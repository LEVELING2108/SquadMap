import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { BackButton } from '../../components/ui/BackButton';
import { Banner } from '../../components/ui/Banner';
import { Segmented } from '../../components/ui/Segmented';
import { Switch } from '../../components/ui/Switch';
import { ThemeSwitch } from '../../components/ui/ThemeSwitch';
import { describeFailure } from '../auth/formErrors';
import { signOut } from '../auth/session';
import { SHARE_HOURS } from '../newTrip/tripDraft';
import { useSettings, useUpdateSettings, type DistanceUnit } from './settingsApi';

const UNITS: readonly DistanceUnit[] = ['km', 'mi'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `settings-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="px-2 text-xs leading-4 font-bold tracking-[1.5px] text-muted">
        {title.toUpperCase()}
      </h2>
      <div className="glass-strong flex flex-col divide-y divide-line rounded-card px-4">{children}</div>
    </section>
  );
}

function Item({ children }: { children: ReactNode }) {
  return <div className="py-3.5">{children}</div>;
}

/** Preferences that follow the account to every device, and the app's look on this one. */
export function SettingsPage() {
  const navigate = useNavigate();
  const { settings, isPending } = useSettings();
  const update = useUpdateSettings();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col gap-5 bg-sand px-3 pt-3 pb-8">
      <header className="flex items-center gap-2">
        <BackButton fallback="/me" className="bg-transparent shadow-none" />
        <h1 className="text-[22px] leading-7 font-extrabold tracking-[-0.3px]">Settings</h1>
      </header>

      {update.isError && (
        <Banner tone="error">Your change wasn’t saved. {describeFailure(update.error)}</Banner>
      )}

      <div aria-busy={isPending} className="flex flex-col gap-5">
        <Section title="Appearance">
          <Item>
            <ThemeSwitch />
          </Item>
        </Section>

        <Section title="Map">
          <Item>
            <Switch
              label="Dark map"
              description="Easier on the eyes at night"
              checked={settings.darkMap}
              onChange={(darkMap) => update.mutate({ darkMap })}
            />
          </Item>
          <Item>
            <Segmented
              label="Distance unit"
              options={UNITS}
              value={settings.distanceUnit}
              onChange={(distanceUnit) => update.mutate({ distanceUnit })}
              format={(unit) => unit}
              describe={(unit) => (unit === 'km' ? 'Kilometres' : 'Miles')}
            />
          </Item>
        </Section>

        <Section title="Trips">
          <Item>
            <Segmented
              label="Default sharing time"
              options={SHARE_HOURS}
              value={settings.defaultShareHours}
              onChange={(defaultShareHours) => update.mutate({ defaultShareHours })}
              format={(hours) => `${hours} h`}
              describe={(hours) => (hours === 1 ? '1 hour' : `${hours} hours`)}
            />
          </Item>
        </Section>

        <Section title="Account">
          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate('/', { replace: true });
            }}
            className="flex min-h-[56px] items-center text-left text-base font-bold text-red"
          >
            Log out
          </button>
        </Section>
      </div>

      <p className="text-center text-[13px] leading-[18px] text-muted">
        SquadMap 1.0 · Made for travel together
      </p>
    </main>
  );
}
