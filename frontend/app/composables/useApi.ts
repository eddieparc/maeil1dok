import { useRuntimeConfig } from '#app'
import { useAuthService } from '~/composables/useAuthService'

type AxiosConfig = {
  headers?: Record<string, string>
  params?: Record<string, any>
}

type AxiosRequestConfig = AxiosConfig;

const CSRF_TOKEN_KEY = 'csrfToken'

export const saveCsrfToken = (token: string): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CSRF_TOKEN_KEY, token)
  }
}

export const useApi = () => {
  const config = useRuntimeConfig()

  const auth = useAuthService()

  const getBaseUrl = () => {
    if (process.server) {
      return process.env.DOCKER_ENV === 'true' ? 'http://backend:8000' : 'http://localhost:8019'
    }
    return config.public.apiBase
  }

  const getCsrfToken = (): string | null => {
    if (typeof window === 'undefined') return null
    
    const storedToken = localStorage.getItem(CSRF_TOKEN_KEY)
    if (storedToken) return storedToken
    
    const match = document.cookie.match(/csrftoken=([^;]+)/)
    return match?.[1] ?? null
  }

  const getHeaders = (includeCsrf: boolean = false): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (includeCsrf) {
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken
      }
    }
    
    return headers
  }

  // API 에러 클래스 - 상태 코드 + 응답 본문 포함
  class ApiError extends Error {
    status: number
    data: any
    constructor(message: string, status: number, data: any = null) {
      super(message)
      this.name = 'ApiError'
      this.status = status
      this.data = data
    }
  }

  // 401 에러 시 토큰 갱신 후 재시도하는 공통 함수
  const fetchWithRetry = async (
    url: string,
    options: RequestInit,
    requiresAuth: boolean = true
  ) => {
    const auth = useAuthService()

    if (requiresAuth && !auth.isAuthenticated.value) {
      throw new ApiError('Authentication required', 401)
    }

    let response = await fetch(url, options)

    const csrfTokenFromHeader = response.headers.get('X-CSRFToken')
    if (csrfTokenFromHeader) {
      saveCsrfToken(csrfTokenFromHeader)
    }

    if (response.status === 401) {
      if (auth.isAuthenticated.value) {
        const refreshSuccess = await auth.refreshToken()

        if (refreshSuccess) {
          const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
            (options.method || 'GET').toUpperCase()
          )
          options.headers = getHeaders(isMutatingMethod)
          response = await fetch(url, options)
          
          const retryTokenFromHeader = response.headers.get('X-CSRFToken')
          if (retryTokenFromHeader) {
            saveCsrfToken(retryTokenFromHeader)
          }
        } else {
          if (auth.isAuthenticated.value) {
            auth.logout()
          }
          throw new ApiError('Authentication failed', 401)
        }
      } else {
        throw new ApiError('Not authenticated', 401)
      }
    }

    if (!response.ok) {
      // 백엔드 에러 본문(error/detail/message)을 ApiError.data로 전달해
      // 호출 측에서 사용자에게 구체적 메시지를 보여줄 수 있게 한다.
      let body: any = null
      try {
        body = await response.clone().json()
      } catch {
        body = null
      }
      const message = body?.error || body?.detail || body?.message || `API request failed: ${response.status}`
      throw new ApiError(message, response.status, body)
    }

    return response
  }

  const get = async (url: string, config?: AxiosRequestConfig) => {
    try {
      let fullUrl = `${getBaseUrl()}${url}`
      if (config?.params) {
        const searchParams = new URLSearchParams()
        Object.entries(config.params).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            searchParams.append(key, value.toString())
          }
        })
        fullUrl += `?${searchParams.toString()}`
      }

      // 인증이 필요한 URL 경로 정의
      // 비로그인 사용자도 영상 개론 목록과 개별 영상 정보를 조회할 수 있도록 예외 처리
      const isVideoIntroAPI = url.includes('/api/v1/todos/user/video/intro/') || // 목록 조회 API
                             url.includes('/api/v1/todos/video/intro/');         // 개별 영상 조회 API

      // /api/v1/auth/user/는 인증 상태 확인용 엔드포인트이므로 guard에서 제외
      // 쿠키 기반 인증에서 새로고침 시 서버로 요청을 보내서 쿠키 유효성을 확인해야 함
      const isAuthCheckEndpoint = url.includes('/api/v1/auth/user/') ||
                                  url.includes('/api/v1/auth/verify/');

      const requiresAuth = url.includes('/api/v1/todos/hasena/status/') ||
                           url.includes('/api/v1/todos/plans/user/') ||  // 사용자 플랜 목록
                           (url.includes('/api/v1/todos/user/') && !isVideoIntroAPI);

      const auth = useAuthService();
      // 인증 확인 엔드포인트는 항상 서버로 요청 (쿠키 기반 인증 지원)
      if (requiresAuth && !isAuthCheckEndpoint && !auth.isAuthenticated.value) {
        return { data: { success: false, message: 'Authentication required' } };
      }

      const response = await fetchWithRetry(fullUrl, {
        headers: getHeaders(false),
        credentials: 'include'
      }, requiresAuth && !isAuthCheckEndpoint)

      const data = await response.json()
      return { data }
    } catch (error) {
      throw error
    }
  }

  const post = async (url: string, data?: any, config?: AxiosRequestConfig) => {
    const fullUrl = `${getBaseUrl()}${url}`

    try {
      const isFormData = data instanceof FormData;
      const headers = getHeaders(true);

      if (isFormData) {
        delete headers['Content-Type'];
      }

      const publicEndpoints = [
        '/api/v1/auth/register/',
        '/api/v1/auth/token/',
        '/api/v1/auth/social-login/',
        '/api/v1/auth/complete-kakao-signup/',
        '/api/v1/auth/check-username/',
        '/api/v1/auth/check-nickname/',
        '/api/v1/auth/email-register/',
        '/api/v1/auth/email-login/',
        '/api/v1/auth/social-login/v2/',
        '/api/v1/auth/complete-social-signup/',
        '/api/v1/auth/send-verification/',
        '/api/v1/auth/verify-email/',
        '/api/v1/auth/request-password-reset/',
        '/api/v1/auth/verify-reset-token/',
        '/api/v1/auth/reset-password/'
      ];

      const requiresAuth = !publicEndpoints.some(endpoint => url.includes(endpoint));

      const response = await fetchWithRetry(fullUrl, {
        method: 'POST',
        headers: headers,
        body: isFormData ? data : JSON.stringify(data),
        credentials: 'include'
      }, requiresAuth)

      return response.json()
    } catch (error) {
      throw error
    }
  }

  const put = async (url: string, data: any) => {
    const fullUrl = `${getBaseUrl()}${url}`

    try {
      const response = await fetchWithRetry(fullUrl, {
        method: 'PUT',
        headers: getHeaders(true),
        body: JSON.stringify(data),
        credentials: 'include'
      })

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  const patch = async (url: string, data: any) => {
    const fullUrl = `${getBaseUrl()}${url}`

    try {
      const response = await fetchWithRetry(fullUrl, {
        method: 'PATCH',
        headers: getHeaders(true),
        body: JSON.stringify(data),
        credentials: 'include'
      })

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  return {
    get,
    post,
    put,
    patch,
    async delete(url: string) {
      try {
        const response = await fetchWithRetry(`${getBaseUrl()}${url}`, {
          method: 'DELETE',
          headers: getHeaders(true),
          credentials: 'include'
        })
        return response.json()
      } catch (error) {
        throw error
      }
    },
    async upload(url: string, formData: FormData) {
      try {
        const headers: Record<string, string> = {}
        const csrfToken = getCsrfToken()
        if (csrfToken) {
          headers['X-CSRFToken'] = csrfToken
        }

        const response = await fetchWithRetry(`${getBaseUrl()}${url}`, {
          method: 'POST',
          headers,
          body: formData,
          credentials: 'include'
        })
        return response.json()
      } catch (error) {
        throw error
      }
    },
  }
}