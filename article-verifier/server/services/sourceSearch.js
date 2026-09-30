import { env } from '../config/env.js'
import { ConfigurationError, ExternalServiceError } from '../utils/errors.js'
import { getDomain, normalizeSourceUrl } from './sourceValidator.js'

const API_URL = 'https://www.googleapis.com/customsearch/v1'
const REQUEST_TIMEOUT_MS = 8000
const MAX_RESULTS = 15

const fetchJson = async (url) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  )

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new ExternalServiceError(
        'Unable to retrieve search sources.',
        response.status === 429 ? 429 : 502,
      )
    }

    return await response.json()
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ExternalServiceError(
        'Search source request timed out.',
        504,
      )
    }

    if (error instanceof ExternalServiceError) {
      throw error
    }

    throw new ExternalServiceError(
      'Unable to retrieve search sources.',
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

const buildQueries = (claim) => [
  claim,
  `${claim} news`,
  `${claim} latest`,
]

const classifySourceType = (url, title = '') => {
  const domain = getDomain(url).toLowerCase()
  const text = `${domain} ${title}`.toLowerCase()

  const factCheckDomains = [
    'factcheck.afp.com',
    'fullfact.org',
    'snopes.com',
    'politifact.com',
    'factcheck.org',
    'reuters.com/fact-check',
  ]

  if (
    factCheckDomains.some((item) => text.includes(item))
  ) {
    return 'FACT_CHECK'
  }

  const newsDomains = [
    'reuters.com',
    'apnews.com',
    'bbc.com',
    'bbc.co.uk',
    'theguardian.com',
    'aljazeera.com',
    'npr.org',
    'cnn.com',
    'nytimes.com',
    'washingtonpost.com',
    'independent.co.uk',
    'indiatoday.in',
    'hindustantimes.com',
    'thehindu.com',
    'ndtv.com',
  ]

  if (
    newsDomains.some((item) => domain.includes(item))
  ) {
    return 'NEWS'
  }

  return 'OTHER'
}

export const searchSources = async (claim) => {
  if (
    !env.googleCustomSearchApiKey ||
    !env.googleSearchEngineId
  ) {
    throw new ConfigurationError()
  }

  const retrievedAt = new Date().toISOString()
  const seenUrls = new Set()
  const collectedSources = []

  const queries = buildQueries(claim)

  for (const query of queries) {
    if (collectedSources.length >= MAX_RESULTS) {
      break
    }

    const params = new URLSearchParams({
      key: env.googleCustomSearchApiKey,
      cx: env.googleSearchEngineId,
      q: query,
      num: '10',
    })

    const data = await fetchJson(
      `${API_URL}?${params.toString()}`,
    )

    const items = Array.isArray(data.items)
      ? data.items
      : []

    for (const item of items) {
      if (
        !item ||
        typeof item !== 'object' ||
        !item.link
      ) {
        continue
      }

      const url = normalizeSourceUrl(item.link)

      if (!url || seenUrls.has(url)) {
        continue
      }

      seenUrls.add(url)

      const title =
        typeof item.title === 'string'
          ? item.title
          : 'Search result'

      const domain =
        getDomain(url) || 'Unknown publisher'

      collectedSources.push({
        id: `search-${url}`,
        title,
        url,
        publisher:
          item.displayLink ||
          domain ||
          'Unknown publisher',
        publishedAt: null,
        retrievedAt,
        sourceType: classifySourceType(
          url,
          title,
        ),
        relationship: 'UNKNOWN',
        excerpt:
          typeof item.snippet === 'string'
            ? item.snippet
            : '',
        domain,
      })

      if (collectedSources.length >= MAX_RESULTS) {
        break
      }
    }
  }

  return collectedSources
}