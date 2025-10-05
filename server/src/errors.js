export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    if (details) {
      this.details = details
    }
  }
}

export const notFound = (message = 'Resource not found') => new HttpError(404, message)

export const badRequest = (message, details) => new HttpError(400, message, details)

export const conflict = (message, details) => new HttpError(409, message, details)

export const internalError = (message = 'Internal server error') => new HttpError(500, message)
