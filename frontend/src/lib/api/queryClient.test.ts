import { describe, expect, it } from 'vitest';
import { ApiError } from './ApiError';
import { shouldRetry } from './queryClient';

describe('shouldRetry', () => {
  it.each([400, 401, 403, 404, 409, 410, 429])('never retries a %s', (status) => {
    expect(shouldRetry(0, new ApiError(status, 'X', 'x'))).toBe(false);
  });

  it('retries a lost connection or a server error, at most twice', () => {
    for (const error of [ApiError.network(), new ApiError(502, 'UNKNOWN', 'x')]) {
      expect(shouldRetry(0, error)).toBe(true);
      expect(shouldRetry(1, error)).toBe(true);
      expect(shouldRetry(2, error)).toBe(false);
    }
  });
});
