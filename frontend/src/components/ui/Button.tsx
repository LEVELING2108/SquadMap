import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'glass';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const base =
  'flex h-13 w-full items-center justify-center gap-2 rounded-button px-5 text-[15px] font-bold leading-none ' +
  'transition-transform duration-(--dur-fast) ease-soft active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-blue text-on-primary shadow-float',
  glass: 'glass text-blue-d',
};

export function Button({ variant = 'primary', type = 'button', className = '', ...rest }: ButtonProps) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}
