/* global process */
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const serverDirectory = dirname(fileURLToPath(import.meta.url))
const databasePath = resolve(process.env.DATABASE_PATH || resolve(serverDirectory, '../data/factcheck.db'))
mkdirSync(dirname(databasePath), { recursive: true })
const database = new Database(databasePath)
database.pragma('journal_mode = WAL')
database.exec(`
  CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    input_type TEXT NOT NULL,
    original_input TEXT NOT NULL,
    claim TEXT NOT NULL,
    verdict TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    result_hash TEXT NOT NULL,
    proof_status TEXT NOT NULL,
    transaction_hash TEXT,
    block_number INTEGER,
    chain_id INTEGER,
    contract_address TEXT,
    proof_timestamp TEXT,
    created_at TEXT NOT NULL,
    result_json TEXT NOT NULL
  )
`)

const parse = (row) => row ? JSON.parse(row.result_json) : null
const summary = (row) => row ? ({ id: row.id, claim: row.claim, verdict: row.verdict, confidence: row.confidence, createdAt: row.created_at, proofStatus: row.proof_status, resultHash: row.result_hash }) : null

export const saveAnalysis = (result, inputType, originalInput) => {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const proof = result.proof || {}
  database.prepare(`INSERT INTO analyses
    (id, input_type, original_input, claim, verdict, confidence, explanation, result_hash, proof_status, transaction_hash, block_number, chain_id, contract_address, proof_timestamp, created_at, result_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, inputType, originalInput, result.claim, result.verdict, result.confidence, result.explanation, proof.resultHash, proof.status || 'NOT_CONFIGURED', proof.transactionHash || null, proof.blockNumber ?? null, proof.chainId ?? null, proof.contractAddress || null, proof.timestamp || null, createdAt, JSON.stringify({ ...result, id, createdAt }))
  return getAnalysis(id)
}

export const getAnalysis = (id) => parse(database.prepare('SELECT result_json FROM analyses WHERE id = ?').get(id))
export const getAnalysisRow = (id) => database.prepare('SELECT * FROM analyses WHERE id = ?').get(id)
export const listAnalyses = ({ page = 1, limit = 10, verdict = null }) => {
  const offset = (page - 1) * limit
  const where = verdict ? 'WHERE verdict = ?' : ''
  const values = verdict ? [verdict, limit, offset] : [limit, offset]
  const rows = database.prepare(`SELECT id, claim, verdict, confidence, created_at, proof_status, result_hash FROM analyses ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...values)
  const total = database.prepare(`SELECT COUNT(*) AS count FROM analyses ${where}`).get(...(verdict ? [verdict] : [])).count
  return { items: rows.map(summary), page, limit, total, totalPages: Math.ceil(total / limit) }
}

export const closeDatabase = () => database.close()
