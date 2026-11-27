import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatTile } from './StatTile';
import { statParts } from './statParts';

describe('statParts', () => {
  it.each([
    ['8.1 km', [{ number: '8.1', unit: 'km' }]],
    ['4', [{ number: '4', unit: '' }]],
    [
      '12 h 45 min',
      [
        { number: '12', unit: 'h' },
        { number: '45', unit: 'min' },
      ],
    ],
    ['…', [{ number: '…', unit: '' }]],
    ['–', [{ number: '–', unit: '' }]],
  ])('keeps each number with its unit: %s', (value, parts) => {
    expect(statParts(value)).toEqual(parts);
  });
});

describe('StatTile', () => {
  it('reads as the whole value and its label, never shortened', () => {
    render(
      <dl>
        <StatTile value="12 h 45 min" label="Time" className="bg-sand" />
      </dl>,
    );
    const value = screen.getByRole('definition');
    expect(value).toHaveTextContent(/^12 h 45 min$/);
    expect(value).not.toHaveClass('truncate');
    expect(screen.getByRole('term')).toHaveTextContent('Time');
    // A number and its unit never split across lines.
    expect(screen.getByText('12', { exact: false }).closest('span')).toHaveClass('whitespace-nowrap');
  });
});
