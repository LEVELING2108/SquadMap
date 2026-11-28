import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';

export type Choice<T> = {
  value: T;
  label: string;
  /** One line under the label, for example "Parks, trails and terrain". */
  description?: string;
  /** How the option is announced, when the label alone is too short ("4 h" becomes "4 hours"). */
  spoken?: string;
};

type ChoiceSheetProps<T extends string | number> = {
  open: boolean;
  onClose: () => void;
  title: string;
  choices: readonly Choice<T>[];
  value: T;
  /** Called with the picked option; the sheet then closes. */
  onPick: (value: T) => void;
};

/**
 * A sheet from the bottom of the screen with one choice from a short list, ticked on the current one.
 * A native dialog: focus stays inside, Esc or a tap outside closes it, and focus goes back to whatever
 * opened it. The options behave as a radio group: the arrow keys move between them, and Enter, Space or a
 * tap picks one and closes the sheet.
 */
export function ChoiceSheet<T extends string | number>({
  open,
  onClose,
  title,
  choices,
  value,
  onPick,
}: ChoiceSheetProps<T>) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  // Closing because `open` turned false is not the person closing it, so it isn't reported back.
  const wanted = useRef(open);

  useEffect(() => {
    wanted.current = open;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal?.();
      buttons.current[
        Math.max(
          0,
          choices.findIndex((choice) => choice.value === value),
        )
      ]?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, choices, value]);

  function move(event: KeyboardEvent, index: number) {
    const step =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    buttons.current[(index + step + choices.length) % choices.length]?.focus();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => wanted.current && onClose()}
      onClick={(event) => event.target === dialogRef.current && onClose()}
      className="glass-strong motion-sheet fixed inset-x-0 top-auto bottom-0 m-0 mx-auto w-full max-w-[600px] rounded-t-sheet rounded-b-none px-4 pt-2.5 pb-[max(28px,env(safe-area-inset-bottom))] text-ink backdrop:bg-scrim backdrop:backdrop-blur-[4px]"
    >
      {open && (
        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className="mb-2 h-[5px] w-10 self-center rounded-pill bg-handle" />
          <h2 id={titleId} className="mb-1.5 px-1 font-heading text-[22px] leading-7 tracking-[-0.3px]">
            {title}
          </h2>
          <div role="radiogroup" aria-labelledby={titleId} className="flex flex-col gap-1">
            {choices.map((choice, index) => {
              const selected = choice.value === value;
              return (
                <button
                  key={String(choice.value)}
                  ref={(element) => {
                    buttons.current[index] = element;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={choice.spoken}
                  onClick={() => {
                    onPick(choice.value);
                    onClose();
                  }}
                  onKeyDown={(event) => move(event, index)}
                  className={`flex min-h-[60px] items-center gap-3 rounded-control px-3 text-left ${
                    selected ? 'bg-tint' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base leading-[22px] font-bold">{choice.label}</span>
                    {choice.description && (
                      <span className="block text-[13px] leading-[18px] text-muted">
                        {choice.description}
                      </span>
                    )}
                  </span>
                  {selected && <Check aria-hidden="true" className="size-[22px] flex-none text-blue-d" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </dialog>
  );
}
