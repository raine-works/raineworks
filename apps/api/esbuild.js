const { buildSync } = require('esbuild')
const { dependencies, devDependencies } = require('./package.json')
// for (const key of Object.keys(dependencies)) {
// 	if (dependencies[key] === '*') {
// 		delete dependencies[key]
// 	}
// }

module.exports = buildSync({
	entryPoints: ['src/index.ts'],
	platform: 'node',
	external: [...Object.keys(dependencies), ...Object.keys(devDependencies)],
	bundle: true,
	minify: false,
	sourcemap: true,
	outdir: '.build'
})
