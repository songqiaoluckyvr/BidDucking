import { INTEL_COSTS } from '@config/EconomyConfig';
import type { IIntelOption } from '../IIntelOption';
import type { Vault, IntelResult } from '../../types';

export interface ValueBandData {
  lowerBound: number;
  upperBound: number;
}

// Band is intentionally wide — reduces uncertainty without solving the value
const BAND_FACTOR = 0.30; // ±30% around true house value

export class ValueBandIntel implements IIntelOption {
  readonly id = 'valueBand';
  readonly label = 'Value Band';
  readonly flavorLabel = 'Pull Manifest Report';
  readonly cost = INTEL_COSTS.valueBand;
  readonly description = 'Reveals a rough price band the vault falls in. Intentionally wide.';

  execute(vault: Vault): IntelResult {
    const data: ValueBandData = {
      lowerBound: Math.floor(vault.houseValue * (1 - BAND_FACTOR)),
      upperBound: Math.ceil(vault.houseValue * (1 + BAND_FACTOR)),
    };
    return { intelId: this.id, displayData: data };
  }
}
