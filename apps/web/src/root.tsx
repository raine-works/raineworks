import { component$ } from '@builder.io/qwik'
import {
	QwikCity,
	RouterOutlet,
	ServiceWorkerRegister
} from '@builder.io/qwik-city'

export default component$(() => {
	return (
		<QwikCity>
			<head>
				<meta charSet="utf-8" />
				<link rel="manifest" href="/manifest.json" />
			</head>
			<body lang="en">
				<RouterOutlet />
				<ServiceWorkerRegister />
			</body>
		</QwikCity>
	)
})
