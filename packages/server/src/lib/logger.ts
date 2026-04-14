/**
 * Structured logging with Pino.
 *
 * Provides the root logger instance, module-level child logger
 * helpers, sensitive-field redaction, request-ID generation, and
 * the oRPC request middleware that logs every incoming request and
 * its response with timing information.
 *
 * In development, output is piped through `pino-pretty` for
 * human-readable terminal output. In production, logs are emitted
 * as newline-delimited JSON for ingestion by structured log aggregators.
 *
 * ## Log levels
 *
 * | Level   | Use                                                      |
 * |---------|----------------------------------------------------------|
 * | `fatal` | Process is about to crash — unrecoverable errors.        |
 * | `error` | Unexpected failures that need investigation.             |
 * | `warn`  | Client errors (4xx), degraded subsystems, rate limits.   |
 * | `info`  | Request lifecycle, startup, shutdown, connections.        |
 * | `debug` | LISTEN/NOTIFY events, detailed internal state.           |
 * | `trace` | Granular debugging — disabled in production.             |
 *
 * ## Redaction
 *
 * Pino's built-in `redact` option scrubs sensitive fields **before**
 * they reach the transport. Secrets never touch stdout.
 *
 * @module logger
 */

import { ORPCError, os } from '@orpc/server';
import { env } from '@server/lib/env';
import pino from 'pino';

// ---------------------------------------------------------------------------
// Redaction paths
// ---------------------------------------------------------------------------
// Every path listed here is replaced with `[REDACTED]` in the
// serialised JSON **before** it leaves the process. Paths are
// matched against the top-level keys of the object passed to the
// log method.
//
// Example: `log.info({ input: { password: 'secret' } })` →
//          `{ input: { password: '[REDACTED]' } }`
// ---------------------------------------------------------------------------

const REDACT_PATHS = [
	// Request headers
	'req.authorization',
	'req.cookie',

	// Tokens in request bodies
	'input.refreshToken',
	'input.token',
	'input.password',

	// Tokens in response bodies
	'output.tokens.accessToken',
	'output.tokens.refreshToken',
	'output.token'
];

// ---------------------------------------------------------------------------
// Root logger
// ---------------------------------------------------------------------------

export const log = pino({
	level: env.LOG_LEVEL,

	// Base context attached to every log line.
	base: {
		service: 'mystack-server',
		env: env.NODE_ENV
	},

	redact: {
		paths: REDACT_PATHS,
		censor: '[REDACTED]'
	},

	// ISO timestamps for structured log aggregation.
	timestamp: pino.stdTimeFunctions.isoTime,

	// In development, pipe through pino-pretty for human-readable output.
	// In production, emit raw newline-delimited JSON.
	...(env.NODE_ENV === 'development'
		? {
				transport: {
					target: 'pino-pretty',
					options: {
						colorize: true,
						translateTime: 'HH:MM:ss.l',
						ignore: 'pid,hostname,service,env'
					}
				}
			}
		: {})
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Re-export Pino's Logger type for convenience. */
export type Logger = pino.Logger;

/**
 * Context shape added by {@link requestMiddleware}.
 *
 * Available in every handler after the middleware runs.
 */
export interface RequestContext {
	/** Unique identifier for this request (UUID). */
	requestId: string;
	/** Child logger bound to this request's ID and path. */
	log: Logger;
}

// ---------------------------------------------------------------------------
// Request middleware
// ---------------------------------------------------------------------------

/**
 * oRPC middleware that instruments every request with structured
 * logging and a unique request ID.
 *
 * On each request:
 * 1. Extracts or generates a request ID (`X-Request-ID` header or
 *    `crypto.randomUUID()`).
 * 2. Creates a child logger bound to `{ requestId, path }`.
 * 3. Logs the incoming request at `info` level with headers and
 *    input payload (sensitive fields are redacted automatically).
 * 4. Injects `requestId` and `log` into the oRPC context.
 * 5. After the handler completes, logs the response with duration.
 * 6. On error, logs at `warn` (client errors) or `error` (unexpected).
 */
export const requestMiddleware = os.$context<{ headers: Headers }>().middleware(async ({ context, next, path }) => {
	const requestId = context.headers.get('x-request-id') || crypto.randomUUID();

	const reqLog = log.child({ requestId, path });

	// Log the incoming request with headers.
	reqLog.info(
		{
			req: {
				authorization: context.headers.get('authorization') ?? undefined,
				cookie: context.headers.get('cookie') ?? undefined,
				userAgent: context.headers.get('user-agent') ?? undefined,
				ip: context.headers.get('x-forwarded-for') ?? context.headers.get('cf-connecting-ip') ?? undefined
			}
		},
		'request received'
	);

	const start = performance.now();

	try {
		const result = await next({
			context: {
				requestId,
				log: reqLog
			} satisfies RequestContext
		});

		const durationMs = Math.round(performance.now() - start);

		reqLog.info({ output: result.output, durationMs }, 'request completed');

		return result;
	} catch (err) {
		const durationMs = Math.round(performance.now() - start);

		if (err instanceof ORPCError) {
			// Client errors (bad input, unauthorized, etc.) — expected.
			reqLog.warn({ err: { code: err.code, message: err.message }, durationMs }, 'request failed');
		} else {
			// Unexpected server errors — need investigation.
			reqLog.error({ err, durationMs }, 'request failed (unhandled)');
		}

		throw err;
	}
});
