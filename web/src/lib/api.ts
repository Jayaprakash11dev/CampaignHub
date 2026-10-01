import axios from 'axios'
import { clearAuth, readAuth } from './auth-storage'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
})

// Attach the JWT to every request.
api.interceptors.request.use((config) => {
  const auth = readAuth()
  if (auth) {
    config.headers.Authorization = `Bearer ${auth.token}`
  }
  return config
})

// A 401 on any call except login means the token expired or the user was
// removed: clear it and send them back to the login page.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/login')
    ) {
      clearAuth()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?expired=1')
      }
    }
    return Promise.reject(error)
  },
)
