import { useRuntimeConfig } from '#app'
import { useAuthService } from '~/composables/useAuthService'
import type {
  ApiPath,
  ApiPathFor,
  ApiQueryParameters,
  ApiResponseBody,
} from '~/types/api-contract'

type AxiosConfig = {
  headers?: Record<string, string>
  params?: Record<string, any>
}

type AxiosRequestConfig = AxiosConfig;

const CSRF_TOKEN_KEY = 'csrfToken'

type PathParameterNames<Path extends string> =
  Path extends `${string}{${infer Parameter}}${infer Rest}`
    ? Parameter | PathParameterNames<Rest>
    : never

type PathParameters<Path extends ApiPath> = {
  [Parameter in PathParameterNames<Path>]: string | number
}

const apiPath = <Path extends ApiPath>(
  template: Path,
  parameters: PathParameters<Path>,
): Path => {
  let result: string = template

  for (const [name, value] of Object.entries(parameters)) {
    result = result.replace(`{${name}}`, encodeURIComponent(String(value)))
  }

  return result as Path
}

export const saveCsrfToken = (token: string): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CSRF_TOKEN_KEY, token)
  }
}

// 204/205(No Content) 응답은 본문이 비어 있어 response.json() 호출 시
// "Unexpected end of JSON input" SyntaxError가 발생한다. 삭제(DELETE)류
// 엔드포인트는 대부분 204를 반환하므로, 성공했는데도 예외로 처리되어
// 에러 토스트가 뜨고 로컬 상태 정리가 중단되는 버그를 막기 위해
// 본문 없는 응답은 null로 안전하게 파싱한다.
export const readJsonBody = async (response: { status: number; json: () => Promise<any> }): Promise<any> => {
  if (response.status === 204 || response.status === 205) {
    return null
  }
  return response.json()
}

export const useApi = () => {
  const config = useRuntimeConfig()

  const getBaseUrl = () => {
    if (import.meta.server) {
      if (config.internalApiBase) {
        return config.internalApiBase as string
      }
      return config.public.apiBase as string
    }
    return config.public.apiBase as string
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
        // refreshToken() returns a reasoned outcome, not a boolean: an object is
        // always truthy, so testing it directly would read a failed refresh as a
        // success and retry the request with the same dead credentials.
        const refreshOutcome = await auth.refreshToken({ logoutOnFailure: false })
        const refreshSuccess =
          refreshOutcome === true ||
          (typeof refreshOutcome === 'object' && refreshOutcome !== null && refreshOutcome.ok)
        const refreshRejected =
          refreshOutcome === false ||
          (
            typeof refreshOutcome === 'object' &&
            refreshOutcome !== null &&
            !refreshOutcome.ok &&
            refreshOutcome.reason === 'rejected'
          )

        if (refreshSuccess) {
          const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
            (options.method || 'GET').toUpperCase()
          )
          // 재시도 시 원래 요청 헤더를 보존한다.
          // getHeaders()로 통째로 교체하면 FormData 업로드처럼
          // Content-Type을 일부러 비워둔 요청이 application/json으로 덮여
          // multipart 경계(boundary)가 사라지고 백엔드 파싱이 깨진다.
          // 따라서 갱신이 필요한 CSRF 토큰만 변형 메서드에 한해 다시 반영한다.
          if (isMutatingMethod) {
            const retryHeaders: Record<string, string> = {
              ...(options.headers as Record<string, string> | undefined),
            }
            const refreshedCsrfToken = getCsrfToken()
            if (refreshedCsrfToken) {
              retryHeaders['X-CSRFToken'] = refreshedCsrfToken
            }
            options.headers = retryHeaders
          }
          response = await fetch(url, options)
          
          const retryTokenFromHeader = response.headers.get('X-CSRFToken')
          if (retryTokenFromHeader) {
            saveCsrfToken(retryTokenFromHeader)
          }
        } else {
          if (refreshRejected && auth.isAuthenticated.value) {
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
                           url.includes('/api/v1/todos/certification/progress/') ||
                           url.includes('/api/v1/todos/notifications/') ||
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

      const data = await readJsonBody(response)
      return { data }
    } catch (error) {
      throw error
    }
  }

  const post = async (url: string, data?: any, _config?: AxiosRequestConfig) => {
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

      return readJsonBody(response)
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

      return await readJsonBody(response);
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

      return await readJsonBody(response);
    } catch (error) {
      throw error;
    }
  }

  const GET = <Path extends ApiPathFor<'get'>>(
    url: Path,
    requestConfig?: AxiosRequestConfig & { params?: ApiQueryParameters<Path, 'get'> },
  ) =>
    get(url, requestConfig) as Promise<{ data: ApiResponseBody<Path, 'get'> }>

  const POST = <Path extends ApiPathFor<'post'>>(url: Path, data?: any, requestConfig?: AxiosRequestConfig) =>
    post(url, data, requestConfig) as Promise<ApiResponseBody<Path, 'post'>>

  const PUT = <Path extends ApiPathFor<'put'>>(url: Path, data: any) =>
    put(url, data) as Promise<ApiResponseBody<Path, 'put'>>

  const PATCH = <Path extends ApiPathFor<'patch'>>(url: Path, data: any) =>
    patch(url, data) as Promise<ApiResponseBody<Path, 'patch'>>

  const remove = async (url: string) => {
    try {
      const response = await fetchWithRetry(`${getBaseUrl()}${url}`, {
        method: 'DELETE',
        headers: getHeaders(true),
        credentials: 'include'
      })
      return readJsonBody(response)
    } catch (error) {
      throw error
    }
  }

  const DELETE = <Path extends ApiPathFor<'delete'>>(url: Path) =>
    remove(url) as Promise<ApiResponseBody<Path, 'delete'>>

  return {
    get,
    post,
    put,
    patch,
    delete: remove,
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
    path: apiPath,
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
        return readJsonBody(response)
      } catch (error) {
        throw error
      }
    },
  }
}
