import { ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

type BackButtonProps = {
  className?: string;
  /** Where to go when the page was opened directly, with nothing to go back to. */
  fallback?: string;
};

/** Goes back within the app, or to the fallback (the welcome screen by default) when opened directly. */
export function BackButton({ className = '', fallback = '/' }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  // React Router gives the first page of a visit the key "default".
  const openedDirectly = location.key === 'default';

  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => (openedDirectly ? navigate(fallback) : navigate(-1))}
      className={`glass flex size-11 flex-none items-center justify-center rounded-pill text-ink ${className}`}
    >
      <ChevronLeft aria-hidden="true" className="size-6" />
    </button>
  );
}
