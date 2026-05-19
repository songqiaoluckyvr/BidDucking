import { INTEL_COSTS } from '@config/EconomyConfig';
import type { IIntelOption } from '../IIntelOption';
import type { Vault, IntelResult } from '../../types';

export interface DoorSignalData {
  hasHiddenDoor: boolean;
}

export class DoorSignalIntel implements IIntelOption {
  readonly id = 'doorSignal';
  readonly label = 'Door Signal';
  readonly flavorLabel = 'Check Vault Signal';
  readonly cost = INTEL_COSTS.doorSignal;
  readonly description = 'Detects whether the vault has a hidden second door. Does not reveal what is inside.';

  execute(vault: Vault): IntelResult {
    const data: DoorSignalData = { hasHiddenDoor: vault.hasHiddenDoor };
    return { intelId: this.id, displayData: data };
  }
}
