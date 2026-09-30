import { hasLlmCredentials } from '../config/env.js'
import { extractClaimsWithLlm } from './llm.js'

const MAX_CLAIMS = 8
const cleanSentence = (sentence) => sentence.replace(/\s+/g, ' ').trim()

const validateClaims = (value) => {
  if (!Array.isArray(value)) return []
  return value.filter((item) => item && typeof item.text === 'string' && item.text.trim()).slice(0, MAX_CLAIMS).map((item, index) => ({
    id: typeof item.id === 'string' && item.id ? item.id : `claim-${index + 1}`,
    text: cleanSentence(item.text)
  }))
}

const extractSimpleClaims = (text) => text.split(/(?<=[.!?])\s+/).map(cleanSentence)
  .filter((sentence) => sentence.length >= 20 && !/[?]$/.test(sentence) && !/^(advertisement|subscribe|sign in|menu)\b/i.test(sentence))
  .slice(0, MAX_CLAIMS)
  .map((text, index) => ({ id: `claim-${index + 1}`, text }))

export const extractClaims = async (text, inputType) => {
  if (inputType === 'claim') return [{ id: 'claim-1', text: cleanSentence(text) }]
  if (hasLlmCredentials()) {
    try {
      const result = await extractClaimsWithLlm(text)
      const claims = validateClaims(result.claims)
      if (claims.length) return claims
    } catch (error) {
      console.warn('Claim extraction failed:', error.message)
    }
  }
  return extractSimpleClaims(text)
}
