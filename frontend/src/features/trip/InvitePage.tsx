import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Copy, QrCode, Share } from 'lucide-react';
import mapLight from '../../assets/illustrations/map.svg';
import mapDark from '../../assets/illustrations/map-dark.svg';
import { BackButton } from '../../components/ui/BackButton';
import { Banner } from '../../components/ui/Banner';
import { Button, ButtonLink } from '../../components/ui/Button';
import { describeFailure } from '../auth/formErrors';
import { BoardingPass } from './BoardingPass';
import { QrDialog } from './QrDialog';
import { useTrip } from './tripQueries';

const step = (n: number) => ({ '--motion-delay': `${n * 80}ms` }) as React.CSSProperties;

/** After starting a trip: the boarding pass, and the ways to send the link. */
export function InvitePage() {
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);
  const [notice, setNotice] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const qrButton = useRef<HTMLButtonElement>(null);

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Link copied. Paste it into a chat to invite friends.');
    } catch {
      setNotice(`Couldn't copy automatically. The link is ${url}`);
    }
  }

  async function share(url: string, name: string) {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: name, text: `Join "${name}" on SquadMap`, url });
        return;
      } catch (error) {
        // Closing the share sheet is not a failure.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await copyLink(url);
  }

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[600px] flex-col overflow-hidden bg-screen">
      <div aria-hidden="true" className="absolute inset-0">
        <img
          src={mapLight}
          alt=""
          className="size-full scale-105 object-cover object-top blur-[4px] dark:hidden"
        />
        <img
          src={mapDark}
          alt=""
          className="hidden size-full scale-105 object-cover object-top blur-[4px] dark:block"
        />
        <div className="absolute inset-0 bg-scrim backdrop-blur-[4px]" />
      </div>

      <div className="relative z-10 flex items-center justify-between px-3 pt-3">
        <BackButton />
        <Link
          to="/home"
          className="glass inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-bold"
        >
          Skip for now
        </Link>
      </div>

      <div className="relative z-10 flex flex-1 flex-col gap-6 px-5 pt-7 pb-6">
        <div className="motion-rise text-on-scrim">
          <h1 className="text-[28px] leading-[34px] font-extrabold tracking-[-0.5px]">Trip is live</h1>
          <p className="mt-1.5 text-[15px] leading-[21px] opacity-90">
            Send this link. Friends join without signing up.
          </p>
        </div>

        {trip.isPending && (
          <div aria-busy="true" className="ticket h-[308px] opacity-60">
            <span className="sr-only">Loading your boarding pass…</span>
          </div>
        )}
        {trip.isError && (
          <Banner tone="error">
            {describeFailure(trip.error)}{' '}
            <button type="button" onClick={() => trip.refetch()} className="underline">
              Try again
            </button>
          </Banner>
        )}
        {trip.data && (
          <div className="motion-rise" style={step(2)}>
            <BoardingPass trip={trip.data} />
          </div>
        )}
      </div>

      {trip.data && (
        <section
          aria-label="Send the invite"
          className="motion-sheet glass glass-strong relative z-10 flex flex-col gap-2.5 rounded-t-sheet px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]"
        >
          <div aria-hidden="true" className="mx-auto mb-1 h-1 w-10 rounded-[2px] bg-handle" />
          <Button
            className="motion-rise"
            style={step(3)}
            onClick={() => share(trip.data.inviteUrl, trip.data.name)}
          >
            <Share aria-hidden="true" className="size-5" />
            Share invite link
          </Button>
          <div className="motion-rise flex gap-2" style={step(4)}>
            <Button variant="glass" onClick={() => copyLink(trip.data.inviteUrl)}>
              <Copy aria-hidden="true" className="size-5" />
              Copy link
            </Button>
            <Button ref={qrButton} variant="glass" onClick={() => setQrOpen(true)} aria-haspopup="dialog">
              <QrCode aria-hidden="true" className="size-5" />
              QR code
            </Button>
          </div>
          <p role="status" aria-live="polite" className="min-h-5 text-center text-sm leading-5 text-muted">
            {notice}
          </p>
          <ButtonLink to={`/trip/${trip.data.id}`} variant="text" className="motion-rise" style={step(5)}>
            Open live map
          </ButtonLink>
        </section>
      )}

      {trip.data && (
        <QrDialog
          open={qrOpen}
          url={trip.data.inviteUrl}
          code={trip.data.code}
          onClose={() => {
            setQrOpen(false);
            qrButton.current?.focus();
          }}
        />
      )}
    </main>
  );
}
