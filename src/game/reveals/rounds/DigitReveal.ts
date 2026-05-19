import type { IRoundReveal } from '../IRoundReveal';
import type { Vault, RevealResult, DigitRevealData } from '../../types';
import { buildDigitHint } from '../digitHintBuilder';

export class DigitReveal implements IRoundReveal {
  readonly id = 'digitReveal';
  readonly roundNumber = 4 as const;

  execute(vault: Vault, rng: () => number): RevealResult {
    const data: DigitRevealData = buildDigitHint(vault.houseValue, rng);
    return { revealId: this.id, roundNumber: this.roundNumber, displayData: data };
  }
}
