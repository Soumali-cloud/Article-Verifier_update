import { hasLlmCredentials } from '../config/env.js'
import { evaluateEvidenceWithLlm } from './llm.js'

const relationships = new Set(['SUPPORTS', 'CONTRADICTS', 'UNKNOWN'])

export const validateEvaluations = (result, evidence) => {
  const allowedUrls = new Set(evidence.map((item) => item.url))

  if (!Array.isArray(result?.evaluations)) {
    return []
  }

  return result.evaluations
    .filter(
      (item) =>
        allowedUrls.has(item.sourceUrl) &&
        relationships.has(item.relationship),
    )
    .map((item) => ({
      sourceUrl: item.sourceUrl,
      relationship: item.relationship,
      strength: Number.isFinite(item.strength)
        ? Math.min(1, Math.max(0, item.strength))
        : 0,
      reason:
        typeof item.reason === 'string'
          ? item.reason
          : 'The evidence evaluation did not include a reason.',
    }))
}

export const evaluateEvidence = async (claim, evidence) => {
  if (!hasLlmCredentials()) {
    return {
      evaluations: [],
      failure: {
        code: 'LLM_NOT_CONFIGURED',
        message: 'LLM evidence evaluation is not configured.',
      },
    }
  }

  if (!evidence.length) {
    return {
      evaluations: [],
      failure: {
        code: 'NO_EVIDENCE',
        message: 'No retrieved evidence was available for evaluation.',
      },
    }
  }

  try {
    const result = await evaluateEvidenceWithLlm(claim, evidence)
    const evaluations = validateEvaluations(result, evidence)

    if (!evaluations.length) {
      return {
        evaluations,
        failure: {
          code: 'LLM_EMPTY_EVALUATION',
          message: 'The LLM returned no valid evidence evaluations.',
        },
      }
    }

    return {
      evaluations,
      failure: null,
    }
  } catch (error) {
    const code =
      error.statusCode === 429
        ? 'LLM_QUOTA_EXCEEDED'
        : error.statusCode === 504
          ? 'LLM_TIMEOUT'
          : 'LLM_EVALUATION_FAILED'

    console.warn(`Evidence evaluation failed (${code}).`)

    return {
      evaluations: [],
      failure: {
        code,
        message:
          error.statusCode === 429
            ? (
                error.message ||
                'The LLM request was rate limited or its quota was exceeded.'
              )
            : error.statusCode === 504
              ? 'The LLM evidence evaluation timed out.'
              : (
                  error.message ||
                  'The LLM evidence evaluation failed.'
                ),
      },
    }
  }
}