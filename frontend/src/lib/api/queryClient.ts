import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './ApiError';

/**
 * Retries only failures that can pass on their own (no connection, server errors), at most twice.
 * A 4xx answer such as "not found" or "not allowed" won't change, so it is shown straight away.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry },
      // A create or a join is never repeated behind the person's back.
      mutations: { retry: false },
    },
  });
}
