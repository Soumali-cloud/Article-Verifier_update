import assert from 'node:assert/strict'
import test from 'node:test'
/* global process */
import { canonicalJson, canonicalizeResult } from '../services/resultCanonicalizer.js'
import { hashResult } from '../services/hashResult.js'

process.env.BLOCKCHAIN_RPC_URL = 'your_sepolia_rpc_url'
process.env.BLOCKCHAIN_PRIVATE_KEY = 'your_backend_wallet_private_key'
process.env.FACT_CHECK_CONTRACT_ADDRESS = 'deployed_contract_address'

const { isBlockchainConfigured, encodeVerdict, verifyProof } = await import('../services/blockchain.js')

const result = { claim: 'Claim', verdict: 'REAL', confidence: 80, explanation: 'Supported.', evidence: [{ claimId: 'claim-1', relationship: 'SUPPORTS', strength: 0.8, reason: 'Direct.', excerpt: 'Excerpt', source: { title: 'Source', url: 'https://example.com/a', publisher: 'Example', publishedAt: null, retrievedAt: '2026-01-01T00:00:00.000Z' } }] }

test('canonical result hashing is stable and changes with meaningful fields', () => {
  assert.equal(hashResult(result), hashResult({ ...result, evidence: [...result.evidence] }))
  assert.notEqual(hashResult(result), hashResult({ ...result, verdict: 'FAKE' }))
  assert.notEqual(hashResult(result), hashResult({ ...result, confidence: 81 }))
  assert.notEqual(hashResult(result), hashResult({ ...result, explanation: 'Changed.' }))
  assert.notEqual(hashResult(result), hashResult({ ...result, evidence: [] }))
})

test('canonicalization sorts evidence and rejects invalid verdict or confidence', () => {
  const reversed = { ...result, evidence: [...result.evidence].reverse() }
  assert.equal(canonicalJson(result), canonicalJson(reversed))
  assert.throws(() => canonicalizeResult({ ...result, verdict: 'MAYBE' }))
  assert.throws(() => canonicalizeResult({ ...result, confidence: 101 }))
})

test('blockchain remains non-fatal when configuration is absent', async () => {
  assert.equal(isBlockchainConfigured(), false)
  assert.equal(encodeVerdict('UNCERTAIN'), 0)
  assert.equal(encodeVerdict('REAL'), 1)
  assert.equal(encodeVerdict('FAKE'), 2)
  assert.deepEqual(await verifyProof(hashResult(result)), { verified: false, resultHash: hashResult(result), status: 'NOT_CONFIGURED' })
})
