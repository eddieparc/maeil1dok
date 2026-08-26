import type { paths } from './generated/api-schema'

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'
type SuccessStatus = 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 226

export type ApiPath = keyof paths & string

export type ApiPathFor<Method extends HttpMethod> = {
  [Path in ApiPath]: Exclude<paths[Path][Method], undefined> extends never ? never : Path
}[ApiPath]

type ApiOperation<
  Path extends ApiPathFor<Method>,
  Method extends HttpMethod,
> = Exclude<paths[Path][Method], undefined>

type SuccessResponse<Operation> = Operation extends { responses: infer Responses }
  ? Responses[Extract<keyof Responses, SuccessStatus>]
  : never

type JsonBody<Response> = Response extends { content: infer Content }
  ? Content extends { 'application/json': infer Body }
    ? Body
    : never
  : never

type GeneratedResponseBody<
  Path extends ApiPathFor<Method>,
  Method extends HttpMethod,
> = JsonBody<SuccessResponse<ApiOperation<Path, Method>>>

type GeneratedQueryParameters<
  Path extends ApiPathFor<Method>,
  Method extends HttpMethod,
> = ApiOperation<Path, Method> extends { parameters: { query?: infer Query } }
  ? Query
  : never

/**
 * Successful JSON body declared by the generated OpenAPI contract.
 *
 * Function-based Django views that still have "No response body" in the
 * schema intentionally remain `unknown` until their response annotations are
 * completed. Paths with a declared JSON schema remain fully checked.
 */
export type ApiResponseBody<
  Path extends ApiPathFor<Method>,
  Method extends HttpMethod,
> = [GeneratedResponseBody<Path, Method>] extends [never]
  ? unknown
  : GeneratedResponseBody<Path, Method>

export type ApiQueryParameters<
  Path extends ApiPathFor<Method>,
  Method extends HttpMethod,
> = [Exclude<GeneratedQueryParameters<Path, Method>, undefined>] extends [never]
  ? Record<string, any>
  : Exclude<GeneratedQueryParameters<Path, Method>, undefined>
