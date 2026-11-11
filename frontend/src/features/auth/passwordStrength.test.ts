import { describe, expect, it } from 'vitest';
import { passwordStrength } from './passwordStrength';

describe('passwordStrength', () => {
  it.each([
    ['abc', 'Too short'],
    ['tulipmoon', 'Weak'],
    ['tulipmoon9', 'Fair'],
    ['Correct horse 1', 'Good'],
    ['Correct horse battery 1', 'Strong'],
  ])('"%s" is %s', (password, label) => {
    expect(passwordStrength(password).label).toBe(label);
  });

  it('marks down common words and obvious sequences', () => {
    expect(passwordStrength('Password1234!').label).toBe('Weak');
    expect(passwordStrength('aaaaaaaaaaaa1A').label).not.toBe('Strong');
  });

  it('never shows colour without a word', () => {
    for (const password of ['a', 'tulipmoon', 'Correct horse battery 1']) {
      const strength = passwordStrength(password);
      expect(strength.label.length).toBeGreaterThan(0);
      expect(strength.percent).toBeGreaterThan(0);
    }
  });
});
