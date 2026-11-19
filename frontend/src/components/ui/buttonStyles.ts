export type ButtonVariant = 'primary' | 'glass' | 'text' | 'danger' | 'dangerSoft';

const base =
  'flex w-full items-center justify-center gap-2 rounded-button px-5 text-[15px] font-bold leading-none ' +
  'transition-transform duration-(--dur-fast) ease-soft active:scale-[0.97] ' +
  'aria-disabled:opacity-50 disabled:opacity-50 disabled:active:scale-100';

const variants: Record<ButtonVariant, string> = {
  primary: 'motion-shine bg-blue text-on-primary shadow-primary',
  glass: 'glass-button text-blue-d',
  // A quieter action: a 44 px tall text button.
  text: 'text-blue-d',
  // Something that can't be undone, such as ending a trip for everyone.
  danger: 'bg-red text-on-primary',
  // The way into a danger action, before it is confirmed.
  dangerSoft: 'bg-red-bg text-red',
};

export function buttonClasses(variant: ButtonVariant = 'primary', extra = ''): string {
  const height = variant === 'text' ? 'h-11' : 'h-13';
  return `${base} ${height} ${variants[variant]} ${extra}`.trim();
}
