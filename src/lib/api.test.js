import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '@/lib/api'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('apiRequest', () => {
  it('rejects a stalled request when its timeout expires', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, options) =>
      new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      }),
    )

    await expect(apiRequest('transactions', { timeoutMs: 5 })).rejects.toThrow(
      'Request timed out after 5 ms.',
    )
  })
})
