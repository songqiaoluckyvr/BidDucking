export type RarityBand = 'scrap' | 'standard' | 'premium' | 'legendary';

export interface RarityBandDefinition {
  band: RarityBand;
  label: string;
  itemCountMin: number;
  itemCountMax: number;
  // Tier weights: probability weight for each tier when generating items
  tierWeights: Record<string, number>;
  hiddenDoorProbability: number;
}

export const RARITY_BAND_CONFIG: Record<RarityBand, RarityBandDefinition> = {
  scrap: {
    band: 'scrap', label: 'Scrap',
    itemCountMin: 5, itemCountMax: 7,
    tierWeights: { garbage: 50, common: 35, rare: 15, epic: 0, legendary: 0, ancient: 0 },
    hiddenDoorProbability: 0.15,
  },
  standard: {
    band: 'standard', label: 'Standard',
    itemCountMin: 5, itemCountMax: 8,
    tierWeights: { garbage: 20, common: 40, rare: 30, epic: 10, legendary: 0, ancient: 0 },
    hiddenDoorProbability: 0.25,
  },
  premium: {
    band: 'premium', label: 'Premium',
    itemCountMin: 6, itemCountMax: 9,
    tierWeights: { garbage: 10, common: 20, rare: 35, epic: 25, legendary: 10, ancient: 0 },
    hiddenDoorProbability: 0.35,
  },
  legendary: {
    band: 'legendary', label: 'Legendary',
    itemCountMin: 5, itemCountMax: 8,
    tierWeights: { garbage: 5, common: 10, rare: 20, epic: 35, legendary: 25, ancient: 5 },
    hiddenDoorProbability: 0.45,
  },
};

export const GAME_CONFIG = {
  ante: 200,
  jackpotTolerancePercent: 0.005, // ±0.5% of house value counts as jackpot
  hiddenDoorValueMin: 500,
  hiddenDoorValueMax: 8000,
  startingBalance: 5000,
} as const;
