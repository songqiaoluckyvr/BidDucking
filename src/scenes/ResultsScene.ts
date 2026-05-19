import Phaser from 'phaser';
import { GAME_CONFIG } from '@config/GameConfig';
import type { SessionManager } from '@game/SessionManager';

interface ResultsData { session: SessionManager; }

const BALANCE_KEY = 'bidducking_balance';

export class ResultsScene extends Phaser.Scene {
  constructor() { super({ key: 'Results' }); }

  create(data: ResultsData) {
    const { session } = data;
    const { width, height } = this.scale;
    const outcome = session.getSessionOutcome();
    const state = session.getSessionState();

    // Update persisted balance
    const prevBalance = parseInt(localStorage.getItem(BALANCE_KEY) ?? String(GAME_CONFIG.startingBalance), 10);
    const newBalance = prevBalance + outcome.netProfit;
    localStorage.setItem(BALANCE_KEY, String(newBalance));

    this.add.text(width / 2, height * 0.1, 'SESSION RESULTS', { fontSize: '36px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5);

    const lines = [
      `Ante paid:         -$${state.antePaid.toLocaleString()}`,
      `Intel paid:        -$${state.intelCost.toLocaleString()}`,
      outcome.bidAccepted ? `Bid paid:          -$${outcome.bidAmount.toLocaleString()}` : 'Bid:               None accepted',
      `Vault value:       +$${outcome.surfaceValue.toLocaleString()}`,
      outcome.hiddenDoorValue > 0 ? `Hidden door:       +$${outcome.hiddenDoorValue.toLocaleString()}` : 'Hidden door:       None',
      outcome.isJackpot ? `Jackpot bonus:     +$${outcome.jackpotBonus.toLocaleString()}` : '',
      `─────────────────────────────`,
      `Net:               ${outcome.netProfit >= 0 ? '+' : ''}$${outcome.netProfit.toLocaleString()}`,
      `New balance:       $${newBalance.toLocaleString()}`,
    ].filter(Boolean);

    lines.forEach((line, i) => {
      const isNet = line.startsWith('Net:');
      const isBalance = line.startsWith('New balance:');
      this.add.text(width / 2, height * 0.22 + i * 30, line, {
        fontSize: isNet || isBalance ? '20px' : '16px',
        color: isNet ? (outcome.netProfit >= 0 ? '#86efac' : '#f87171') : '#cccccc',
        fontStyle: isNet || isBalance ? 'bold' : 'normal',
        fontFamily: 'monospace',
      }).setOrigin(0.5);
    });

    const playAgainBtn = this.add.text(width / 2, height * 0.88, '[ PLAY AGAIN ]', {
      fontSize: '26px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    playAgainBtn.on('pointerover', () => playAgainBtn.setColor('#ffffff'));
    playAgainBtn.on('pointerout',  () => playAgainBtn.setColor('#ffd700'));
    playAgainBtn.on('pointerdown', () => this.scene.start('Lobby'));
  }
}
