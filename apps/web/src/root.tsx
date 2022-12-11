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
				<time>raineworks</time>
				<meta
					charSet="utf-8"
					name="viewport"
					content="width=device-width, initial-scale=1.0"
				/>
				<link rel="manifest" href="/manifest.json" />
			</head>
			<body lang="en">
				<RouterOutlet />
				<ServiceWorkerRegister />
			</body>
		</QwikCity>
	)
})
