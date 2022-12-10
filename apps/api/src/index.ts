import express, { Request, Response, Application } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()
const PORT = process.env.PORT ?? 4000

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
app.listen(PORT, () => {
	console.log('Server listening at http://localhost:4000')
})

console.log(process.env.NODE_ENV)
