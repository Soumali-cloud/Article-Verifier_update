import { env } from '../config/env.js'
import { ConfigurationError, ExternalServiceError } from '../utils/errors.js'
import { normalizeSourceUrl } from './sourceValidator.js'

const API_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search'
const REQUEST_TIMEOUT_MS = 8000

const fetchJson = async (url) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new ExternalServiceError('Unable to retrieve fact-check sources.', response.status === 429 ? 429 : 502)
    }
    return await response.json()
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ExternalServiceError('Fact-check source request timed out.', 504)
    }
    if (error instanceof ExternalServiceError) throw error
    throw new ExternalServiceError('Unable to retrieve fact-check sources.')
  } finally {
    clearTimeout(timeoutId)
  }
}

export const searchFactChecks = async (claim) => {
  if (!env.googleFactCheckApiKey) throw new ConfigurationError()

  const params = new URLSearchParams({
    key: env.googleFactCheckApiKey,
    query: claim,
    languageCode: 'en',
    pageSize: '10'
  })
  const data = await fetchJson(`${API_URL}?${params.toString()}`)
  const retrievedAt = new Date().toISOString()

  const claims = Array.isArray(data.claims) ? data.claims : []

  return claims.filter((claimRecord) => claimRecord && typeof claimRecord === 'object').flatMap((claimRecord) =>
    (Array.isArray(claimRecord.claimReview) ? claimRecord.claimReview : [])
      .filter((review) => review && normalizeSourceUrl(review.url)).map((review) => ({
      id: `fact-check-${review.url}`,
      title: claimRecord.text || review.title || 'Fact-check review',
      url: normalizeSourceUrl(review.url),
      publisher: review.publisher?.name || 'Unknown publisher',
      publishedAt: review.reviewDate || null,
      retrievedAt,
      sourceType: 'FACT_CHECK',
      relationship: 'UNKNOWN',
      excerpt: review.textualRating ? `Rating: ${review.textualRating}` : '',
      rating: review.textualRating || null
      }))
  )
}

