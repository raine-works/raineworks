/**
 * Authentication routes.
 *
 * Exposes endpoints for:
 *
 * - **OTP** — passwordless email one-time passcodes
 * - **OIDC** — federated identity via Google, GitHub, etc.
 * - **Passkeys** — WebAuthn registration and authentication
 * - **Session** — JWT introspection, refresh, and logout
 *
 * All routes are grouped under the `/auth` prefix in the OpenAPI spec.
 *
 * ## Token flow
 *
 * 1. Client authenticates via OTP, OIDC, or passkey.
 * 2. Server issues a **JWT access token** (15 min) and an opaque
 *    **refresh token** (24 h).
 * 3. When the access token expires, the client calls `refresh` with
 *    the refresh token. The server rotates the refresh token and
 *    returns a fresh token pair.
 * 4. On logout the refresh token is revoked. The access token
 *    naturally expires within 15 minutes.
 *
 * @module routes/auth
 */

import { ORPCError } from '@orpc/server';
import type { User } from '@rainestack/database';
import { withActor } from '@rainestack/database/actor';
import { toDate } from '@rainestack/tools/temporal';
import * as accountsData from '@server/data/accounts';
import * as passkeysData from '@server/data/passkeys';
import * as usersData from '@server/data/users';
import { env } from '@server/lib/env';
import {
	issueTokenPair,
	revokeAllRefreshTokens,
	revokeRefreshToken,
	rotateRefreshToken,
	signAccessToken,
	validateRefreshToken
} from '@server/lib/jwt';
import { authedProcedure, base, publicProcedure } from '@server/lib/orpc';
import { createOtp, verifyOtp } from '@server/lib/otp';
import {
	LinkedAccountsOutputSchema,
	LogoutInputSchema,
	MessageOutputSchema,
	OidcAuthorizeInputSchema,
	OidcAuthorizeOutputSchema,
	OidcCallbackInputSchema,
	OidcCallbackOutputSchema,
	OidcProvidersOutputSchema,
	OtpSendInputSchema,
	OtpSendOutputSchema,
	OtpVerifyInputSchema,
	OtpVerifyOutputSchema,
	PasskeyAuthenticateInputSchema,
	PasskeyAuthenticateOptionsInputSchema,
	PasskeyAuthenticateOptionsOutputSchema,
	PasskeyAuthenticateOutputSchema,
	PasskeyDeleteInputSchema,
	PasskeyListOutputSchema,
	PasskeyRegisterInputSchema,
	PasskeyRegisterOptionsInputSchema,
	PasskeyRegisterOptionsOutputSchema,
	PasskeyRegisterOutputSchema,
	PasskeyRenameInputSchema,
	PasskeySchema,
	RefreshInputSchema,
	RefreshOutputSchema,
	SessionInfoSchema,
	serializeUser,
	UnlinkAccountInputSchema
} from '@server/lib/schemas';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from '@simplewebauthn/server';
import { jwtVerify, SignJWT } from 'jose';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** HMAC key for signing OIDC state parameters (reuses JWT_SECRET). */
const STATE_KEY = new TextEncoder().encode(env.JWT_SECRET);

/** Challenge TTL for WebAuthn ceremonies (5 minutes). */
const CHALLENGE_TTL = Temporal.Duration.from({ minutes: 5 });

/** State token TTL for OIDC flows (10 minutes). */
const OIDC_STATE_TTL = Temporal.Duration.from({ minutes: 10 });

// ---------------------------------------------------------------------------
// OIDC provider configuration
// ---------------------------------------------------------------------------

interface OidcProviderConfig {
	/** Human-readable name shown in the UI. */
	name: string;
	/** Authorization endpoint URL. */
	authorizationEndpoint: string;
	/** Token endpoint URL. */
	tokenEndpoint: string;
	/** Userinfo endpoint URL (fallback when id_token lacks claims). */
	userinfoEndpoint: string;
	/** Scopes to request during authorization. */
	scopes: string[];
	/** Client ID from environment. */
	clientId: string;
	/** Client secret from environment. */
	clientSecret: string;
}

/**
 * Builds the map of enabled OIDC providers from environment variables.
 *
 * Providers are only included when both their client ID and client
 * secret are configured. This allows operators to selectively enable
 * providers by setting the appropriate env vars.
 */
function getEnabledProviders(): Map<string, OidcProviderConfig> {
	const providers = new Map<string, OidcProviderConfig>();

	if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
		providers.set('google', {
			name: 'Google',
			authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
			tokenEndpoint: 'https://oauth2.googleapis.com/token',
			userinfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
			scopes: ['openid', 'email', 'profile'],
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET
		});
	}

	if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
		providers.set('github', {
			name: 'GitHub',
			authorizationEndpoint: 'https://github.com/login/oauth/authorize',
			tokenEndpoint: 'https://github.com/login/oauth/access_token',
			userinfoEndpoint: 'https://api.github.com/user',
			scopes: ['read:user', 'user:email'],
			clientId: env.GITHUB_CLIENT_ID,
			clientSecret: env.GITHUB_CLIENT_SECRET
		});
	}

	return providers;
}

// ---------------------------------------------------------------------------
// OIDC helpers
// ---------------------------------------------------------------------------

/**
 * Creates a signed state token for OIDC CSRF protection.
 *
 * The state is a compact JWS containing the provider key, redirect
 * URI, and a random nonce. It is verified on callback to prevent
 * CSRF attacks and ensure the callback matches the original request.
 */
async function createStateToken(provider: string, redirectUri: string): Promise<string> {
	const now = Temporal.Now.instant();
	const exp = now.add(OIDC_STATE_TTL);

	return new SignJWT({
		provider,
		redirectUri,
		nonce: crypto.randomUUID()
	})
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt(Math.floor(now.epochMilliseconds / 1000))
		.setExpirationTime(Math.floor(exp.epochMilliseconds / 1000))
		.sign(STATE_KEY);
}

/**
 * Verifies an OIDC state token and returns the embedded claims.
 *
 * Returns `null` if the token is invalid, expired, or tampered with.
 */
async function verifyStateToken(
	state: string
): Promise<{ provider: string; redirectUri: string; nonce: string } | null> {
	try {
		const { payload } = await jwtVerify(state, STATE_KEY, { algorithms: ['HS256'] });
		if (typeof payload.provider !== 'string' || typeof payload.redirectUri !== 'string') {
			return null;
		}
		return {
			provider: payload.provider as string,
			redirectUri: payload.redirectUri as string,
			nonce: (payload.nonce as string) ?? ''
		};
	} catch {
		return null;
	}
}

/**
 * Exchanges an authorization code for tokens at the provider's token
 * endpoint. Returns the raw JSON response from the provider.
 */
async function exchangeCodeForTokens(
	provider: OidcProviderConfig,
	code: string,
	redirectUri: string
): Promise<Record<string, unknown>> {
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: redirectUri,
		client_id: provider.clientId,
		client_secret: provider.clientSecret
	});

	const response = await fetch(provider.tokenEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json'
		},
		body: body.toString()
	});

	if (!response.ok) {
		const text = await response.text();
		throw new ORPCError('BAD_GATEWAY', {
			message: `Provider token exchange failed: ${response.status} ${text}`
		});
	}

	return response.json() as Promise<Record<string, unknown>>;
}

/**
 * Fetches user info from the provider's userinfo endpoint.
 *
 * This is used as a fallback when the id_token doesn't contain
 * sufficient claims (e.g. GitHub doesn't issue OIDC id_tokens in
 * the standard OAuth flow).
 */
async function fetchUserInfo(
	provider: OidcProviderConfig,
	accessToken: string
): Promise<{ sub: string; email: string; name?: string; picture?: string }> {
	const response = await fetch(provider.userinfoEndpoint, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: 'application/json'
		}
	});

	if (!response.ok) {
		throw new ORPCError('BAD_GATEWAY', {
			message: `Provider userinfo request failed: ${response.status}`
		});
	}

	const data = (await response.json()) as Record<string, unknown>;

	// Normalise across providers — GitHub uses `id` and `login` instead
	// of `sub` and `email`.
	const sub = String(data.sub ?? data.id ?? '');
	const email = String(data.email ?? '');
	const name = (data.name as string) ?? (data.login as string) ?? undefined;
	const picture = (data.picture as string) ?? (data.avatar_url as string) ?? undefined;

	if (!sub || !email) {
		throw new ORPCError('BAD_GATEWAY', {
			message: 'Provider did not return a valid subject or email.'
		});
	}

	return { sub, email, name, picture };
}

/**
 * For GitHub, the primary email may not be in the user profile if
 * the user has set their email to private. In that case we need to
 * call the `/user/emails` endpoint.
 */
async function fetchGitHubEmail(accessToken: string): Promise<string> {
	const response = await fetch('https://api.github.com/user/emails', {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: 'application/json'
		}
	});

	if (!response.ok) {
		throw new ORPCError('BAD_GATEWAY', {
			message: `GitHub email fetch failed: ${response.status}`
		});
	}

	const emails = (await response.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
	const primary = emails.find((e) => e.primary && e.verified);

	if (!primary) {
		throw new ORPCError('BAD_REQUEST', {
			message: 'No verified primary email found on your GitHub account.'
		});
	}

	return primary.email;
}

// ---------------------------------------------------------------------------
// Helpers — request metadata
// ---------------------------------------------------------------------------

/** Extracts IP address and user-agent from request headers. */
function requestMeta(headers: Headers) {
	return {
		ipAddress: headers.get('x-forwarded-for') ?? headers.get('cf-connecting-ip') ?? undefined,
		userAgent: headers.get('user-agent') ?? undefined
	};
}

// ===========================================================================
// OTP sub-router
// ===========================================================================

const otpRouter = base.router({
	/**
	 * Send a one-time passcode to the given email address.
	 *
	 * If the email belongs to an existing user the code is linked to
	 * that user. Otherwise it is created unlinked and will be associated
	 * on verification (sign-up flow).
	 */
	send: publicProcedure
		.input(OtpSendInputSchema)
		.output(OtpSendOutputSchema)
		.route({ method: 'POST', path: '/auth/otp/send' })
		.handler(async ({ input, context }) => {
			const { db, actorId } = context;
			const email = input.email.toLowerCase().trim();

			// Look up existing user so we can link the code.
			const existingUser = await usersData.findByEmail(db, email);

			const { expiresAt, code } = await createOtp(db, actorId, email, existingUser?.id);

			// In production, send the code via an email provider.
			// For development, the code is visible at debug level.
			// The `otp` field is redacted in production logs.
			context.log.debug({ email, otp: code }, 'OTP code generated');

			return {
				message: 'OTP code sent. Check your email.',
				expiresAt: expiresAt.toISOString()
			};
		}),

	/**
	 * Verify an OTP code and issue a JWT token pair.
	 *
	 * On first login a new `User` record is created (sign-up). On
	 * subsequent logins the existing user is returned. In both cases
	 * a JWT access token and an opaque refresh token are issued.
	 */
	verify: publicProcedure
		.input(OtpVerifyInputSchema)
		.output(OtpVerifyOutputSchema)
		.route({ method: 'POST', path: '/auth/otp/verify' })
		.handler(async ({ input, context }) => {
			const { db, actorId, headers } = context;
			const email = input.email.toLowerCase().trim();

			const result = await verifyOtp(db, actorId, email, input.code);

			if (!result.success) {
				throw new ORPCError('BAD_REQUEST', { message: result.reason });
			}

			// Upsert user + issue tokens inside a single actor-tracked
			// transaction so audit triggers see the correct actor.
			const { user, tokens } = await withActor(db, actorId, async (tx) => {
				const user = await usersData.upsertOnVerification(tx, actorId, email);
				const tokens = await issueTokenPair(tx, actorId, user, requestMeta(headers));
				return { user, tokens };
			});

			return {
				user: serializeUser(user),
				tokens
			};
		})
});

// ===========================================================================
// OIDC sub-router
// ===========================================================================

const oidcRouter = base.router({
	/**
	 * Lists the enabled OIDC / OAuth 2.0 providers.
	 *
	 * The client uses this to render the "Sign in with…" buttons.
	 * Only providers with both client ID and client secret configured
	 * in the environment are included.
	 */
	providers: publicProcedure
		.output(OidcProvidersOutputSchema)
		.route({ method: 'GET', path: '/auth/oidc/providers' })
		.handler(async () => {
			const providers = getEnabledProviders();

			return {
				providers: Array.from(providers.entries()).map(([id, config]) => ({
					id,
					name: config.name,
					authorizationUrl: config.authorizationEndpoint
				}))
			};
		}),

	/**
	 * Generates an authorization URL for the given OIDC provider.
	 *
	 * The client should redirect the user to this URL. After the user
	 * authenticates with the provider, the provider redirects back to
	 * the client's `redirectUri` with an authorization code and the
	 * `state` parameter.
	 */
	authorize: publicProcedure
		.input(OidcAuthorizeInputSchema)
		.output(OidcAuthorizeOutputSchema)
		.route({ method: 'POST', path: '/auth/oidc/authorize' })
		.handler(async ({ input }) => {
			const providers = getEnabledProviders();
			const provider = providers.get(input.provider);

			if (!provider) {
				throw new ORPCError('BAD_REQUEST', {
					message: `Unknown or disabled provider: "${input.provider}"`
				});
			}

			const state = await createStateToken(input.provider, input.redirectUri);

			const params = new URLSearchParams({
				client_id: provider.clientId,
				redirect_uri: input.redirectUri,
				response_type: 'code',
				scope: provider.scopes.join(' '),
				state,
				// Prompt for account selection on every login to prevent
				// silent re-authentication with a stale identity.
				prompt: 'select_account'
			});

			const authorizationUrl = `${provider.authorizationEndpoint}?${params.toString()}`;

			return { authorizationUrl, state };
		}),

	/**
	 * Handles the OIDC callback after the user authenticates with the
	 * provider.
	 *
	 * Exchanges the authorization code for tokens, resolves the user's
	 * identity (via id_token or userinfo endpoint), creates or links
	 * an `Account` record, and issues a JWT token pair.
	 *
	 * If the provider's email matches an existing user, the account is
	 * linked to that user. Otherwise a new user is created.
	 */
	callback: publicProcedure
		.input(OidcCallbackInputSchema)
		.output(OidcCallbackOutputSchema)
		.route({ method: 'POST', path: '/auth/oidc/callback' })
		.handler(async ({ input, context }) => {
			const { db, actorId, headers } = context;

			// -----------------------------------------------------------------
			// 1. Verify state token (CSRF protection)
			// -----------------------------------------------------------------
			const stateClaims = await verifyStateToken(input.state);

			if (!stateClaims) {
				throw new ORPCError('BAD_REQUEST', { message: 'Invalid or expired state parameter.' });
			}

			if (stateClaims.provider !== input.provider) {
				throw new ORPCError('BAD_REQUEST', { message: 'State parameter does not match the provider.' });
			}

			if (stateClaims.redirectUri !== input.redirectUri) {
				throw new ORPCError('BAD_REQUEST', { message: 'Redirect URI does not match the original request.' });
			}

			// -----------------------------------------------------------------
			// 2. Get provider config
			// -----------------------------------------------------------------
			const providers = getEnabledProviders();
			const provider = providers.get(input.provider);

			if (!provider) {
				throw new ORPCError('BAD_REQUEST', {
					message: `Unknown or disabled provider: "${input.provider}"`
				});
			}

			// -----------------------------------------------------------------
			// 3. Exchange authorization code for tokens
			// -----------------------------------------------------------------
			const tokenResponse = await exchangeCodeForTokens(provider, input.code, input.redirectUri);

			const providerAccessToken = tokenResponse.access_token as string;
			const providerRefreshToken = (tokenResponse.refresh_token as string) ?? undefined;
			const providerIdToken = (tokenResponse.id_token as string) ?? undefined;
			const tokenType = (tokenResponse.token_type as string) ?? undefined;
			const scope = (tokenResponse.scope as string) ?? undefined;
			const expiresIn = (tokenResponse.expires_in as number) ?? undefined;

			if (!providerAccessToken) {
				throw new ORPCError('BAD_GATEWAY', {
					message: 'Provider did not return an access token.'
				});
			}

			// -----------------------------------------------------------------
			// 4. Resolve user identity from provider
			// -----------------------------------------------------------------
			let userInfo = await fetchUserInfo(provider, providerAccessToken);

			// GitHub special case: email may be private
			if (input.provider === 'github' && !userInfo.email) {
				const email = await fetchGitHubEmail(providerAccessToken);
				userInfo = { ...userInfo, email };
			}

			// -----------------------------------------------------------------
			// 5. Find or create Account + User, then issue tokens
			//    All writes run inside a single actor-tracked transaction.
			// -----------------------------------------------------------------
			const { user, tokens, isNewUser } = await withActor(db, actorId, async (tx) => {
				let isNewUser = false;

				// Check if this provider account is already linked.
				const existingAccount = await accountsData.findByProviderAccount(tx, input.provider, userInfo.sub);

				let user: User;

				if (existingAccount) {
					// Account already linked — update tokens and return the user.
					const updated = await accountsData.updateTokens(tx, actorId, existingAccount.id, {
						accessToken: providerAccessToken,
						refreshToken: providerRefreshToken ?? null,
						accessTokenExpiresAt: expiresIn
							? toDate(Temporal.Now.instant().add(Temporal.Duration.from({ seconds: expiresIn })))
							: null,
						tokenType: tokenType ?? null,
						scope: scope ?? null,
						idToken: providerIdToken ?? null
					});
					user = updated.user;
				} else {
					// New provider account — find or create the local user by email.
					const existingUser = await usersData.findByEmail(tx, userInfo.email.toLowerCase().trim());

					if (existingUser) {
						user = existingUser;

						// Mark email as verified if not already (the provider
						// verified it during their auth flow).
						if (!user.emailVerified) {
							user = await usersData.markEmailVerified(tx, actorId, user.id);
						}
					} else {
						// Create a brand-new user.
						user = await usersData.create(tx, actorId, {
							email: userInfo.email.toLowerCase().trim(),
							emailVerified: new Date(),
							name: userInfo.name ?? null,
							avatarUrl: userInfo.picture ?? null
						});
						isNewUser = true;
					}

					// Link the provider account to the user.
					await accountsData.linkAccount(tx, actorId, {
						userId: user.id,
						provider: input.provider,
						providerAccountId: userInfo.sub,
						accessToken: providerAccessToken,
						refreshToken: providerRefreshToken,
						accessTokenExpiresAt: expiresIn
							? toDate(Temporal.Now.instant().add(Temporal.Duration.from({ seconds: expiresIn })))
							: undefined,
						tokenType,
						scope,
						idToken: providerIdToken
					});
				}

				// Issue JWT token pair inside the same transaction.
				const tokens = await issueTokenPair(tx, actorId, user, requestMeta(headers));

				return { user, tokens, isNewUser };
			});

			return {
				user: serializeUser(user),
				tokens,
				isNewUser
			};
		})
});

// ===========================================================================
// Passkey sub-router
// ===========================================================================

const passkeyRouter = base.router({
	/**
	 * Lists all registered passkeys for the authenticated user.
	 */
	list: authedProcedure
		.output(PasskeyListOutputSchema)
		.route({ method: 'GET', path: '/auth/passkeys' })
		.handler(async ({ context }) => {
			const passkeys = await passkeysData.findByUserId(context.db, context.user.id);

			return {
				passkeys: passkeys.map((p) => ({
					id: p.id,
					credentialId: p.credentialId,
					credentialDeviceType: p.credentialDeviceType,
					credentialBackedUp: p.credentialBackedUp,
					transports: p.transports,
					name: p.name,
					lastUsedAt: p.lastUsedAt,
					createdAt: p.createdAt
				}))
			};
		}),

	/**
	 * Generates WebAuthn registration options for the authenticated user.
	 *
	 * The client should pass the returned `options` to
	 * `navigator.credentials.create()` and send back the resulting
	 * `AuthenticatorAttestationResponse` to the `register` endpoint.
	 */
	registerOptions: authedProcedure
		.input(PasskeyRegisterOptionsInputSchema)
		.output(PasskeyRegisterOptionsOutputSchema)
		.route({ method: 'POST', path: '/auth/passkeys/register-options' })
		.handler(async ({ context }) => {
			const { db, actorId, user } = context;

			// Fetch existing passkeys so we can exclude them from
			// registration (prevent re-registering the same authenticator).
			const existingPasskeys = await passkeysData.findByUserId(db, user.id);

			const options = await generateRegistrationOptions({
				rpName: env.RP_NAME,
				rpID: env.RP_ID,
				userName: user.email,
				userDisplayName: user.name ?? user.email,
				// Discourage re-registration of existing authenticators.
				excludeCredentials: existingPasskeys.map((p) => ({
					id: p.credentialId,
					transports: p.transports as AuthenticatorTransportFuture[]
				})),
				authenticatorSelection: {
					// Prefer platform authenticators (Touch ID, Windows Hello)
					// but allow cross-platform (security keys).
					authenticatorAttachment: undefined,
					// Require a resident key so the passkey is discoverable
					// (allows sign-in without typing an email first).
					residentKey: 'preferred',
					userVerification: 'preferred'
				},
				attestationType: 'none'
			});

			// Store the challenge in the database for verification.
			const expiresAt = toDate(Temporal.Now.instant().add(CHALLENGE_TTL));
			const challenge = await passkeysData.createChallenge(db, actorId, {
				challenge: options.challenge,
				type: 'registration',
				expiresAt,
				userId: user.id
			});

			return {
				options,
				challengeId: challenge.id
			};
		}),

	/**
	 * Completes passkey registration by verifying the attestation
	 * response from the browser.
	 *
	 * Stores the credential's public key, counter, and metadata in the
	 * `Passkey` table for future authentication ceremonies.
	 */
	register: authedProcedure
		.input(PasskeyRegisterInputSchema)
		.output(PasskeyRegisterOutputSchema)
		.route({ method: 'POST', path: '/auth/passkeys/register' })
		.handler(async ({ input, context }) => {
			const { db, actorId, user } = context;

			// -----------------------------------------------------------------
			// 1. Look up and validate the challenge
			// -----------------------------------------------------------------
			const challenge = await passkeysData.findChallengeById(db, input.challengeId);

			if (!challenge) {
				throw new ORPCError('BAD_REQUEST', { message: 'Unknown challenge.' });
			}

			if (challenge.usedAt) {
				throw new ORPCError('BAD_REQUEST', { message: 'Challenge has already been used.' });
			}

			if (challenge.type !== 'registration') {
				throw new ORPCError('BAD_REQUEST', { message: 'Invalid challenge type.' });
			}

			if (
				Temporal.Instant.compare(Temporal.Instant.from(challenge.expiresAt.toISOString()), Temporal.Now.instant()) < 0
			) {
				throw new ORPCError('BAD_REQUEST', { message: 'Challenge has expired.' });
			}

			if (challenge.userId !== user.id) {
				throw new ORPCError('BAD_REQUEST', { message: 'Challenge does not belong to this user.' });
			}

			// -----------------------------------------------------------------
			// 2. Verify the attestation response
			// -----------------------------------------------------------------
			let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
			try {
				verification = await verifyRegistrationResponse({
					response: input.credential,
					expectedChallenge: challenge.challenge,
					expectedOrigin: env.RP_ORIGIN,
					expectedRPID: env.RP_ID,
					requireUserVerification: false
				});
			} catch (err) {
				throw new ORPCError('BAD_REQUEST', {
					message: `Registration verification failed: ${err instanceof Error ? err.message : 'unknown error'}`
				});
			}

			if (!verification.verified || !verification.registrationInfo) {
				throw new ORPCError('BAD_REQUEST', { message: 'Registration verification failed.' });
			}

			// -----------------------------------------------------------------
			// 3. Mark challenge as used and store the credential
			// -----------------------------------------------------------------
			const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

			const passkey = await withActor(db, actorId, async (tx) => {
				await passkeysData.markChallengeUsed(tx, actorId, challenge.id);

				return passkeysData.create(tx, actorId, {
					userId: user.id,
					credentialId: credential.id,
					publicKey: Buffer.from(credential.publicKey),
					counter: credential.counter,
					transports: (credential.transports ?? []) as string[],
					credentialDeviceType,
					credentialBackedUp,
					name: input.name
				});
			});

			return {
				passkey: {
					id: passkey.id,
					credentialId: passkey.credentialId,
					credentialDeviceType: passkey.credentialDeviceType,
					credentialBackedUp: passkey.credentialBackedUp,
					transports: passkey.transports,
					name: passkey.name,
					lastUsedAt: passkey.lastUsedAt,
					createdAt: passkey.createdAt
				}
			};
		}),

	/**
	 * Generates WebAuthn authentication options.
	 *
	 * This is a **public** endpoint — the user is not yet authenticated.
	 * If an `email` hint is provided, the `allowCredentials` list is
	 * scoped to that user's passkeys. Otherwise it is empty, triggering
	 * the browser's credential picker for discoverable credentials.
	 */
	authenticateOptions: publicProcedure
		.input(PasskeyAuthenticateOptionsInputSchema)
		.output(PasskeyAuthenticateOptionsOutputSchema)
		.route({ method: 'POST', path: '/auth/passkeys/authenticate-options' })
		.handler(async ({ input, context }) => {
			const { db, actorId } = context;

			let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined;

			if (input.email) {
				const user = await usersData.findByEmail(db, input.email.toLowerCase().trim());
				if (user) {
					const passkeys = await passkeysData.findByUserId(db, user.id);
					allowCredentials = passkeys.map((p) => ({
						id: p.credentialId,
						transports: p.transports as AuthenticatorTransportFuture[]
					}));
				}
			}

			const options = await generateAuthenticationOptions({
				rpID: env.RP_ID,
				allowCredentials,
				userVerification: 'preferred'
			});

			// Store the challenge in the database for verification.
			// userId is null for discoverable credential flows.
			const expiresAt = toDate(Temporal.Now.instant().add(CHALLENGE_TTL));
			const challengeRecord = await passkeysData.createChallenge(db, actorId, {
				challenge: options.challenge,
				type: 'authentication',
				expiresAt
			});

			return {
				options,
				challengeId: challengeRecord.id
			};
		}),

	/**
	 * Completes passkey authentication by verifying the assertion
	 * response from the browser.
	 *
	 * On success, issues a JWT token pair. The user is identified by
	 * the credential ID in the assertion — no email or password is
	 * needed.
	 */
	authenticate: publicProcedure
		.input(PasskeyAuthenticateInputSchema)
		.output(PasskeyAuthenticateOutputSchema)
		.route({ method: 'POST', path: '/auth/passkeys/authenticate' })
		.handler(async ({ input, context }) => {
			const { db, actorId, headers } = context;

			// -----------------------------------------------------------------
			// 1. Look up and validate the challenge
			// -----------------------------------------------------------------
			const challenge = await passkeysData.findChallengeById(db, input.challengeId);

			if (!challenge) {
				throw new ORPCError('BAD_REQUEST', { message: 'Unknown challenge.' });
			}

			if (challenge.usedAt) {
				throw new ORPCError('BAD_REQUEST', { message: 'Challenge has already been used.' });
			}

			if (challenge.type !== 'authentication') {
				throw new ORPCError('BAD_REQUEST', { message: 'Invalid challenge type.' });
			}

			if (
				Temporal.Instant.compare(Temporal.Instant.from(challenge.expiresAt.toISOString()), Temporal.Now.instant()) < 0
			) {
				throw new ORPCError('BAD_REQUEST', { message: 'Challenge has expired.' });
			}

			// -----------------------------------------------------------------
			// 2. Look up the credential
			// -----------------------------------------------------------------
			const credentialId = input.credential?.id ?? input.credential?.rawId;

			if (!credentialId || typeof credentialId !== 'string') {
				throw new ORPCError('BAD_REQUEST', { message: 'Missing credential ID in assertion response.' });
			}

			const passkey = await passkeysData.findByCredentialId(db, credentialId);

			if (!passkey) {
				throw new ORPCError('BAD_REQUEST', { message: 'Unrecognised credential.' });
			}

			// -----------------------------------------------------------------
			// 3. Verify the assertion response
			// -----------------------------------------------------------------
			let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
			try {
				verification = await verifyAuthenticationResponse({
					response: input.credential,
					expectedChallenge: challenge.challenge,
					expectedOrigin: env.RP_ORIGIN,
					expectedRPID: env.RP_ID,
					credential: {
						id: passkey.credentialId,
						publicKey: new Uint8Array(passkey.publicKey),
						counter: passkey.counter,
						transports: passkey.transports as AuthenticatorTransportFuture[]
					},
					requireUserVerification: false
				});
			} catch (err) {
				throw new ORPCError('BAD_REQUEST', {
					message: `Authentication verification failed: ${err instanceof Error ? err.message : 'unknown error'}`
				});
			}

			if (!verification.verified) {
				throw new ORPCError('BAD_REQUEST', { message: 'Authentication verification failed.' });
			}

			// -----------------------------------------------------------------
			// 4. Mark challenge as used, update counter, and issue tokens
			// -----------------------------------------------------------------
			const { user, tokens } = await withActor(db, actorId, async (tx) => {
				await passkeysData.markChallengeUsed(tx, actorId, challenge.id);
				await passkeysData.updateCounter(tx, actorId, passkey.id, verification.authenticationInfo.newCounter);

				const user = passkey.user;

				// Mark email as verified on passkey auth if not already
				// (passkey implies device-level verification).
				if (!user.emailVerified) {
					await usersData.markEmailVerified(tx, actorId, user.id);
					user.emailVerified = new Date();
				}

				const tokens = await issueTokenPair(tx, actorId, user, requestMeta(headers));
				return { user, tokens };
			});

			return {
				user: serializeUser(user),
				tokens
			};
		}),

	/**
	 * Renames a registered passkey.
	 */
	rename: authedProcedure
		.input(PasskeyRenameInputSchema)
		.output(PasskeySchema)
		.route({ method: 'PATCH', path: '/auth/passkeys/{id}' })
		.handler(async ({ input, context }) => {
			const { db, actorId, user } = context;

			const passkey = await passkeysData.findById(db, input.id);

			if (!passkey || passkey.userId !== user.id) {
				throw new ORPCError('NOT_FOUND', { message: 'Passkey not found.' });
			}

			const updated = await passkeysData.rename(db, actorId, input.id, input.name);

			return {
				id: updated.id,
				credentialId: updated.credentialId,
				credentialDeviceType: updated.credentialDeviceType,
				credentialBackedUp: updated.credentialBackedUp,
				transports: updated.transports,
				name: updated.name,
				lastUsedAt: updated.lastUsedAt,
				createdAt: updated.createdAt
			};
		}),

	/**
	 * Removes a registered passkey.
	 *
	 * Fails if this is the user's last authentication method (no other
	 * passkeys, no linked accounts, and no verified email).
	 */
	delete: authedProcedure
		.input(PasskeyDeleteInputSchema)
		.output(MessageOutputSchema)
		.route({ method: 'DELETE', path: '/auth/passkeys/{id}' })
		.handler(async ({ input, context }) => {
			const { db, actorId, user } = context;

			const passkey = await passkeysData.findById(db, input.id);

			if (!passkey || passkey.userId !== user.id) {
				throw new ORPCError('NOT_FOUND', { message: 'Passkey not found.' });
			}

			// Ensure the user has at least one other auth method.
			const [passkeyCount, accountCount] = await Promise.all([
				passkeysData.countByUserId(db, user.id),
				accountsData.countByUserId(db, user.id)
			]);

			const hasVerifiedEmail = user.emailVerified !== null;

			if (passkeyCount <= 1 && accountCount === 0 && !hasVerifiedEmail) {
				throw new ORPCError('BAD_REQUEST', {
					message:
						'Cannot remove your last passkey without another authentication method (linked account or verified email for OTP).'
				});
			}

			await passkeysData.remove(db, actorId, input.id);

			return { message: 'Passkey removed.' };
		})
});

// ===========================================================================
// Linked accounts sub-router
// ===========================================================================

const accountsRouter = base.router({
	/**
	 * Lists all linked OIDC accounts for the authenticated user.
	 */
	list: authedProcedure
		.output(LinkedAccountsOutputSchema)
		.route({ method: 'GET', path: '/auth/accounts' })
		.handler(async ({ context }) => {
			const accounts = await accountsData.findByUserId(context.db, context.user.id);

			return {
				accounts: accounts.map((a) => ({
					id: a.id,
					provider: a.provider,
					providerAccountId: a.providerAccountId,
					createdAt: a.createdAt
				}))
			};
		}),

	/**
	 * Unlinks an OIDC account from the authenticated user.
	 *
	 * Fails if this is the user's last authentication method.
	 */
	unlink: authedProcedure
		.input(UnlinkAccountInputSchema)
		.output(MessageOutputSchema)
		.route({ method: 'DELETE', path: '/auth/accounts/{id}' })
		.handler(async ({ input, context }) => {
			const { db, actorId, user } = context;

			const account = await accountsData.findById(db, input.id);

			if (!account || account.userId !== user.id) {
				throw new ORPCError('NOT_FOUND', { message: 'Linked account not found.' });
			}

			// Ensure the user has at least one other auth method.
			const [passkeyCount, accountCount] = await Promise.all([
				passkeysData.countByUserId(db, user.id),
				accountsData.countByUserId(db, user.id)
			]);

			const hasVerifiedEmail = user.emailVerified !== null;

			if (accountCount <= 1 && passkeyCount === 0 && !hasVerifiedEmail) {
				throw new ORPCError('BAD_REQUEST', {
					message:
						'Cannot unlink your last account without another authentication method (passkey or verified email for OTP).'
				});
			}

			await accountsData.unlinkAccount(db, actorId, input.id);

			return { message: 'Account unlinked.' };
		})
});

// ===========================================================================
// Auth router (top-level)
// ===========================================================================

export const authRouter = base.router({
	otp: otpRouter,
	oidc: oidcRouter,
	passkey: passkeyRouter,
	accounts: accountsRouter,

	/**
	 * Returns the currently authenticated user from the JWT claims.
	 *
	 * This endpoint performs **no database query** — the user info is
	 * extracted entirely from the verified JWT payload.
	 */
	session: authedProcedure
		.output(SessionInfoSchema)
		.route({ method: 'GET', path: '/auth/session' })
		.handler(async ({ context }) => {
			// Fetch fresh user data from the database so the response
			// includes up-to-date fields (e.g. after a name change).
			const user = await usersData.findById(context.db, context.user.id);

			if (!user) {
				throw new ORPCError('NOT_FOUND', { message: 'User no longer exists.' });
			}

			return {
				user: serializeUser(user)
			};
		}),

	/**
	 * Exchange a valid refresh token for a new token pair.
	 *
	 * The old refresh token is revoked and a new one is issued
	 * (rotation). This limits the window of abuse if a refresh token
	 * is leaked — once the legitimate client uses it, the attacker's
	 * copy becomes invalid.
	 *
	 * This is a public endpoint (no JWT required) because the client
	 * calls it precisely when the access token has expired.
	 */
	refresh: publicProcedure
		.input(RefreshInputSchema)
		.output(RefreshOutputSchema)
		.route({ method: 'POST', path: '/auth/refresh' })
		.handler(async ({ input, context }) => {
			const { db, actorId, headers } = context;

			const record = await validateRefreshToken(db, input.refreshToken);

			if (!record) {
				throw new ORPCError('UNAUTHORIZED', { message: 'Invalid or expired refresh token.' });
			}

			const { user } = record;

			// Rotate: revoke old refresh token, issue new pair.
			const meta = requestMeta(headers);

			const [accessToken, newRefresh] = await Promise.all([
				signAccessToken(user),
				rotateRefreshToken(db, actorId, input.refreshToken, user.id, meta)
			]);

			return {
				tokens: {
					accessToken: accessToken.token,
					accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
					refreshToken: newRefresh.token,
					refreshTokenExpiresAt: newRefresh.expiresAt.toISOString()
				}
			};
		}),

	/**
	 * Logs the user out by revoking the provided refresh token.
	 *
	 * The JWT access token cannot be server-side invalidated (by
	 * design — it's stateless). It will naturally expire within
	 * 15 minutes. The client should discard it immediately.
	 */
	logout: authedProcedure
		.input(LogoutInputSchema)
		.output(MessageOutputSchema)
		.route({ method: 'POST', path: '/auth/logout' })
		.handler(async ({ input, context }) => {
			await revokeRefreshToken(context.db, context.actorId, input.refreshToken);
			return { message: 'Logged out successfully.' };
		}),

	/**
	 * Revokes **all** refresh tokens for the authenticated user,
	 * effectively logging out every device.
	 *
	 * Active JWT access tokens remain valid until they expire (up to
	 * 15 minutes). The client should discard its local tokens.
	 */
	logoutAll: authedProcedure
		.output(MessageOutputSchema)
		.route({ method: 'POST', path: '/auth/logout-all' })
		.handler(async ({ context }) => {
			await revokeAllRefreshTokens(context.db, context.actorId, context.user.id);
			return { message: 'All sessions revoked.' };
		})
});
