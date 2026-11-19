import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ScanLine } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../lib/api/ApiError';
import { Banner } from '../../components/ui/Banner';
import { Button, ButtonLink } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { AuthScreen } from '../auth/AuthScreen';
import { describeFailure, focusFirstInvalid } from '../auth/formErrors';
import { useSession } from '../auth/session';
import { useTrip } from '../trip/tripQueries';
import { expiredPath, fetchPreview, joinKeys, normalizeCode } from './joinApi';
import { QrScannerDialog } from './QrScannerDialog';
import type { JoinPreview } from './types';

const MAX_NAME_LENGTH = 40;

type Errors = { name?: string; code?: string };

/** "Priya invited you to Saturday at Phoenix": the card floating above the sheet. */
function InviterCard({ preview }: { preview: JoinPreview }) {
  const others = preview.memberCount;
  return (
    <div className="motion-rise glass absolute top-[150px] right-5 left-5 flex items-center gap-3.5 rounded-card p-4">
      <span
        aria-hidden="true"
        className="flex size-12 flex-none items-center justify-center rounded-pill bg-friend-1 text-lg font-extrabold text-on-person"
      >
        {preview.hostName.charAt(0).toUpperCase()}
      </span>
      <p className="min-w-0 text-[13px] leading-[18px] text-muted">
        {preview.hostName} invited you to
        <strong className="block truncate text-[17px] leading-6 font-extrabold text-ink">
          {preview.tripName}
        </strong>
        {others <= 1 ? `Just ${preview.hostName} so far` : `${others} friends already on the trip`}
      </p>
    </div>
  );
}

/**
 * Joining a trip from its link, or by typing or scanning the code. No account is needed: a guest
 * gives a name their friends know. Someone signed in joins with their account.
 */
export function JoinPage() {
  const { code: linkCode = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = useSession((state) => state.status);
  const user = useSession((state) => state.user);
  const guest = useSession((state) => state.guest);
  const asAccount = status === 'signedIn';

  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [typedCode, setTypedCode] = useState(linkCode);
  const [errors, setErrors] = useState<Errors>({});
  const [scanning, setScanning] = useState(false);

  const code = normalizeCode(typedCode);
  const preview = useQuery({
    queryKey: joinKeys.preview(code ?? ''),
    queryFn: () => fetchPreview(code!),
    enabled: code !== null,
  });
  // A guest who opens their own trip's link again goes back to it instead of joining twice.
  const guestTrip = useTrip(guest?.tripId ?? '', status === 'guest');
  const alreadyHere = status === 'guest' && code !== null && guestTrip.data?.code === code;

  const failure = preview.error;
  const codeNotFound = failure instanceof ApiError && failure.code === 'INVALID_CODE';

  useEffect(() => {
    if (failure instanceof ApiError && failure.code === 'TRIP_EXPIRED' && code) {
      navigate(expiredPath(code, failure.details.endedAt), { replace: true });
    }
  }, [failure, code, navigate]);

  function check(): Errors {
    const found: Errors = {};
    if (!asAccount && !name.trim()) found.name = 'Enter your name so friends know who you are.';
    if (!code) found.code = 'Trip codes have 8 letters and numbers, like K7QX2P9T.';
    return found;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = check();
    setErrors(found);
    if (found.name || found.code || !code) {
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    try {
      // Usually already loaded; this waits for it when the code was only just typed.
      await queryClient.fetchQuery({ queryKey: joinKeys.preview(code), queryFn: () => fetchPreview(code) });
    } catch {
      // The query now holds the error, which the screen shows.
      requestAnimationFrame(() => focusFirstInvalid(formRef.current));
      return;
    }
    navigate(`/join/${code}/consent`, { state: { displayName: asAccount ? undefined : name.trim() } });
  }

  function scanned(scannedCode: string) {
    setScanning(false);
    setTypedCode(scannedCode);
    setErrors((current) => ({ ...current, code: undefined }));
    if (!asAccount && !name.trim()) requestAnimationFrame(() => nameRef.current?.focus());
  }

  const codeError =
    errors.code ?? (codeNotFound ? "That code doesn't match a trip. Check it and try again." : undefined);
  const otherFailure =
    failure && !codeNotFound && !(failure instanceof ApiError && failure.code === 'TRIP_EXPIRED');

  return (
    <AuthScreen
      titleId="join-title"
      topSpace={310}
      backdrop="sky"
      decoration={preview.data && code ? <InviterCard preview={preview.data} /> : undefined}
    >
      <div className="motion-rise">
        <h1 id="join-title" className="text-[28px] leading-[34px] font-extrabold tracking-[-0.5px]">
          Join the trip
        </h1>
        <p className="mt-1 text-sm leading-5 text-muted">
          {asAccount && user
            ? `You'll join as ${user.name}, with your account.`
            : 'No account needed. Just a name your friends know.'}
        </p>
      </div>

      {alreadyHere && guest ? (
        <>
          <Banner tone="success">You're already on this trip as {guest.displayName}.</Banner>
          <ButtonLink to={`/trip/${guest.tripId}`}>Open the trip</ButtonLink>
        </>
      ) : (
        <form ref={formRef} noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
          {!asAccount && (
            <TextField
              ref={nameRef}
              label="Your name"
              name="displayName"
              autoComplete="nickname"
              placeholder="e.g. Sourav"
              maxLength={MAX_NAME_LENGTH}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
            />
          )}
          <TextField
            label="Trip code"
            name="code"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="8 letters and numbers"
            maxLength={11}
            value={typedCode}
            onChange={(e) => {
              setTypedCode(e.target.value);
              setErrors((current) => ({ ...current, code: undefined }));
            }}
            error={codeError}
            className="font-mono text-[17px] tracking-[3px] uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case"
          />
          {otherFailure && <Banner tone="error">{describeFailure(failure)}</Banner>}
          <Button type="submit" disabled={preview.isFetching}>
            {preview.isFetching ? 'Checking the code…' : 'Continue'}
          </Button>
          <Button variant="glass" onClick={() => setScanning(true)}>
            <ScanLine aria-hidden="true" className="size-5" />
            Scan QR code
          </Button>
        </form>
      )}

      <QrScannerDialog open={scanning} onClose={() => setScanning(false)} onCode={scanned} />
    </AuthScreen>
  );
}
