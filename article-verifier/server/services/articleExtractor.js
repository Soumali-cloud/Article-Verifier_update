import { Buffer } from 'node:buffer'
import dns from 'node:dns/promises'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import { ExternalServiceError } from '../utils/errors.js'
import { getDomain, normalizeSourceUrl } from './sourceValidator.js'

const REQUEST_TIMEOUT_MS = 10000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const MAX_TEXT_LENGTH = 50000
const MAX_REDIRECTS = 3

const isPrivateAddress = (address) => {
  const normalized = address.toLowerCase()
  if (normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true
  const parts = normalized.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168)
}

const assertSafeUrl = async (value) => {
  const normalized = normalizeSourceUrl(value)
  if (!normalized) throw new ExternalServiceError('The article URL is not allowed.', 400)
  const hostname = new URL(normalized).hostname
  const addresses = await dns.lookup(hostname, { all: true })
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new ExternalServiceError('The article URL is not allowed.', 400)
  }
  return normalized
}

const fetchHtml = async (initialUrl) => {
  let url = await assertSafeUrl(initialUrl)

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(url, { signal: controller.signal, redirect: 'manual', headers: { Accept: 'text/html,application/xhtml+xml' } })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        if (!location || redirectCount === MAX_REDIRECTS) throw new ExternalServiceError('Too many article redirects.', 502)
        url = await assertSafeUrl(new URL(location, url).toString())
        continue
      }
      if (!response.ok) throw new ExternalServiceError('Unable to fetch the article URL.', 502)
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        throw new ExternalServiceError('The article URL did not return HTML content.', 415)
      }
      const contentLength = Number.parseInt(response.headers.get('content-length') || '0', 10)
      if (contentLength > MAX_RESPONSE_BYTES) throw new ExternalServiceError('The article response is too large.', 413)
      const reader = response.body?.getReader()
      if (!reader) throw new ExternalServiceError('Unable to read article content.', 502)
      const chunks = []
      let totalBytes = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalBytes += value.byteLength
        if (totalBytes > MAX_RESPONSE_BYTES) {
          await reader.cancel()
          throw new ExternalServiceError('The article response is too large.', 413)
        }
        chunks.push(value)
      }
      const html = Buffer.concat(chunks).toString('utf8')
      return { html, url }
    } catch (error) {
      if (error.name === 'AbortError') throw new ExternalServiceError('Article fetch timed out.', 504)
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }
  throw new ExternalServiceError('Unable to fetch the article URL.', 502)
}

const getMeta = (document, property, name) => document.querySelector(`meta[property="${property}"], meta[name="${name}"]`)?.getAttribute('content') || null

export const extractArticle = async (inputUrl) => {
  let fetched
  try {
    fetched = await fetchHtml(inputUrl)
    const dom = new JSDOM(fetched.html, { url: fetched.url })
    const document = dom.window.document
    const parsed = new Readability(document).parse()
    const text = parsed?.textContent?.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH) || ''
    if (!text) throw new ExternalServiceError('Unable to extract readable article content from this URL.', 422)
    const canonicalUrl = normalizeSourceUrl(document.querySelector('link[rel="canonical"]')?.href || fetched.url) || fetched.url
    return {
      url: inputUrl,
      canonicalUrl,
      title: parsed.title || getMeta(document, 'og:title', 'twitter:title') || document.title || null,
      publisher: getMeta(document, 'og:site_name', 'application-name') || getDomain(canonicalUrl),
      author: parsed.byline || getMeta(document, 'author', 'author'),
      publishedAt: getMeta(document, 'article:published_time', 'datePublished'),
      text,
      retrievedAt: new Date().toISOString()
    }
  } catch (error) {
    if (error instanceof ExternalServiceError) throw error
    throw new ExternalServiceError('Unable to extract readable article content from this URL.', 422)
  }
}
