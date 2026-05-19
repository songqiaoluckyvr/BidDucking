import type { Vault, RevealResult, RoundNumber } from '../types';

export interface IRoundReveal {
  readonly id: string;
  readonly roundNumber: RoundNumber;

  // rng is injected for deterministic testing of random selections (e.g. Round 2 stat)
  execute(vault: Vault, rng: () => number): RevealResult;
}
