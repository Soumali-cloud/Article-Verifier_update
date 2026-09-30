import assert from 'node:assert/strict'
import test from 'node:test'
import { hasUriScheme, isHttpUrl, validateAnalyzeRequest } from '../utils/validation.js'
import { normalizeSourceUrl } from '../services/sourceValidator.js'
import { validateEvaluations } from '../services/evidenceEvaluator.js'
import { buildVerdict } from '../services/verdictEngine.js'

test('validation accepts claims and rejects empty or unsupported input', () => {
  assert.deepEqual(validateAnalyzeRequest({ input: 'A claim.', inputType: 'claim' }), { input: 'A claim.', inputType: 'claim' })
  assert.throws(() => validateAnalyzeRequest({ input: '', inputType: 'claim' }))
  assert.throws(() => validateAnalyzeRequest({ input: 'A claim.', inputType: 'video' }))
})

test('source validation rejects unsafe URLs and strips tracking data', () => {
  assert.equal(normalizeSourceUrl('javascript:alert(1)'), null)
  assert.equal(normalizeSourceUrl('http://localhost/story'), null)
  assert.equal(normalizeSourceUrl('http://127.0.0.1/story'), null)
  assert.equal(normalizeSourceUrl('https://example.com/story?utm_source=test&id=1'), 'https://example.com/story?id=1')
})

test('article URL detection distinguishes HTTP URLs from unsafe schemes', () => {
  assert.equal(isHttpUrl('https://example.com/article'), true)
  assert.equal(isHttpUrl('javascript:alert(1)'), false)
  assert.equal(hasUriScheme('javascript:alert(1)'), true)
  assert.equal(hasUriScheme('Company X announced Y.'), false)
})

test('malformed or hallucinated evaluations are discarded', () => {
  const evidence = [{ url: 'https://example.com/source', title: 'Source' }]
  const evaluations = validateEvaluations({ evaluations: [
    { sourceUrl: 'https://not-retrieved.example', relationship: 'SUPPORTS', strength: 1, reason: 'hallucinated' },
    { sourceUrl: evidence[0].url, relationship: 'UNKNOWN', strength: 2, reason: 'valid URL' },
    { sourceUrl: evidence[0].url, relationship: 'INVALID', strength: 1, reason: 'invalid relationship' }
  ] }, evidence)
  assert.deepEqual(evaluations, [{ sourceUrl: evidence[0].url, relationship: 'UNKNOWN', strength: 1, reason: 'valid URL' }])
})

test('verdict engine remains uncertain for no, weak, or mixed evidence', () => {
  assert.equal(buildVerdict('claim', [], []).verdict, 'UNCERTAIN')
  assert.equal(buildVerdict('claim', [], [{ sourceUrl: 'a', relationship: 'SUPPORTS', strength: 0.5 }]).verdict, 'UNCERTAIN')
  assert.equal(buildVerdict('claim', [], [
    { sourceUrl: 'a', relationship: 'SUPPORTS', strength: 0.9 },
    { sourceUrl: 'b', relationship: 'SUPPORTS', strength: 0.8 }
  ]).verdict, 'REAL')
  assert.equal(buildVerdict('claim', [], [
    { sourceUrl: 'a', relationship: 'CONTRADICTS', strength: 0.9 },
    { sourceUrl: 'b', relationship: 'CONTRADICTS', strength: 0.8 }
  ]).verdict, 'FAKE')
  assert.equal(buildVerdict('claim', [], [
    { sourceUrl: 'a', relationship: 'SUPPORTS', strength: 0.9 },
    { sourceUrl: 'b', relationship: 'CONTRADICTS', strength: 0.9 }
  ]).verdict, 'UNCERTAIN')
})
