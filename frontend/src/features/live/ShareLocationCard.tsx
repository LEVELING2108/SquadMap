import { MapPin } from 'lucide-react';
import { Banner } from '../../components/ui/Banner';
import { Button } from '../../components/ui/Button';
import { describeFailure } from '../auth/formErrors';

type ShareLocationCardProps = {
  onShare: () => void;
  pending: boolean;
  error: unknown;
};

/**
 * Asks someone who hasn't agreed yet (the host, or someone who chose "Not now") to share their location.
 * Agreeing is recorded, then the browser asks for permission.
 */
export function ShareLocationCard({ onShare, pending, error }: ShareLocationCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-tint p-4">
      <div className="flex items-start gap-3">
        <MapPin aria-hidden="true" className="mt-0.5 size-5 flex-none text-blue" />
        <div>
          <h2 className="text-base leading-[22px] font-extrabold">Share your location with this trip?</h2>
          <p className="text-[13px] leading-[18px] text-muted">
            Friends on this trip see where you are until it ends. Leaving the trip stops it at once.
          </p>
        </div>
      </div>
      {error !== null && error !== undefined && <Banner tone="error">{describeFailure(error)}</Banner>}
      <Button onClick={onShare} disabled={pending}>
        {pending ? 'Turning on…' : 'Share my location'}
      </Button>
    </div>
  );
}
