/**
 * A failed API call, read from the server's problem+json body.
 * {@link code} is stable and safe to branch on; {@link detail} is a message meant for people.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  /** Messages for individual form fields, keyed by field name. */
  readonly fieldErrors: Record<string, string>;
  /** Seconds to wait before trying again, when rate limited. */
  readonly retryAfter: number | undefined;

  constructor(
    status: number,
    code: string,
    detail: string,
    fieldErrors: Record<string, string> = {},
    retryAfter?: number,
  ) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.fieldErrors = fieldErrors;
    this.retryAfter = retryAfter;
  }

  static network(): ApiError {
    return new ApiError(0, 'NETWORK', "Can't reach SquadMap. Check your connection and try again.");
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    const generic = new ApiError(response.status, 'UNKNOWN', 'Something went wrong. Please try again.');
    const type = response.headers.get('Content-Type') ?? '';
    if (!type.includes('json')) return generic;

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return generic;
    }
    if (typeof body !== 'object' || body === null) return generic;

    const problem = body as {
      code?: unknown;
      detail?: unknown;
      errors?: unknown;
      retryAfter?: unknown;
    };
    const fieldErrors: Record<string, string> = {};
    if (Array.isArray(problem.errors)) {
      for (const entry of problem.errors) {
        const { field, message } = (entry ?? {}) as { field?: unknown; message?: unknown };
        if (typeof field === 'string' && typeof message === 'string' && !(field in fieldErrors)) {
          fieldErrors[field] = message;
        }
      }
    }
    const header = Number(response.headers.get('Retry-After'));
    const retryAfter =
      typeof problem.retryAfter === 'number'
        ? problem.retryAfter
        : Number.isFinite(header) && header > 0
          ? header
          : undefined;

    return new ApiError(
      response.status,
      typeof problem.code === 'string' ? problem.code : 'UNKNOWN',
      typeof problem.detail === 'string' ? problem.detail : generic.detail,
      fieldErrors,
      retryAfter,
    );
  }
}
