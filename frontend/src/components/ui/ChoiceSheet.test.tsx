import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceSheet, type Choice } from './ChoiceSheet';

const hours: Choice<number>[] = [
  { value: 1, label: '1 h', spoken: '1 hour' },
  { value: 2, label: '2 h', spoken: '2 hours' },
  { value: 4, label: '4 h', spoken: '4 hours', description: 'Most trips' },
];

function sheet(onPick = vi.fn(), onClose = vi.fn()) {
  render(
    <ChoiceSheet open onClose={onClose} title="Sharing time" choices={hours} value={2} onPick={onPick} />,
  );
  return { onPick, onClose };
}

describe('ChoiceSheet', () => {
  it('lists the options as a radio group, with the current one ticked and focused', () => {
    sheet();

    expect(screen.getByRole('heading', { name: 'Sharing time' })).toBeInTheDocument();
    const options = screen.getAllByRole('radio');
    expect(options.map((option) => option.getAttribute('aria-label'))).toEqual([
      '1 hour',
      '2 hours',
      '4 hours',
    ]);
    expect(screen.getByRole('radio', { name: '2 hours' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '2 hours' })).toHaveFocus();
    expect(screen.getByText('Most trips')).toBeInTheDocument();
  });

  it('picks an option and closes', async () => {
    const user = userEvent.setup();
    const { onPick, onClose } = sheet();

    await user.click(screen.getByRole('radio', { name: '4 hours' }));

    expect(onPick).toHaveBeenCalledWith(4);
    expect(onClose).toHaveBeenCalled();
  });

  it('moves between options with the arrow keys, wrapping round, without picking', async () => {
    const user = userEvent.setup();
    const { onPick } = sheet();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: '4 hours' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: '1 hour' })).toHaveFocus();
    expect(onPick).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith(1);
  });
});
