import { useState } from 'react';
import { ArrowDownAZ, Check, ListFilter, Plus } from 'lucide-react';
import { ButtonLink } from '../../components/ui/Button';
import { formatDistance } from '../../lib/map/geo';
import type { DistanceUnit } from '../profile/settingsApi';
import { formatDuration, modeWords } from './liveFormat';
import { TravelModeIcon } from './TravelModeIcon';
import type { Eta, LiveMember } from './liveTypes';

type EtaListProps = {
  members: LiveMember[];
  etas: Record<string, Eta>;
  /** Short destination name, or null for a trip without one. */
  destination: string | null;
  unit: DistanceUnit;
  /** The host may invite more people. */
  inviteHref: string | null;
};

type Row = { member: LiveMember; eta: Eta | undefined; rank: number };

/** Soonest first; then people still being worked out, then those not sharing; arrivals last, as designed. */
function byArrival(a: Row, b: Row): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  if (a.eta && b.eta) return a.eta.durationS - b.eta.durationS;
  return a.member.displayName.localeCompare(b.member.displayName);
}

function rankOf(member: LiveMember, eta: Eta | undefined): number {
  if (member.arrivedAt) return 3;
  if (eta) return 0;
  return member.sharing ? 1 : 2;
}

/** D3, "Who's on the way": everyone with their distance, how they travel, and when they'll arrive. */
export function EtaList({ members, etas, destination, unit, inviteHref }: EtaListProps) {
  const [sort, setSort] = useState<'arrival' | 'name'>('arrival');
  const rows: Row[] = members.map((member) => {
    const eta = etas[member.memberId];
    return { member, eta, rank: rankOf(member, eta) };
  });
  rows.sort(
    sort === 'arrival'
      ? byArrival
      : (a, b) =>
          (a.member.you ? 'You' : a.member.displayName).localeCompare(
            b.member.you ? 'You' : b.member.displayName,
          ),
  );
  // The next to arrive gets the warm badge, as in the design.
  const nextId = rows.filter((row) => row.eta && !row.member.arrivedAt).sort(byArrival)[0]?.member.memberId;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 id="live-title" className="text-[24px] leading-[30px] font-extrabold tracking-[-0.3px]">
            Who’s on the way
          </h1>
          <p className="text-sm leading-5 text-muted">
            {destination ? `To ${destination}` : 'This trip has no destination, so there are no ETAs.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSort((current) => (current === 'arrival' ? 'name' : 'arrival'))}
          aria-label={sort === 'arrival' ? 'Sort by name' : 'Sort by arrival time'}
          className="glass flex min-h-11 flex-none items-center gap-2 rounded-pill px-4 text-[15px] font-bold text-ink"
        >
          {sort === 'arrival' ? (
            <ListFilter aria-hidden="true" className="size-5" />
          ) : (
            <ArrowDownAZ aria-hidden="true" className="size-5" />
          )}
          Sort
        </button>
      </div>
      <ul aria-label="Everyone on this trip" className="flex flex-col">
        {rows.map(({ member, eta }) => {
          const name = member.you ? 'You' : member.displayName;
          const detail = member.arrivedAt
            ? 'At destination'
            : eta
              ? `${formatDistance(eta.distanceM, unit)} · ${modeWords(eta.mode)}`
              : !member.sharing
                ? 'Not sharing yet'
                : destination
                  ? 'Working out the route…'
                  : 'Sharing live';
          return (
            <li
              key={member.memberId}
              className="flex items-center gap-3 border-b border-line py-3 last:border-0"
            >
              <span
                aria-hidden="true"
                className="flex size-12 flex-none items-center justify-center rounded-pill text-lg font-extrabold text-on-person"
                style={{ backgroundColor: member.color }}
              >
                {member.displayName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] leading-[22px] font-extrabold">{name}</p>
                <p className="flex min-w-0 items-center gap-1.5 text-sm leading-5 text-muted">
                  {eta && !member.arrivedAt && (
                    <TravelModeIcon mode={eta.mode} className="size-4 flex-none" />
                  )}
                  <span className="truncate">{detail}</span>
                </p>
              </div>
              {member.arrivedAt ? (
                <span className="flex flex-none items-center gap-1 rounded-pill bg-green-bg px-3 py-1 text-sm font-bold text-green">
                  <Check aria-hidden="true" className="size-4" />
                  Arrived
                </span>
              ) : eta ? (
                <span
                  className={`flex-none rounded-pill px-3 py-1 text-sm font-bold ${
                    member.memberId === nextId ? 'bg-amber-bg text-amber' : 'bg-tint text-blue-d'
                  }`}
                >
                  <span className="sr-only">Arrives in </span>
                  {formatDuration(eta.durationS)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {inviteHref && (
        <ButtonLink to={inviteHref}>
          <Plus aria-hidden="true" className="size-5" />
          Invite more friends
        </ButtonLink>
      )}
    </div>
  );
}
