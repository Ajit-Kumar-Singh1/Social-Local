import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  MutationFunction,
  QueryFunction,
  QueryKey,
  UseMutationOptions,
  UseMutationResult,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthStatus { status: string; }
export interface ErrorResponse { error: string; }

export interface FacebookPage {
  id: number;
  pageId: string;
  name: string;
  category?: string | null;
  avatarUrl?: string | null;
  accessToken: string;
  createdAt: string;
}

export interface ConnectPageBody {
  accessToken: string;
}

export type PostPostType = "text" | "image" | "video";
export type PostStatus = "draft" | "scheduled" | "published" | "failed";

export interface Post {
  id: number;
  pageId: number;
  pageName?: string | null;
  title?: string | null;
  postType: PostPostType;
  caption: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  status: PostStatus;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  facebookPostId?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface CreatePostBody {
  pageId: number;
  title?: string | null;
  postType?: PostPostType;
  caption: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  scheduledAt?: string | null;
}

export interface UpdatePostBody {
  title?: string | null;
  postType?: PostPostType;
  caption?: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  scheduledAt?: string | null;
  status?: "draft" | "scheduled";
}

export interface GenerateImageBody {
  prompt: string;
  style?: string | null;
}

export interface GeneratedImage {
  imageUrl: string;
  prompt: string;
}

export interface DashboardStats {
  totalPages: number;
  totalPosts: number;
  scheduledPosts: number;
  publishedPosts: number;
  draftPosts: number;
  failedPosts: number;
}

export type ListPostsStatus = "draft" | "scheduled" | "published" | "failed";
export const ListPostsStatus = {
  draft: "draft" as ListPostsStatus,
  scheduled: "scheduled" as ListPostsStatus,
  published: "published" as ListPostsStatus,
  failed: "failed" as ListPostsStatus,
};

export type ListPostsParams = {
  status?: ListPostsStatus;
  pageId?: number;
};

// ─── Custom Fetch ─────────────────────────────────────────────────────────────

type CustomFetchOptions = RequestInit & {
  responseType?: "json" | "text" | "blob" | "auto";
};

export type ErrorType<T = unknown> = ApiError<T>;
export type BodyType<T> = T;

type AuthTokenGetter = () => Promise<string | null> | string | null;

const NO_BODY_STATUS = new Set([204, 205, 304]);
const DEFAULT_JSON_ACCEPT = "application/json, application/problem+json";

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}
export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}
function resolveMethod(input: RequestInfo | URL, explicitMethod?: string): string {
  if (explicitMethod) return explicitMethod.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}
function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}
function applyBaseUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!_baseUrl) return input;
  const url = resolveUrl(input);
  if (!url.startsWith("/")) return input;
  const absolute = `${_baseUrl}${url}`;
  if (typeof input === "string") return absolute;
  if (isUrl(input)) return new URL(absolute);
  return new Request(absolute, input as Request);
}
function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}
function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();
  for (const source of sources) {
    if (!source) continue;
    new Headers(source).forEach((value, key) => { headers.set(key, value); });
  }
  return headers;
}
function getMediaType(headers: Headers): string | null {
  const value = headers.get("content-type");
  return value ? value.split(";", 1)[0].trim().toLowerCase() : null;
}
function isJsonMediaType(mediaType: string | null): boolean {
  return mediaType === "application/json" || Boolean(mediaType?.endsWith("+json"));
}
function isTextMediaType(mediaType: string | null): boolean {
  return Boolean(mediaType && (
    mediaType.startsWith("text/") || mediaType === "application/xml" ||
    mediaType === "text/xml" || mediaType.endsWith("+xml") ||
    mediaType === "application/x-www-form-urlencoded"
  ));
}
function hasNoBody(response: Response, method: string): boolean {
  if (method === "HEAD") return true;
  if (NO_BODY_STATUS.has(response.status)) return true;
  if (response.headers.get("content-length") === "0") return true;
  if (response.body === null) return true;
  return false;
}
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
function looksLikeJson(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}
function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") return undefined;
  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}
function truncate(text: string, maxLength = 300): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
function buildErrorMessage(response: Response, data: unknown): string {
  const prefix = `HTTP ${response.status} ${response.statusText}`;
  if (typeof data === "string") {
    const text = data.trim();
    return text ? `${prefix}: ${truncate(text)}` : prefix;
  }
  const title = getStringField(data, "title");
  const detail = getStringField(data, "detail");
  const message = getStringField(data, "message") ?? getStringField(data, "error_description") ?? getStringField(data, "error");
  if (title && detail) return `${prefix}: ${title} — ${detail}`;
  if (detail) return `${prefix}: ${detail}`;
  if (message) return `${prefix}: ${message}`;
  if (title) return `${prefix}: ${title}`;
  return prefix;
}

export class ApiError<T = unknown> extends Error {
  readonly name = "ApiError";
  readonly status: number;
  readonly statusText: string;
  readonly data: T | null;
  readonly headers: Headers;
  readonly response: Response;
  readonly method: string;
  readonly url: string;

  constructor(response: Response, data: T | null, requestInfo: { method: string; url: string }) {
    super(buildErrorMessage(response, data));
    Object.setPrototypeOf(this, new.target.prototype);
    this.status = response.status;
    this.statusText = response.statusText;
    this.data = data;
    this.headers = response.headers;
    this.response = response;
    this.method = requestInfo.method;
    this.url = response.url || requestInfo.url;
  }
}

async function parseErrorBody(response: Response, method: string): Promise<unknown> {
  if (hasNoBody(response, method)) return null;
  const mediaType = getMediaType(response.headers);
  if (mediaType && !isJsonMediaType(mediaType) && !isTextMediaType(mediaType)) {
    return typeof response.blob === "function" ? response.blob() : response.text();
  }
  const raw = await response.text();
  const normalized = stripBom(raw);
  const trimmed = normalized.trim();
  if (trimmed === "") return null;
  if (isJsonMediaType(mediaType) || looksLikeJson(normalized)) {
    try { return JSON.parse(normalized); } catch { return raw; }
  }
  return raw;
}

function inferResponseType(response: Response): "json" | "text" | "blob" {
  const mediaType = getMediaType(response.headers);
  if (isJsonMediaType(mediaType)) return "json";
  if (isTextMediaType(mediaType) || mediaType == null) return "text";
  return "blob";
}

async function parseSuccessBody(
  response: Response,
  responseType: "json" | "text" | "blob" | "auto",
  requestInfo: { method: string; url: string },
): Promise<unknown> {
  if (hasNoBody(response, requestInfo.method)) return null;
  const effectiveType = responseType === "auto" ? inferResponseType(response) : responseType;
  switch (effectiveType) {
    case "json": {
      const raw = await response.text();
      const normalized = stripBom(raw);
      if (normalized.trim() === "") return null;
      try { return JSON.parse(normalized); } catch (cause) {
        throw new Error(`Failed to parse JSON from ${requestInfo.method} ${requestInfo.url}: ${String(cause)}`);
      }
    }
    case "text": {
      const text = await response.text();
      return text === "" ? null : text;
    }
    case "blob":
      return response.blob();
  }
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  input = applyBaseUrl(input);
  const { responseType = "auto", headers: headersInit, ...init } = options;
  const method = resolveMethod(input, init.method);
  const headers = mergeHeaders(isRequest(input) ? input.headers : undefined, headersInit);

  if (typeof init.body === "string" && !headers.has("content-type") && looksLikeJson(init.body)) {
    headers.set("content-type", "application/json");
  }
  if (responseType === "json" && !headers.has("accept")) {
    headers.set("accept", DEFAULT_JSON_ACCEPT);
  }
  if (_authTokenGetter && !headers.has("authorization")) {
    const token = await _authTokenGetter();
    if (token) headers.set("authorization", `Bearer ${token}`);
  }

  const requestInfo = { method, url: resolveUrl(input) };
  const response = await fetch(input, { ...init, method, headers });

  if (!response.ok) {
    const errorData = await parseErrorBody(response, method);
    throw new ApiError(response, errorData, requestInfo);
  }

  return (await parseSuccessBody(response, responseType, requestInfo)) as T;
}

// ─── Type helpers ─────────────────────────────────────────────────────────────

type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];

// ─── Health Check ─────────────────────────────────────────────────────────────

export const getHealthCheckQueryKey = () => [`/api/healthz`] as const;
export const healthCheck = async (options?: RequestInit): Promise<HealthStatus> =>
  customFetch<HealthStatus>(`/api/healthz`, { ...options, method: "GET" });

export function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>; request?: SecondParameter<typeof customFetch> }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getHealthCheckQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof healthCheck>>> = ({ signal }) =>
    healthCheck({ signal, ...options?.request });
  const query = useQuery({ queryKey, queryFn, ...options?.query }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

// ─── Pages ────────────────────────────────────────────────────────────────────

export const getListPagesQueryKey = () => [`/api/pages`] as const;
export const listPages = async (options?: RequestInit): Promise<FacebookPage[]> =>
  customFetch<FacebookPage[]>(`/api/pages`, { ...options, method: "GET" });

export function useListPages<TData = Awaited<ReturnType<typeof listPages>>, TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<Awaited<ReturnType<typeof listPages>>, TError, TData>; request?: SecondParameter<typeof customFetch> }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getListPagesQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof listPages>>> = ({ signal }) =>
    listPages({ signal, ...options?.request });
  const query = useQuery({ queryKey, queryFn, ...options?.query }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export const disconnectPage = async (id: number, options?: RequestInit): Promise<void> =>
  customFetch<void>(`/api/pages/${id}`, { ...options, method: "DELETE" });

export const useDisconnectPage = <TError = ErrorType<ErrorResponse>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<Awaited<ReturnType<typeof disconnectPage>>, TError, { id: number }, TContext>; request?: SecondParameter<typeof customFetch> }
): UseMutationResult<Awaited<ReturnType<typeof disconnectPage>>, TError, { id: number }, TContext> => {
  const mutationFn: MutationFunction<Awaited<ReturnType<typeof disconnectPage>>, { id: number }> = ({ id }) =>
    disconnectPage(id, options?.request);
  return useMutation({ mutationFn, ...options?.mutation });
};

// ─── Posts ────────────────────────────────────────────────────────────────────

export const getListPostsQueryKey = (params?: ListPostsParams) =>
  [`/api/posts`, ...(params ? [params] : [])] as const;

export const listPosts = async (params?: ListPostsParams, options?: RequestInit): Promise<Post[]> => {
  const normalizedParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined) normalizedParams.append(key, value === null ? "null" : String(value));
  });
  const qs = normalizedParams.toString();
  return customFetch<Post[]>(qs ? `/api/posts?${qs}` : `/api/posts`, { ...options, method: "GET" });
};

export function useListPosts<TData = Awaited<ReturnType<typeof listPosts>>, TError = ErrorType<unknown>>(
  params?: ListPostsParams,
  options?: { query?: UseQueryOptions<Awaited<ReturnType<typeof listPosts>>, TError, TData>; request?: SecondParameter<typeof customFetch> }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getListPostsQueryKey(params);
  const queryFn: QueryFunction<Awaited<ReturnType<typeof listPosts>>> = ({ signal }) =>
    listPosts(params, { signal, ...options?.request });
  const query = useQuery({ queryKey, queryFn, ...options?.query }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export const createPost = async (body: CreatePostBody, options?: RequestInit): Promise<Post> =>
  customFetch<Post>(`/api/posts`, {
    ...options, method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });

export const useCreatePost = <TError = ErrorType<ErrorResponse>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPost>>, TError, { data: BodyType<CreatePostBody> }, TContext>; request?: SecondParameter<typeof customFetch> }
): UseMutationResult<Awaited<ReturnType<typeof createPost>>, TError, { data: BodyType<CreatePostBody> }, TContext> => {
  const mutationFn: MutationFunction<Awaited<ReturnType<typeof createPost>>, { data: BodyType<CreatePostBody> }> = ({ data }) =>
    createPost(data, options?.request);
  return useMutation({ mutationFn, ...options?.mutation });
};

export const getGetPostQueryKey = (id: number) => [`/api/posts/${id}`] as const;

export const getPost = async (id: number, options?: RequestInit): Promise<Post> =>
  customFetch<Post>(`/api/posts/${id}`, { ...options, method: "GET" });

export function useGetPost<TData = Awaited<ReturnType<typeof getPost>>, TError = ErrorType<ErrorResponse>>(
  id: number,
  options?: { query?: UseQueryOptions<Awaited<ReturnType<typeof getPost>>, TError, TData>; request?: SecondParameter<typeof customFetch> }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getGetPostQueryKey(id);
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getPost>>> = ({ signal }) =>
    getPost(id, { signal, ...options?.request });
  const query = useQuery({ queryKey, queryFn, enabled: !!id, ...options?.query }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export const updatePost = async (id: number, body: UpdatePostBody, options?: RequestInit): Promise<Post> =>
  customFetch<Post>(`/api/posts/${id}`, {
    ...options, method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });

export const useUpdatePost = <TError = ErrorType<ErrorResponse>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePost>>, TError, { id: number; data: BodyType<UpdatePostBody> }, TContext>; request?: SecondParameter<typeof customFetch> }
): UseMutationResult<Awaited<ReturnType<typeof updatePost>>, TError, { id: number; data: BodyType<UpdatePostBody> }, TContext> => {
  const mutationFn: MutationFunction<Awaited<ReturnType<typeof updatePost>>, { id: number; data: BodyType<UpdatePostBody> }> = ({ id, data }) =>
    updatePost(id, data, options?.request);
  return useMutation({ mutationFn, ...options?.mutation });
};

export const deletePost = async (id: number, options?: RequestInit): Promise<void> =>
  customFetch<void>(`/api/posts/${id}`, { ...options, method: "DELETE" });

export const useDeletePost = <TError = ErrorType<ErrorResponse>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePost>>, TError, { id: number }, TContext>; request?: SecondParameter<typeof customFetch> }
): UseMutationResult<Awaited<ReturnType<typeof deletePost>>, TError, { id: number }, TContext> => {
  const mutationFn: MutationFunction<Awaited<ReturnType<typeof deletePost>>, { id: number }> = ({ id }) =>
    deletePost(id, options?.request);
  return useMutation({ mutationFn, ...options?.mutation });
};

export const publishPost = async (id: number, options?: RequestInit): Promise<Post> =>
  customFetch<Post>(`/api/posts/${id}/publish`, { ...options, method: "POST" });

export const usePublishPost = <TError = ErrorType<ErrorResponse>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<Awaited<ReturnType<typeof publishPost>>, TError, { id: number }, TContext>; request?: SecondParameter<typeof customFetch> }
): UseMutationResult<Awaited<ReturnType<typeof publishPost>>, TError, { id: number }, TContext> => {
  const mutationFn: MutationFunction<Awaited<ReturnType<typeof publishPost>>, { id: number }> = ({ id }) =>
    publishPost(id, options?.request);
  return useMutation({ mutationFn, ...options?.mutation });
};

// ─── Images ───────────────────────────────────────────────────────────────────

export const generateImage = async (body: GenerateImageBody, options?: RequestInit): Promise<GeneratedImage> =>
  customFetch<GeneratedImage>(`/api/images/generate`, {
    ...options, method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });

export const useGenerateImage = <TError = ErrorType<ErrorResponse>, TContext = unknown>(
  options?: { mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateImage>>, TError, { data: BodyType<GenerateImageBody> }, TContext>; request?: SecondParameter<typeof customFetch> }
): UseMutationResult<Awaited<ReturnType<typeof generateImage>>, TError, { data: BodyType<GenerateImageBody> }, TContext> => {
  const mutationFn: MutationFunction<Awaited<ReturnType<typeof generateImage>>, { data: BodyType<GenerateImageBody> }> = ({ data }) =>
    generateImage(data, options?.request);
  return useMutation({ mutationFn, ...options?.mutation });
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getGetDashboardStatsQueryKey = () => [`/api/dashboard/stats`] as const;
export const getDashboardStats = async (options?: RequestInit): Promise<DashboardStats> =>
  customFetch<DashboardStats>(`/api/dashboard/stats`, { ...options, method: "GET" });

export function useGetDashboardStats<TData = Awaited<ReturnType<typeof getDashboardStats>>, TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardStats>>, TError, TData>; request?: SecondParameter<typeof customFetch> }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getGetDashboardStatsQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getDashboardStats>>> = ({ signal }) =>
    getDashboardStats({ signal, ...options?.request });
  const query = useQuery({ queryKey, queryFn, ...options?.query }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export const getGetRecentPostsQueryKey = () => [`/api/dashboard/recent-posts`] as const;
export const getRecentPosts = async (options?: RequestInit): Promise<Post[]> =>
  customFetch<Post[]>(`/api/dashboard/recent-posts`, { ...options, method: "GET" });

export function useGetRecentPosts<TData = Awaited<ReturnType<typeof getRecentPosts>>, TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<Awaited<ReturnType<typeof getRecentPosts>>, TError, TData>; request?: SecondParameter<typeof customFetch> }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getGetRecentPostsQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getRecentPosts>>> = ({ signal }) =>
    getRecentPosts({ signal, ...options?.request });
  const query = useQuery({ queryKey, queryFn, ...options?.query }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export const getGetUpcomingPostsQueryKey = () => [`/api/dashboard/upcoming`] as const;
export const getUpcomingPosts = async (options?: RequestInit): Promise<Post[]> =>
  customFetch<Post[]>(`/api/dashboard/upcoming`, { ...options, method: "GET" });

export function useGetUpcomingPosts<TData = Awaited<ReturnType<typeof getUpcomingPosts>>, TError = ErrorType<unknown>>(
  options?: { query?: UseQueryOptions<Awaited<ReturnType<typeof getUpcomingPosts>>, TError, TData>; request?: SecondParameter<typeof customFetch> }
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getGetUpcomingPostsQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getUpcomingPosts>>> = ({ signal }) =>
    getUpcomingPosts({ signal, ...options?.request });
  const query = useQuery({ queryKey, queryFn, ...options?.query }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}
