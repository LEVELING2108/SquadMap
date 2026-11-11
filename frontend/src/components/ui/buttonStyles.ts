export type ButtonVariant = 'primary' | 'glass';

const base =
  'flex h-13 w-full items-center justify-center gap-2 rounded-button px-5 text-[15px] font-bold leading-none ' +
  'transition-transform duration-(--dur-fast) ease-soft active:scale-[0.97] ' +
  'aria-disabled:opacity-50 disabled:opacity-50 disabled:active:scale-100';

const variants: Record<ButtonVariant, string> = {
  primary: 'motion-shine bg-blue text-on-primary shadow-primary',
  glass: 'glass-button text-blue-d',
};

export function buttonClasses(variant: ButtonVariant = 'primary', extra = ''): string {
  return `${base} ${variants[variant]} ${extra}`.trim();
}
