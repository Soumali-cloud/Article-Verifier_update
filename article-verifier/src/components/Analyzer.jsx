import { useState } from 'react'
import './Analyzer.css'

const MAX_INPUT_LENGTH = 10000

export default function Analyzer({ onAnalyze, loading, error, inputType, onInputTypeChange, onClear }) {
  const [claim, setClaim] = useState('')
  const isOverLimit = claim.length > MAX_INPUT_LENGTH

  const handleAnalyzeClick = () => {
    if (!loading && claim.trim() && !isOverLimit) {
      onAnalyze(claim)
    }
  }

  const handleClear = () => {
    setClaim('')
    onClear()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleAnalyzeClick()
    }
  }

  return (
    <div className="analyzer-card">
      <div className="analyzer-header">
        <h2 className="section-title">ANALYZER</h2>
        <h3 className="analyzer-subtitle">Article or claim</h3>
      </div>

      <div className="analyzer-content">
        <div className="input-mode" role="group" aria-label="Input type">
          <label>
            <input type="radio" name="inputType" value="claim" checked={inputType === 'claim'} onChange={(e) => onInputTypeChange(e.target.value)} disabled={loading} />
            Claim
          </label>
          <label>
            <input type="radio" name="inputType" value="article" checked={inputType === 'article'} onChange={(e) => onInputTypeChange(e.target.value)} disabled={loading} />
            Article or URL
          </label>
        </div>
        <textarea
          className="claim-input"
          placeholder={inputType === 'article' ? 'Paste an article URL or article text...' : "Enter a factual claim..."}
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          maxLength={MAX_INPUT_LENGTH + 1}
          aria-invalid={isOverLimit}
        />

        <div className={`character-count ${isOverLimit ? 'character-count-error' : ''}`}>
          {claim.length} / {MAX_INPUT_LENGTH} characters
        </div>

        {isOverLimit && <p className="input-error">Input exceeds the {MAX_INPUT_LENGTH.toLocaleString()}-character limit.</p>}
        {error && <p className="input-error" role="alert">{error}</p>}

        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={handleAnalyzeClick}
            disabled={loading || !claim.trim()}
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleClear}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
