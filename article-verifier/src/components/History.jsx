import './History.css'

export default function History({ items, loading, error, onRetry, onSelect }) {
  return (
    <section className="history-section" aria-labelledby="history-title">
      <div className="history-header">
        <h2 id="history-title" className="section-title">FACT CHECK HISTORY</h2>
        <button className="btn btn-secondary" onClick={onRetry} type="button" disabled={loading}>Refresh</button>
      </div>
      {loading ? <p className="history-empty" role="status">Loading history...</p> : error ? <div className="history-empty"><p>{error}</p><button className="btn btn-secondary" onClick={onRetry} type="button">Retry</button></div> : items.length === 0 ? <p className="history-empty">No fact checks yet.</p> : (
        <div className="history-list">
          {items.map((item) => (
            <article className="history-item" key={item.id}>
              <div>
                <h3>{item.verdict} <span>{item.confidence}%</span></h3>
                <p>{item.claim}</p>
                <small>{new Date(item.createdAt).toLocaleString()} · On-chain proof: {item.proofStatus === 'CONFIRMED' ? 'Confirmed' : item.proofStatus === 'NOT_CONFIGURED' ? 'Not configured' : item.proofStatus}</small>
              </div>
              <button className="btn btn-primary" onClick={() => onSelect(item.id)} type="button">View Result</button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
