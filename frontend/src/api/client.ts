// One place for every API call: sends the login cookie, encodes JSON, and turns
// failures into ApiError with the server's message.

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let onUnauthorized: () => void = () => {};

// Called on any 401 (session expired or revoked), except failed login/sign-up attempts
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

const AUTH_ATTEMPT_PATHS = ['/api/auth/login', '/api/auth/signup'];

export type ApiInit = RequestInit & { json?: unknown };

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);
  finalHeaders.set('Accept', 'application/json');
  if (json !== undefined) finalHeaders.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      headers: finalHeaders,
      credentials: 'include',
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server.");
  }

  if (response.status === 401 && !AUTH_ATTEMPT_PATHS.some((p) => path.startsWith(p))) {
    onUnauthorized();
  }

  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.message === 'string') return body.message;
    if (typeof body?.title === 'string') return body.title;
  } catch {
    // not JSON
  }
  return `Request failed (${response.status})`;
}
