import Phaser from 'phaser';
import { GAME_CONFIG } from '@config/GameConfig';
import { generateVault, pickRandomBand } from '@game/VaultGenerator';
import { SessionManager } from '@game/SessionManager';
import { createRng, seedFromString } from '@game/rng';
import { buildIntelRegistry, buildRevealRegistry } from '../registry';
import { PAL } from '@ui/palette';
import { addBackground } from '@ui/sceneBackground';
import { ASSETS } from '@assets/AssetKeys';

const BALANCE_KEY = 'bidducking_balance';
const W = 960;

export class LobbyScene extends Phaser.Scene {
  private balance: number = GAME_CONFIG.startingBalance;

  constructor() { super({ key: 'Lobby' }); }

  create() {
    this.balance = parseInt(localStorage.getItem(BALANCE_KEY) ?? String(GAME_CONFIG.startingBalance), 10);

    addBackground(this);

    // Center card
    const cx = W / 2;
    const card = this.add.graphics();
    card.fillStyle(PAL.n.panel, PAL.cardAlpha).fillRoundedRect(cx - 280, 80, 560, 440, 14);
    card.lineStyle(1, PAL.n.border, 1).strokeRoundedRect(cx - 280, 80, 560, 440, 14);
    // Top cyan accent bar
    card.fillStyle(PAL.n.cyan, 1).fillRect(cx - 280, 80, 560, 3);

    // Title image — scaled to fit card width, positioned at top of card
    this.add.image(cx, 158, ASSETS.TITLE)
      .setOrigin(0.5)
      .setDisplaySize(340, 200);

    // Divider
    this.add.graphics().lineStyle(1, PAL.n.border, 1).lineBetween(cx - 220, 226, cx + 220, 226);

    // Balance display
    this.add.text(cx, 258, 'YOUR BALANCE', { fontSize: '11px', color: PAL.dim }).setOrigin(0.5);
    const balanceText = this.add.text(cx, 288, `$${this.balance.toLocaleString()}`, {
      fontSize: '34px', color: PAL.white, fontStyle: 'bold',
    }).setOrigin(0.5);

    // Ante line
    this.add.text(cx, 326, `Entry ante: $${GAME_CONFIG.ante.toLocaleString()}`, {
      fontSize: '14px', color: PAL.white,
    }).setOrigin(0.5);

    // Enter button
    const btnW = 300; const btnH = 52; const btnY = 390;
    const btnG = this.add.graphics();
    const drawBtn = (hov: boolean) => {
      btnG.clear();
      btnG.fillStyle(hov ? PAL.n.cyan : PAL.n.panelAlt, hov ? 1 : PAL.panelAltAlpha).fillRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
      btnG.lineStyle(2, PAL.n.cyan, 1).strokeRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
    };
    drawBtn(false);

    const enterBtn = this.add.text(cx, btnY, 'ENTER THE VAULT', {
      fontSize: '20px', color: PAL.white, fontStyle: 'bold',
    }).setOrigin(0.5);

    const hit = this.add.rectangle(cx, btnY, btnW, btnH).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { drawBtn(true);  enterBtn.setColor('#05040f'); });
    hit.on('pointerout',  () => { drawBtn(false); enterBtn.setColor(PAL.white); });
    hit.on('pointerdown', () => {
      if (this.balance < GAME_CONFIG.ante) {
        balanceText.setText('Insufficient balance').setColor(PAL.red);
        return;
      }
      this.balance -= GAME_CONFIG.ante;
      localStorage.setItem(BALANCE_KEY, String(this.balance));
      this.startSession();
    });

    // Footer
    this.add.text(cx, 468, 'Jackpot · Hidden Door · 5 Rounds · Pre-Auction Intel', {
      fontSize: '11px', color: PAL.muted,
    }).setOrigin(0.5);

    this.addDuck();
  }

  private addDuck() {
    const duck = this.add.image(820, 430, ASSETS.DUCK_MASCOT);
    const scale = Math.min(180 / duck.width, 300 / duck.height);
    duck.setScale(scale);
  }

  private startSession() {
    const available = this.balance; // ante already deducted before calling this
    const seed = `${Date.now()}`;
    const rng = createRng(seedFromString(seed));
    const band = pickRandomBand(rng);
    const vault = generateVault(band, seed, available);
    const intelRegistry = buildIntelRegistry(rng);
    const revealRegistry = buildRevealRegistry();
    const session = new SessionManager(vault, intelRegistry, revealRegistry, rng);
    this.scene.start('Bidding', { session });
  }
}
