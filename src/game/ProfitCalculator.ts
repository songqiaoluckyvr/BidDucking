import { ROUND_CONFIG } from '@config/RoundConfig';
import type { Vault, RoundNumber, SessionOutcome } from './types';

export function calculateOutcome(
  vault: Vault,
  bid: number,
  round: RoundNumber,
  isJackpot: boolean,
  _ante: number,
  intelCost: number,
): SessionOutcome {
  const surfaceValue = vault.houseValue;
  const hiddenDoorValue = vault.hasHiddenDoor ? vault.hiddenDoorValue : 0;
  const grossReturn = surfaceValue + hiddenDoorValue;
  const jackpotBonus = isJackpot ? vault.houseValue * ROUND_CONFIG[round].jackpotMultiplier : 0;
  // Ante was already deducted upfront as the entry deposit — it counts toward the
  // bid price, so we don't deduct it again here.
  const netProfit = grossReturn - bid - intelCost + jackpotBonus;

  return {
    bidAccepted: true,
    bidAmount: bid,
    roundWon: round,
    surfaceValue,
    hiddenDoorValue,
    jackpotBonus,
    grossReturn,
    netProfit,
    isJackpot,
  };
}

export function calculateLostOutcome(_ante: number, intelCost: number): SessionOutcome {
  // Ante is already gone from the player's balance (deducted on session start).
  // Only intel cost is an additional loss on top of that.
  return {
    bidAccepted: false,
    bidAmount: 0,
    roundWon: null,
    surfaceValue: 0,
    hiddenDoorValue: 0,
    jackpotBonus: 0,
    grossReturn: 0,
    netProfit: -intelCost,
    isJackpot: false,
  };
}
