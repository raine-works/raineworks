import { Elysia, t } from 'elysia'

export const user = new Elysia({ prefix: '/user' }).post(
	'/test',
	({ body }) => {
		console.log(body)
		return {
			msg: 'Hello World'
		}
	},
	{
		body: t.Object({
			name: t.String()
		})
	}
)
