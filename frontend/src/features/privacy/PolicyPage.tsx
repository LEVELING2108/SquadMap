import type { ReactNode } from 'react';
import { BackButton } from '../../components/ui/BackButton';
import { GRIEVANCE_CONTACT } from './grievanceContact';

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

function Points({ children }: { children: ReactNode }) {
  return <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">{children}</ul>;
}

/** Change this whenever the text below changes in meaning, and say what changed under "Changes". */
const LAST_UPDATED = '27 November 2026';

/**
 * Terms and Privacy Policy, in plain words: what SquadMap keeps, for how long, who else sees it, and who to
 * contact. Written for India's Digital Personal Data Protection Act 2023. Open to everyone, signed in or
 * not, since sign-up links here. The retention numbers match the code; change both together.
 */
export function PolicyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col gap-4 bg-sand px-3 pt-3 pb-10">
      <header className="flex items-center gap-2">
        <BackButton fallback="/" className="bg-transparent shadow-none" />
        <h1 className="text-[22px] leading-7 font-extrabold tracking-[-0.3px]">Terms and Privacy Policy</h1>
      </header>

      <p className="px-2 text-[15px] leading-[22px]">
        SquadMap lets friends see each other on one map during a trip. This page explains, in plain words,
        what we keep about you, why, for how long, and the rules for using SquadMap. By creating an account or
        joining a trip you agree to it.
      </p>
      <p className="px-2 text-sm leading-5 font-semibold text-muted">Last updated {LAST_UPDATED}</p>

      <Section title="Who we are and how to reach us">
        <p className="m-0 text-[15px] leading-[22px]">
          SquadMap is run by {GRIEVANCE_CONTACT.name}, an individual developer in India, who decides how your
          data is used. For any question, request or complaint about your data, write to{' '}
          <a href={`mailto:${GRIEVANCE_CONTACT.email}`} className="font-bold break-all text-blue-d">
            {GRIEVANCE_CONTACT.email}
          </a>
          .
        </p>
        <Points>
          <Point>We reply as soon as we can, and within 30 days at the latest.</Point>
          <Point>
            If you’re not happy with our answer, you can complain to the Data Protection Board of India.
          </Point>
        </Points>
      </Section>

      <Section title="Your location">
        <Points>
          <Point>It’s shared only during a trip you joined, and only with the people on that trip.</Point>
          <Point>
            It’s never stored. Your last spot is held in memory for friends to see, and disappears 10 minutes
            after your last update, or at once when you leave or the trip ends. While you pause, your last
            spot stays until you resume or leave.
          </Point>
          <Point>
            Sharing always stops when a trip ends. A trip keeps only how far you went in total, never where.
          </Point>
        </Points>
      </Section>

      <Section title="What we keep, and for how long">
        <Points>
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
        </Points>
      </Section>

      <Section title="Who else sees it">
        <Points>
          <Point>
            Mapbox draws the maps. To work out routes and arrival times, our server sends Mapbox your current
            position and the destination; we don’t keep them.
          </Point>
          <Point>
            Push notifications are delivered, encrypted, by your browser’s push service (Google, Apple,
            Mozilla or Microsoft).
          </Point>
          <Point>Emails (password resets, account notices) go through an email delivery service.</Point>
          <Point>
            When something breaks, an error report goes to Sentry so we can fix it. It holds what went wrong
            and which screen you were on, never your name, email, location or messages.
          </Point>
          <Point>
            Our data is stored with a cloud hosting company, whose servers may be outside India. They keep it
            for us and may not use it for anything else.
          </Point>
          <Point>
            Our server sees your device’s internet (IP) address, as every website does. We use it only to
            block abuse, such as too many login attempts, and don’t add it to your account.
          </Point>
          <Point>
            We share data with the police or a court only when the law requires it. We don’t sell your data or
            show ads.
          </Point>
        </Points>
      </Section>

      <Section title="Your choices">
        <Points>
          <Point>Pause or stop sharing at any time, or leave a trip.</Point>
          <Point>Download everything kept about you from Privacy and data.</Point>
          <Point>Correct your name or email from your profile.</Point>
          <Point>
            Delete your account from Privacy and data. It closes at once and is deleted for good after 30
            days; logging in before then keeps it. Friends keep their trips with you shown as a former member.
          </Point>
          <Point>
            Name someone who can use these choices for you if you die or can no longer use them yourself, by
            writing to us.
          </Point>
          <Point>
            If your data is ever exposed in a security breach, we’ll tell you by email and report it to the
            Data Protection Board.
          </Point>
        </Points>
      </Section>

      <Section title="Using SquadMap">
        <Points>
          <Point>Share your location only with people you trust, and only when you want to.</Point>
          <Point>Don’t use SquadMap to track anyone without their knowledge.</Point>
          <Point>Don’t use it while driving in a way that takes your eyes off the road.</Point>
          <Point>
            You must be 18 or older to create an account or join a trip. If we learn that someone under 18 is
            using SquadMap, we delete their data.
          </Point>
          <Point>
            Don’t break the law with SquadMap, harass anyone in trip chat, or try to get into accounts or
            parts of the service that aren’t yours. We may close an account that does, and we’ll tell you why
            by email.
          </Point>
        </Points>
      </Section>

      <Section title="Our promises and their limits">
        <Points>
          <Point>
            SquadMap is free and provided as it is. Arrival times are estimates, and positions depend on your
            phone’s GPS and connection, so they can be late or wrong. Don’t rely on SquadMap in an emergency;
            call 112.
          </Point>
          <Point>
            We work to keep SquadMap running and your data safe, but can’t promise it will never be down or
            lose a message. As far as the law allows, we aren’t responsible for losses caused by relying on
            it.
          </Point>
          <Point>These terms are governed by the laws of India.</Point>
        </Points>
      </Section>

      <Section title="Changes">
        <Points>
          <Point>
            If we change how we use your data, we’ll tell you in the app or by email before the change
            applies, and update the date at the top of this page.
          </Point>
        </Points>
      </Section>
    </main>
  );
}
