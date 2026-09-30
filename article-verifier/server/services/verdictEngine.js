const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)))

export const buildVerdict = (claim, sources, evaluations) => {
  const allEvaluations = evaluations
  const supports = allEvaluations.filter((item) => item.relationship === 'SUPPORTS')
  const contradicts = allEvaluations.filter((item) => item.relationship === 'CONTRADICTS')
  const supportStrength = supports.reduce((total, item) => total + item.strength, 0)
  const contradictionStrength = contradicts.reduce((total, item) => total + item.strength, 0)
  const totalStrength = supportStrength + contradictionStrength

  let verdict = 'UNCERTAIN'

  if (
    supportStrength >= 1.4 &&
    contradictionStrength < supportStrength * 0.35
  ) {
    verdict = 'REAL'
  }

  if (
    contradictionStrength >= 1.4 &&
    supportStrength < contradictionStrength * 0.35
  ) {
    verdict = 'FAKE'
  }

  const agreement = Math.max(
    supportStrength,
    contradictionStrength,
  )

  const confidence =
    totalStrength === 0
      ? 0
      : clamp(
          100 *
            (agreement /
              (agreement + Math.max(1, totalStrength - agreement))) *
            Math.min(1, agreement / 1.4),
        )

  const explanation =
    verdict === 'UNCERTAIN'
      ? 'Available evidence is insufficient or mixed for a reliable verdict.'
      : verdict === 'REAL'
        ? `The claim is supported by ${supports.length} evaluated source(s), with no comparable contradiction.`
        : `The claim is contradicted by ${contradicts.length} evaluated source(s), with no comparable support.`

  return {
    claim,
    verdict,
    confidence,
    explanation,
    evidence: allEvaluations,
    proof: null,
  }
}