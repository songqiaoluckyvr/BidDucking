import Phaser from 'phaser';
import { SessionManager } from '@game/SessionManager';
import type { IntelResult, RevealResult, SessionOutcome, VaultItem } from '@game/types';
import { generateVault, pickRandomBand } from '@game/VaultGenerator';
import { createRng, seedFromString } from '@game/rng';
import { buildIntelRegistry, buildRevealRegistry } from '../registry';
import { ROUND_CONFIG } from '@config/RoundConfig';
import { GAME_CONFIG } from '@config/GameConfig';
import { PAL } from '@ui/palette';
import { addBackground } from '@ui/sceneBackground';
import { ASSETS } from '@assets/AssetKeys';

interface BiddingData {
  session: SessionManager;
  intelResult?: IntelResult | null;
}

interface PlacedItem {
  item: VaultItem;
  col: number;
  row: number;
  w: number;   // cell span width
  h: number;   // cell span height
  isHidden: boolean;
}

const BALANCE_KEY = 'bidducking_balance';

const LEFT_W  = 220;
const RIGHT_W = 340;
const W       = 960;
const H       = 600;
const MID_CX  = LEFT_W + (W - LEFT_W - RIGHT_W) / 2;  // 420

const SLIDER_MIN = 100;
const SLIDER_MAX = 200_000;
const SLIDER_PAD = 24;

// ── Vault loot grid ──────────────────────────────────────────────────────────
const GSTEP  = 33;          // grid step (cell + gap)
const GCELL  = 30;          // visible cell size
const GCOLS  = 8;
const GROW_M = 13;          // main vault rows
const GROW_S = 4;           // secret vault rows

// Left edge of grid, centred inside the right panel
const GRID_X   = (W - RIGHT_W) + Math.round((RIGHT_W - ((GCOLS - 1) * GSTEP + GCELL)) / 2);
const GRID_Y_M = 18;                                // top of main grid
const GRID_Y_S = GRID_Y_M + GROW_M * GSTEP + 18;  // top of secret grid

// Colours — white / greys only for game UI
const C_ACTIVE = '#ffffff';
const C_GREY   = '#d0d0e4';

// Intel shop display config (overrides option.flavorLabel / option.description)
const INTEL_DISPLAY: Record<string, { icon: string; label: string; desc: string }> = {
  valueBand: {
    icon:  '□',
    label: 'ITEM SWEEP',
    desc:  "Shows every item's footprint in the vault. Size tells a story.",
  },
  doorSignal: {
    icon:  '◈',
    label: 'RARITY SCANNER',
    desc:  'Highlights Rare+ items with tier colours. Spot the prize before you bid.',
  },
  digitPeek: {
    icon:  '⬡',
    label: 'SECRET BOX',
    desc:  'Peeks behind the hidden door — if one exists. Know before you go.',
  },
};

export class BiddingScene extends Phaser.Scene {
  private session!: SessionManager;

  // Player bankroll cap
  private playerBalance = 0;
  private effectiveMax  = SLIDER_MAX;

  // Slider
  private sliderTrackLeft  = 0;
  private sliderTrackRight = 0;
  private sliderTrackY     = 0;
  private sliderThumbX     = 0;
  private isDragging       = false;
  private bidAmount        = 0;
  private rangeMaxLabel!:  Phaser.GameObjects.Text;

  // Bid section objects hidden during reveal
  private bidSectionObjects: Phaser.GameObjects.GameObject[] = [];

  // Dynamic UI
  private roundLabel!:     Phaser.GameObjects.Text;
  private roundName!:      Phaser.GameObjects.Text;
  private totalValueText!: Phaser.GameObjects.Text;
  private intelLineText!:  Phaser.GameObjects.Text;
  private bidAmountText!:  Phaser.GameObjects.Text;
  private feedbackText!:   Phaser.GameObjects.Text;
  private sliderFillGfx!:  Phaser.GameObjects.Graphics;
  private sliderThumb!:    Phaser.GameObjects.Image;
  private infoLines:       Phaser.GameObjects.Text[] = [];
  private bidHistoryTexts: Phaser.GameObjects.Text[] = [];

  // Vault grid
  private mainGridItems:   PlacedItem[] = [];
  private secretGridItems: PlacedItem[] = [];
  private gridEffectGfx!:  Phaser.GameObjects.Graphics;

  constructor() { super({ key: 'Bidding' }); }

  create(data: BiddingData) {
    this.session           = data.session;
    this.bidAmount         = 0;
    this.sliderThumbX      = 0;
    this.isDragging        = false;
    this.bidHistoryTexts   = [];
    this.infoLines         = [];
    this.bidSectionObjects = [];
    this.mainGridItems   = [];
    this.secretGridItems = [];

    this.playerBalance = parseInt(
      localStorage.getItem(BALANCE_KEY) ?? String(GAME_CONFIG.startingBalance), 10,
    );
    this.effectiveMax = Math.min(SLIDER_MAX, this.playerBalance);

    addBackground(this);
    this.drawPanels();
    this.buildLeftPanel();
    this.buildCenterPanel();
    this.buildRightPanel();
    this.setupSliderInput();

    if (data.intelResult === undefined) {
      this.showIntelShopOverlay();
    } else {
      if (data.intelResult) {
        this.intelLineText.setText(this.formatIntel(data.intelResult));
        this.applyIntelEffect(data.intelResult.intelId);
      }
    }
  }

  // ─── Panel backgrounds ────────────────────────────────────────────────────

  private drawPanels() {
    const g = this.add.graphics();
    // Left panel
    g.fillStyle(PAL.n.panel, 0.72).fillRect(0, 0, LEFT_W, H);
    g.lineStyle(1, PAL.n.border, 1).strokeRect(0, 0, LEFT_W, H);
    g.fillStyle(PAL.n.cyan, 1).fillRect(0, 0, LEFT_W, 3);
    // Right panel
    g.fillStyle(PAL.n.panel, 0.72).fillRect(W - RIGHT_W, 0, RIGHT_W, H);
    g.lineStyle(1, PAL.n.border, 1).strokeRect(W - RIGHT_W, 0, RIGHT_W, H);
    g.fillStyle(PAL.n.cyan, 1).fillRect(W - RIGHT_W, 0, RIGHT_W, 3);
    // Dividers
    g.lineStyle(1, PAL.n.borderBright, 0.4);
    g.lineBetween(LEFT_W, 0, LEFT_W, H);
    g.lineBetween(W - RIGHT_W, 0, W - RIGHT_W, H);
  }

  // ─── Left panel ───────────────────────────────────────────────────────────

  private buildLeftPanel() {
    const cx    = LEFT_W / 2;
    const state = this.session.getSessionState();
    const round = state.currentRound;

    this.roundLabel = this.add.text(cx, 16, `ROUND ${round} OF 5`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: C_GREY,
    }).setOrigin(0.5);

    this.roundName = this.add.text(cx, 34, ROUND_CONFIG[round].name.toUpperCase(), {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '12px', color: C_GREY,
    }).setOrigin(0.5);

    this.add.graphics().lineStyle(1, PAL.n.border, 0.4).lineBetween(8, 50, LEFT_W - 8, 50);

    this.add.text(cx, 64, 'BID LOG', { fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: C_ACTIVE }).setOrigin(0.5);

    for (let i = 0; i < 5; i++) {
      const t = this.add.text(cx, 82 + i * 24, '', {
        fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '14px', color: C_GREY,
      }).setOrigin(0.5);
      this.bidHistoryTexts.push(t);
    }

    this.add.graphics().lineStyle(1, PAL.n.border, 0.4).lineBetween(8, 204, LEFT_W - 8, 204);

    const HISTORY_BOTTOM = 210;
    const availH = H - HISTORY_BOTTOM;
    const duck = this.add.image(cx, HISTORY_BOTTOM + availH / 2, ASSETS.DUCK_MASCOT);
    duck.setScale(Math.min(LEFT_W / duck.width, availH / duck.height));
  }

  // ─── Center panel ─────────────────────────────────────────────────────────

  private buildCenterPanel() {
    const state = this.session.getSessionState();

    // ── Zone 1: Vault value display ──────────────────────────────────────────
    this.add.text(MID_CX, 16, 'VAULT VALUE', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: C_GREY,
    }).setOrigin(0.5);

    this.totalValueText = this.add.text(MID_CX, 78, '—', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '56px', color: C_ACTIVE,
    }).setOrigin(0.5);

    this.feedbackText = this.add.text(MID_CX, 136, '', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '15px', color: C_GREY,
    }).setOrigin(0.5);

    this.intelLineText = this.add.text(MID_CX, 158, '', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '14px', color: C_ACTIVE, align: 'center',
      wordWrap: { width: W - LEFT_W - RIGHT_W - 24 },
    }).setOrigin(0.5);

    // ── Zone 2: Vault intel ───────────────────────────────────────────────────
    this.add.graphics().lineStyle(1, PAL.n.border, 0.4)
      .lineBetween(LEFT_W + 20, 176, W - RIGHT_W - 20, 176);

    this.add.text(MID_CX, 190, 'CLUES', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: C_ACTIVE,
    }).setOrigin(0.5);

    for (let i = 0; i < 4; i++) {
      const t = this.add.text(MID_CX, 210 + i * 24, '', {
        fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '14px', color: C_GREY, align: 'center',
        wordWrap: { width: W - LEFT_W - RIGHT_W - 24 },
      }).setOrigin(0.5);
      this.infoLines.push(t);
    }

    // ── Zone 3: Bid controls ──────────────────────────────────────────────────
    this.add.graphics().lineStyle(1, PAL.n.border, 0.4)
      .lineBetween(LEFT_W + 20, 302, W - RIGHT_W - 20, 302);

    const sliderLeft  = LEFT_W + SLIDER_PAD;
    const sliderRight = W - RIGHT_W - SLIDER_PAD;
    const sliderW     = sliderRight - sliderLeft;
    const sliderY     = 404;

    this.sliderTrackLeft  = sliderLeft;
    this.sliderTrackRight = sliderRight;
    this.sliderTrackY     = sliderY;
    this.sliderThumbX     = sliderLeft;

    const yourBidLabel = this.add.text(MID_CX, 316, 'NAME YOUR PRICE', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: C_GREY,
    }).setOrigin(0.5);
    this.bidSectionObjects.push(yourBidLabel);

    this.bidAmountText = this.add.text(MID_CX, 354, '—', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '38px', color: C_ACTIVE,
    }).setOrigin(0.5);
    this.bidSectionObjects.push(this.bidAmountText);

    const trackGfx = this.add.graphics()
      .fillStyle(0x1e1e32, 1).fillRoundedRect(sliderLeft, sliderY - 5, sliderW, 10, 5);
    this.bidSectionObjects.push(trackGfx);

    this.sliderFillGfx = this.add.graphics();
    this.sliderThumb   = this.add.image(sliderLeft, sliderY, ASSETS.BID_COIN)
      .setDisplaySize(36, 36).setOrigin(0.5);
    this.bidSectionObjects.push(this.sliderFillGfx, this.sliderThumb);
    this.redrawSlider();

    const rangeMin = this.add.text(sliderLeft, sliderY + 20, `$${SLIDER_MIN.toLocaleString()}`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: C_GREY,
    }).setOrigin(0, 0.5);
    this.rangeMaxLabel = this.add.text(sliderRight, sliderY + 20, `$${this.effectiveMax.toLocaleString()}`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: C_GREY,
    }).setOrigin(1, 0.5);
    this.bidSectionObjects.push(rangeMin, this.rangeMaxLabel);

    const hitZone = this.add.rectangle(
      (sliderLeft + sliderRight) / 2, sliderY, sliderW + 28, 56,
    ).setInteractive({ useHandCursor: true })
      .on('pointerdown', (ptr: Phaser.Input.Pointer) => {
        this.isDragging = true;
        this.updateSliderFromX(ptr.x);
      });
    this.bidSectionObjects.push(hitZone);

    const btnY = 472;
    const btnG = this.add.graphics();
    const drawBtn = (hov: boolean) => {
      btnG.clear();
      btnG.fillStyle(hov ? 0x1a3a4a : 0x0e1e28, 1)
        .fillRoundedRect(sliderLeft, btnY - 25, sliderW, 50, 8);
      btnG.lineStyle(2, hov ? PAL.n.cyan : PAL.n.borderBright, 1)
        .strokeRoundedRect(sliderLeft, btnY - 25, sliderW, 50, 8);
    };
    drawBtn(false);
    this.bidSectionObjects.push(btnG);

    const btnCx     = (sliderLeft + sliderRight) / 2;
    const submitBtn = this.add.text(btnCx, btnY, 'LOCK IT IN', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '20px', color: C_ACTIVE,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.bidSectionObjects.push(submitBtn);

    submitBtn.on('pointerover',  () => drawBtn(true));
    submitBtn.on('pointerout',   () => drawBtn(false));
    submitBtn.on('pointerdown',  () => this.submitBid());

    const costStr = state.intelCost > 0
      ? `Ante $${state.antePaid.toLocaleString()}  ·  Intel $${state.intelCost.toLocaleString()}`
      : `Ante $${state.antePaid.toLocaleString()}`;
    const costLabel = this.add.text(MID_CX, H - 14, costStr, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: C_GREY,
    }).setOrigin(0.5);
    this.bidSectionObjects.push(costLabel);
  }

  // ─── Right panel — loot grid ──────────────────────────────────────────────

  private buildRightPanel() {
    const vault = this.session.getSessionState().vault;

    // Pre-place all items so intel effects can draw borders before reveal
    this.mainGridItems   = this.placeItems(vault.surfaceItems, false);
    this.secretGridItems = this.placeItems(vault.hiddenItems,  true);

    // Base grid graphics (cells)
    const g = this.add.graphics().setDepth(1);
    this.drawGridCells(g, GRID_Y_M, GROW_M, false);

    // "VAULT" label above main grid
    this.add.text(W - RIGHT_W + RIGHT_W / 2, GRID_Y_M - 4, 'VAULT', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '11px', color: C_GREY,
    }).setOrigin(0.5, 1).setDepth(1);

    // Separator + "SECRET VAULT" label
    const sepY = GRID_Y_M + GROW_M * GSTEP + 6;
    this.add.graphics().setDepth(1)
      .lineStyle(1, PAL.n.border, 0.5)
      .lineBetween(GRID_X, sepY, GRID_X + (GCOLS - 1) * GSTEP + GCELL, sepY);

    this.add.text(W - RIGHT_W + RIGHT_W / 2, sepY + 3, 'SECRET VAULT', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '10px', color: C_GREY,
    }).setOrigin(0.5, 0).setDepth(1);

    this.drawGridCells(g, GRID_Y_S, GROW_S, true);

    // Overlay graphics for intel effects (drawn above grid cells)
    this.gridEffectGfx = this.add.graphics().setDepth(2);
  }

  private drawGridCells(g: Phaser.GameObjects.Graphics, gridY: number, rows: number, isSecret: boolean) {
    const bgColor  = isSecret ? 0x9496b8 : 0x9a9cbe;
    const brdColor = isSecret ? 0xb0b2d0 : 0xb8bada;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < GCOLS; c++) {
        const x = GRID_X + c * GSTEP;
        const y = gridY + r * GSTEP;
        g.fillStyle(bgColor, 0.35).fillRect(x, y, GCELL, GCELL);
        g.lineStyle(1, brdColor, 0.75).strokeRect(x, y, GCELL, GCELL);
      }
    }
  }

  // ─── Grid item placement ──────────────────────────────────────────────────

  private placeItems(items: VaultItem[], isHidden: boolean): PlacedItem[] {
    const rows     = isHidden ? GROW_S : GROW_M;
    const occupied = Array.from({ length: rows }, () => new Array(GCOLS).fill(false));
    const placed: PlacedItem[] = [];

    items.forEach((item, idx) => {
      const size = this.pickItemSize(item, idx);
      let found  = false;

      for (let r = 0; r <= rows - size.h && !found; r++) {
        for (let c = 0; c <= GCOLS - size.w && !found; c++) {
          let fits = true;
          for (let dr = 0; dr < size.h && fits; dr++) {
            for (let dc = 0; dc < size.w && fits; dc++) {
              if (occupied[r + dr][c + dc]) fits = false;
            }
          }
          if (fits) {
            for (let dr = 0; dr < size.h; dr++) {
              for (let dc = 0; dc < size.w; dc++) {
                occupied[r + dr][c + dc] = true;
              }
            }
            placed.push({ item, col: c, row: r, w: size.w, h: size.h, isHidden });
            found = true;
          }
        }
      }
      // If no space found, item is omitted (board doesn't have to be full)
    });

    return placed;
  }

  private pickItemSize(item: VaultItem, idx: number): { w: number; h: number } {
    const TIER_SIZES: Record<string, Array<{ w: number; h: number }>> = {
      common:    [{ w: 1, h: 1 }],
      uncommon:  [{ w: 1, h: 1 }],
      rare:      [{ w: 1, h: 1 }, { w: 2, h: 2 }],
      epic:      [{ w: 2, h: 2 }],
      legendary: [{ w: 2, h: 2 }, { w: 3, h: 3 }],
    };
    const sizes = TIER_SIZES[item.tier] ?? [{ w: 1, h: 1 }];
    const hash  = item.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + idx * 13;
    return sizes[hash % sizes.length];
  }

  // Returns pixel rect for a placed item in its grid
  private placedRect(placed: PlacedItem): { x: number; y: number; pw: number; ph: number } {
    const gridY = placed.isHidden ? GRID_Y_S : GRID_Y_M;
    return {
      x:  GRID_X + placed.col * GSTEP,
      y:  gridY  + placed.row * GSTEP,
      pw: placed.w * GSTEP - (GSTEP - GCELL),
      ph: placed.h * GSTEP - (GSTEP - GCELL),
    };
  }

  // ─── Intel visual effects ─────────────────────────────────────────────────

  private applyIntelEffect(intelId: string) {
    const g = this.gridEffectGfx;
    g.clear();

    if (intelId === 'valueBand') {
      // TOTAL ITEM INTEL — white outline around every main-vault item
      for (const placed of this.mainGridItems) {
        const { x, y, pw, ph } = this.placedRect(placed);
        g.lineStyle(2, 0xffffff, 0.85).strokeRect(x, y, pw, ph);
      }
    } else if (intelId === 'doorSignal') {
      // RARITY SCANNER — tier-coloured border on Rare and above
      for (const placed of this.mainGridItems) {
        if (!placed.item.tierDef.isHighValue && placed.item.tier !== 'rare') continue;
        const { x, y, pw, ph } = this.placedRect(placed);
        const col = Phaser.Display.Color.HexStringToColor(placed.item.tierDef.frameColor).color;
        g.lineStyle(2, col, 0.9).strokeRect(x, y, pw, ph);
      }
    } else if (intelId === 'digitPeek') {
      // SECRET BOX — tier outlines on secret-vault items (if any)
      for (const placed of this.secretGridItems) {
        const { x, y, pw, ph } = this.placedRect(placed);
        const col = Phaser.Display.Color.HexStringToColor(placed.item.tierDef.frameColor).color;
        g.lineStyle(2, col, 0.9).strokeRect(x, y, pw, ph);
      }
    }
  }

  // ─── Intel Shop Overlay ───────────────────────────────────────────────────

  private showIntelShopOverlay() {
    const pop: Phaser.GameObjects.GameObject[] = [];

    const dismiss = (result: IntelResult | null) => {
      pop.forEach(o => o.destroy());
      if (result) {
        this.intelLineText.setText(this.formatIntel(result));
        this.applyIntelEffect(result.intelId);
      }
      const intelCost = this.session.getSessionState().intelCost;
      this.effectiveMax = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, this.playerBalance - intelCost));
      this.rangeMaxLabel.setText(`$${this.effectiveMax.toLocaleString()}`);
    };

    const D = 11;

    // Dim backdrop
    pop.push(
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.90)
        .setDepth(10).setInteractive(),
    );

    // "CHOOSE YOUR EDGE" title banner — text baked into image
    pop.push(
      this.add.image(W / 2, 82, ASSETS.EDGE_TITLE)
        .setDisplaySize(780, 174).setOrigin(0.5).setDepth(D),
    );

    // ─── Intel cards ─────────────────────────────────────────────────────────
    const CARD_W = 220; const CARD_H = 345; const CARD_GAP = 24;
    const x0 = (W - (3 * CARD_W + 2 * CARD_GAP)) / 2;
    const cardsTopY = 172;

    const CARD_ASSET: Record<string, string> = {
      valueBand:  ASSETS.ITEM_SWEEP_CARD,
      doorSignal: ASSETS.RARITY_SCAN_CARD,
      digitPeek:  ASSETS.SECRET_BOX_CARD,
    };

    this.session.getAvailableIntel().forEach((opt, i) => {
      const cx = x0 + i * (CARD_W + CARD_GAP) + CARD_W / 2;
      const cy = cardsTopY + CARD_H / 2;

      const isSecret = opt.id === 'digitPeek';
      const cw = isSecret ? Math.round(CARD_W * 0.95) : CARD_W;
      const ch = isSecret ? Math.round(CARD_H * 0.95) : CARD_H;
      const cardImg = this.add.image(cx, cy, CARD_ASSET[opt.id] ?? ASSETS.ITEM_SWEEP_CARD)
        .setDisplaySize(cw, ch).setOrigin(0.5).setDepth(D);
      pop.push(cardImg);

      // Price
      pop.push(
        this.add.text(cx, cardsTopY + 158, `$${opt.cost.toLocaleString()}`, {
          fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '28px', color: PAL.gold,
        }).setOrigin(0.5).setDepth(D),
      );

      // Description
      const display = INTEL_DISPLAY[opt.id];
      pop.push(
        this.add.text(cx, cardsTopY + 200, display?.desc ?? opt.description, {
          fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '12px', color: '#c0c0d8',
          wordWrap: { width: CARD_W - 24 }, align: 'center', lineSpacing: 4,
        }).setOrigin(0.5, 0).setDepth(D),
      );

      // GRAB THIS button
      const btnY = cardsTopY + CARD_H - 44;
      const btnImg = this.add.image(cx, btnY, ASSETS.UI_BTN_2)
        .setDisplaySize(CARD_W - 26, 58).setOrigin(0.5).setDepth(D);
      pop.push(btnImg);
      pop.push(
        this.add.text(cx, btnY, 'GRAB THIS', {
          fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '15px', color: C_ACTIVE,
        }).setOrigin(0.5).setDepth(D + 1),
      );

      // Hit zone — full card
      const hit = this.add.rectangle(cx, cy, CARD_W, CARD_H)
        .setInteractive({ useHandCursor: true }).setDepth(D + 1);
      pop.push(hit);
      hit.on('pointerover', () => { cardImg.setTint(0xbbccff); btnImg.setTint(0xaaddff); });
      hit.on('pointerout',  () => { cardImg.clearTint(); btnImg.clearTint(); });
      hit.on('pointerdown', () => dismiss(this.session.purchaseIntel(opt.id)));
    });

    // Fly Blind button
    const skipY = cardsTopY + CARD_H + 36;
    const skipBtnW = 520; const skipBtnH = 70;
    const skipImg = this.add.image(W / 2, skipY, ASSETS.UI_BTN_2)
      .setDisplaySize(skipBtnW, skipBtnH).setOrigin(0.5).setDepth(D);
    const skipText = this.add.text(W / 2, skipY, '[ Fly Blind — No Intel ]', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '18px', color: '#9090c0',
    }).setOrigin(0.5).setDepth(D + 1);
    const skipHit = this.add.rectangle(W / 2, skipY, skipBtnW, skipBtnH)
      .setInteractive({ useHandCursor: true }).setDepth(D + 1);
    skipHit.on('pointerover', () => { skipImg.setTint(0xbbccff); skipText.setColor(C_ACTIVE); });
    skipHit.on('pointerout',  () => { skipImg.clearTint(); skipText.setColor('#9090c0'); });
    skipHit.on('pointerdown', () => dismiss(null));
    pop.push(skipImg, skipText, skipHit);
  }

  // ─── Slider ───────────────────────────────────────────────────────────────

  private setupSliderInput() {
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.isDragging) this.updateSliderFromX(ptr.x);
    });
    this.input.on('pointerup', () => { this.isDragging = false; });
  }

  private updateSliderFromX(x: number) {
    this.sliderThumbX = Phaser.Math.Clamp(x, this.sliderTrackLeft, this.sliderTrackRight);
    const t = (this.sliderThumbX - this.sliderTrackLeft) / (this.sliderTrackRight - this.sliderTrackLeft);
    this.bidAmount = Math.round(t * (this.effectiveMax - SLIDER_MIN) + SLIDER_MIN);
    this.redrawSlider();
    this.bidAmountText.setText(`$${this.bidAmount.toLocaleString()}`);
  }

  private redrawSlider() {
    const { sliderTrackLeft: left, sliderTrackY: y, sliderThumbX: tx } = this;
    this.sliderFillGfx.clear();
    if (tx > left) {
      this.sliderFillGfx.fillStyle(PAL.n.cyan, 0.9).fillRoundedRect(left, y - 5, tx - left, 10, 5);
    }
    this.sliderThumb.setPosition(tx, y);
  }

  // ─── Bid submission ───────────────────────────────────────────────────────

  private submitBid() {
    if (this.bidAmount <= 0) {
      this.feedbackText.setText('Set your price first');
      return;
    }
    if (this.bidAmount > this.effectiveMax) {
      this.feedbackText.setText("Can't bet what you don't have");
      return;
    }

    const result = this.session.submitBid(this.bidAmount);

    if (result.accepted) {
      this.hideBidSection();
      this.feedbackText.setText('');
      this.showBidPopup('accepted', () => this.startReveal());
      return;
    }

    const type = result.bidDirection === 'tooHigh' ? 'tooHigh' : 'tooLow';
    this.feedbackText.setText('');
    this.showBidPopup(type);

    const round   = this.session.getSessionState().currentRound - 1;
    const histIdx = round - 1;
    if (histIdx >= 0 && histIdx < this.bidHistoryTexts.length) {
      const arrow = result.bidDirection === 'tooHigh' ? '▲' : '▼';
      this.bidHistoryTexts[histIdx]
        .setText(`R${round}  $${this.bidAmount.toLocaleString()}  ${arrow}`)
        .setColor(C_GREY);
    }

    this.sliderThumbX = this.sliderTrackLeft;
    this.bidAmount    = 0;
    this.redrawSlider();
    this.bidAmountText.setText('—');

    const newRound = this.session.getCurrentRound();
    this.roundLabel.setText(`ROUND ${newRound} OF 5`);
    this.roundName.setText(ROUND_CONFIG[newRound].name.toUpperCase());

    if (result.revealResult) this.appendReveal(result.revealResult);

    if (result.sessionComplete) {
      this.time.delayedCall(1400, () => {
        this.hideBidSection();
        this.showBidPopup('finalRound', () => this.startReveal());
      });
    }
  }

  private showBidPopup(type: 'accepted' | 'tooHigh' | 'tooLow' | 'finalRound', onDone?: () => void) {
    const cfg: Record<string, { text: string; color: string; flashCol: number; holdMs: number }> = {
      accepted:   { text: 'DEAL SEALED!',    color: PAL.green, flashCol: PAL.n.green, holdMs: 900  },
      tooHigh:    { text: '▲  OVERSHOT',     color: PAL.red,   flashCol: PAL.n.red,   holdMs: 600  },
      tooLow:     { text: '▼  THINK BIGGER', color: PAL.red,   flashCol: PAL.n.red,   holdMs: 600  },
      finalRound: { text: 'LAST SHOT!',      color: PAL.gold,  flashCol: PAL.n.gold,  holdMs: 1000 },
    };
    const { text, color, flashCol, holdMs } = cfg[type];

    this.screenFlash(flashCol, type === 'accepted' || type === 'finalRound' ? 0.30 : 0.18,
      type === 'accepted' ? 2 : 1);

    // Dark pill behind text
    const pill = this.add.graphics().setDepth(24);
    const textObj = this.add.text(MID_CX, H / 2, text, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '48px', color,
      stroke: '#000000', strokeThickness: 10,
    }).setOrigin(0.5).setScale(0).setAlpha(0).setDepth(25);

    const drawPill = (alpha: number) => {
      pill.clear();
      if (alpha <= 0) return;
      const pw = textObj.width + 60; const ph = 72;
      pill.fillStyle(0x000000, alpha * 0.72)
        .fillRoundedRect(MID_CX - pw / 2, H / 2 - ph / 2, pw, ph, 10);
      pill.lineStyle(2, Phaser.Display.Color.HexStringToColor(color).color, alpha)
        .strokeRoundedRect(MID_CX - pw / 2, H / 2 - ph / 2, pw, ph, 10);
    };
    drawPill(0);

    // Scale-in
    this.tweens.add({
      targets: textObj, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut',
      onUpdate: () => drawPill(textObj.alpha),
      onComplete: () => {
        // Hold, then fade out
        this.time.delayedCall(holdMs, () => {
          this.tweens.add({
            targets: textObj,
            alpha: 0,
            y: H / 2 - 24,
            duration: 280,
            ease: 'Cubic.easeIn',
            onUpdate: () => drawPill(textObj.alpha),
            onComplete: () => {
              textObj.destroy();
              pill.destroy();
              if (onDone) onDone();
            },
          });
        });
      },
    });
  }

  private hideBidSection() {
    this.isDragging = false;
    for (const obj of this.bidSectionObjects) {
      (obj as Phaser.GameObjects.GameObject & { setVisible: (v: boolean) => void }).setVisible(false);
    }
  }

  // ─── Reveal sequence ──────────────────────────────────────────────────────

  private startReveal() {
    const outcome = this.session.getSessionOutcome();
    const state   = this.session.getSessionState();
    const vault   = state.vault;

    this.add.text(MID_CX, 322, 'LOOT HAUL', { fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '11px', color: C_ACTIVE }).setOrigin(0.5);

    const runningText = this.add.text(MID_CX, 362, '$0', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '36px', color: C_ACTIVE,
    }).setOrigin(0.5).setAlpha(0);

    const netLabel = this.add.text(MID_CX, 420, '', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '14px', color: C_GREY,
    }).setOrigin(0.5).setAlpha(0);

    const netResult = this.add.text(MID_CX, 456, '', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '32px', color: C_ACTIVE,
    }).setOrigin(0.5).setAlpha(0);

    // Clear intel effect outlines — items will reveal their true colours
    this.gridEffectGfx.clear();

    // ── Suspense buildup ──────────────────────────────────────────────────────
    const suspense = this.add.text(MID_CX, H / 2 - 10, 'CRACKING THE SAFE', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '22px', color: C_GREY, letterSpacing: 6,
    }).setOrigin(0.5).setAlpha(0).setDepth(5);

    // Pulse the grid during buildup
    this.tweens.add({ targets: suspense, alpha: 1, duration: 400 });
    this.tweens.add({
      targets: suspense, alpha: 0.3, duration: 600, yoyo: true, repeat: 1,
      delay: 400,
    });

    // Rapid grid flicker before items appear
    this.time.delayedCall(600,  () => this.screenFlash(0x334466, 0.15, 0));
    this.time.delayedCall(900,  () => this.screenFlash(0x334466, 0.15, 0));
    this.time.delayedCall(1200, () => this.screenFlash(0x334466, 0.22, 0));

    this.time.delayedCall(1600, () => {
      this.tweens.add({
        targets: suspense, alpha: 0, duration: 200,
        onComplete: () => suspense.destroy(),
      });
      this.tweens.add({ targets: runningText, alpha: 1, duration: 200 });
      this.playOpenSequence(
        vault.surfaceItems, vault.hasHiddenDoor, vault.hiddenItems,
        outcome, runningText, netLabel, netResult,
      );
    });
  }

  private playOpenSequence(
    surfaceItems: VaultItem[],
    hasHiddenDoor: boolean,
    hiddenItems: VaultItem[],
    outcome: SessionOutcome,
    runningText: Phaser.GameObjects.Text,
    netLabel: Phaser.GameObjects.Text,
    netResult: Phaser.GameObjects.Text,
  ) {
    const baseDelay = 400;
    const step      = 320;
    let   runTotal  = 0;

    surfaceItems.forEach((item, i) => {
      this.time.delayedCall(baseDelay + i * step, () => {
        runTotal += item.value;
        const placed = this.mainGridItems[i];
        if (placed) this.revealGridItem(placed);
        this.countUp(runningText, runTotal - item.value, runTotal, 280, '$');
      });
    });

    const afterSurface = baseDelay + surfaceItems.length * step;

    if (hasHiddenDoor) {
      this.time.delayedCall(afterSurface + 300, () => {
        this.screenFlash(0x4a0080, 0.22, 3);
        this.feedbackText.setText('SECRET PASSAGE FOUND!');
      });
      hiddenItems.forEach((item, i) => {
        this.time.delayedCall(afterSurface + 700 + i * step, () => {
          runTotal += item.value;
          const placed = this.secretGridItems[i];
          if (placed) this.revealGridItem(placed);
          this.countUp(runningText, runTotal - item.value, runTotal, 280, '$');
        });
      });
    }

    const afterAll = hasHiddenDoor
      ? afterSurface + 700 + hiddenItems.length * step
      : afterSurface;

    this.time.delayedCall(afterAll, () => {
      this.countUp(this.totalValueText, 0, outcome.grossReturn, 800, '$');
    });

    if (outcome.isJackpot) {
      this.time.delayedCall(afterAll + 200, () => this.flashJackpot(outcome.jackpotBonus));
    }

    const endDelay = afterAll + (outcome.isJackpot ? 1500 : 700);
    this.time.delayedCall(endDelay, () => {
      this.showNetResult(outcome, netLabel, netResult);
    });
  }

  // ─── Grid item reveal ─────────────────────────────────────────────────────

  private revealGridItem(placed: PlacedItem) {
    const { x, y, pw, ph } = this.placedRect(placed);
    const tileCol = Phaser.Display.Color.HexStringToColor(placed.item.tierDef.frameColor).color;

    // Tile background + border
    const tileGfx = this.add.graphics().setDepth(4).setAlpha(0);
    tileGfx.fillStyle(tileCol, 0.18).fillRect(x, y, pw, ph);
    tileGfx.lineStyle(2, tileCol, 1).strokeRect(x, y, pw, ph);
    if (placed.isHidden) {
      tileGfx.lineStyle(1, 0xffd700, 0.5).strokeRect(x + 2, y + 2, pw - 4, ph - 4);
    }
    this.tweens.add({ targets: tileGfx, alpha: 1, duration: 220, ease: 'Power2' });

    // Value text centred in tile
    const maxFontSize = ph >= 48 ? 10 : 8;
    const price = this.add.text(x + pw / 2, y + ph / 2, `$${placed.item.value.toLocaleString()}`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: `${maxFontSize}px`, color: placed.item.tierDef.frameColor,
      align: 'center', wordWrap: { width: pw - 4 },
    }).setOrigin(0.5).setAlpha(0).setDepth(5);
    this.tweens.add({ targets: price, alpha: 1, duration: 200, delay: 140 });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private countUp(target: Phaser.GameObjects.Text, from: number, to: number, duration: number, prefix: string) {
    const counter = { value: from };
    this.tweens.add({
      targets: counter, value: to, duration, ease: 'Cubic.easeOut',
      onUpdate: () => target.setText(`${prefix}${Math.round(counter.value).toLocaleString()}`),
    });
  }

  private screenFlash(color: number, alpha: number, repeats: number) {
    const flash = this.add.rectangle(W / 2, H / 2, W, H, color, 0).setDepth(20);
    this.tweens.add({
      targets: flash, alpha, duration: 180, yoyo: true, repeat: repeats,
      onComplete: () => flash.destroy(),
    });
  }

  private flashJackpot(bonus: number) {
    this.screenFlash(0xffd700, 0.4, 3);
    const jp = this.add.text(W - RIGHT_W / 2, H / 2, `JACKPOT!\n+$${bonus.toLocaleString()}`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '28px', color: PAL.gold, align: 'center',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setScale(0).setDepth(21);
    this.tweens.add({ targets: jp, scale: 1, duration: 360, ease: 'Back.easeOut' });
    this.time.delayedCall(1100, () => {
      this.tweens.add({ targets: jp, alpha: 0, duration: 300, onComplete: () => jp.destroy() });
    });
  }

  private showNetResult(
    outcome: SessionOutcome,
    netLabel: Phaser.GameObjects.Text,
    netResult: Phaser.GameObjects.Text,
  ) {
    // Persist updated balance now that all values are known
    const prevBalance = parseInt(localStorage.getItem(BALANCE_KEY) ?? String(GAME_CONFIG.startingBalance), 10);
    const newBalance  = prevBalance + outcome.netProfit;
    localStorage.setItem(BALANCE_KEY, String(newBalance));

    const profit = outcome.netProfit >= 0;
    const sign   = profit ? '+' : '-';
    const abs    = Math.abs(outcome.netProfit);

    netLabel.setText('YOUR CUT').setAlpha(1);
    netResult.setText(`${sign}$0`).setAlpha(1);
    this.countUp(netResult, 0, abs, 900, `${sign}$`);

    this.time.delayedCall(1100, () => {
      this.add.text(MID_CX, H - 38, `BANK: $${newBalance.toLocaleString()}`, {
        fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '12px', color: C_GREY,
      }).setOrigin(0.5);

      const sliderLeft  = LEFT_W + SLIDER_PAD;
      const sliderRight = W - RIGHT_W - SLIDER_PAD;
      const btnG = this.add.graphics();
      const drawBtn = (hov: boolean) => {
        btnG.clear();
        btnG.fillStyle(hov ? 0x1a3a4a : 0x0e1e28, 1)
          .fillRoundedRect(sliderLeft, H - 68, sliderRight - sliderLeft, 50, 8);
        btnG.lineStyle(2, hov ? PAL.n.cyan : PAL.n.borderBright, 1)
          .strokeRoundedRect(sliderLeft, H - 68, sliderRight - sliderLeft, 50, 8);
      };
      drawBtn(false);

      const playBtn = this.add.text(MID_CX, H - 43, 'HIT ANOTHER VAULT', {
        fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '20px', color: C_ACTIVE,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      playBtn.on('pointerover',  () => drawBtn(true));
      playBtn.on('pointerout',   () => drawBtn(false));
      playBtn.on('pointerdown',  () => this.startNewSession());
    });
  }

  // ─── Round reveals ────────────────────────────────────────────────────────

  private appendReveal(reveal: RevealResult) {
    if (reveal.revealId === 'digitReveal') {
      const d = reveal.displayData as Record<string, unknown>;
      this.totalValueText.setText(d['formattedHint'] as string);
      return;
    }
    const slot = this.infoLines.findIndex(t => t.text === '');
    if (slot === -1) return;
    this.infoLines[slot].setText(this.formatReveal(reveal)).setColor(C_ACTIVE);
  }

  private formatReveal(reveal: RevealResult): string {
    const d = reveal.displayData as Record<string, unknown>;
    switch (reveal.revealId) {
      case 'quickPeek': {
        const anchor = d['hasDominantAnchor'] ? ' · anchor item detected' : '';
        return `~${d['itemCount']} items visible${anchor}`;
      }
      case 'itemTally': {
        const stat = d['statShown'] as string;
        const val  = d['value'] as number;
        if (stat === 'total')     return `Total items: ${val}`;
        if (stat === 'highValue') return `High-value items: ${val}`;
        return `Low-value items: ${val}`;
      }
      case 'topItemValue':
        return `Top item worth: $${(d['topItemValue'] as number).toLocaleString()}`;
      default:
        return JSON.stringify(d);
    }
  }

  private formatIntel(result: IntelResult): string {
    const d = result.displayData as Record<string, unknown>;
    switch (result.intelId) {
      case 'valueBand':
        return `Value range: $${(d['lowerBound'] as number).toLocaleString()} – $${(d['upperBound'] as number).toLocaleString()}`;
      case 'doorSignal':
        return d['hasHiddenDoor']
          ? 'Hidden door detected — high-rarity items flagged in grid'
          : 'No hidden door detected';
      case 'digitPeek':
        return 'Secret vault scan — tier outlines applied to hidden grid';
      default:
        return JSON.stringify(d);
    }
  }

  // ─── New session ──────────────────────────────────────────────────────────

  private startNewSession() {
    const balance = parseInt(localStorage.getItem(BALANCE_KEY) ?? String(GAME_CONFIG.startingBalance), 10);
    if (balance < GAME_CONFIG.ante) {
      this.scene.start('Lobby');
      return;
    }
    const available = balance - GAME_CONFIG.ante;
    localStorage.setItem(BALANCE_KEY, String(available));

    const seed  = `${Date.now()}`;
    const rng   = createRng(seedFromString(seed));
    const band  = pickRandomBand(rng);
    const vault = generateVault(band, seed, available);
    const session = new SessionManager(vault, buildIntelRegistry(rng), buildRevealRegistry(), rng);
    this.scene.start('Bidding', { session });
  }
}
