import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { BackButton } from '../../components/ui/BackButton';
import { Banner } from '../../components/ui/Banner';
import { Segmented } from '../../components/ui/Segmented';
import { Switch } from '../../components/ui/Switch';
import { ThemeSwitch } from '../../components/ui/ThemeSwitch';
import { describeFailure } from '../auth/formErrors';
import { signOut } from '../auth/session';
import { SHARE_HOURS } from '../newTrip/tripDraft';
import {
  useSettings,
  useUpdateSettings,
  type DistanceUnit,
  type MapStyle,
  type TimeFormat,
} from './settingsApi';

const UNITS: readonly DistanceUnit[] = ['km', 'mi'];
const MAP_STYLES: readonly MapStyle[] = ['streets', 'outdoors', 'satellite'];
const MAP_STYLE_NAMES: Record<MapStyle, string> = {
  streets: 'Streets',
  outdoors: 'Outdoors',
  satellite: 'Satellite',
};
const TIME_FORMATS: readonly TimeFormat[] = ['12h', '24h'];

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
            <Segmented
              label="Map style"
              options={MAP_STYLES}
              value={settings.mapStyle}
              onChange={(mapStyle) => update.mutate({ mapStyle })}
              format={(style) => MAP_STYLE_NAMES[style]}
            />
          </Item>
          {settings.mapStyle === 'streets' && (
            <Item>
              <Switch
                label="Dark map"
                description="Easier on the eyes at night"
                checked={settings.darkMap}
                onChange={(darkMap) => update.mutate({ darkMap })}
              />
            </Item>
          )}
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
          <Item>
            <Switch
              label="Chat on by default"
              description="Whether friends can chat on a new trip"
              checked={settings.chatDefault}
              onChange={(chatDefault) => update.mutate({ chatDefault })}
            />
          </Item>
        </Section>

        <Section title="Display">
          <Item>
            <Switch
              label="Reduce animations"
              description="Turn off moving effects in the app"
              checked={settings.reduceMotion}
              onChange={(reduceMotion) => update.mutate({ reduceMotion })}
            />
          </Item>
          <Item>
            <Segmented
              label="Time format"
              options={TIME_FORMATS}
              value={settings.timeFormat}
              onChange={(timeFormat) => update.mutate({ timeFormat })}
              format={(format) => (format === '12h' ? '9:30 PM' : '21:30')}
              describe={(format) => (format === '12h' ? '12-hour, like 9:30 PM' : '24-hour, like 21:30')}
            />
          </Item>
        </Section>

        <Section title="Notifications">
          <Link to="/me/alerts#push" className="flex min-h-[56px] items-center gap-4">
            <span className="min-w-0 flex-1">
              <span className="block text-base leading-[22px] font-bold text-ink">Push notifications</span>
              <span className="block text-[13px] leading-[18px] text-muted">
                Which alerts reach this device
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="size-5 text-muted" />
          </Link>
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
