import { useState } from 'react'
import './Result.css'

const formatDate = (value) => {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString()
}
const formatProof = (proof) => proof?.status === 'NOT_CONFIGURED' ? 'Blockchain proof is not configured.' : proof?.status === 'FAILED' ? 'Blockchain proof could not be recorded.' : proof?.status === 'PENDING' ? 'Recording proof on blockchain...' : proof?.status === 'CONFIRMED' ? 'Proof recorded on-chain. Blockchain confirms the integrity of this result, not the truth of the underlying claim.' : 'Proof status unavailable.'

export default function Result({ result, verification, onVerifyProof }) {
  const confidence = Number.isInteger(result.confidence) ? result.confidence : 0
  const evidence = Array.isArray(result.evidence) ? result.evidence : []
  const sources = Array.isArray(result.sources) ? result.sources : []
  const claims = Array.isArray(result.claims) ? result.claims : []
  const [copyState, setCopyState] = useState('')

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(result.proof.resultHash)
      setCopyState('Copied')
    } catch {
      setCopyState('Copy failed')
    }
  }

  return (
    <div className="result-card">
      <div className="result-header"><h2 className="section-title">RESULT</h2></div>
      <div className="result-content">
        <div className="status-section">
          <h3 className="status-title">{result.verdict}</h3>
          <div className="confidence-circle"><div className="confidence-value">{confidence}%</div></div>
          <p className="evidence-detail">Confidence reflects the strength and consistency of retrieved evidence, not the probability of objective truth.</p>
          <p className="confidence-reason">{result.explanation}</p>
        </div>

        {result.article && (
          <div className="evidence-section">
            <h4 className="evidence-title">ARTICLE</h4>
            <p className="evidence-detail">{result.article.title || 'Untitled article'}<br />{result.article.publisher || 'Unknown publisher'}<br />Retrieved {formatDate(result.article.retrievedAt)}</p>
          </div>
        )}

        {claims.length > 1 && (
          <div className="evidence-section">
            <h4 className="evidence-title">EXTRACTED CLAIMS</h4>
            {claims.map((claim) => <div className="evidence-item" key={claim.id}><div className="evidence-header"><span className="evidence-name">{claim.text}</span><span className="evidence-badge">{claim.verdict} · {claim.confidence}%</span></div><p className="evidence-detail">{claim.explanation}</p></div>)}
          </div>
        )}

        <div className="evidence-section">
          <h4 className="evidence-title">EVIDENCE</h4>
          {evidence.length ? evidence.map((item, index) => (
            <div className="evidence-item" key={`${item.claimId || 'evidence'}-${index}`}>
              <div className="evidence-header"><span className="evidence-name">{item.relationship}</span><span className="evidence-badge">Strength {Math.round((item.strength || 0) * 100)}%</span></div>
              <p className="evidence-detail">{item.reason || 'No evaluation reason available.'}</p>
              {item.source && <p className="evidence-detail"><strong>{item.source.title}</strong> · {item.source.publisher}<br />Published: {formatDate(item.source.publishedAt)} · Retrieved: {formatDate(item.source.retrievedAt)}<br /><a href={item.source.url} target="_blank" rel="noreferrer">Open actual source</a></p>}
            </div>
          )) : <p className="evidence-detail">{result.evaluation?.status === 'FAILED' ? `Evidence evaluation failed: ${result.evaluation.failures?.[0]?.message || result.evaluation.message || 'The LLM could not evaluate the retrieved sources.'}` : 'No evidence was evaluated.'}</p>}
        </div>

        <div className="sources-section">
          <h4 className="evidence-title">RETRIEVED SOURCES</h4>
          {sources.length ? sources.map((source) => <div className="source-item" key={source.url}><div className="source-name">{source.title}</div><p className="source-description">{source.publisher} · {source.sourceType} · Retrieved {formatDate(source.retrievedAt)}</p><p className="article-summary">{source.excerpt || 'No excerpt available. Search snippets are not treated as proof.'}</p><a className="article-link" href={source.url} target="_blank" rel="noreferrer">Open actual source</a></div>) : <p className="evidence-detail">No sources were retrieved.</p>}
        </div>

        <div className="proof-section">
          <h4 className="evidence-title">ON-CHAIN PROOF</h4>
          <p className="evidence-detail">{formatProof(result.proof)}</p>
          {result.proof?.resultHash && <p className="evidence-detail"><strong>Proof hash:</strong> {result.proof.resultHash}</p>}
          {result.proof?.resultHash && <button className="btn btn-secondary" type="button" onClick={copyHash}>{copyState || 'Copy hash'}</button>}
          {result.proof?.chainId && <p className="evidence-detail"><strong>Chain ID:</strong> {result.proof.chainId}</p>}
          {result.proof?.network && <p className="evidence-detail"><strong>Network:</strong> {result.proof.network}</p>}
          {result.proof?.contractAddress && <p className="evidence-detail"><strong>Contract:</strong> {result.proof.contractAddress}</p>}
          {result.proof?.transactionHash && <p className="evidence-detail"><strong>Transaction:</strong> {result.proof.transactionHash}</p>}
          {result.proof?.blockNumber !== null && result.proof?.blockNumber !== undefined && <p className="evidence-detail"><strong>Block:</strong> {result.proof.blockNumber}</p>}
          {result.proof?.timestamp && <p className="evidence-detail"><strong>Blockchain timestamp:</strong> {formatDate(result.proof.timestamp)}</p>}
          {result.proof?.explorerUrl && <a className="article-link" href={result.proof.explorerUrl} target="_blank" rel="noreferrer">View transaction</a>}
          {result.id && <button className="btn btn-primary" type="button" onClick={onVerifyProof} disabled={verification?.loading}>{verification?.loading ? 'Checking integrity...' : 'Verify Proof'}</button>}
          {verification?.verified && <p className="evidence-detail">Result integrity verified. Blockchain proof verified.</p>}
          {verification && !verification.loading && !verification.verified && <p className="input-error">{verification.error || (verification.hashMatches === false ? 'Result has been modified.' : verification.blockchain?.status === 'NOT_CONFIGURED' ? 'Blockchain proof is unavailable for this analysis.' : verification.blockchain?.status === 'CONFIRMED' ? 'Blockchain proof does not match this result.' : 'Blockchain proof could not be verified.')}</p>}
        </div>
      </div>
    </div>
  )
}
