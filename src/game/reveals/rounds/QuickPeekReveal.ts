import type { IRoundReveal } from '../IRoundReveal';
import type { Vault, RevealResult, QuickPeekData } from '../../types';

export class QuickPeekReveal implements IRoundReveal {
  readonly id = 'quickPeek';
  readonly roundNumber = 1 as const;

  execute(vault: Vault, _rng: () => number): RevealResult {
    const topItem = vault.surfaceItems.reduce((a, b) => a.value > b.value ? a : b);
    const data: QuickPeekData = {
      itemCount: vault.surfaceItems.length,
      hasDominantAnchor: topItem.value > vault.houseValue * 0.5,
    };
    return { revealId: this.id, roundNumber: this.roundNumber, displayData: data };
  }
}
