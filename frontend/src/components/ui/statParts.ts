/**
 * Splits "2 h 5 min" into ["2 h", "5 min"]: a number stays on the same line as its unit.
 * Anything without a number ("…", "–") stays whole.
 */
export function statParts(value: string): { number: string; unit: string }[] {
  const parts: { number: string; unit: string }[] = [];
  for (const word of value.split(' ')) {
    const last = parts.at(-1);
    if (/^[\d.,]+$/.test(word) || !last || last.unit) parts.push({ number: word, unit: '' });
    else last.unit = word;
  }
  return parts;
}
