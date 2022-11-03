import { component$, $ } from '@builder.io/qwik'
import type { DocumentHead } from '@builder.io/qwik-city'

export const getData = $(async () => {
	const response = await (await fetch('http://localhost:8000/test', {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	})).json()
	console.log(response)
})

export default component$(() => {
	return (
		<div>
			<button onClick$={getData}>Click me</button>
		</div>
	)
})

export const head: DocumentHead = {
	title: 'Welcome to Raineworks'
}
