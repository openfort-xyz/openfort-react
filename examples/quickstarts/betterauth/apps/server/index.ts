import { toNodeHandler } from 'better-auth/node'
import cors from 'cors'
import express from 'express'
import './env'
import { auth } from './auth'

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
)

app.all('/api/auth/*', toNodeHandler(auth))

app.use(express.json())

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Only start the server if not being imported for config
if (process.env.SKIP_SERVER !== 'true') {
  app.listen(port, () => {
    console.log(`Better Auth server listening on http://localhost:${port}`)
  })
}
