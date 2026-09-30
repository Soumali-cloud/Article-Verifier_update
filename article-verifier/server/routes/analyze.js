import { Router } from 'express'
import { env } from '../config/env.js'
import { extractArticle } from '../services/articleExtractor.js'
import { extractClaims } from '../services/claimExtractor.js'
import { evaluateEvidence } from '../services/evidenceEvaluator.js'
import { searchFactChecks } from '../services/factCheck.js'
import { searchSources } from '../services/sourceSearch.js'
import { buildVerdict } from '../services/verdictEngine.js'
import { hashResult } from '../services/hashResult.js'
import { registerProof, verifyProof } from '../services/blockchain.js'
import { canonicalizeResult } from '../services/resultCanonicalizer.js'
import { getAnalysis, saveAnalysis } from '../services/database.js'
import { AppError, ConfigurationError } from '../utils/errors.js'
import { hasUriScheme, isHttpUrl, validateAnalyzeRequest } from '../utils/validation.js'

const router = Router()

const retrieveEvidence = async (claim) => {
  const [factCheckResult, searchResult] = await Promise.allSettled([searchFactChecks(claim), searchSources(claim)])
  const factChecks = factCheckResult.status === 'fulfilled' ? factCheckResult.value : []
  const sources = searchResult.status === 'fulfilled' ? searchResult.value : []
  const failures = [factCheckResult, searchResult].filter((result) => result.status === 'rejected')
  return { factChecks, sources, failures }
}

const toEvidenceRecords = (claimId, sources, evaluations) => evaluations.map((evaluation) => {
  const source = sources.find((item) => item.url === evaluation.sourceUrl)
  return source ? {
    claimId,
    relationship: evaluation.relationship,
    strength: evaluation.strength,
    reason: evaluation.reason,
    excerpt: source.excerpt,
    source: {
      title: source.title,
      url: source.url,
      publisher: source.publisher,
      publishedAt: source.publishedAt,
      retrievedAt: source.retrievedAt
    }
  } : null
}).filter(Boolean)

const createUrlResult = (input) => ({
  claim: input,
  verdict: 'UNCERTAIN',
  confidence: 0,
  explanation: 'Article URL extraction failed or is not available for this URL.',
  claims: [],
  evidence: [],
  sources: [],
  proof: null,
  article: null
})

const finalizeAndStore = async (result, inputType, originalInput) => {
  const resultHash = hashResult(result)
  const proof = await registerProof(result, resultHash)
  try {
    return saveAnalysis({ ...result, proof }, inputType, originalInput)
  } catch (error) {
    console.error('Analysis persistence failed:', error.message)
    throw new AppError('The fact-check completed but could not be saved.', 503, 'DATABASE_UNAVAILABLE')
  }
}

router.post('/', async (request, response, next) => {
  try {
    const { input, inputType } = validateAnalyzeRequest(request.body)
    let article = null
    let text = input

    if (inputType === 'article' && hasUriScheme(input) && !isHttpUrl(input)) {
      throw new AppError('Article URLs must use HTTP or HTTPS.', 400, 'INVALID_ARTICLE_URL')
    }

    if (inputType === 'article' && isHttpUrl(input)) {
      article = await extractArticle(input)
      text = article.text
    }

    const claims = await extractClaims(text, inputType)
    if (!claims.length) {
      const emptyResult = { ...createUrlResult(input), explanation: 'No objectively verifiable claims could be extracted from the supplied content.', article }
      return response.json(await finalizeAndStore(emptyResult, inputType, input))
    }

    const allSources = []
    const claimResults = []
    let hadConfigurationFailure = false
    for (const claim of claims) {
      const retrieved = await retrieveEvidence(claim.text)
      retrieved.failures.forEach((failure) => {
        if (failure.reason?.code === 'CONFIGURATION_ERROR') hadConfigurationFailure = true
      })
      const sources = [...retrieved.factChecks, ...retrieved.sources]
      allSources.push(...sources)
      const evaluationResult = await evaluateEvidence(claim.text, sources)
      const verdict = buildVerdict(claim.text, sources, evaluationResult.evaluations)
      claimResults.push({ ...claim, verdict: verdict.verdict, confidence: verdict.confidence, explanation: verdict.explanation, evidence: toEvidenceRecords(claim.id, sources, evaluationResult.evaluations), evaluation: evaluationResult.failure ? { status: 'FAILED', ...evaluationResult.failure } : { status: 'COMPLETED' } })
    }

    if (!allSources.length && hadConfigurationFailure && !env.googleFactCheckApiKey && !env.googleCustomSearchApiKey) throw new ConfigurationError()

    const overall = claimResults.length === 1
      ? claimResults[0]
      : buildOverallResult(input, claimResults)
    const uniqueSources = [...new Map(allSources.map((source) => [source.url, source])).values()]
    const finalResult = {
      claim: input,
      verdict: overall.verdict,
      confidence: overall.confidence,
      explanation: overall.explanation,
      claims: claimResults,
      evidence: claimResults.flatMap((result) => result.evidence),
      sources: uniqueSources,
      evaluation: claimResults.some((result) => result.evaluation?.status === 'FAILED') ? { status: 'FAILED', failures: claimResults.map((result) => result.evaluation).filter((evaluation) => evaluation.status === 'FAILED') } : { status: 'COMPLETED' },
      proof: null,
      article
    }
    return response.json(await finalizeAndStore(finalResult, inputType, input))
  } catch (error) {
    return next(error)
  }
})

export const proofRouter = Router()

proofRouter.post('/verify', async (request, response, next) => {
  try {
    const analysisId = request.body?.analysisId
    if (typeof analysisId !== 'string' || !analysisId) throw new AppError('analysisId is required.', 400, 'INVALID_ANALYSIS_ID')
    const stored = getAnalysis(analysisId)
    if (!stored) throw new AppError('The requested analysis does not exist.', 404, 'ANALYSIS_NOT_FOUND')
    const result = canonicalizeResult(stored)
    const localHash = hashResult(result)
    const storedHash = stored.proof?.resultHash || null
    const hashMatches = localHash === storedHash
    const blockchain = stored.proof?.status === 'CONFIRMED' ? await verifyProof(localHash) : { status: stored.proof?.status || 'NOT_CONFIGURED', verified: false }
    const blockchainMatches = blockchain.status === 'CONFIRMED' && blockchain.verified === true
    return response.json({ analysisId, localHash, storedHash, hashMatches, localIntegrityVerified: hashMatches, blockchain, verified: hashMatches && blockchainMatches })
  } catch (error) {
    return next(error)
  }
})

const buildOverallResult = (claim, claims) => {
  const verdicts = new Set(claims.map((item) => item.verdict))
  const verdict = verdicts.size === 1 ? claims[0].verdict : 'UNCERTAIN'
  const confidence = verdict === 'UNCERTAIN' ? Math.min(69, Math.round(claims.reduce((sum, item) => sum + item.confidence, 0) / claims.length)) : Math.min(...claims.map((item) => item.confidence))
  return {
    claim,
    verdict,
    confidence,
    explanation: verdict === 'UNCERTAIN' ? 'The article contains mixed or insufficiently evaluated claims, so the overall result remains uncertain.' : `All extracted claims received the ${verdict} result under the conservative evidence rule.`
  }
}

export default router
