import { GAME_CONFIG } from '@config/GameConfig';
import type { RoundNumber, Vault, SessionState, SessionOutcome, BidEvaluationResult, IntelResult, RevealResult, RoundState } from './types';
import { evaluateBid } from './BidEvaluator';
import { calculateOutcome, calculateLostOutcome } from './ProfitCalculator';
import type { IntelRegistry } from './intel/IntelRegistry';
import type { RevealRegistry } from './reveals/RevealRegistry';

const MAX_ROUNDS = 5;

export class SessionManager {
  private state: SessionState;

  constructor(
    private readonly vault: Vault,
    private readonly intelRegistry: IntelRegistry,
    private readonly revealRegistry: RevealRegistry,
    private readonly rng: () => number,
    ante: number = GAME_CONFIG.ante,
  ) {
    this.state = {
      vault,
      antePaid: ante,
      intelPurchased: null,
      intelCost: 0,
      rounds: [],
      currentRound: 1,
      complete: false,
      outcome: null,
    };
  }

  // ─── Intel ─────────────────────────────────────────────────────────────────

  getAvailableIntel() {
    return this.intelRegistry.getAll();
  }

  purchaseIntel(intelId: string): IntelResult {
    if (this.state.intelPurchased) throw new Error('Intel already purchased this session');
    if (this.state.rounds.length > 0) throw new Error('Intel must be purchased before Round 1');

    const option = this.intelRegistry.get(intelId);
    const result = option.execute(this.vault);
    const cost = option.cost;

    this.state = { ...this.state, intelPurchased: result, intelCost: cost };
    return result;
  }

  // ─── Bidding ───────────────────────────────────────────────────────────────

  getCurrentRound(): RoundNumber {
    return this.state.currentRound;
  }

  submitBid(bid: number): BidEvaluationResult {
    if (this.state.complete) throw new Error('Session is already complete');

    const round = this.state.currentRound;
    const { accepted, isJackpot, bidDirection } = evaluateBid(bid, this.vault.houseValue, round);

    if (accepted) {
      const outcome = calculateOutcome(
        this.vault, bid, round, isJackpot,
        this.state.antePaid, this.state.intelCost,
      );
      const roundState: RoundState = { roundNumber: round, bidSubmitted: bid, bidAccepted: true, isJackpot, revealResult: null };
      this.state = {
        ...this.state,
        rounds: [...this.state.rounds, roundState],
        complete: true,
        outcome,
      };
      return { accepted: true, isJackpot, bidDirection: null, revealResult: null, sessionComplete: true };
    }

    // Bid rejected — get reveal for next round (if any)
    const nextRound = (round + 1) as RoundNumber;
    const isLastRound = round === MAX_ROUNDS;
    const revealResult = !isLastRound
      ? this.revealRegistry.getForRound(nextRound as RoundNumber)?.execute(this.vault, this.rng) ?? null
      : null;

    const roundState: RoundState = { roundNumber: round, bidSubmitted: bid, bidAccepted: false, isJackpot: false, revealResult };

    if (isLastRound) {
      const outcome = calculateLostOutcome(this.state.antePaid, this.state.intelCost);
      this.state = {
        ...this.state,
        rounds: [...this.state.rounds, roundState],
        complete: true,
        outcome,
      };
      return { accepted: false, isJackpot: false, bidDirection, revealResult, sessionComplete: true };
    }

    this.state = {
      ...this.state,
      rounds: [...this.state.rounds, roundState],
      currentRound: nextRound,
    };
    return { accepted: false, isJackpot: false, bidDirection, revealResult, sessionComplete: false };
  }

  forfeit(): void {
    if (this.state.complete) return;
    const outcome = calculateLostOutcome(this.state.antePaid, this.state.intelCost);
    this.state = { ...this.state, complete: true, outcome };
  }

  // ─── Read-only access ──────────────────────────────────────────────────────

  getSessionState(): Readonly<SessionState> {
    return this.state;
  }

  getSessionOutcome(): SessionOutcome {
    if (!this.state.outcome) throw new Error('Session not yet complete');
    return this.state.outcome;
  }

  getAllRevealsSoFar(): RevealResult[] {
    return this.state.rounds
      .map(r => r.revealResult)
      .filter((r): r is RevealResult => r !== null);
  }
}
