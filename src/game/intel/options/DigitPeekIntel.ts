import { INTEL_COSTS } from '@config/EconomyConfig';
import type { IIntelOption } from '../IIntelOption';
import type { Vault, IntelResult } from '../../types';
import { buildDigitHint } from '../../reveals/digitHintBuilder';

export interface DigitPeekData {
  digit: number;
  position: number;
  formattedHint: string;
}

export class DigitPeekIntel implements IIntelOption {
  readonly id = 'digitPeek';
  readonly label = 'Digit Peek';
  readonly flavorLabel = 'Request Digit Analysis';
  readonly cost = INTEL_COSTS.digitPeek;
  readonly description = 'Reveals one digit of the House Value in its positional place — e.g. "$X,7XX".';

  constructor(private readonly rng: () => number) {}

  execute(vault: Vault): IntelResult {
    const data: DigitPeekData = buildDigitHint(vault.houseValue, this.rng);
    return { intelId: this.id, displayData: data };
  }
}
