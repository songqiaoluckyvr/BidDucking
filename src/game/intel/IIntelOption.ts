import type { Vault, IntelResult } from '../types';

export interface IIntelOption {
  readonly id: string;
  readonly label: string;        // display name
  readonly flavorLabel: string;  // casino-framed action label
  readonly cost: number;
  readonly description: string;

  execute(vault: Vault): IntelResult;
}
