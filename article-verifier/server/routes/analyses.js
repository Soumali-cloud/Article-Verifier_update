import { Router } from 'express'
import { AppError } from '../utils/errors.js'
import { getAnalysis, listAnalyses } from '../services/database.js'

const router = Router()
const allowedVerdicts = new Set(['REAL', 'FAKE', 'UNCERTAIN'])

const parsePage = (value, fallback, maximum) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, maximum) : fallback
}

router.get('/', (request, response) => {
  const page = parsePage(request.query.page, 1, Number.MAX_SAFE_INTEGER)
  const limit = parsePage(request.query.limit, 10, 50)
  const verdict = request.query.verdict || null
  if (verdict && !allowedVerdicts.has(verdict)) throw new AppError('Invalid verdict filter.', 400, 'INVALID_VERDICT_FILTER')
  response.json(listAnalyses({ page, limit, verdict }))
})

router.get('/:id', (request, response, next) => {
  try {
    const analysis = getAnalysis(request.params.id)
    if (!analysis) throw new AppError('The requested analysis does not exist.', 404, 'ANALYSIS_NOT_FOUND')
    response.json(analysis)
  } catch (error) {
    next(error)
  }
})

export default router
