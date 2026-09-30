export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
  }
}

export class ConfigurationError extends AppError {
  constructor(message = 'Google API credentials are not configured.') {
    super(message, 503, 'CONFIGURATION_ERROR')
  }
}

export class ExternalServiceError extends AppError {
  constructor(message = 'Unable to retrieve fact-check sources.', statusCode = 502) {
    super(message, statusCode, 'EXTERNAL_SERVICE_ERROR')
  }
}

export const errorHandler = (error, _request, response, _next) => {
  void _next

  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: { message: 'Request body is too large.', code: 'REQUEST_TOO_LARGE' } })
  }

  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ error: { message: 'Request body must be valid JSON.', code: 'INVALID_JSON' } })
  }

  if (error instanceof AppError) {
    return response.status(error.statusCode).json({ error: { message: error.message, code: error.code } })
  }

  console.error('Unhandled server error:', error.message)
  return response.status(500).json({ error: { message: 'Unexpected server error.', code: 'INTERNAL_ERROR' } })
}
