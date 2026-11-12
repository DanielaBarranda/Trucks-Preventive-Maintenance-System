import { ApiError } from './client';
import { createExpense } from './driver';

it('createExpense gives up on a stalled connection with a retryable error', async () => {
  // A connection that never answers, but stops when the request is aborted
  vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  })));
  const error = await createExpense(new FormData(), 50).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(0);
});
