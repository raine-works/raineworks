import { join } from 'node:path';

/**
 * Compiles the SSH server into a standalone binary (`dist/ssh-server`), stamped `production`. Keep `target: 'bun'`
 * and `keepNames: true`: without them the binary crashes on disconnect, since `ssh2` checks
 * `channel.constructor.name === 'Session'`.
 *
 * Two optional dependencies are stubbed out because they cannot (and should
 * not) be bundled: `react-devtools-core` (Ink's opt-in devtools) and
 * `cpu-features` (ssh2's optional native probe; ssh2 falls back to pure JS).
 */
const packageDir = join(import.meta.dir, '..');

const result = await Bun.build({
	entrypoints: [join(packageDir, 'src/main.ts')],
	target: 'bun',
	compile: { outfile: join(packageDir, 'dist/ssh-server') },
	// Minified, but with names kept: ssh2 tells its channels apart by `constructor.name`.
	minify: { whitespace: true, syntax: true, identifiers: true, keepNames: true },
	define: { 'process.env.NODE_ENV': '"production"' },
	plugins: [
		{
			name: 'stub-optional-deps',
			setup(build) {
				build.onResolve({ filter: /^(react-devtools-core|cpu-features)$/ }, (args) => ({
					path: args.path,
					namespace: 'stub',
				}));
				build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
					contents: 'export default {};',
					loader: 'js',
				}));
			},
		},
	],
});

if (!result.success) {
	for (const log of result.logs) console.error(log);
	process.exit(1);
}
console.log('✅ Built dist/ssh-server');
