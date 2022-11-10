import { component$, $ } from '@builder.io/qwik'
import type { DocumentHead } from '@builder.io/qwik-city'

export let data: null | string = null
export const getData = $( async () => {
	const response = await fetch('http://localhost:8000/test', {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	})
	if (response.status === 200) {
		data = await response.json()
	}
})
	

export default component$(() => {
	return (
		<div>
			<h1>{data}</h1>
			<button onClick$={getData}>Click me</button>
		</div>
	)
})

export const head: DocumentHead = {
	title: 'Welcome to Raineworks'
}
