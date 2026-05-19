import type { IRoundReveal } from './IRoundReveal';
import type { RoundNumber } from '../types';

export class RevealRegistry {
  private readonly reveals = new Map<RoundNumber, IRoundReveal>();

  register(reveal: IRoundReveal): void {
    this.reveals.set(reveal.roundNumber, reveal);
  }

  getForRound(round: RoundNumber): IRoundReveal | undefined {
    return this.reveals.get(round);
  }

  hasRevealForRound(round: RoundNumber): boolean {
    return this.reveals.has(round);
  }
}
