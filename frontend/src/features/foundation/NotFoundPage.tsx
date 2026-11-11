import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[600px] flex-col items-start justify-center gap-3 px-5">
      <h1 className="text-[22px] leading-7 font-extrabold">This page does not exist</h1>
      <p className="text-sm leading-5 text-muted">The link may be mistyped, or the page may have moved.</p>
      <Link to="/" className="inline-flex min-h-11 items-center font-bold text-blue-d">
        Go to home
      </Link>
    </main>
  );
}
