import type { ComponentPropsWithRef } from 'react';
import { Link, type LinkProps } from 'react-router';
import { buttonClasses, type ButtonVariant } from './buttonStyles';

// React 19 passes `ref` as an ordinary prop, so it reaches the <button> with the rest.
type ButtonProps = ComponentPropsWithRef<'button'> & { variant?: ButtonVariant };

export function Button({ variant = 'primary', type = 'button', className = '', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...rest} />;
}

type ButtonLinkProps = LinkProps & { variant?: ButtonVariant };

/** Navigation that looks like a button. It stays a link, so it opens in a new tab and reads as a link. */
export function ButtonLink({ variant = 'primary', className = '', ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, typeof className === 'string' ? className : '')} {...rest} />
  );
}
