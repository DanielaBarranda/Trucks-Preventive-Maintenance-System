import { vi } from 'vitest';

// networkError: simulate a dropped connection (fetch rejects); delay: answer after N ms
export type MockResponse = { status?: number; json?: unknown; networkError?: boolean; delay?: number };
export type MockRoutes = Record<string, (body: unknown) => MockResponse>;

// Stubs globalThis.fetch. Routes are keyed "METHOD /path" (query string ignored),
// e.g. "GET /api/auth/me". Unknown routes answer 404. Returns the spy.
export function mockFetch(routes: MockRoutes) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const handler = routes[`${method} ${url.pathname}`];
    const body = typeof init?.body === 'string' ? safeParse(init.body) : init?.body;
    const res = handler ? handler(body) : { status: 404, json: { message: 'Not found' } };
    if (res.delay) await new Promise((r) => setTimeout(r, res.delay));
    if (res.networkError) throw new TypeError('Failed to fetch');
    const status = res.status ?? 200;
    return new Response(status === 204 || res.json === undefined ? null : JSON.stringify(res.json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
