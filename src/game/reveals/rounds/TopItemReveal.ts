import type { IRoundReveal } from '../IRoundReveal';
import type { Vault, RevealResult, TopItemValueData } from '../../types';

export class TopItemReveal implements IRoundReveal {
  readonly id = 'topItemValue';
  readonly roundNumber = 3 as const;

  execute(vault: Vault, _rng: () => number): RevealResult {
    const topValue = Math.max(...vault.surfaceItems.map(i => i.value));
    const data: TopItemValueData = { topItemValue: topValue };
    return { revealId: this.id, roundNumber: this.roundNumber, displayData: data };
  }
}
