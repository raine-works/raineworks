/**
 * Zod schemas for API request/response validation.
 *
 * Every oRPC route uses these schemas for input validation and output
 * serialisation. Keeping them in a single module ensures consistent
 * naming, coercion rules, and documentation across all endpoints.
 *
 * ## Naming conventions
 *
 * | Suffix     | Purpose                                      |
 * |------------|----------------------------------------------|
 * | `Schema`   | Full model shape (used for outputs / selects) |
 * | `Input`    | Create/update payloads from the client        |
 * | `Params`   | Path/query parameters (IDs, filters, etc.)    |
 *
 * @module lib/schemas
 */

import type { User } from '@rainestack/database';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const UserRoleSchema = z.enum(['USER', 'ADMIN']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const PostStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export type PostStatus = z.infer<typeof PostStatusSchema>;

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

/** Reusable CUID identifier param. */
export const IdParamsSchema = z.object({
	id: z.string().min(1, 'ID is required')
});

/** Reusable slug param. */
export const SlugParamsSchema = z.object({
	slug: z.string().min(1, 'Slug is required')
});

/** Standard pagination parameters. */
export const PaginationParamsSchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20)
});

/** Paginated list metadata included in every list response. */
export const PaginationMetaSchema = z.object({
	page: z.number(),
	limit: z.number(),
	total: z.number(),
	totalPages: z.number()
});

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

/** Full User shape returned by the API. */
export const UserSchema = z.object({
	id: z.string(),
	email: z.email(),
	emailVerified: z.coerce.date().nullable(),
	name: z.string().nullable(),
	avatarUrl: z.url().nullable(),
	role: UserRoleSchema,
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});

/** Input for creating a new user. */
export const CreateUserInputSchema = z.object({
	email: z.email('Invalid email address'),
	name: z.string().min(1, 'Name must not be empty').max(255).optional(),
	avatarUrl: z.url('Invalid avatar URL').optional(),
	role: UserRoleSchema.optional()
});

/** Input for updating an existing user. */
export const UpdateUserInputSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(255).optional(),
	avatarUrl: z.url().nullable().optional(),
	role: UserRoleSchema.optional()
});

/** User list response. */
export const UserListSchema = z.object({
	users: z.array(UserSchema),
	pagination: PaginationMetaSchema
});

/** Params for listing users. */
export const ListUsersParamsSchema = PaginationParamsSchema.extend({
	role: UserRoleSchema.optional(),
	search: z.string().optional()
});

// ---------------------------------------------------------------------------
// Post
// ---------------------------------------------------------------------------

/** Full Post shape returned by the API (with nested author). */
export const PostSchema = z.object({
	id: z.string(),
	title: z.string(),
	slug: z.string(),
	content: z.string().nullable(),
	excerpt: z.string().nullable(),
	status: PostStatusSchema,
	publishedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	authorId: z.string(),
	author: UserSchema.optional()
});

/** Input for creating a new post. */
export const CreatePostInputSchema = z.object({
	title: z.string().min(1, 'Title is required').max(500),
	slug: z
		.string()
		.min(1, 'Slug is required')
		.max(500)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
	content: z.string().optional(),
	excerpt: z.string().max(1000).optional(),
	status: PostStatusSchema.optional()
});

/** Input for updating an existing post. */
export const UpdatePostInputSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).max(500).optional(),
	slug: z
		.string()
		.min(1)
		.max(500)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
		.optional(),
	content: z.string().nullable().optional(),
	excerpt: z.string().max(1000).nullable().optional(),
	status: PostStatusSchema.optional()
});

/** Post list response. */
export const PostListSchema = z.object({
	posts: z.array(PostSchema),
	pagination: PaginationMetaSchema
});

/** Params for listing posts. */
export const ListPostsParamsSchema = PaginationParamsSchema.extend({
	status: PostStatusSchema.optional(),
	authorId: z.string().optional(),
	search: z.string().optional()
});

// ---------------------------------------------------------------------------
// Auth — shared schemas
// ---------------------------------------------------------------------------

/** JWT + refresh token pair returned on login / refresh. */
export const TokenPairSchema = z.object({
	accessToken: z.string().describe('Signed JWT access token (15 min TTL).'),
	accessTokenExpiresAt: z.iso.datetime().describe('ISO-8601 expiry of the access token.'),
	refreshToken: z.string().describe('Opaque refresh token (24 h TTL). Store securely — it cannot be recovered.'),
	refreshTokenExpiresAt: z.iso.datetime().describe('ISO-8601 expiry of the refresh token.')
});

/** Session info returned by the `/auth/session` endpoint. */
export const SessionInfoSchema = z.object({
	user: UserSchema
});

// ---------------------------------------------------------------------------
// Auth — OTP schemas
// ---------------------------------------------------------------------------

export const OtpSendInputSchema = z.object({
	email: z.email('Invalid email address').describe('The email address to send the OTP code to.')
});

export const OtpSendOutputSchema = z.object({
	message: z.string(),
	expiresAt: z.iso.datetime()
});

export const OtpVerifyInputSchema = z.object({
	email: z.email('Invalid email address').describe('The email address the OTP was sent to.'),
	code: z.string().length(6, 'Code must be exactly 6 digits').describe('The 6-digit OTP code received via email.')
});

export const OtpVerifyOutputSchema = z.object({
	user: UserSchema,
	tokens: TokenPairSchema
});

// ---------------------------------------------------------------------------
// Auth — token refresh / logout schemas
// ---------------------------------------------------------------------------

export const RefreshInputSchema = z.object({
	refreshToken: z.string().describe('The opaque refresh token received at login.')
});

export const RefreshOutputSchema = z.object({
	tokens: TokenPairSchema
});

export const LogoutInputSchema = z.object({
	refreshToken: z.string().describe('The refresh token to revoke.')
});

export const MessageOutputSchema = z.object({
	message: z.string()
});

// ---------------------------------------------------------------------------
// Auth — OIDC schemas
// ---------------------------------------------------------------------------

export const OidcProviderSchema = z.object({
	id: z.string().describe('Provider key, e.g. "google", "github".'),
	name: z.string().describe('Human-readable provider name.'),
	authorizationUrl: z.url().describe('Full authorization URL to redirect the user to.')
});

export const OidcProvidersOutputSchema = z.object({
	providers: z.array(OidcProviderSchema)
});

export const OidcAuthorizeInputSchema = z.object({
	provider: z.string().min(1).describe('Provider key, e.g. "google", "github".'),
	redirectUri: z.url().describe('Client-side redirect URI for the callback.')
});

export const OidcAuthorizeOutputSchema = z.object({
	authorizationUrl: z.url().describe('URL to redirect the user to for provider authentication.'),
	state: z.string().describe('Opaque state parameter to include in the callback for CSRF protection.')
});

export const OidcCallbackInputSchema = z.object({
	provider: z.string().min(1).describe('Provider key, e.g. "google", "github".'),
	code: z.string().min(1).describe('Authorization code received from the provider.'),
	state: z.string().min(1).describe('State parameter for CSRF validation.'),
	redirectUri: z.url().describe('Must match the redirect_uri used in the authorization request.')
});

export const OidcCallbackOutputSchema = z.object({
	user: UserSchema,
	tokens: TokenPairSchema,
	isNewUser: z.boolean().describe('Whether a new user account was created during this login.')
});

// ---------------------------------------------------------------------------
// Auth — linked account schemas
// ---------------------------------------------------------------------------

export const LinkedAccountSchema = z.object({
	id: z.string(),
	provider: z.string(),
	providerAccountId: z.string(),
	createdAt: z.coerce.date()
});

export const LinkedAccountsOutputSchema = z.object({
	accounts: z.array(LinkedAccountSchema)
});

export const UnlinkAccountInputSchema = z.object({
	id: z.string().min(1).describe('The CUID of the linked account to remove.')
});

// ---------------------------------------------------------------------------
// Auth — passkey schemas
// ---------------------------------------------------------------------------

export const PasskeySchema = z.object({
	id: z.string(),
	credentialId: z.string(),
	credentialDeviceType: z.string(),
	credentialBackedUp: z.boolean(),
	transports: z.array(z.string()),
	name: z.string(),
	lastUsedAt: z.coerce.date().nullable(),
	createdAt: z.coerce.date()
});

export const PasskeyListOutputSchema = z.object({
	passkeys: z.array(PasskeySchema)
});

export const PasskeyRegisterOptionsInputSchema = z.object({
	/** Optional friendly name for the new passkey. */
	name: z.string().max(255).optional()
});

export const PasskeyRegisterOptionsOutputSchema = z.object({
	/** JSON-serialisable WebAuthn registration options to pass to `navigator.credentials.create()`. */
	options: z.any(),
	/** Challenge ID to send back with the registration response. */
	challengeId: z.string()
});

export const PasskeyRegisterInputSchema = z.object({
	/** The challenge ID received from the register-options endpoint. */
	challengeId: z.string().min(1),
	/** The JSON-serialised `AuthenticatorAttestationResponse` from the browser. */
	credential: z.any(),
	/** Optional friendly name for the passkey. */
	name: z.string().max(255).optional()
});

export const PasskeyRegisterOutputSchema = z.object({
	passkey: PasskeySchema
});

export const PasskeyAuthenticateOptionsInputSchema = z.object({
	/** Optional email hint — if provided, limits `allowCredentials` to this user's passkeys. */
	email: z.email().optional()
});

export const PasskeyAuthenticateOptionsOutputSchema = z.object({
	/** JSON-serialisable WebAuthn authentication options to pass to `navigator.credentials.get()`. */
	options: z.any(),
	/** Challenge ID to send back with the authentication response. */
	challengeId: z.string()
});

export const PasskeyAuthenticateInputSchema = z.object({
	/** The challenge ID received from the authenticate-options endpoint. */
	challengeId: z.string().min(1),
	/** The JSON-serialised `AuthenticatorAssertionResponse` from the browser. */
	credential: z.any()
});

export const PasskeyAuthenticateOutputSchema = z.object({
	user: UserSchema,
	tokens: TokenPairSchema
});

export const PasskeyRenameInputSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(255)
});

export const PasskeyDeleteInputSchema = z.object({
	id: z.string().min(1)
});

// ---------------------------------------------------------------------------
// Serialisers
// ---------------------------------------------------------------------------

/**
 * Serialises a Prisma `User` row to the API response shape.
 *
 * Converts `emailVerified` from a `Date` to an ISO-8601 string (or
 * `null`). All other fields are passed through as-is since the Zod
 * schema uses `z.coerce.date()` for timestamp fields.
 */
export function serializeUser(
	user: Pick<User, 'id' | 'email' | 'emailVerified' | 'name' | 'avatarUrl' | 'role' | 'createdAt' | 'updatedAt'>
) {
	return {
		id: user.id,
		email: user.email,
		emailVerified: user.emailVerified,
		name: user.name,
		avatarUrl: user.avatarUrl,
		role: user.role,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt
	};
}

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type UserOutput = z.infer<typeof UserSchema>;
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;
export type UserList = z.infer<typeof UserListSchema>;
export type ListUsersParams = z.infer<typeof ListUsersParamsSchema>;

export type Post = z.infer<typeof PostSchema>;
export type CreatePostInput = z.infer<typeof CreatePostInputSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostInputSchema>;
export type PostList = z.infer<typeof PostListSchema>;
export type ListPostsParams = z.infer<typeof ListPostsParamsSchema>;

export type IdParams = z.infer<typeof IdParamsSchema>;
export type SlugParams = z.infer<typeof SlugParamsSchema>;
export type PaginationParams = z.infer<typeof PaginationParamsSchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

export type TokenPair = z.infer<typeof TokenPairSchema>;
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export type OtpSendInput = z.infer<typeof OtpSendInputSchema>;
export type OtpVerifyInput = z.infer<typeof OtpVerifyInputSchema>;
export type RefreshInput = z.infer<typeof RefreshInputSchema>;
export type LogoutInput = z.infer<typeof LogoutInputSchema>;
export type OidcAuthorizeInput = z.infer<typeof OidcAuthorizeInputSchema>;
export type OidcCallbackInput = z.infer<typeof OidcCallbackInputSchema>;
export type LinkedAccount = z.infer<typeof LinkedAccountSchema>;
export type Passkey = z.infer<typeof PasskeySchema>;
