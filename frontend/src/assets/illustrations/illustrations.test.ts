import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** design/assets is the source of truth; the app keeps a copy so it builds on its own. */
describe('illustrations match design/assets', () => {
  it.each(['hero.svg', 'hero-dark.svg'])('%s', (file) => {
    const copy = readFileSync(resolve(process.cwd(), 'src/assets/illustrations', file), 'utf8');
    const source = readFileSync(resolve(process.cwd(), '../design/assets', file), 'utf8');

    expect(copy.replace(/\r\n/g, '\n')).toBe(source.replace(/\r\n/g, '\n'));
  });
});
