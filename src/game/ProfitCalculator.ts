import { ROUND_CONFIG } from '@config/RoundConfig';
import type { Vault, RoundNumber, SessionOutcome } from './types';

export function calculateOutcome(
  vault: Vault,
  bid: number,
  round: RoundNumber,
  isJackpot: boolean,
  ante: number,
  intelCost: number,
): SessionOutcome {
  const surfaceValue = vault.houseValue;
  const hiddenDoorValue = vault.hasHiddenDoor ? vault.hiddenDoorValue : 0;
  const grossReturn = surfaceValue + hiddenDoorValue;
  const jackpotBonus = isJackpot ? vault.houseValue * ROUND_CONFIG[round].jackpotMultiplier : 0;
  const netProfit = grossReturn - bid - ante - intelCost + jackpotBonus;

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

export function calculateLostOutcome(ante: number, intelCost: number): SessionOutcome {
  return {
    bidAccepted: false,
    bidAmount: 0,
    roundWon: null,
    surfaceValue: 0,
    hiddenDoorValue: 0,
    jackpotBonus: 0,
    grossReturn: 0,
    netProfit: -(ante + intelCost),
    isJackpot: false,
  };
}
