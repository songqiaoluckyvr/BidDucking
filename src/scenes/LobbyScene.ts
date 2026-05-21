import Phaser from 'phaser';
import { GAME_CONFIG } from '@config/GameConfig';
import { VAULT_TIER_CONFIG, type VaultTier, type VaultTierDef } from '@config/VaultTierConfig';
import { generateVault, pickBandForTier } from '@game/VaultGenerator';
import { SessionManager } from '@game/SessionManager';
import { createRng, seedFromString } from '@game/rng';
import { buildIntelRegistry, buildRevealRegistry } from '../registry';
import { addBackground } from '@ui/sceneBackground';
import { ASSETS } from '@assets/AssetKeys';

const BALANCE_KEY = 'bidducking_balance';
const W = 960;

const S_SM = { stroke: '#000000', strokeThickness: 2 } as const;
const S_MD = { stroke: '#000000', strokeThickness: 3 } as const;

function darkenHex(hex: string, factor = 0.38): string {
  const c = Phaser.Display.Color.HexStringToColor(hex);
  const r = Math.floor(c.red   * factor).toString(16).padStart(2, '0');
  const g = Math.floor(c.green * factor).toString(16).padStart(2, '0');
  const b = Math.floor(c.blue  * factor).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

export class LobbyScene extends Phaser.Scene {
  private balance: number = GAME_CONFIG.startingBalance;

  constructor() { super({ key: 'Lobby' }); }

  create() {
    this.balance = parseInt(localStorage.getItem(BALANCE_KEY) ?? String(GAME_CONFIG.startingBalance), 10);

    addBackground(this, ASSETS.BG_LOBBY_VIDEO, ASSETS.BG_LOBBY_IMG);

    this.sound.stopAll();
    this.sound.play(ASSETS.BGM_LOBBY, { loop: true, volume: 0.18 });

    // VI logo — dark pill backdrop so it reads against any background
    const viLogoScale = 40 / this.textures.get(ASSETS.VI_LOGO).getSourceImage().height;
    const viLogoW = this.textures.get(ASSETS.VI_LOGO).getSourceImage().width * viLogoScale;
    const PAD = 6;
    const logoBg = this.add.graphics().setDepth(29);
    logoBg.fillStyle(0x000000, 0.55).fillRoundedRect(8 - PAD, 8 - PAD, viLogoW + PAD * 2, 40 + PAD * 2, 6);
    const viLogo = this.add.image(8, 8, ASSETS.VI_LOGO).setOrigin(0, 0).setDepth(30).setAlpha(0.92);
    viLogo.setScale(viLogoScale);

    // Title image
    this.add.image(W / 2, 70, ASSETS.TITLE).setOrigin(0.5).setDisplaySize(380, 108);

    // Balance display — top-right corner
    const BAL_X = W - 16;
    this.add.text(BAL_X, 14, 'YOUR STASH', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '11px', color: '#ffffff', ...S_SM,
    }).setOrigin(1, 0.5);

    const balStr = `$${this.balance.toLocaleString()}`;
    const balanceText = this.add.text(BAL_X, 34, balStr, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '26px', color: '#ffffff', ...S_MD,
    }).setOrigin(1, 0.5);

    // ── 3 Vault tier cards ────────────────────────────────────────────────────
    const CARD_W = 270; const CARD_H = 418; const CARD_GAP = 20;
    const totalW = 3 * CARD_W + 2 * CARD_GAP;
    const startX = (W - totalW) / 2;
    const cardTopY = 148;

    (Object.keys(VAULT_TIER_CONFIG) as VaultTier[]).forEach((tier, i) => {
      const tierDef = VAULT_TIER_CONFIG[tier];
      const cx = startX + i * (CARD_W + CARD_GAP) + CARD_W / 2;
      this.buildVaultCard(cx, cardTopY, CARD_W, CARD_H, tierDef, this.balance >= tierDef.ante, balanceText);
    });
  }

  private buildVaultCard(
    cx: number, topY: number, cw: number, ch: number,
    tierDef: VaultTierDef,
    canAfford: boolean,
    balanceText: Phaser.GameObjects.Text,
  ) {
    const dim = canAfford ? 1 : 0.40;
    const col = tierDef.colorNum;

    // Card background + neon border
    const g = this.add.graphics().setAlpha(dim);
    g.fillStyle(0x0d0b20, 0.94).fillRect(cx - cw / 2, topY, cw, ch);
    g.lineStyle(8, col, 0.05).strokeRect(cx - cw / 2, topY, cw, ch);
    g.lineStyle(4, col, 0.14).strokeRect(cx - cw / 2, topY, cw, ch);
    g.lineStyle(1, col, 0.80).strokeRect(cx - cw / 2, topY, cw, ch);
    g.fillStyle(col, 1).fillRect(cx - cw / 2, topY, cw, 3);

    // Tier label
    const tierStrokeSm = { stroke: darkenHex(tierDef.color), strokeThickness: 3 };
    const tierStrokeXl = { stroke: darkenHex(tierDef.color), strokeThickness: 7 };
    this.add.text(cx, topY + 26, tierDef.label, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '22px', color: tierDef.color,
      ...tierStrokeSm,
    }).setOrigin(0.5).setAlpha(dim);

    // Divider
    this.add.graphics().setAlpha(dim * 0.4)
      .lineStyle(1, col, 0.6)
      .lineBetween(cx - cw / 2 + 20, topY + 52, cx + cw / 2 - 20, topY + 52);

    // Vault value range
    this.add.text(cx, topY + 72, 'VAULT VALUE', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '11px', color: '#ffffff', ...S_SM,
    }).setOrigin(0.5).setAlpha(dim);
    this.add.text(cx, topY + 90, `$${tierDef.valueMin.toLocaleString()} – $${tierDef.valueMax.toLocaleString()}`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '16px', color: '#ffffff', ...S_MD,
    }).setOrigin(0.5).setAlpha(dim);

    // Divider
    this.add.graphics().setAlpha(dim * 0.4)
      .lineStyle(1, col, 0.6)
      .lineBetween(cx - cw / 2 + 20, topY + 118, cx + cw / 2 - 20, topY + 118);

    // Buy-in
    this.add.text(cx, topY + 136, 'BUY-IN', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '11px', color: '#ffffff', ...S_SM,
    }).setOrigin(0.5).setAlpha(dim);
    this.add.text(cx, topY + 174, `$${tierDef.ante.toLocaleString()}`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '46px', color: tierDef.color,
      ...tierStrokeXl,
    }).setOrigin(0.5).setAlpha(dim);

    // Quality description
    this.add.text(cx, topY + 226, this.tierDesc(tierDef.tier), {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: '#ffffff',
      wordWrap: { width: cw - 32 }, align: 'center', lineSpacing: 4, ...S_SM,
    }).setOrigin(0.5, 0).setAlpha(dim);

    // ENTER button
    const btnY = topY + ch - 46;
    const btnImg = this.add.image(cx, btnY, ASSETS.MAIN_BTN)
      .setDisplaySize(cw - 28, 58).setOrigin(0.5).setAlpha(canAfford ? 1 : 0.25);
    this.add.text(cx, btnY, 'ENTER', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '20px', color: '#ffffff', ...S_MD,
    }).setOrigin(0.5).setAlpha(canAfford ? 1 : 0.35);

    if (!canAfford) return;

    const hit = this.add.rectangle(cx, btnY, cw - 28, 58)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover',  () => btnImg.setTint(0xaaddff));
    hit.on('pointerout',   () => btnImg.clearTint());
    hit.on('pointerdown',  () => {
      if (this.balance < tierDef.ante) {
        balanceText.setText('Not enough funds').setColor('#ff3355');
        return;
      }
      this.balance -= tierDef.ante;
      localStorage.setItem(BALANCE_KEY, String(this.balance));
      this.startSession(tierDef);
    });
  }

  private tierDesc(tier: VaultTier): string {
    const map: Record<VaultTier, string> = {
      bronze: 'Common to uncommon loot.\nA good starting ground.',
      silver: 'Uncommon to rare items.\nHigher stakes, bigger rewards.',
      gold:   'Rare to legendary loot.\nFor the bold and the fearless.',
    };
    return map[tier];
  }

  private startSession(tierDef: VaultTierDef) {
    const seed = `${Date.now()}`;
    const rng  = createRng(seedFromString(seed));
    const band = pickBandForTier(rng, tierDef);
    const vault = generateVault(band, seed, tierDef.valueMax, tierDef.valueMin);
    const intelRegistry  = buildIntelRegistry(rng);
    const revealRegistry = buildRevealRegistry();
    const session = new SessionManager(vault, intelRegistry, revealRegistry, rng);
    this.scene.start('Bidding', { session, vaultTier: tierDef });
  }
}
