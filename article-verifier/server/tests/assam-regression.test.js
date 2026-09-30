import assert from 'node:assert/strict'
import test from 'node:test'
import { buildVerdict } from '../services/verdictEngine.js'

test('retrieved fact-check ratings do not independently mark a broad temporal claim as FAKE', () => {
  const sources = [
    { url: 'https://example.com/fact-check', rating: 'False', title: 'A related fact-check' },
    { url: 'https://example.com/news', title: 'Assam flooding report', excerpt: 'Flooding was reported in Assam.' }
  ]
  const result = buildVerdict('assam recently got flooded', sources, [])
  assert.equal(result.verdict, 'UNCERTAIN')
  assert.equal(result.confidence, 0)
  assert.equal(result.evidence.length, 0)
})
