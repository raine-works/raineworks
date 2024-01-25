import { Elysia } from 'elysia'

export const user = new Elysia({ prefix: '/user' })

user.get('/', () => {
	return {
		msg: 'Hello World'
	}
})
