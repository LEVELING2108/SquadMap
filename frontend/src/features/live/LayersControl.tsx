import { useEffect, useId, useRef, useState } from 'react';
import { Check, Layers } from 'lucide-react';
import type { MapStyle } from '../profile/settingsApi';

const STYLES: { value: MapStyle; label: string }[] = [
  { value: 'streets', label: 'Streets' },
  { value: 'outdoors', label: 'Outdoors' },
  { value: 'satellite', label: 'Satellite' },
];

/**
 * The Layers button from the design: picks the map style, the same three as in Settings. Opens a small
 * panel beside the button; Escape or picking a style closes it.
 */
export function LayersControl({ value, onChange }: { value: MapStyle; onChange: (style: MapStyle) => void }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return (
    <div className="relative">
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Map style"
          className="glass-strong absolute top-0 right-16 flex w-44 flex-col gap-1 rounded-card p-2"
        >
          {STYLES.map((style) => (
            <button
              key={style.value}
              type="button"
              aria-pressed={style.value === value}
              onClick={() => {
                onChange(style.value);
                setOpen(false);
                button.current?.focus();
              }}
              className="flex min-h-11 items-center justify-between rounded-control px-3 text-left text-[15px] font-bold text-ink aria-pressed:bg-tint aria-pressed:text-blue-d"
            >
              {style.label}
              {style.value === value && <Check aria-hidden="true" className="size-4" />}
            </button>
          ))}
        </div>
      )}
      <button
        ref={button}
        type="button"
        aria-label="Map style"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="glass-strong flex size-14 items-center justify-center rounded-pill text-ink"
      >
        <Layers aria-hidden="true" className="size-6" />
      </button>
    </div>
  );
}
