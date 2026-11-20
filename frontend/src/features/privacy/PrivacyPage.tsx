import { useMutation } from '@tanstack/react-query';
import { ChevronRight, Download, FileText, ShieldCheck, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { BackButton } from '../../components/ui/BackButton';
import { Banner } from '../../components/ui/Banner';
import { describeFailure } from '../auth/formErrors';
import { downloadMyData } from './privacyApi';

const tile = 'flex size-10 flex-none items-center justify-center rounded-control bg-tint text-blue-d';

/** Privacy and data (F5): how location stays private, a copy of your data, the policy, and closing the account. */
export function PrivacyPage() {
  const download = useMutation({ mutationFn: downloadMyData });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col gap-4 bg-sand px-3 pt-3 pb-8">
      <header className="flex items-center gap-2">
        <BackButton fallback="/me" className="bg-transparent shadow-none" />
        <h1 className="text-[22px] leading-7 font-extrabold tracking-[-0.3px]">Privacy and data</h1>
      </header>

      <section
        aria-labelledby="private-title"
        className="flex items-start gap-3.5 rounded-card bg-sea-bg p-4"
      >
        <span
          aria-hidden="true"
          className="flex size-10 flex-none items-center justify-center rounded-control bg-screen text-sea-d"
        >
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 id="private-title" className="text-base leading-[22px] font-bold">
            Your location is private
          </h2>
          <p className="text-sm leading-5 text-muted">
            Shared only during a live trip, with people holding the link. It’s never stored: a trip keeps only
            how far you went.
          </p>
        </div>
      </section>

      <ul className="glass-strong m-0 list-none divide-y divide-line overflow-hidden rounded-card p-0">
        <li>
          <button
            type="button"
            onClick={() => download.mutate()}
            disabled={download.isPending}
            className="flex min-h-[64px] w-full items-center gap-3.5 px-4 py-2.5 text-left"
          >
            <span aria-hidden="true" className={tile}>
              <Download className="size-5" />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-base leading-[22px] font-bold">Download my data</span>
              <span className="text-[13px] leading-[18px] text-muted">
                {download.isPending ? 'Preparing your file…' : 'Everything kept about you, as a file'}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="size-5 text-muted" />
          </button>
        </li>
        <li>
          <Link to="/privacy" className="flex min-h-[64px] items-center gap-3.5 px-4 py-2.5">
            <span aria-hidden="true" className={tile}>
              <FileText className="size-5" />
            </span>
            <span className="flex-1 text-base leading-[22px] font-bold">Terms and Privacy Policy</span>
            <ChevronRight aria-hidden="true" className="size-5 text-muted" />
          </Link>
        </li>
      </ul>
      <div aria-live="polite" className="contents">
        {download.isSuccess && <Banner tone="success">Your data is saved as squadmap-data.json.</Banner>}
        {download.isError && <Banner tone="error">{describeFailure(download.error)}</Banner>}
      </div>

      <Link
        to="/me/delete"
        className="flex h-13 items-center justify-center gap-2 rounded-card bg-red-bg text-[15px] font-bold text-ink"
      >
        <Trash2 aria-hidden="true" className="size-5" />
        Delete my account
      </Link>

      <p className="text-center text-[13px] leading-[18px] text-muted">
        You can withdraw consent at any time.
      </p>
    </main>
  );
}
