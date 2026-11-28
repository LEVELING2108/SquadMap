import { statParts } from './statParts';

type StatTileProps = {
  /** "8.1 km", "19 min", "4": the units are drawn smaller than the numbers. */
  value: string;
  label: string;
  /** The tile's background, for example "bg-sand" or "glass-strong". */
  className: string;
};

/**
 * One number in a row of trip stats ("8.1 km Distance"), as on Trip complete and You made it! Use inside a
 * `<dl>` with `flex flex-wrap`. Tiles share the row by what they hold, so a long distance takes room from
 * "1 Friend". Nothing is ever cut off: a long value ("12 h 45 min") breaks between its parts, and on the
 * narrowest phones the last tile moves to a row of its own.
 */
export function StatTile({ value, label, className }: StatTileProps) {
  return (
    <div
      className={`flex min-w-min flex-auto flex-col rounded-card px-3 py-3 min-[375px]:px-3.5 ${className}`}
    >
      <dd className="order-1 m-0 font-heading text-[22px] leading-7">
        {statParts(value).map(({ number, unit }, index) => (
          <span key={index} className="whitespace-nowrap">
            {index > 0 && ' '}
            {number}
            {unit && <span className="text-[15px] leading-none font-bold"> {unit}</span>}
          </span>
        ))}
      </dd>
      <dt className="order-2 text-[13px] leading-[18px] font-bold text-muted">{label}</dt>
    </div>
  );
}
