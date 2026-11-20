import type { ReactNode } from 'react';
import { BackButton } from '../../components/ui/BackButton';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass-strong flex flex-col gap-2 rounded-card p-5">
      <h2 className="text-lg leading-6 font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function Point({ children }: { children: ReactNode }) {
  return <li className="text-[15px] leading-[22px]">{children}</li>;
}

/**
 * Terms and Privacy Policy, in plain words: what SquadMap keeps, for how long, and who else sees it. Open
 * to everyone, signed in or not, since sign-up links here.
 */
export function PolicyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col gap-4 bg-sand px-3 pt-3 pb-10">
      <header className="flex items-center gap-2">
        <BackButton fallback="/" className="bg-transparent shadow-none" />
        <h1 className="text-[22px] leading-7 font-extrabold tracking-[-0.3px]">Terms and Privacy Policy</h1>
      </header>

      <p className="rounded-card bg-amber-bg px-4 py-3 text-sm leading-5 font-semibold text-amber">
        This is a plain-language summary of how SquadMap handles your data. The full Terms and Privacy Policy,
        with who to contact about your data, will be published here before SquadMap launches.
      </p>

      <Section title="Your location">
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <Point>It’s shared only during a trip you joined, and only with the people on that trip.</Point>
          <Point>
            It’s never stored. Your last spot is held in memory for friends to see, and disappears 10 minutes
            after your last update, or at once when you leave or the trip ends. While you pause, your last
            spot stays until you resume or leave.
          </Point>
          <Point>
            Sharing always stops when a trip ends. A trip keeps only how far you went in total, never where.
          </Point>
        </ul>
      </Section>

      <Section title="What we keep, and for how long">
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <Point>
            Your account: name, email, colour and settings, and your password as a one-way hash. Kept until
            you delete your account.
          </Point>
          <Point>
            Trips: name, destination, times, who was on it and your total distance, for your trip history.
          </Point>
          <Point>Your agreement to share your location on each trip, and when you stopped.</Point>
          <Point>Trip chat: deleted 7 days after the trip ends.</Point>
          <Point>Alerts: deleted after 30 days.</Point>
          <Point>Sessions: end after 30 days without use, or when you log out.</Point>
          <Point>Guests: only the name given for that one trip.</Point>
        </ul>
      </Section>

      <Section title="Who else sees it">
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <Point>
            Mapbox draws the maps. To work out routes and arrival times, our server sends Mapbox your current
            position and the destination; we don’t keep them.
          </Point>
          <Point>
            Push notifications are delivered, encrypted, by your browser’s push service (Google, Apple,
            Mozilla or Microsoft).
          </Point>
          <Point>Emails (password resets, account notices) go through an email delivery service.</Point>
          <Point>We don’t sell your data or show ads.</Point>
        </ul>
      </Section>

      <Section title="Your choices">
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <Point>Pause or stop sharing at any time, or leave a trip.</Point>
          <Point>Download everything kept about you from Privacy and data.</Point>
          <Point>
            Delete your account from Privacy and data. It closes at once and is deleted for good after 30
            days; logging in before then keeps it. Friends keep their trips with you shown as a former member.
          </Point>
        </ul>
      </Section>

      <Section title="Using SquadMap">
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <Point>Share your location only with people you trust, and only when you want to.</Point>
          <Point>Don’t use SquadMap to track anyone without their knowledge.</Point>
          <Point>Don’t use it while driving in a way that takes your eyes off the road.</Point>
        </ul>
      </Section>
    </main>
  );
}
