import { TIER_CONFIG, type ItemTier } from '@config/TierConfig';
import { RARITY_BAND_CONFIG, GAME_CONFIG, type RarityBand } from '@config/GameConfig';
import { createRng, randomInt, seedFromString } from './rng';
import type { Vault, VaultItem } from './types';

let _idCounter = 0;
function nextId(): string {
  return `item_${++_idCounter}`;
}

function pickTier(rng: () => number, weights: Record<string, number>): ItemTier {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (const [tier, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return tier as ItemTier;
  }
  return 'common';
}

function generateItem(rng: () => number, tier: ItemTier): VaultItem {
  const def = TIER_CONFIG[tier];
  const value = randomInt(rng, def.min, def.max);
  return { id: nextId(), tier, tierDef: def, value, isHighValue: def.isHighValue };
}

function generateItems(rng: () => number, count: number, weights: Record<string, number>): VaultItem[] {
  const items: VaultItem[] = [];
  for (let i = 0; i < count; i++) {
    const tier = pickTier(rng, weights);
    items.push(generateItem(rng, tier));
  }
  return items;
}

function generateHiddenItems(rng: () => number): VaultItem[] {
  const count = randomInt(rng, 1, 3);
  // Hidden door items skew toward rare/epic — not priced by house so they lean valuable
  const hiddenWeights = { garbage: 5, common: 15, rare: 35, epic: 35, legendary: 10, ancient: 0 };
  return generateItems(rng, count, hiddenWeights);
}

export function generateVault(band: RarityBand, seed?: string): Vault {
  const resolvedSeed = seed ?? `vault_${Date.now()}_${Math.random()}`;
  const rng = createRng(seedFromString(resolvedSeed));
  const bandDef = RARITY_BAND_CONFIG[band];

  const itemCount = randomInt(rng, bandDef.itemCountMin, bandDef.itemCountMax);
  const surfaceItems = generateItems(rng, itemCount, bandDef.tierWeights);
  const houseValue = surfaceItems.reduce((sum, i) => sum + i.value, 0);

  const hasHiddenDoor = rng() < bandDef.hiddenDoorProbability;
  const hiddenItems = hasHiddenDoor ? generateHiddenItems(rng) : [];
  const hiddenDoorValue = hiddenItems.reduce((sum, i) => sum + i.value, 0);

  // Clamp hidden door value to configured range
  const clampedHidden = hasHiddenDoor
    ? Math.min(Math.max(hiddenDoorValue, GAME_CONFIG.hiddenDoorValueMin), GAME_CONFIG.hiddenDoorValueMax)
    : 0;

  return {
    id: `vault_${resolvedSeed}`,
    rarityBand: band,
    houseValue,
    surfaceItems,
    hasHiddenDoor,
    hiddenItems,
    hiddenDoorValue: clampedHidden,
    seed: resolvedSeed,
  };
}

export function pickRandomBand(rng: () => number): RarityBand {
  const bands: RarityBand[] = ['scrap', 'standard', 'premium', 'legendary'];
  const weights = [30, 40, 22, 8]; // % probability
  let roll = rng() * 100;
  for (let i = 0; i < bands.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return bands[i];
  }
  return 'standard';
}
