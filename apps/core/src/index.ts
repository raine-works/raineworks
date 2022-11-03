import express, { Request, Response, Application } from 'express'
import cors from 'cors'

const app: Application = express()
	.use(cors({ origin: '*' }))
	.use(express.json())

/** Imported routes */
app.use('/test', require('~/routes/test').router)

app.get('/hello', (req: Request, res: Response) => {
	res.send('Hello')
})

/** Catch all route (Must run after all other routes)*/
app.use((req: Request, res: Response) => {
	res.status(404).json({ error: '404 - Resource not found' })
})

/** Start server */
app.listen(8000, '0.0.0.0', () => {
	console.log('Application listening at http://localhost:8000')
})
