import type { RarityBand } from './GameConfig';

export type VaultTier = 'bronze' | 'silver' | 'gold';

export interface VaultTierDef {
  tier:        VaultTier;
  label:       string;
  ante:        number;
  color:       string;      // CSS hex for text
  colorNum:    number;      // number for Graphics
  bands:       RarityBand[];
  bandWeights: number[];    // parallel weights for each band
  valueMin:    number;      // approx vault value floor (display + generator hint)
  valueMax:    number;      // approx vault value ceiling
  sliderMax:   number;      // bid slider cap (slightly above valueMax)
}

export const VAULT_TIER_CONFIG: Record<VaultTier, VaultTierDef> = {
  bronze: {
    tier:        'bronze',
    label:       'BRONZE',
    ante:        200,
    color:       '#cd8040',
    colorNum:    0xcd8040,
    bands:       ['scrap', 'standard'],
    bandWeights: [55, 45],
    valueMin:    600,
    valueMax:    8_000,
    sliderMax:   10_000,
  },
  silver: {
    tier:        'silver',
    label:       'SILVER',
    ante:        1_000,
    color:       '#b0c8e0',
    colorNum:    0xb0c8e0,
    bands:       ['standard', 'premium'],
    bandWeights: [40, 60],
    valueMin:    3_000,
    valueMax:    25_000,
    sliderMax:   30_000,
  },
  gold: {
    tier:        'gold',
    label:       'GOLD',
    ante:        2_000,
    color:       '#ffd700',
    colorNum:    0xffd700,
    bands:       ['premium', 'legendary'],
    bandWeights: [35, 65],
    valueMin:    8_000,
    valueMax:    60_000,
    sliderMax:   75_000,
  },
};
