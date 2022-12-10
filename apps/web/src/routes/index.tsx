import { component$, $, useStore } from '@builder.io/qwik'
import type { DocumentHead } from '@builder.io/qwik-city'

export default component$(() => {
	const state = useStore({
		data: null
	})

	const getData = $(async () => {
		const response = await fetch(`${import.meta.env.VITE_API_URL}/test`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		})
		if (response.status === 200) {
			state.data = await response.json()
		}
	})

	return (
		<div>
			<h1>{state.data}</h1>
			<button onClick$={getData}>Click me</button>
		</div>
	)
})

export const head: DocumentHead = {
	title: 'Welcome to Raineworks'
}
