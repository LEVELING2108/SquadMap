import type { ReactNode } from 'react';
import { AlertCircle, Check } from 'lucide-react';

const tones = {
  success: { classes: 'bg-green-bg text-green', Icon: Check, role: 'status' },
  error: { classes: 'bg-red-bg text-red', Icon: AlertCircle, role: 'alert' },
} as const;

/** A message under a form. Errors interrupt screen readers; success messages wait their turn. */
export function Banner({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  const { classes, Icon, role } = tones[tone];
  return (
    <div
      role={role}
      className={`flex items-start gap-2 rounded-control px-3.5 py-3 text-[13px] leading-[18px] font-bold ${classes}`}
    >
      <Icon aria-hidden="true" className="mt-px size-5 flex-none" />
      <div>{children}</div>
    </div>
  );
}
