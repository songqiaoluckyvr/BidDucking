export type ItemTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface TierDefinition {
  tier: ItemTier;
  label: string;
  frameColor: string;
  min: number;
  max: number;
  isHighValue: boolean; // epic and above
}

export const TIER_CONFIG: Record<ItemTier, TierDefinition> = {
  common:    { tier: 'common',    label: 'Common',    frameColor: '#ffffff', min: 1,     max: 50,    isHighValue: false },
  uncommon:  { tier: 'uncommon',  label: 'Uncommon',  frameColor: '#22c55e', min: 51,    max: 200,   isHighValue: false },
  rare:      { tier: 'rare',      label: 'Rare',      frameColor: '#3b82f6', min: 250,   max: 700,   isHighValue: false },
  epic:      { tier: 'epic',      label: 'Epic',      frameColor: '#a855f7', min: 1000,  max: 3000,  isHighValue: true  },
  legendary: { tier: 'legendary', label: 'Legendary', frameColor: '#eab308', min: 5000,  max: 15000, isHighValue: true  },
};
