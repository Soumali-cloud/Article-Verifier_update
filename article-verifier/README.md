# Decentralized Fake News Detector

React + Vite frontend with an Express evidence-verification backend.

An evidence-based fake-news verification platform that combines source retrieval, LLM-assisted evidence evaluation, deterministic verdict aggregation, and blockchain-backed proof records.

## Key Features

- AI-assisted evidence evaluation
- Google Fact Check and Search retrieval
- Article URL extraction
- Source provenance and hallucination protection
- `REAL` / `FAKE` / `UNCERTAIN` verdicts
- Deterministic confidence scoring
- SHA-256 result integrity hashes
- Sepolia proof trail and verification
- SQLite analysis history

## Technology Stack

- React 19 and Vite
- Node.js and Express
- SQLite with better-sqlite3
- OpenAI-compatible LLM adapter
- ethers.js and Solidity
- Hardhat for contract development

## Architecture

```text
Input
  -> article extraction or claim processing
  -> Google Fact Check and Google Search retrieval
  -> normalized source records
  -> optional LLM evidence evaluation
  -> deterministic verdict engine
  -> confidence and explanation
  -> React frontend
```

The system does not determine truth from the LLM alone. The LLM evaluates only evidence retrieved by the backend. Source URLs returned by an LLM are discarded unless they already exist in the retrieved evidence set.

## Database

SQLite is initialized automatically when the backend starts at `server/data/factcheck.db`. The database is outside the frontend static directory and is ignored by Git. Each analysis is stored as an immutable JSON snapshot with indexed summary fields for the original input, claim, verdict, confidence, result hash, proof status, transaction metadata, and creation time. Claims, sources, evidence, article metadata, and proof information are retained in the snapshot. API keys, private keys, and full HTML are not stored.

Database failures are reported separately from fact-check failures. The API does not return an analysis ID unless persistence succeeds.

## Analysis History

`GET /api/analyses?page=1&limit=10` returns compact history records with a maximum page size of 50. `GET /api/analyses/:id` returns the immutable complete result. There are no update endpoints; corrections must be represented by a new analysis.

## Integrity Verification

`POST /api/proof/verify` accepts an `analysisId`. The backend loads the stored snapshot, reconstructs its canonical result, recalculates the SHA-256 hash, and compares it with the stored hash. If the stored proof was confirmed on-chain, the backend also queries the contract independently. Blockchain provides tamper-evident integrity for the recorded fact-check result; it does not independently determine whether the underlying news claim is true.

## Blockchain Proof Trail

After the fact-check result is finalized, the backend canonicalizes stable result fields, generates a SHA-256 proof hash, and registers that hash with the `FactCheckRegistry` contract when blockchain settings are configured. The contract stores the hash, verdict encoding (`0 = UNCERTAIN`, `1 = REAL`, `2 = FAKE`), confidence, timestamp, and submitting address. Blockchain does not determine whether a claim is true; it provides tamper-evident proof of the recorded fact-check result.

The initial signer is a server-controlled custodial wallet on Sepolia (`chainId 11155111`). It requires testnet funds for gas. Contract deployment is optional and must never use mainnet credentials.

## Setup

From the workspace root:

```text
npm install
npm run server
npm run dev
```

The frontend normally runs at `http://localhost:5173` and the backend at `http://localhost:5000`.

Copy `article-verifier/.env.example` to `article-verifier/.env` and configure the backend values. Google and LLM credentials belong only in this server environment. `VITE_*` variables are exposed to the browser; only `VITE_API_BASE_URL` is used here, and it is safe because it is a server address rather than a secret.

## Environment Variables

- `GOOGLE_FACT_CHECK_API_KEY`
- `GOOGLE_CUSTOM_SEARCH_API_KEY`
- `GOOGLE_SEARCH_ENGINE_ID`
- `LLM_PROVIDER`
- `LLM_MODEL`
- `LLM_API_KEY`
- `LLM_BASE_URL`
- `PORT`
- `CLIENT_ORIGIN`
- `VITE_API_BASE_URL`
- `BLOCKCHAIN_RPC_URL`
- `BLOCKCHAIN_PRIVATE_KEY`
- `FACT_CHECK_CONTRACT_ADDRESS`
- `BLOCKCHAIN_CHAIN_ID`

The LLM adapter uses an OpenAI-compatible chat-completions endpoint. Leave LLM values empty to run without LLM evaluation; the application remains `UNCERTAIN` rather than pretending evaluation occurred.

## API

### `GET /api/health`

Returns `{ "status": "ok" }` without secrets or internal details.

### `POST /api/analyze`

Request:

```json
{
  "input": "A factual claim or article URL/text",
  "inputType": "claim"
}
```

`inputType` is `claim` or `article`. Article HTTP/HTTPS URLs are fetched with SSRF checks, redirect limits, HTML content validation, response-size limits, and Readability extraction. Article text is processed directly.

Responses use `REAL`, `FAKE`, or `UNCERTAIN`, an integer confidence from 0 to 100, extracted claims, normalized sources, evidence records, an explanation, and a proof object. Without blockchain configuration, proof status is `NOT_CONFIGURED` and includes only the computed result hash.

### `POST /api/proof/verify`

Accepts `{ "analysisId": "..." }`. The backend loads the immutable stored result, canonicalizes and hashes it itself, then compares that hash with the stored and configured contract records. Frontend proof metadata is not trusted.

## Limits and Safety

- Request JSON is limited to 32 KB and input to 10,000 characters.
- Article responses are limited to 2 MB and extracted text to 50,000 characters.
- Article fetching allows at most three redirects and rejects loopback, localhost, private, link-local, and unsupported schemes.
- External requests have finite timeouts.
- Google search snippets are not treated as proof.
- Missing credentials, failed retrieval, unavailable LLM evaluation, mixed evidence, and weak evidence remain `UNCERTAIN`.

## Development Commands

```text
npm run lint
npm test
npm run build
npm run server
npm run compile:contract
npm run deploy:sepolia
```

## Remaining Limitations

- Evidence retrieval currently uses Google Fact Check and Google Custom Search; source-page content retrieval beyond returned excerpts is not implemented.
- The LLM provider is optional and requires compatible credentials and endpoint configuration.
- The verdict engine is conservative and should receive further domain-specific evaluation in later steps.
- Database persistence is implemented; user wallet functionality is not implemented.
