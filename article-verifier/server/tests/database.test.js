/* global process */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'articleverify-'))
process.env.DATABASE_PATH = join(temporaryDirectory, 'factcheck.db')
const { closeDatabase, getAnalysis, listAnalyses, saveAnalysis } = await import('../services/database.js')

test.after(() => {
  closeDatabase()
  rmSync(temporaryDirectory, { recursive: true, force: true })
})

const result = {
  claim: 'Stored claim',
  verdict: 'UNCERTAIN',
  confidence: 0,
  explanation: 'Insufficient evidence.',
  evidence: [],
  sources: [],
  proof: { status: 'NOT_CONFIGURED', resultHash: '0x' + '1'.repeat(64) }
}

test('database creates, retrieves, and lists immutable analysis snapshots', () => {
  const saved = saveAnalysis(result, 'claim', result.claim)
  assert.ok(saved.id)
  assert.ok(saved.createdAt)
  assert.equal(getAnalysis(saved.id).claim, result.claim)
  assert.equal(getAnalysis(saved.id).verdict, 'UNCERTAIN')
  const listed = listAnalyses({ page: 1, limit: 1 })
  assert.equal(listed.items.length, 1)
  assert.equal(listed.items[0].id, saved.id)
  assert.ok(listed.total >= 1)
})

test('database returns null for a missing analysis and paginates safely', () => {
  assert.equal(getAnalysis('missing-analysis-id'), null)
  const listed = listAnalyses({ page: 999, limit: 50 })
  assert.equal(listed.items.length, 0)
})
