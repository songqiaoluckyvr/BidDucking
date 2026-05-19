export type RoundNumber = 1 | 2 | 3 | 4 | 5;

export interface RoundDefinition {
  round: RoundNumber;
  name: string;
  underbidTolerance: number; // fraction e.g. 0.60 = ±60% below house value
  overbidTolerance: number;  // fraction e.g. 0.60 = ±60% above house value
  jackpotMultiplier: number;
}

export const ROUND_CONFIG: Record<RoundNumber, RoundDefinition> = {
  1: { round: 1, name: 'First Glance',   underbidTolerance: 0.60, overbidTolerance: 0.60, jackpotMultiplier: 5   },
  2: { round: 2, name: 'Market Read',    underbidTolerance: 0.40, overbidTolerance: 0.55, jackpotMultiplier: 4   },
  3: { round: 3, name: 'Appraiser Eye',  underbidTolerance: 0.20, overbidTolerance: 0.40, jackpotMultiplier: 3   },
  4: { round: 4, name: 'Shark Bid',      underbidTolerance: 0.10, overbidTolerance: 0.25, jackpotMultiplier: 2   },
  5: { round: 5, name: 'Dead On',        underbidTolerance: 0.01, overbidTolerance: 0.10, jackpotMultiplier: 1.5 },
};
