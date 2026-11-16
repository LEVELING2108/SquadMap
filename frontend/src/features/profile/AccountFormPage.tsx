import type { ReactNode } from 'react';
import { BackButton } from '../../components/ui/BackButton';

/** The frame for the account forms: a back button, a title, a line of explanation, then the form. */
export function AccountFormPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col gap-4 bg-sand px-3 pt-3 pb-8">
      <header className="flex items-center gap-2">
        <BackButton fallback="/me" className="bg-transparent shadow-none" />
        <h1 className="text-[22px] leading-7 font-extrabold tracking-[-0.3px]">{title}</h1>
      </header>
      <section aria-label={title} className="glass-strong flex flex-col gap-4 rounded-card p-5">
        <p className="text-sm leading-5 text-muted">{intro}</p>
        {children}
      </section>
    </main>
  );
}
