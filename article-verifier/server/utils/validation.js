import { AppError } from './errors.js'

export const MAX_INPUT_LENGTH = 10000
const validInputTypes = new Set(['claim', 'article'])

export const validateAnalyzeRequest = (body = {}) => {
  const { input, inputType } = body

  if (typeof input !== 'string' || !input.trim()) {
    throw new AppError('Input must be a non-empty string.', 400, 'INVALID_INPUT')
  }

  if (input.length > MAX_INPUT_LENGTH) {
    throw new AppError(`Input must not exceed ${MAX_INPUT_LENGTH} characters.`, 400, 'INPUT_TOO_LONG')
  }

  if (!validInputTypes.has(inputType)) {
    throw new AppError('inputType must be either "claim" or "article".', 400, 'INVALID_INPUT_TYPE')
  }

  return { input: input.trim(), inputType }
}

export const isHttpUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export const hasUriScheme = (value) => /^[a-z][a-z\d+.-]*:/i.test(value)
