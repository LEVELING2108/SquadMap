import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Switch } from '../../components/ui/Switch';
import { describeFailure } from '../auth/formErrors';
import { historyKey } from '../history/historyApi';
import { statsKey, useSettings, useUpdateSettings } from '../profile/settingsApi';
import { forgetPastTrips } from './privacyApi';

/**
 * The privacy switches: precise location, auto-stop (always on, so shown as a fact), and trip history.
 * Turning history off asks whether past trips go too.
 */
export function PrivacyChoices() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const update = useUpdateSettings();
  const [asking, setAsking] = useState(false);
  const forget = useMutation({
    mutationFn: forgetPastTrips,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: historyKey });
      void queryClient.invalidateQueries({ queryKey: statsKey });
    },
  });

  function historyOff(removePast: boolean) {
    setAsking(false);
    update.mutate({ keepHistory: false });
    if (removePast) forget.mutate();
  }

  return (
    <>
      <div className="glass-strong flex flex-col divide-y divide-line rounded-card px-4">
        <div className="py-3.5">
          <Switch
            label="Share precise location"
            description="Off shows friends an area of about 200 m only. Your ETA is then rough, and arriving isn’t noticed."
            checked={settings.preciseLocation}
            onChange={(preciseLocation) => update.mutate({ preciseLocation })}
          />
        </div>
        <div className="flex min-h-11 items-center gap-4 py-3.5">
          <span className="min-w-0 flex-1">
            <span className="block text-base leading-[22px] font-bold text-ink">Auto-stop at trip end</span>
            <span className="block text-[13px] leading-[18px] text-muted">
              Sharing stops for everyone when a trip ends
            </span>
          </span>
          <span className="flex-none rounded-pill bg-green-bg px-3 py-1 text-[13px] leading-[18px] font-bold text-green">
            Always on
          </span>
        </div>
        <div className="py-3.5">
          <Switch
            label="Keep trip history"
            description="Summaries only: how far you went, never where"
            checked={settings.keepHistory}
            onChange={(keep) => (keep ? update.mutate({ keepHistory: true }) : setAsking(true))}
          />
        </div>
      </div>
      <div aria-live="polite" className="contents">
        {update.isError && (
          <Banner tone="error">Your change wasn’t saved. {describeFailure(update.error)}</Banner>
        )}
        {forget.isSuccess && (
          <Banner tone="success">
            {forget.data.removed === 1
              ? 'Removed 1 past trip from your history.'
              : `Removed ${forget.data.removed} past trips from your history.`}
          </Banner>
        )}
        {forget.isError && <Banner tone="error">{describeFailure(forget.error)}</Banner>}
      </div>

      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        labelledBy="history-title"
        describedBy="history-text"
      >
        <h2 id="history-title" className="text-lg leading-6 font-extrabold">
          Stop keeping trip history?
        </h2>
        <p id="history-text" className="text-sm leading-5 text-muted">
          From now on, trips leave your history a day after they end, with their chat. Friends keep their own
          copy. Removing past trips can’t be undone.
        </p>
        <Button variant="dangerSoft" onClick={() => historyOff(true)}>
          Remove past trips too
        </Button>
        <Button onClick={() => historyOff(false)}>Only from now on</Button>
        <Button variant="text" onClick={() => setAsking(false)}>
          Cancel
        </Button>
      </Dialog>
    </>
  );
}
