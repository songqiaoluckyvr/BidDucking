import { INTEL_COSTS } from '@config/EconomyConfig';
import type { IIntelOption } from '../IIntelOption';
import type { Vault, IntelResult } from '../../types';

export interface TierScanData {
  totalItems: number;
  highValueCount: number;
  lowValueCount: number;
}

export class TierScanIntel implements IIntelOption {
  readonly id = 'tierScan';
  readonly label = 'Tier Scan';
  readonly flavorLabel = 'Request Tier Assessment';
  readonly cost = INTEL_COSTS.tierScan;
  readonly description = 'Reveals the total item count, and how many are high-value vs low-value.';

  execute(vault: Vault): IntelResult {
    const highValueCount = vault.surfaceItems.filter(i => i.isHighValue).length;
    const data: TierScanData = {
      totalItems: vault.surfaceItems.length,
      highValueCount,
      lowValueCount: vault.surfaceItems.length - highValueCount,
    };
    return { intelId: this.id, displayData: data };
  }
}
