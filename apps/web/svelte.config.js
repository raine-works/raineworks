import preprocess from 'svelte-preprocess'
import adapter from 'svelte-adapter-bun'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: preprocess(),
	kit: {
		adapter: adapter({ out: '.build', dynamic_origin: true })
	}
}

export default config
