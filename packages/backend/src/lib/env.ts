/**
 * Minimal environment access for @app/backend. Every module should read
 * `env` from here instead of touching `Bun.env` / `process.env` directly.
 */
export const env = {
	PORT: Number(Bun.env.PORT ?? 3000),
	NODE_ENV: Bun.env.NODE_ENV ?? 'development',
};
