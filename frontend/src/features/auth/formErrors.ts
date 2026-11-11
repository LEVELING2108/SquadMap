import { ApiError } from '../../lib/api/ApiError';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './passwordStrength';

export type FieldErrors = Record<string, string | undefined>;

/** Loose check that catches typos; the server has the final say. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function checkEmail(email: string): string | undefined {
  if (!email.trim()) return 'Enter your email.';
  if (!EMAIL.test(email.trim())) return 'Enter a valid email address.';
  return undefined;
}

export function checkNewPassword(password: string): string | undefined {
  if (!password) return 'Enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return `Use between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return undefined;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** A sentence for the form-level banner. Field-specific problems are shown on the fields instead. */
export function describeFailure(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (error.code === 'RATE_LIMITED') {
    const seconds = error.retryAfter ?? 60;
    const wait = seconds > 90 ? `${Math.ceil(seconds / 60)} minutes` : `${seconds} seconds`;
    return `Too many attempts. Try again in ${wait}.`;
  }
  return error.detail;
}

/** Moves focus to the first field with a problem, so keyboard and screen reader users land on it. */
export function focusFirstInvalid(form: HTMLFormElement | null): void {
  form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}
