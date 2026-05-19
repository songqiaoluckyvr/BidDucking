import { INTEL_COSTS } from '@config/EconomyConfig';
import type { IIntelOption } from '../IIntelOption';
import type { Vault, IntelResult } from '../../types';

export interface TopItemPeekData {
  topItemValue: number;
}

export class TopItemPeekIntel implements IIntelOption {
  readonly id = 'topItemPeek';
  readonly label = 'Top Item Peek';
  readonly flavorLabel = 'Run Appraisal Scan';
  readonly cost = INTEL_COSTS.topItemPeek;
  readonly description = 'Reveals the dollar value of the single highest-value surface item.';

  execute(vault: Vault): IntelResult {
    const topValue = Math.max(...vault.surfaceItems.map(i => i.value));
    const data: TopItemPeekData = { topItemValue: topValue };
    return { intelId: this.id, displayData: data };
  }
}
