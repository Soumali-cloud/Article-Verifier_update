import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import analyzeRouter, { proofRouter } from './routes/analyze.js'
import analysesRouter from './routes/analyses.js'
import { errorHandler } from './utils/errors.js'

const app = express()
const requestCounts = new Map()
const allowedOrigins = new Set([env.clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'])

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin) ? origin || env.clientOrigin : false) }))
app.use(express.json({ limit: '32kb' }))
app.use('/api/analyze', (request, response, next) => {
  const key = request.ip
  const now = Date.now()
  const record = requestCounts.get(key) || { startedAt: now, count: 0 }
  if (now - record.startedAt > 60_000) {
    record.startedAt = now
    record.count = 0
  }
  record.count += 1
  requestCounts.set(key, record)
  if (requestCounts.size > 10000) requestCounts.delete(requestCounts.keys().next().value)
  if (record.count > 20) return response.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many analysis requests. Please try again later.' } })
  return next()
})

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.use('/api/analyze', analyzeRouter)
app.use('/api/proof', proofRouter)
app.use('/api/analyses', analysesRouter)
app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found.', code: 'NOT_FOUND' })
})
app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`Backend listening on port ${env.port}`)
})
