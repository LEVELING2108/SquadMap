import { useId } from 'react';

type StampProps = {
  /** The big word in the middle, such as ENDED. */
  word: string;
  /** Curved along the top edge. */
  top?: string;
  /** Curved along the bottom edge. */
  bottom?: string;
  /** Size and position. */
  className?: string;
  /** The big word's size in the 170-unit drawing; wide words need less to stay inside the ring. */
  wordSize?: number;
};

/** A rubber stamp, slightly turned, as on a used ticket. Decoration only: screen readers skip it. */
export function Stamp({ word, top = 'SQUADMAP', bottom, className = '', wordSize }: StampProps) {
  const id = useId();
  // Long words get a smaller size so they stay inside the ring.
  const size = wordSize ?? (word.length > 6 ? 30 : 34);
  return (
    <svg aria-hidden="true" viewBox="0 0 170 170" className={`text-red ${className}`}>
      <defs>
        <path id={`${id}-top`} d="M 30 85 A 55 55 0 0 1 140 85" />
        <path id={`${id}-bottom`} d="M 36 85 A 49 49 0 0 0 134 85" />
      </defs>
      <circle cx="85" cy="85" r="82" className="fill-screen/85" />
      <circle cx="85" cy="85" r="81" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="85" cy="85" r="75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <g transform="rotate(-14 85 85)" fill="currentColor" fontFamily="var(--font-display)" fontWeight="800">
        <text fontSize="12" letterSpacing="3" textAnchor="middle">
          <textPath href={`#${id}-top`} startOffset="50%">
            {top}
          </textPath>
        </text>
        <text x="85" y={85 + size / 3} fontSize={size} letterSpacing="1.5" textAnchor="middle">
          {word}
        </text>
        {bottom && (
          <text fontSize="11" letterSpacing="3" textAnchor="middle" dominantBaseline="hanging">
            <textPath href={`#${id}-bottom`} startOffset="50%">
              {bottom}
            </textPath>
          </text>
        )}
      </g>
    </svg>
  );
}
