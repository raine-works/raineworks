/**
 * RaineStack server — application entry point.
 *
 * Bootstraps the HTTP server, wires up the oRPC router with OpenAPI
 * support, connects the database listener, initialises static zone
 * discovery, and registers graceful shutdown handlers.
 *
 * ## Architecture
 *
 * The server exposes three categories of endpoints:
 *
 * | Path                 | Purpose                                  |
 * |----------------------|------------------------------------------|
 * | `/api/*`             | oRPC procedure calls (OpenAPI-compatible) |
 * | `/api/openapi.json`  | OpenAPI 3.x specification                |
 * | `/api/contract.json` | oRPC contract router (for client factory) |
 * | `/healthz`           | Liveness / readiness probe               |
 * | `/*`                 | Static micro-frontend zones (SPA)        |
 *
 * @module index
 */

import '@rainestack/tools/prototypes';
import '@rainestack/tools/temporal-polyfill';

import { minifyContractRouter } from '@orpc/contract';
import { OpenAPIGenerator } from '@orpc/openapi';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { ORPCError, onError } from '@orpc/server';
import { CORSPlugin } from '@orpc/server/plugins';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { connectListener, db, listener } from '@server/lib/database';
import { log } from '@server/lib/logger';
import { base } from '@server/lib/orpc';
import { registerShutdown } from '@server/lib/shutdown';
import { initializeZones, serveStaticFile } from '@server/lib/static';
import { authRouter } from '@server/routes/auth';
import { postRouter } from '@server/routes/posts';
import { userRouter } from '@server/routes/users';

// ---------------------------------------------------------------------------
// Module logger
// ---------------------------------------------------------------------------

const startupLog = log.child({ module: 'startup' });
const healthLog = log.child({ module: 'health' });

// ---------------------------------------------------------------------------
// Root router
// ---------------------------------------------------------------------------

const router = base.router({
	auth: authRouter,
	users: userRouter,
	posts: postRouter
});

// ---------------------------------------------------------------------------
// Contract router
// ---------------------------------------------------------------------------

const contractRouter = minifyContractRouter(router);

// ---------------------------------------------------------------------------
// OpenAPI spec generation
// ---------------------------------------------------------------------------

const generator = new OpenAPIGenerator({
	schemaConverters: [new ZodToJsonSchemaConverter()]
});

const spec = await generator.generate(router, {
	info: { title: 'RaineStack API', version: '1.0.0' },
	servers: [{ url: 'http://localhost:3000/api' }]
});

// ---------------------------------------------------------------------------
// oRPC handler
// ---------------------------------------------------------------------------

const handler = new OpenAPIHandler(router, {
	plugins: [new CORSPlugin()],
	interceptors: [
		onError((error) => {
			// Expected client errors (4xx) are already logged by
			// requestMiddleware with full request context. Only log
			// genuinely unexpected errors here as a safety net.
			if (error instanceof ORPCError && error.status >= 400 && error.status < 500) {
				return;
			}

			log.error({ err: error }, 'unhandled oRPC error');
		})
	]
});

// ---------------------------------------------------------------------------
// Database listener — connect once before accepting requests
// ---------------------------------------------------------------------------

await connectListener();

// ---------------------------------------------------------------------------
// Static zone discovery — detect which frontend bundles are available
// ---------------------------------------------------------------------------

await initializeZones();

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = Bun.serve({
	port: 3000,
	routes: {
		'/healthz': async () => {
			const checks: Record<string, string> = {};
			let healthy = true;

			// Prisma / pg.Pool health
			try {
				await db.$queryRawUnsafe('SELECT 1');
				checks.database = 'ok';
			} catch {
				checks.database = 'unreachable';
				healthy = false;
			}

			// LISTEN/NOTIFY listener health
			if (listener.isConnected) {
				checks.listener = 'ok';
			} else {
				checks.listener = listener.isReconnecting
					? `reconnecting (${listener.consecutiveFailures} failures)`
					: 'disconnected';
				healthy = false;
			}

			if (!healthy) {
				healthLog.warn({ checks }, 'health check degraded');
			}

			return Response.json({ status: healthy ? 'healthy' : 'degraded', checks }, { status: healthy ? 200 : 503 });
		}
	},
	async fetch(request: Request) {
		// Generate a request ID for non-RPC routes (RPC routes get theirs
		// from requestMiddleware). This ensures every response carries the
		// header regardless of the route.
		const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

		const { matched, response } = await handler.handle(request, {
			prefix: '/api',
			context: { headers: request.headers }
		});

		if (matched) {
			response.headers.set('x-request-id', requestId);
			return response;
		}

		const { pathname } = new URL(request.url);

		if (pathname === '/api/openapi.json') {
			if (request.method === 'OPTIONS') {
				return new Response(null, {
					status: 204,
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type',
						'x-request-id': requestId
					}
				});
			}

			return new Response(JSON.stringify(spec, null, 2), {
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Content-Disposition': 'inline',
					'Access-Control-Allow-Origin': '*',
					'x-request-id': requestId
				}
			});
		}

		if (pathname === '/api/contract.json') {
			return new Response(JSON.stringify(contractRouter, null, 2), {
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Content-Disposition': 'inline',
					'x-request-id': requestId
				}
			});
		}

		// -------------------------------------------------------------
		// Static file serving — frontend micro-frontend zones
		// -------------------------------------------------------------

		const staticResponse = await serveStaticFile(request);

		if (staticResponse) {
			staticResponse.headers.set('x-request-id', requestId);
			return staticResponse;
		}

		return new Response('Not Found', {
			status: 404,
			headers: { 'x-request-id': requestId }
		});
	}
});

// ---------------------------------------------------------------------------
// Graceful shutdown — signal handlers + database health monitor
// ---------------------------------------------------------------------------

registerShutdown({ server, db, listener });

startupLog.info({ port: server.port, url: `http://localhost:${server.port}` }, 'server listening');

export type Router = typeof router;
