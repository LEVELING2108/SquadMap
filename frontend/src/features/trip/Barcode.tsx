/**
 * The decorative barcode on the boarding pass. Bars are derived from the trip code, so every trip's pass
 * looks a little different, but it encodes nothing and is hidden from assistive technology.
 */
export function Barcode({ code }: { code: string }) {
  const bars: { x: number; width: number }[] = [];
  let x = 0;
  for (const char of code + code + code) {
    const value = char.charCodeAt(0);
    const width = 2 + (value % 4);
    const gap = 2 + ((value >> 2) % 3);
    if (x + width > 150) break;
    bars.push({ x, width });
    x += width + gap;
  }

  return (
    <svg width="150" height="30" viewBox="0 0 150 30" aria-hidden="true" className="fill-ink">
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} width={bar.width} height="30" />
      ))}
    </svg>
  );
}
