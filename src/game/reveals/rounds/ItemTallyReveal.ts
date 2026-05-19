import type { IRoundReveal } from '../IRoundReveal';
import type { Vault, RevealResult, ItemTallyData, TallyStat } from '../../types';
import { randomChoice } from '../../rng';

const STATS: TallyStat[] = ['total', 'highValue', 'lowValue'];

export class ItemTallyReveal implements IRoundReveal {
  readonly id = 'itemTally';
  readonly roundNumber = 2 as const;

  execute(vault: Vault, rng: () => number): RevealResult {
    const statShown = randomChoice(rng, STATS);
    const highValueCount = vault.surfaceItems.filter(i => i.isHighValue).length;

    const value =
      statShown === 'total'     ? vault.surfaceItems.length :
      statShown === 'highValue' ? highValueCount :
                                  vault.surfaceItems.length - highValueCount;

    const data: ItemTallyData = { statShown, value };
    return { revealId: this.id, roundNumber: this.roundNumber, displayData: data };
  }
}
