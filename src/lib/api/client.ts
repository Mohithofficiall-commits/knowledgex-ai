/**
 * Typed HTTP client for the KnowledgeX FastAPI backend.
 *
 * Base URL is read from the VITE_API_URL env variable.
 * Automatically injects JWT Bearer token when stored in localStorage.
 * Falls back gracefully when the backend is offline.
 */

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';
const TOKEN_KEY = 'knowledgex_auth_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, headers: extraHeaders, signal } = options;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) qs.set(k, String(v));
    }
    const q = qs.toString();
    if (q) url += `?${q}`;
  }

  const headers: Record<string, string> = {
    ...extraHeaders,
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new ApiError(
      response.status,
      `API ${method} ${path} failed: ${response.statusText}`,
      errorBody,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Upload a file via multipart/form-data. */
async function upload<T>(path: string, formData: FormData, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
    signal,
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new ApiError(response.status, `Upload to ${path} failed: ${response.statusText}`, errorBody);
  }
  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, params?: RequestOptions['params'], signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', params, signal }),

  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body, signal }),

  put: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'PUT', body, signal }),

  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'PATCH', body, signal }),

  delete: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { method: 'DELETE', signal }),

  upload: <T>(path: string, formData: FormData, signal?: AbortSignal) =>
    upload<T>(path, formData, signal),
};

/** Check if the FastAPI backend is reachable. */
export async function checkBackendHealth(): Promise<{
  reachable: boolean;
  version?: string;
  llm_configured?: boolean;
}> {
  try {
    const data = await apiClient.get<{
      status: string;
      version: string;
      llm_configured: boolean;
    }>('/api/v1/health', undefined, AbortSignal.timeout(3000));
    return { reachable: data.status === 'ok', version: data.version, llm_configured: data.llm_configured };
  } catch {
    return { reachable: false };
  }
}
