import { ArrowRight } from 'lucide-react';
import { StatTile } from '../../components/ui/StatTile';
import { formatClock } from '../../lib/time';
import { distanceText, lengthText, type TripSummary } from './summaryApi';
import { shortPlace } from './tripQueries';

type TripSummaryPassProps = {
  /** Null while it loads: the card keeps its shape with placeholders. */
  summary: TripSummary | null;
  unit: 'km' | 'mi';
  timeFormat: '12h' | '24h';
};

/**
 * The trip as a used boarding pass: when it started, where it went, and your numbers. No place is kept
 * for the start, so FROM is the time it began.
 */
export function TripSummaryPass({ summary, unit, timeFormat }: TripSummaryPassProps) {
  const loading = '…';
  const to = summary?.destination ? shortPlace(summary.destination.name) : 'Anywhere';
  const done = summary !== null && summary.status !== 'active';

  return (
    <div className="ticket-shadow">
      <section
        aria-label="Trip summary"
        className="ticket"
        style={{ '--cut': '118px' } as React.CSSProperties}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs leading-4 font-extrabold tracking-[1.5px] text-coral-d">
              TRIP SUMMARY
            </span>
            {done && (
              <span className="rounded-pill bg-green-bg px-3 py-1 text-[13px] leading-[18px] font-bold text-green">
                Completed
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex-none">
              <p className="text-xs leading-4 text-muted">STARTED</p>
              <p className="text-[22px] leading-7 font-extrabold whitespace-nowrap">
                {summary ? formatClock(summary.startsAt, timeFormat) : loading}
              </p>
            </div>
            <ArrowRight aria-hidden="true" className="size-6 flex-none text-muted" />
            <div className="min-w-0 text-right">
              <p className="text-xs leading-4 text-muted">TO</p>
              <p className="truncate text-[22px] leading-7 font-extrabold">{summary ? to : loading}</p>
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="mx-5 border-t-2 border-dashed border-perforation" />
        <dl className="m-0 flex flex-wrap gap-2.5 px-5 pt-4 pb-5">
          <StatTile
            value={summary ? distanceText(summary.distanceM, unit) : loading}
            label="Distance"
            className="bg-sand"
          />
          <StatTile
            value={summary ? lengthText(summary.durationSeconds) : loading}
            label="Time"
            className="bg-sand"
          />
          <StatTile
            value={summary ? String(summary.friendCount) : loading}
            label={summary?.friendCount === 1 ? 'Friend' : 'Friends'}
            className="bg-sand"
          />
        </dl>
      </section>
    </div>
  );
}
