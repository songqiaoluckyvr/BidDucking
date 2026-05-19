import { randomInt } from '../rng';

export interface DigitHint {
  digit: number;
  position: number;
  formattedHint: string;
}

// Picks a random digit position from the house value and builds a formatted string
// e.g. houseValue=4750, position=2 (hundreds) → digit=7, hint="$X,7XX"
export function buildDigitHint(houseValue: number, rng: () => number): DigitHint {
  const digits = String(Math.round(houseValue)).split('');
  const position = randomInt(rng, 0, digits.length - 1); // 0 = leftmost digit
  const digit = parseInt(digits[position], 10);

  const masked = digits.map((d, i) => (i === position ? d : 'X')).join('');
  // Insert comma formatting if length > 3
  const formattedHint = masked.length > 3
    ? `$${masked.slice(0, masked.length - 3)},${masked.slice(-3)}`
    : `$${masked}`;

  return { digit, position, formattedHint };
}
