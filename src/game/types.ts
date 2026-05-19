import type { ItemTier, TierDefinition } from '@config/TierConfig';
import type { RarityBand } from '@config/GameConfig';
import type { RoundNumber } from '@config/RoundConfig';

export type { ItemTier, RarityBand, RoundNumber };

// ─── Item ────────────────────────────────────────────────────────────────────

export interface VaultItem {
  id: string;
  tier: ItemTier;
  tierDef: TierDefinition;
  value: number;       // randomised within tier range at generation
  isHighValue: boolean;
}

// ─── Vault ───────────────────────────────────────────────────────────────────

export interface Vault {
  id: string;
  rarityBand: RarityBand;
  houseValue: number;          // sum of surface item values
  surfaceItems: VaultItem[];
  hasHiddenDoor: boolean;
  hiddenItems: VaultItem[];    // empty if no hidden door
  hiddenDoorValue: number;     // sum of hidden item values (0 if no door)
  seed: string;
}

// ─── Intel ───────────────────────────────────────────────────────────────────

export interface IntelResult {
  intelId: string;
  displayData: unknown; // cast by the Phaser renderer that knows the intelId
}

// ─── Reveals ─────────────────────────────────────────────────────────────────

export interface RevealResult {
  revealId: string;
  roundNumber: RoundNumber;
  displayData: unknown; // cast by RevealPanel sub-renderer keyed on revealId
}

// Strongly-typed reveal payloads — used by implementations and their renderers

export interface QuickPeekData {
  itemCount: number;
  hasDominantAnchor: boolean; // true if top item > 50% of houseValue
}

export type TallyStat = 'total' | 'highValue' | 'lowValue';
export interface ItemTallyData {
  statShown: TallyStat;
  value: number;
}

export interface TopItemValueData {
  topItemValue: number;
}

export interface DigitRevealData {
  digit: number;
  position: number;      // 0 = ones, 1 = tens, 2 = hundreds …
  formattedHint: string; // e.g. "$X,7XX"
}

// ─── Session ─────────────────────────────────────────────────────────────────

export interface RoundState {
  roundNumber: RoundNumber;
  bidSubmitted: number | null;
  bidAccepted: boolean;
  isJackpot: boolean;
  revealResult: RevealResult | null; // null on the final accepted round
}

export interface SessionState {
  vault: Vault;
  antePaid: number;
  intelPurchased: IntelResult | null;
  intelCost: number;
  rounds: RoundState[];
  currentRound: RoundNumber;
  complete: boolean;
  outcome: SessionOutcome | null;
}

export interface SessionOutcome {
  bidAccepted: boolean;
  bidAmount: number;
  roundWon: RoundNumber | null;
  surfaceValue: number;
  hiddenDoorValue: number;
  jackpotBonus: number;
  grossReturn: number;  // surfaceValue + hiddenDoorValue
  netProfit: number;    // grossReturn - bidAmount - ante - intelCost + jackpotBonus
  isJackpot: boolean;
}

// ─── Bid evaluation ──────────────────────────────────────────────────────────

export type BidDirection = 'tooHigh' | 'tooLow' | null;

export interface BidEvaluationResult {
  accepted: boolean;
  isJackpot: boolean;
  bidDirection: BidDirection; // null when accepted, 'tooHigh'/'tooLow' when rejected
  revealResult: RevealResult | null; // provided when rejected, null when accepted
  sessionComplete: boolean;
}
