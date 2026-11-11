import { ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

/** Goes back within the app, or to the welcome screen when the page was opened directly. */
export function BackButton({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  // React Router gives the first page of a visit the key "default".
  const openedDirectly = location.key === 'default';

  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => (openedDirectly ? navigate('/') : navigate(-1))}
      className={`glass flex size-11 items-center justify-center rounded-pill text-ink ${className}`}
    >
      <ChevronLeft aria-hidden="true" className="size-6" />
    </button>
  );
}
