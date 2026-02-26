import { AuthError, NotFoundError, PermissionError, NetworkError, ValidationError } from './errors'

export type RepositoryError =
  | AuthError
  | NotFoundError
  | PermissionError
  | NetworkError
  | ValidationError

export type RepositoryResult<T> =
  | { success: true; data: T }
  | { success: false; error: RepositoryError }

export interface PaginationOptions {
  page?: number
  limit?: number
  offset?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}
