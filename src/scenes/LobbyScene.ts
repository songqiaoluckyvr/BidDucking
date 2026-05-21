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

export class LobbyScene extends Phaser.Scene {
  private balance: number = GAME_CONFIG.startingBalance;

  constructor() { super({ key: 'Lobby' }); }

  create() {
    this.balance = parseInt(localStorage.getItem(BALANCE_KEY) ?? String(GAME_CONFIG.startingBalance), 10);

    addBackground(this);

    const viLogo = this.add.image(8, 8, ASSETS.VI_LOGO).setOrigin(0, 0).setDepth(30).setAlpha(0.85);
    viLogo.setScale(40 / viLogo.height);

    // Card shifted left so duck has breathing room on the right
    const cardCX = 415;
    const cardY = 45; const cardW = 500; const cardH = 492;

    // ui_border as full card (background texture + glowing frame)
    this.add.image(cardCX, cardY + cardH / 2, ASSETS.UI_BORDER)
      .setDisplaySize(cardW, cardH)
      .setOrigin(0.5)
      .setAlpha(0.85);

    // Semi-transparent dark overlay so text stays readable
    this.add.graphics()
      .fillStyle(0x04060f, 0.50)
      .fillRoundedRect(cardCX - cardW / 2 + 12, cardY + 12, cardW - 24, cardH - 24, 12);

    // Title — natural ratio 1536×439 → 3.5:1
    this.add.image(cardCX, cardY + 100, ASSETS.TITLE)
      .setOrigin(0.5)
      .setDisplaySize(460, 132);

    // YOUR STASH
    this.add.text(cardCX, cardY + 210, 'YOUR STASH', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: '#9090b8',
    }).setOrigin(0.5);

    // Balance — hero number
    const balStr = `$${this.balance.toLocaleString()}`;
    const balStyle = { fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '48px' };

    // Glow — outer (wide, soft)
    this.add.text(cardCX, cardY + 258, balStr, {
      ...balStyle, color: '#3355dd',
      shadow: { offsetX: 0, offsetY: 0, color: '#3355dd', blur: 60, stroke: true, fill: true },
    }).setOrigin(0.5).setAlpha(0.55);

    // Glow — inner (tight, bright)
    this.add.text(cardCX, cardY + 258, balStr, {
      ...balStyle, color: '#aabbff',
      shadow: { offsetX: 0, offsetY: 0, color: '#aabbff', blur: 22, stroke: true, fill: true },
    }).setOrigin(0.5).setAlpha(0.75);

    // Sharp white text on top
    const balanceText = this.add.text(cardCX, cardY + 258, balStr, {
      ...balStyle, color: '#ffffff',
    }).setOrigin(0.5);

    // BUY-IN label (no background)
    const pillY = cardY + 312;
    this.add.text(cardCX, pillY, `BUY-IN: $${GAME_CONFIG.ante.toLocaleString()}`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '14px', color: '#9090b8',
    }).setOrigin(0.5);

    // CRACK THE VAULT — natural ratio 1526×337 → 4.53:1
    const btnW = 450; const btnH = 100; const btnY = cardY + 370;
    const btnImg = this.add.image(cardCX, btnY, ASSETS.MAIN_BTN)
      .setDisplaySize(btnW, btnH)
      .setOrigin(0.5);

    this.add.text(cardCX, btnY, 'CRACK THE VAULT', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5);

    const hit = this.add.rectangle(cardCX, btnY, btnW, btnH)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => { btnImg.setTint(0xbbddff); });
    hit.on('pointerout',  () => { btnImg.clearTint(); });
    hit.on('pointerdown', () => {
      if (this.balance < GAME_CONFIG.ante) {
        balanceText.setText('Not enough funds').setColor(PAL.red);
        return;
      }
      this.balance -= GAME_CONFIG.ante;
      localStorage.setItem(BALANCE_KEY, String(this.balance));
      this.startSession();
    });

    // Footer — inside the card border
    this.add.text(cardCX, cardY + cardH - 48, 'Loot  ◆  |  Secrets  🔒  |  5 Rounds  ✦  |  Buy Intel', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: '#6060a0',
    }).setOrigin(0.5);

    this.addDuck();
  }

  private addDuck() {
    // Anchor to left edge of image so duck grows rightward from the card border.
    // Card right edge: cardCX(415) + cardW/2(250) = 665
    const duck = this.add.image(570, 390, ASSETS.DUCK_MASCOT)
      .setOrigin(0, 0.5);
    const scale = Math.min(420 / duck.width, 420 / duck.height);
    duck.setScale(scale);
  }

  private startSession() {
    const available = this.balance;
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
