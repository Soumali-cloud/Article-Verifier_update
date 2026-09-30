const verdicts = new Set(['UNCERTAIN', 'REAL', 'FAKE'])

const stableString = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value
const stableSource = (source = {}) => ({
  title: stableString(source.title || ''),
  url: stableString(source.url || ''),
  publisher: stableString(source.publisher || ''),
  publishedAt: source.publishedAt || null,
  excerpt: stableString(source.excerpt || '')
})

export const canonicalizeResult = (result) => {
  if (!verdicts.has(result.verdict)) throw new Error('Invalid verdict for proof canonicalization.')
  if (!Number.isInteger(result.confidence) || result.confidence < 0 || result.confidence > 100) throw new Error('Invalid confidence for proof canonicalization.')
  const evidence = (Array.isArray(result.evidence) ? result.evidence : []).map((item) => ({
    claimId: stableString(item.claimId || ''),
    relationship: stableString(item.relationship || 'UNKNOWN'),
    strength: Number(item.strength || 0),
    reason: stableString(item.reason || ''),
    excerpt: stableString(item.excerpt || ''),
    source: stableSource(item.source)
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  return { claim: stableString(result.claim || ''), verdict: result.verdict, confidence: result.confidence, explanation: stableString(result.explanation || ''), evidence }
}

const sortKeys = (value) => {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((sorted, key) => ({ ...sorted, [key]: sortKeys(value[key]) }), {})
  return value
}

export const canonicalJson = (result) => JSON.stringify(sortKeys(canonicalizeResult(result)))
