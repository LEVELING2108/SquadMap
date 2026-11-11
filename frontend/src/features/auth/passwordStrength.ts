export type Strength = {
  label: 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  /** How full the meter is, 0 to 100. */
  percent: number;
  tone: 'red' | 'amber' | 'green';
};

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * A rough guide shown while typing. It rewards length most, then variety, and marks down
 * obvious patterns. The only hard rule is the minimum length, which the server also enforces.
 */
export function passwordStrength(password: string): Strength {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      label: 'Too short',
      percent: Math.max(8, (password.length / MIN_PASSWORD_LENGTH) * 25),
      tone: 'red',
    };
  }

  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (classes >= 2) score++;
  if (classes >= 3) score++;

  const repeated = /(.)\1{2,}/.test(password);
  const sequential = /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/i.test(password);
  const common = /password|letmein|welcome|qwerty|iloveyou|admin|squadmap/i.test(password);
  if (repeated || sequential) score--;
  if (common) score -= 2;

  if (score <= 0) return { label: 'Weak', percent: 30, tone: 'red' };
  if (score === 1) return { label: 'Fair', percent: 50, tone: 'amber' };
  if (score <= 3) return { label: 'Good', percent: 75, tone: 'green' };
  return { label: 'Strong', percent: 100, tone: 'green' };
}
