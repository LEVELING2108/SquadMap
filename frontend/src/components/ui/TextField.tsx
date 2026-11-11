import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

const inputClasses =
  'h-13 w-full rounded-control border-[1.5px] border-input-border bg-input-bg px-4 text-[15px] font-medium text-ink ' +
  'placeholder:text-input-placeholder focus:border-blue focus:outline-2 focus:outline-blue ' +
  'aria-invalid:border-red';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  /** Extra content inside the field's box, such as the show-password button. */
  trailing?: ReactNode;
  /** Shown under the input, before any error. */
  hint?: ReactNode;
};

/** A labelled input. Its error is announced with the field and marks it invalid. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, trailing, hint, id, className = '', ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-semibold text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${inputClasses} ${trailing ? 'pr-13' : ''} ${className}`}
          {...rest}
        />
        {trailing}
      </div>
      {hint}
      {error && (
        <p id={errorId} className="text-[13px] leading-[18px] font-semibold text-red">
          {error}
        </p>
      )}
    </div>
  );
});
