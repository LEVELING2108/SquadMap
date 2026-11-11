import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * design/tokens/tokens.json is the source of truth for design values.
 * These tests fail if src/styles/tokens.css drifts from it.
 */
type ColorSet = Record<string, string>;
type GlassSet = { bg: string; bgStrong: string; border: string; blur: number; saturate: number };
type Tokens = {
  color: { light: ColorSet; dark: ColorSet; friends: string[]; you: string };
  radius: Record<string, number>;
  glass: { light: GlassSet; dark: GlassSet };
  motion: { easeOut: string; duration: Record<string, number> };
};

const tokens = JSON.parse(
  readFileSync(resolve(process.cwd(), '../design/tokens/tokens.json'), 'utf8'),
) as Tokens;
const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

function declarations(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Selector not found in tokens.css: ${selector}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const found = new Map<string, string>();
  for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name && value) found.set(name, value.trim());
  }
  return found;
}

/** Same value regardless of case, spacing, or a leading zero (".62" equals "0.62"). */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(^|[^0-9])0\./g, '$1.')
    .replace(/^#fff$/, '#ffffff');
}

const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const light = declarations(':root');
const dark = declarations(":root[data-theme='dark']");

describe('tokens.css matches design/tokens/tokens.json', () => {
  it.each(Object.entries(tokens.color.light))('light color %s', (name, value) => {
    expect(normalize(light.get(`--${kebab(name)}`) ?? 'missing')).toBe(normalize(value));
  });

  it.each(Object.entries(tokens.color.dark))('dark color %s', (name, value) => {
    expect(normalize(dark.get(`--${kebab(name)}`) ?? 'missing')).toBe(normalize(value));
  });

  it('friend colors and the "you" color', () => {
    tokens.color.friends.forEach((value, index) => {
      expect(normalize(light.get(`--friend-${index + 1}`) ?? 'missing')).toBe(normalize(value));
    });
    expect(normalize(light.get('--you') ?? 'missing')).toBe(normalize(tokens.color.you));
  });

  it.each(Object.entries(tokens.radius))('radius %s', (name, value) => {
    expect(light.get(`--r-${name}`)).toBe(`${value}px`);
  });

  it.each(Object.entries(tokens.motion.duration))('duration %s', (name, value) => {
    expect(light.get(`--dur-${name}`)).toBe(`${value}ms`);
  });

  it('easing curve', () => {
    expect(normalize(light.get('--ease') ?? 'missing')).toBe(normalize(tokens.motion.easeOut));
  });

  it.each([
    ['light', light, tokens.glass.light],
    ['dark', dark, tokens.glass.dark],
  ] as const)('glass (%s)', (_theme, found, glass) => {
    expect(normalize(found.get('--glass-bg') ?? 'missing')).toBe(normalize(glass.bg));
    expect(normalize(found.get('--glass-bg-strong') ?? 'missing')).toBe(normalize(glass.bgStrong));
    expect(normalize(found.get('--glass-border') ?? 'missing')).toBe(normalize(glass.border));
  });

  it('glass blur and saturation', () => {
    expect(light.get('--glass-blur')).toBe(`${tokens.glass.light.blur}px`);
    expect(light.get('--glass-saturate')).toBe(String(tokens.glass.light.saturate));
  });
});
