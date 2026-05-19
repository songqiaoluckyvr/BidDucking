import { ROUND_CONFIG } from '@config/RoundConfig';
import { GAME_CONFIG } from '@config/GameConfig';
import type { RoundNumber } from './types';

import type { BidDirection } from './types';

export interface BidCheck {
  accepted: boolean;
  isJackpot: boolean;
  bidDirection: BidDirection;
  lowerBound: number;
  upperBound: number;
  jackpotWindow: number;
}

export function evaluateBid(bid: number, houseValue: number, round: RoundNumber): BidCheck {
  const cfg = ROUND_CONFIG[round];
  const lowerBound = houseValue * (1 - cfg.underbidTolerance);
  const upperBound = houseValue * (1 + cfg.overbidTolerance);
  const accepted = bid >= lowerBound && bid <= upperBound;

  const jackpotWindow = houseValue * GAME_CONFIG.jackpotTolerancePercent;
  const isJackpot = accepted && Math.abs(bid - houseValue) <= jackpotWindow;

  const bidDirection: BidDirection = accepted ? null : bid < lowerBound ? 'tooLow' : 'tooHigh';

  return { accepted, isJackpot, bidDirection, lowerBound, upperBound, jackpotWindow };
}

export function getAcceptanceRange(houseValue: number, round: RoundNumber): { lower: number; upper: number } {
  const cfg = ROUND_CONFIG[round];
  return {
    lower: houseValue * (1 - cfg.underbidTolerance),
    upper: houseValue * (1 + cfg.overbidTolerance),
  };
}
