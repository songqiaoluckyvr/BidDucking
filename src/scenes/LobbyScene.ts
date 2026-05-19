import Phaser from 'phaser';
import { GAME_CONFIG } from '@config/GameConfig';
import { generateVault, pickRandomBand } from '@game/VaultGenerator';
import { SessionManager } from '@game/SessionManager';
import { createRng, seedFromString } from '@game/rng';
import { buildIntelRegistry, buildRevealRegistry } from '../registry';

const BALANCE_KEY = 'bidducking_balance';

export class LobbyScene extends Phaser.Scene {
  private balance: number = GAME_CONFIG.startingBalance;

  constructor() { super({ key: 'Lobby' }); }

  create() {
    const { width, height } = this.scale;
    this.balance = parseInt(localStorage.getItem(BALANCE_KEY) ?? String(GAME_CONFIG.startingBalance), 10);

    this.add.text(width / 2, height * 0.25, 'BID DUCKING', {
      fontSize: '48px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.4, `Lucky Duck says: "Ready to claim a vault?"`, {
      fontSize: '18px', color: '#cccccc',
    }).setOrigin(0.5);

    const balanceText = this.add.text(width / 2, height * 0.52, `Balance: $${this.balance.toLocaleString()}`, {
      fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.6, `Ante: $${GAME_CONFIG.ante.toLocaleString()}`, {
      fontSize: '18px', color: '#aaaaaa',
    }).setOrigin(0.5);

    const enterBtn = this.add.text(width / 2, height * 0.72, '[ ENTER THE VAULT ]', {
      fontSize: '28px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    enterBtn.on('pointerover', () => enterBtn.setColor('#ffffff'));
    enterBtn.on('pointerout',  () => enterBtn.setColor('#ffd700'));
    enterBtn.on('pointerdown', () => {
      if (this.balance < GAME_CONFIG.ante) {
        balanceText.setText('Not enough balance!').setColor('#ff4444');
        return;
      }
      this.balance -= GAME_CONFIG.ante;
      localStorage.setItem(BALANCE_KEY, String(this.balance));
      this.startSession();
    });
  }

  private startSession() {
    const seed = `${Date.now()}`;
    const rng = createRng(seedFromString(seed));
    const band = pickRandomBand(rng);
    const vault = generateVault(band, seed);
    const intelRegistry = buildIntelRegistry(rng);
    const revealRegistry = buildRevealRegistry();
    const session = new SessionManager(vault, intelRegistry, revealRegistry, rng);

    this.scene.start('IntelShop', { session });
  }
}
