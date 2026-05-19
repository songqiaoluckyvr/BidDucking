import Phaser from 'phaser';
import type { SessionManager } from '@game/SessionManager';
import type { IIntelOption } from '@game/intel/IIntelOption';

interface IntelShopData { session: SessionManager; }

const W = 960;
const H = 600;

const COL = {
  bg:        0x0a0a0f,
  card:      0x12121a,
  border:    0x2a2a3a,
  borderHov: 0xffd700,
  gold:      '#ffd700',
  white:     '#ffffff',
  dim:       '#6b7280',
  accent:    '#67e8f9',
};

// Card dimensions
const CARD_W    = 224;
const CARD_H    = 296;
const CARD_GAP  = 24;
const CARD_R    = 10;       // corner radius

// 3 cards centered
const TOTAL_W   = 3 * CARD_W + 2 * CARD_GAP;
const CARDS_X0  = (W - TOTAL_W) / 2;   // left edge of first card
const CARDS_Y   = (H - CARD_H) / 2 + 20; // top edge (offset down for title)

// Icon per intel id
const ICONS: Record<string, string> = {
  valueBand:  '~',
  doorSignal: 'D',
  digitPeek:  '#',
};

export class IntelShopScene extends Phaser.Scene {
  constructor() { super({ key: 'IntelShop' }); }

  create(data: IntelShopData) {
    const { session } = data;

    this.add.rectangle(W / 2, H / 2, W, H, COL.bg);

    // ── Header ────────────────────────────────────────────────────────────────
    this.add.text(W / 2, 36, 'PRE-AUCTION INTEL', {
      fontSize: '26px', color: COL.gold, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, 68, 'Purchase one dossier before entering the vault — or go in blind.', {
      fontSize: '13px', color: COL.dim,
    }).setOrigin(0.5);

    // ── Cards ─────────────────────────────────────────────────────────────────
    const options = session.getAvailableIntel();
    options.forEach((option, i) => {
      const cx = CARDS_X0 + i * (CARD_W + CARD_GAP) + CARD_W / 2;
      const cy = CARDS_Y + CARD_H / 2;
      this.buildCard(cx, cy, option, session);
    });

    // ── Skip button ───────────────────────────────────────────────────────────
    const skipY = CARDS_Y + CARD_H + 36;
    const skipBtn = this.add.text(W / 2, skipY, '[ Go In Blind — Skip Intel ]', {
      fontSize: '15px', color: COL.dim,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    skipBtn.on('pointerover', () => skipBtn.setColor(COL.white));
    skipBtn.on('pointerout',  () => skipBtn.setColor(COL.dim));
    skipBtn.on('pointerdown', () => this.scene.start('Bidding', { session, intelResult: null }));
  }

  // ─── Card builder ──────────────────────────────────────────────────────────

  private buildCard(cx: number, cy: number, option: IIntelOption, session: SessionManager) {
    const lx = cx - CARD_W / 2;
    const ty = cy - CARD_H / 2;

    // Background graphics (redrawn on hover)
    const bg = this.add.graphics();
    const draw = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(COL.card, 1);
      bg.fillRoundedRect(lx, ty, CARD_W, CARD_H, CARD_R);
      bg.lineStyle(hovered ? 2 : 1, hovered ? COL.borderHov : COL.border, 1);
      bg.strokeRoundedRect(lx, ty, CARD_W, CARD_H, CARD_R);
    };
    draw(false);

    // Icon glyph (large, centered at top)
    const iconGlyph = ICONS[option.id] ?? '?';
    this.add.text(cx, ty + 44, iconGlyph, {
      fontSize: '36px', color: COL.accent, fontStyle: 'bold',
    }).setOrigin(0.5);

    // Divider under icon
    const divG = this.add.graphics();
    divG.lineStyle(1, COL.border, 1).lineBetween(lx + 20, ty + 78, lx + CARD_W - 20, ty + 78);

    // Flavor label
    this.add.text(cx, ty + 100, option.flavorLabel.toUpperCase(), {
      fontSize: '12px', color: COL.gold, fontStyle: 'bold',
    }).setOrigin(0.5);

    // Cost
    this.add.text(cx, ty + 126, `$${option.cost.toLocaleString()}`, {
      fontSize: '24px', color: COL.white, fontStyle: 'bold',
    }).setOrigin(0.5);

    // Description
    this.add.text(cx, ty + 178, option.description, {
      fontSize: '11px', color: COL.dim,
      wordWrap: { width: CARD_W - 32 }, align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);

    // Purchase button
    const buyBtn = this.add.text(cx, ty + CARD_H - 34, '[ PURCHASE ]', {
      fontSize: '14px', color: COL.gold, fontStyle: 'bold',
    }).setOrigin(0.5);

    // Invisible hit rect
    const hit = this.add.rectangle(cx, cy, CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { draw(true);  buyBtn.setColor(COL.white); });
    hit.on('pointerout',  () => { draw(false); buyBtn.setColor(COL.gold);  });
    hit.on('pointerdown', () => {
      const result = session.purchaseIntel(option.id);
      this.scene.start('Bidding', { session, intelResult: result });
    });
  }
}
