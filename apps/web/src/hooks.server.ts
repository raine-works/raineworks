import type { Handle } from '@sveltejs/kit'
import { Elysia } from 'elysia'
import { user } from './routes/api/user.api'

export const app = new Elysia({ prefix: '/api' }).use(user)

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api')) {
		return await app.handle(event.request)
	} else {
		return await resolve(event)
	}
}

export type App = typeof app
