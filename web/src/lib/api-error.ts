import axios from 'axios'
import type { ApiErrorBody } from './types'

// Turns anything thrown by an API call into the API's error shape, so
// components can always read `code` and `message`.
export function getApiError(error: unknown): ApiErrorBody {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as Partial<ApiErrorBody> | undefined
    if (body?.code && body.message) {
      return body as ApiErrorBody
    }
    if (!error.response) {
      return {
        statusCode: 0,
        code: 'NETWORK_ERROR',
        message: 'Cannot reach the server. Check that the API is running.',
      }
    }
    return {
      statusCode: error.response.status,
      code: 'UNKNOWN_ERROR',
      message: error.message,
    }
  }
  return {
    statusCode: 0,
    code: 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : 'Something went wrong',
  }
}
