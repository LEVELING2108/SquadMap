import { useEffect, type ReactNode } from 'react';
import { Banner } from '../../components/ui/Banner';
import { Switch } from '../../components/ui/Switch';
import { checkPush, turnPushOff, turnPushOn, usePush } from '../../pwa/push';
import { describeFailure } from '../auth/formErrors';
import { useSettings, useUpdateSettings, type Settings } from '../profile/settingsApi';

type Choice = {
  key: keyof Pick<Settings, 'pushJoined' | 'pushLeft' | 'pushEndingSoon' | 'pushTripEnded'>;
  label: string;
  description?: string;
};

const CHOICES: readonly Choice[] = [
  { key: 'pushJoined', label: 'Friend joins', description: 'On trips you host' },
  { key: 'pushLeft', label: 'Friend leaves', description: 'On trips you host' },
  { key: 'pushEndingSoon', label: 'Sharing ends soon', description: '10 minutes before, so you can extend' },
  { key: 'pushTripEnded', label: 'Trip ended' },
];

function Note({ children }: { children: ReactNode }) {
  return <p className="py-3.5 text-sm leading-5 text-muted">{children}</p>;
}

/** PUSH ALERTS on the Alerts screen: notifications on this device, and which alerts send one. */
export function PushAlerts() {
  const support = usePush((state) => state.support);
  const on = usePush((state) => state.on);
  const busy = usePush((state) => state.busy);
  const problem = usePush((state) => state.problem);
  const { settings } = useSettings();
  const update = useUpdateSettings();

  useEffect(() => {
    void checkPush();
  }, []);

  return (
    <section id="push" aria-labelledby="push-title" className="flex scroll-mt-3 flex-col gap-2">
      <h2 id="push-title" className="px-2 text-xs leading-4 font-bold tracking-[1.5px] text-muted">
        PUSH ALERTS
      </h2>
      {problem && <Banner tone="error">{problem}</Banner>}
      {update.isError && (
        <Banner tone="error">Your change wasn’t saved. {describeFailure(update.error)}</Banner>
      )}
      <div className="glass-strong flex flex-col divide-y divide-line rounded-card px-4">
        {support === 'ready' && (
          <div className="py-3.5">
            <Switch
              label="Notifications on this device"
              description="Get these alerts even when SquadMap is closed"
              checked={on}
              disabled={busy}
              onChange={(next) => void (next ? turnPushOn() : turnPushOff())}
            />
          </div>
        )}
        {support === 'ready' &&
          on &&
          CHOICES.map((choice) => (
            <div key={choice.key} className="py-3.5">
              <Switch
                label={choice.label}
                description={choice.description}
                checked={settings[choice.key]}
                onChange={(value) => update.mutate({ [choice.key]: value })}
              />
            </div>
          ))}
        {support === 'blocked' && (
          <Note>
            Notifications are blocked for SquadMap. Allow them in your browser’s site settings, then come back
            here.
          </Note>
        )}
        {support === 'install' && (
          <Note>
            On iPhone and iPad, add SquadMap to your Home Screen first: in Safari, tap Share, then Add to Home
            Screen. Open it from there to turn notifications on.
          </Note>
        )}
        {support === 'checking' && <Note>Checking this device…</Note>}
        {support === 'unavailable' && <Note>This browser can’t show notifications from SquadMap.</Note>}
      </div>
    </section>
  );
}
