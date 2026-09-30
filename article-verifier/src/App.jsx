import { useEffect, useRef, useState } from 'react'
import './App.css'
import Analyzer from './components/Analyzer'
import Result from './components/Result'
import History from './components/History'

const MAX_INPUT_LENGTH = 10000

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')
const getFriendlyError = (payload, fallback) => {
  const code = payload?.error?.code
  if (code === 'RATE_LIMITED') return 'Too many requests. Please wait a moment and try again.'
  if (code === 'DATABASE_UNAVAILABLE') return 'The fact-check completed, but could not be saved.'
  if (code === 'ANALYSIS_NOT_FOUND') return 'That historical fact check could not be found.'
  if (code === 'CONFIGURATION_ERROR') return 'Google fact-checking is not configured. Add the backend Google API credentials to article-verifier/.env.'
  if (code === 'EXTERNAL_SERVICE_ERROR') return 'Fact-checking service is temporarily unavailable.'
  return payload?.error?.message || payload?.error || fallback
}

function App() {
  const [analysisResult, setAnalysisResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inputType, setInputType] = useState('claim')
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [verification, setVerification] = useState(null)
  const requestRef = useRef({ id: 0, controller: null })

  const handleAnalyze = async (claim) => {
    if (loading || claim.length > MAX_INPUT_LENGTH) return

    requestRef.current.controller?.abort()
    const controller = new AbortController()
    const requestId = requestRef.current.id + 1
    requestRef.current = { id: requestId, controller }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: claim, inputType }),
        signal: controller.signal
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(getFriendlyError(payload, 'The analysis could not be completed.'))
      }

      const result = payload

      if (requestRef.current.id === requestId && !controller.signal.aborted) {
        setAnalysisResult(result)
        loadHistory()
      }
    } catch (requestError) {
      if (requestError.name !== 'AbortError' && requestRef.current.id === requestId) {
        setError(requestError.message || 'The analysis could not be completed. Please try again.')
      }
    } finally {
      if (requestRef.current.id === requestId) {
        setLoading(false)
        requestRef.current.controller = null
      }
    }
  }

  const loadHistory = async () => {
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/analyses?page=1&limit=10`)
      const payload = await response.json()
      if (!response.ok) throw new Error(getFriendlyError(payload, 'History unavailable.'))
      setHistory(payload.items || [])
    } catch {
      setHistory([])
      setHistoryError('Unable to load fact-check history.')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    fetch(`${API_BASE_URL}/api/analyses?page=1&limit=10`)
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(getFriendlyError(payload, 'History unavailable.'))
        if (active) setHistory(payload.items || [])
      })
      .catch(() => {
        if (active) {
          setHistory([])
          setHistoryError('Unable to load fact-check history.')
        }
      })
      .finally(() => {
        if (active) setHistoryLoading(false)
      })

    return () => { active = false }
  }, [])

  const loadAnalysis = async (id) => {
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/analyses/${encodeURIComponent(id)}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(getFriendlyError(payload, 'Analysis not found.'))
      setAnalysisResult(payload)
      setVerification(null)
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  const verifyProof = async () => {
    if (!analysisResult?.id) return
    setVerification({ loading: true })
    try {
      const response = await fetch(`${API_BASE_URL}/api/proof/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analysisId: analysisResult.id }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(getFriendlyError(payload, 'Proof verification failed.'))
      setVerification(payload)
    } catch (verifyError) {
      setVerification({ error: verifyError.message })
    }
  }

  const handleClear = () => {
    requestRef.current.controller?.abort()
    requestRef.current = { id: requestRef.current.id + 1, controller: null }
    setAnalysisResult(null)
    setError('')
    setLoading(false)
    setVerification(null)
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <h1 className="title">Truth Detective</h1>
          <p className="subtitle">Compare claims with external fact-checks and references, then inspect language risk.</p>
        </div>
      </header>

      <main className="main-content">
        <div className="analyzer-section">
          <Analyzer
            onAnalyze={handleAnalyze}
            loading={loading}
            error={error}
            inputType={inputType}
            onInputTypeChange={setInputType}
            onClear={handleClear}
          />
        </div>
        <div className="result-section">
          {analysisResult ? (
            <Result result={analysisResult} verification={verification} onVerifyProof={verifyProof} />
          ) : (
            <div className="empty-state">
              <p>Enter a claim or article to begin analysis</p>
            </div>
          )}
        </div>
      </main>
      <History items={history} loading={historyLoading} error={historyError} onRetry={loadHistory} onSelect={loadAnalysis} />
    </div>
  )
}

export default App
