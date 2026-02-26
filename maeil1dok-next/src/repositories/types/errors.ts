export class AuthError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'AuthError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string, public readonly resource?: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermissionError'
  }
}

export class NetworkError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'NetworkError'
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
