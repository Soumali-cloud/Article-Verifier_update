import { env, hasLlmCredentials } from '../config/env.js'
import { ConfigurationError, ExternalServiceError } from '../utils/errors.js'

const REQUEST_TIMEOUT_MS = 120000

const parseJson = (content) => {
  const fenced =
    content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] || content

  return JSON.parse(fenced)
}

const callLlm = async (systemPrompt, userPrompt) => {
  if (!hasLlmCredentials()) {
    throw new ConfigurationError('LLM credentials are not configured.')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  )

  try {
    const response = await fetch(
      `${env.llmBaseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.llmApiKey}`,
        },
        body: JSON.stringify({
          model: env.llmModel,
          temperature: 0,
          response_format: {
            type: 'json_object',
          },
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        }),
        signal: controller.signal,
      },
    )

    if (!response.ok) {
      let errorDetails = ''

      try {
        errorDetails = await response.text()
      } catch {
        errorDetails = 'Unable to read the LLM error response.'
      }

      console.error('LLM API error:', {
        status: response.status,
        statusText: response.statusText,
        details: errorDetails,
      })

      throw new ExternalServiceError(
        `LLM API request failed (${response.status}): ${errorDetails}`,
        response.status === 429 ? 429 : 502,
      )
    }

    const data = await response.json()

    const content = data.choices?.[0]?.message?.content

    if (typeof content !== 'string') {
      throw new ExternalServiceError(
        'The LLM returned a malformed response.',
      )
    }
const parsed = parseJson(content)

console.log(
  'LLM EVIDENCE RESPONSE:',
  JSON.stringify(parsed, null, 2),
)
    return parseJson(content)
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ExternalServiceError(
        'LLM request timed out.',
        504,
      )
    }

    if (
      error instanceof ConfigurationError ||
      error instanceof ExternalServiceError
    ) {
      throw error
    }

    console.error('Unexpected LLM error:', error)

    throw new ExternalServiceError(
      'Unable to evaluate evidence with the configured LLM.',
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

export const extractClaimsWithLlm = (text) =>
  callLlm(
    `
You are a factual claim extraction system.

Extract only objectively verifiable factual claims from the supplied text.

Rules:
- Preserve the original meaning.
- Do not add facts.
- Separate multiple independent factual claims.
- Ignore opinions, predictions, speculation, questions, advertisements, instructions, and navigation text.
- Each claim must be something that can potentially be verified using reliable evidence.

Return JSON only in this exact structure:

{
  "claims": [
    {
      "id": "claim-1",
      "text": "..."
    }
  ]
}
`.trim(),
    text,
  )

export const evaluateEvidenceWithLlm = (claim, evidence) =>
  callLlm(
    `
You are the evidence evaluation component of a fact-checking system.

Your task is to evaluate the supplied evidence AGAINST the supplied claim.

IMPORTANT:
- Use ONLY the evidence supplied in the user message.
- Do NOT invent sources, URLs, facts, quotations, dates, or events.
- Do NOT use general world knowledge that is not present in the supplied evidence.
- Every sourceUrl in your answer MUST exactly match one of the supplied evidence URLs.
- Evaluate each supplied evidence item independently.
- Do not automatically mark evidence UNKNOWN merely because it is a fact-check article.
- Read the title, snippet, description, extracted text, and other supplied fields carefully.

RELATIONSHIP DEFINITIONS:

SUPPORTS:
Use SUPPORTS when the supplied source provides information that directly or substantially confirms the claim.

Examples:
- Claim: "Nepal experienced flooding."
- Evidence: A source explicitly reports flooding occurring in Nepal.
- Relationship: SUPPORTS.

CONTRADICTS:
Use CONTRADICTS when the supplied source explicitly says the claim is false, debunks the exact claim, or provides information that directly conflicts with the claim.

Examples:
- Claim: "A video shows flooding in Nepal."
- Evidence: A fact-check says the video is old footage from another country.
- Relationship: CONTRADICTS.

UNKNOWN:
Use UNKNOWN only when the supplied source does not provide enough information to establish either support or contradiction.

Examples:
- The source discusses a related topic but does not establish whether the claim is true.
- The source mentions Nepal but says nothing relevant to the claim.
- The source discusses a different event, location, date, person, or video.

STRENGTH:

For SUPPORTS or CONTRADICTS:
- 0.9 to 1.0 = direct and very strong evidence
- 0.7 to 0.89 = strong evidence
- 0.4 to 0.69 = moderate or partial evidence
- 0.1 to 0.39 = weak evidence

For UNKNOWN:
- strength MUST be 0

IMPORTANT:
Do not give a strength of 0 to SUPPORTS or CONTRADICTS unless the evidence truly has no useful strength.

REASON:
For every evaluation, provide a short explanation based specifically on the supplied source.
Do not make claims that are not supported by the supplied evidence.

Return JSON only in exactly this structure:

{
  "evaluations": [
    {
      "sourceUrl": "EXACT_SOURCE_URL",
      "relationship": "SUPPORTS",
      "strength": 0.85,
      "reason": "The source explicitly reports ..."
    }
  ]
}
`.trim(),
    JSON.stringify(
      {
        claim,
        evidence,
      },
      null,
      2,
    ),
  )