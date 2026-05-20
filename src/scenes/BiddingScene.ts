import Phaser from 'phaser';
import { SessionManager } from '@game/SessionManager';
import type { IIntelOption } from '@game/intel/IIntelOption';
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
const GSTEP  = 26;          // grid step (cell + gap)
const GCELL  = 24;          // visible cell size
const GCOLS  = 8;
const GROW_M = 15;          // main vault rows
const GROW_S = 5;           // secret vault rows

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
    label: 'TOTAL ITEM INTEL',
    desc:  'Outlines every item in the main vault, revealing their positions and sizes without showing tier or value.',
  },
  doorSignal: {
    icon:  '◈',
    label: 'RARITY SCANNER',
    desc:  'Scans the vault for high-rarity items. Tier-coloured borders appear on Rare and above items in the grid.',
  },
  digitPeek: {
    icon:  '⬡',
    label: 'SECRET BOX',
    desc:  'Probes the hidden vault. If a secret door exists, tier outlines are drawn on its concealed items.',
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
  private sliderThumbGfx!: Phaser.GameObjects.Graphics;
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
    g.fillStyle(PAL.n.panel, PAL.panelAlpha).fillRect(0, 0, LEFT_W, H);
    g.lineStyle(1, PAL.n.border, 1).strokeRect(0, 0, LEFT_W, H);
    g.fillStyle(PAL.n.panel, PAL.panelAlpha).fillRect(W - RIGHT_W, 0, RIGHT_W, H);
    g.lineStyle(1, PAL.n.border, 1).strokeRect(W - RIGHT_W, 0, RIGHT_W, H);
    g.lineStyle(1, PAL.n.border, 0.5);
    g.lineBetween(LEFT_W, 0, LEFT_W, H);
    g.lineBetween(W - RIGHT_W, 0, W - RIGHT_W, H);
  }

  // ─── Left panel ───────────────────────────────────────────────────────────

  private buildLeftPanel() {
    const cx    = LEFT_W / 2;
    const state = this.session.getSessionState();
    const round = state.currentRound;

    this.roundLabel = this.add.text(cx, 14, `ROUND ${round} / 5`, {
      fontSize: '11px', color: C_GREY,
    }).setOrigin(0.5);

    this.roundName = this.add.text(cx, 30, ROUND_CONFIG[round].name.toUpperCase(), {
      fontSize: '10px', color: C_GREY,
    }).setOrigin(0.5);

    this.add.graphics().lineStyle(1, PAL.n.border, 0.4).lineBetween(8, 44, LEFT_W - 8, 44);

    this.add.text(cx, 56, 'BID HISTORY', { fontSize: '10px', color: C_ACTIVE }).setOrigin(0.5);

    for (let i = 0; i < 5; i++) {
      const t = this.add.text(cx, 74 + i * 22, '', {
        fontSize: '12px', color: C_GREY,
      }).setOrigin(0.5);
      this.bidHistoryTexts.push(t);
    }

    this.add.graphics().lineStyle(1, PAL.n.border, 0.4).lineBetween(8, 190, LEFT_W - 8, 190);

    const HISTORY_BOTTOM = 195;
    const availH = H - HISTORY_BOTTOM;
    const duck = this.add.image(cx, HISTORY_BOTTOM + availH / 2, ASSETS.DUCK_MASCOT);
    duck.setScale(Math.min(LEFT_W / duck.width, availH / duck.height));
  }

  // ─── Center panel ─────────────────────────────────────────────────────────

  private buildCenterPanel() {
    const state = this.session.getSessionState();

    this.add.text(MID_CX, 26, 'TOTAL VAULT VALUE', { fontSize: '11px', color: C_ACTIVE }).setOrigin(0.5);

    this.totalValueText = this.add.text(MID_CX, 86, '—', {
      fontSize: '52px', color: C_ACTIVE, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.feedbackText = this.add.text(MID_CX, 132, '', {
      fontSize: '14px', color: C_GREY,
    }).setOrigin(0.5);

    this.intelLineText = this.add.text(MID_CX, 156, '', {
      fontSize: '12px', color: C_ACTIVE, align: 'center',
      wordWrap: { width: W - LEFT_W - RIGHT_W - 20 },
    }).setOrigin(0.5);

    this.add.graphics().lineStyle(1, PAL.n.border, 0.35)
      .lineBetween(LEFT_W + 16, 175, W - RIGHT_W - 16, 175);

    this.add.text(MID_CX, 188, 'VAULT INTEL', { fontSize: '10px', color: C_ACTIVE }).setOrigin(0.5);

    for (let i = 0; i < 4; i++) {
      const t = this.add.text(MID_CX, 206 + i * 24, '', {
        fontSize: '12px', color: C_GREY, align: 'center',
        wordWrap: { width: W - LEFT_W - RIGHT_W - 20 },
      }).setOrigin(0.5);
      this.infoLines.push(t);
    }

    this.add.graphics().lineStyle(1, PAL.n.border, 0.5)
      .lineBetween(LEFT_W + 16, 306, W - RIGHT_W - 16, 306);

    // ── Bid section ──
    const sliderLeft  = LEFT_W + SLIDER_PAD;
    const sliderRight = W - RIGHT_W - SLIDER_PAD;
    const sliderW     = sliderRight - sliderLeft;
    const sliderY     = 412;

    this.sliderTrackLeft  = sliderLeft;
    this.sliderTrackRight = sliderRight;
    this.sliderTrackY     = sliderY;
    this.sliderThumbX     = sliderLeft;

    const yourBidLabel = this.add.text(MID_CX, 322, 'YOUR BID', { fontSize: '11px', color: C_ACTIVE }).setOrigin(0.5);
    this.bidSectionObjects.push(yourBidLabel);

    this.bidAmountText = this.add.text(MID_CX, 356, '—', {
      fontSize: '26px', color: C_ACTIVE, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.bidSectionObjects.push(this.bidAmountText);

    const trackGfx = this.add.graphics()
      .fillStyle(0x2a2a40, 1).fillRoundedRect(sliderLeft, sliderY - 4, sliderW, 8, 4);
    this.bidSectionObjects.push(trackGfx);

    this.sliderFillGfx  = this.add.graphics();
    this.sliderThumbGfx = this.add.graphics();
    this.bidSectionObjects.push(this.sliderFillGfx, this.sliderThumbGfx);
    this.redrawSlider();

    const rangeMin = this.add.text(sliderLeft, sliderY + 20, `$${SLIDER_MIN.toLocaleString()}`, {
      fontSize: '10px', color: C_GREY,
    }).setOrigin(0, 0.5);
    this.rangeMaxLabel = this.add.text(sliderRight, sliderY + 20, `$${this.effectiveMax.toLocaleString()}`, {
      fontSize: '10px', color: C_GREY,
    }).setOrigin(1, 0.5);
    this.bidSectionObjects.push(rangeMin, this.rangeMaxLabel);

    const hitZone = this.add.rectangle(
      (sliderLeft + sliderRight) / 2, sliderY, sliderW + 28, 52,
    ).setInteractive({ useHandCursor: true })
      .on('pointerdown', (ptr: Phaser.Input.Pointer) => {
        this.isDragging = true;
        this.updateSliderFromX(ptr.x);
      });
    this.bidSectionObjects.push(hitZone);

    const btnY = 474;
    const btnG = this.add.graphics();
    const drawBtn = (hov: boolean) => {
      btnG.clear();
      btnG.fillStyle(hov ? 0x444455 : 0x1e1e2e, 1)
        .fillRoundedRect(sliderLeft, btnY - 22, sliderW, 44, 6);
      btnG.lineStyle(1, hov ? 0xddddee : 0x888899, 1)
        .strokeRoundedRect(sliderLeft, btnY - 22, sliderW, 44, 6);
    };
    drawBtn(false);
    this.bidSectionObjects.push(btnG);

    const btnCx     = (sliderLeft + sliderRight) / 2;
    const submitBtn = this.add.text(btnCx, btnY, 'SUBMIT BID', {
      fontSize: '16px', color: C_ACTIVE, fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.bidSectionObjects.push(submitBtn);

    submitBtn.on('pointerover',  () => drawBtn(true));
    submitBtn.on('pointerout',   () => drawBtn(false));
    submitBtn.on('pointerdown',  () => this.submitBid());

    const costStr = state.intelCost > 0
      ? `Ante: $${state.antePaid.toLocaleString()}  ·  Intel: $${state.intelCost.toLocaleString()}`
      : `Ante: $${state.antePaid.toLocaleString()}`;
    const costLabel = this.add.text(MID_CX, H - 14, costStr, {
      fontSize: '10px', color: C_GREY,
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
      fontSize: '8px', color: C_GREY,
    }).setOrigin(0.5, 1).setDepth(1);

    // Separator + "SECRET VAULT" label
    const sepY = GRID_Y_M + GROW_M * GSTEP + 6;
    this.add.graphics().setDepth(1)
      .lineStyle(1, PAL.n.border, 0.5)
      .lineBetween(GRID_X, sepY, GRID_X + (GCOLS - 1) * GSTEP + GCELL, sepY);

    this.add.text(W - RIGHT_W + RIGHT_W / 2, sepY + 3, 'SECRET VAULT', {
      fontSize: '7px', color: C_GREY,
    }).setOrigin(0.5, 0).setDepth(1);

    this.drawGridCells(g, GRID_Y_S, GROW_S, true);

    // Overlay graphics for intel effects (drawn above grid cells)
    this.gridEffectGfx = this.add.graphics().setDepth(2);
  }

  private drawGridCells(g: Phaser.GameObjects.Graphics, gridY: number, rows: number, isSecret: boolean) {
    const bgColor = isSecret ? 0x0b0d1e : 0x0d0b20;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < GCOLS; c++) {
        const x = GRID_X + c * GSTEP;
        const y = gridY + r * GSTEP;
        g.fillStyle(bgColor, 0.92).fillRect(x, y, GCELL, GCELL);
        g.lineStyle(1, PAL.n.border, 0.25).strokeRect(x, y, GCELL, GCELL);
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
      garbage:   [{ w: 1, h: 1 }],
      common:    [{ w: 1, h: 1 }, { w: 1, h: 1 }, { w: 1, h: 2 }],
      rare:      [{ w: 1, h: 1 }, { w: 1, h: 2 }, { w: 2, h: 2 }],
      epic:      [{ w: 1, h: 2 }, { w: 2, h: 2 }, { w: 1, h: 3 }],
      legendary: [{ w: 2, h: 2 }, { w: 1, h: 3 }, { w: 3, h: 3 }],
      ancient:   [{ w: 2, h: 2 }, { w: 3, h: 3 }],
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

      // Recalculate slider cap — intel cost reduces available bankroll
      const intelCost = this.session.getSessionState().intelCost;
      this.effectiveMax = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, this.playerBalance - intelCost));
      this.rangeMaxLabel.setText(`$${this.effectiveMax.toLocaleString()}`);
    };

    // Dim backdrop — absorbs clicks to game UI below
    pop.push(
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.82)
        .setDepth(10).setInteractive(),
    );

    pop.push(
      this.add.text(W / 2, 30, 'PRE-AUCTION INTEL', {
        fontSize: '22px', color: PAL.gold, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(11),
    );

    pop.push(
      this.add.text(W / 2, 58, 'Purchase one dossier before the vault opens — or go in blind.', {
        fontSize: '12px', color: C_GREY,
      }).setOrigin(0.5).setDepth(11),
    );

    const CARD_W = 220; const CARD_H = 272; const CARD_GAP = 22;
    const totalW = 3 * CARD_W + 2 * CARD_GAP;
    const x0     = (W - totalW) / 2;
    const cardsY = 90;

    this.session.getAvailableIntel().forEach((opt, i) => {
      const cx = x0 + i * (CARD_W + CARD_GAP) + CARD_W / 2;
      const cy = cardsY + CARD_H / 2;
      this.buildIntelCard(cx, cy, CARD_W, CARD_H, opt, dismiss, pop);
    });

    const skipY = cardsY + CARD_H + 26;
    const skipBtn = this.add.text(W / 2, skipY, '[ Go In Blind — Skip Intel ]', {
      fontSize: '13px', color: C_GREY,
    }).setOrigin(0.5).setDepth(11).setInteractive({ useHandCursor: true });
    skipBtn.on('pointerover', () => skipBtn.setColor(C_ACTIVE));
    skipBtn.on('pointerout',  () => skipBtn.setColor(C_GREY));
    skipBtn.on('pointerdown', () => dismiss(null));
    pop.push(skipBtn);
  }

  private buildIntelCard(
    cx: number, cy: number, cardW: number, cardH: number,
    option: IIntelOption,
    onSelect: (result: IntelResult | null) => void,
    pop: Phaser.GameObjects.GameObject[],
  ) {
    const lx = cx - cardW / 2;
    const ty = cy - cardH / 2;
    const R  = 10;
    const D  = 11;

    const display = INTEL_DISPLAY[option.id] ?? {
      icon: '?', label: option.flavorLabel.toUpperCase(), desc: option.description,
    };

    const bg = this.add.graphics().setDepth(D);
    const draw = (hov: boolean) => {
      bg.clear();
      bg.fillStyle(hov ? PAL.n.panelAlt : PAL.n.panel, hov ? PAL.panelAltAlpha : PAL.cardAlpha);
      bg.fillRoundedRect(lx, ty, cardW, cardH, R);
      bg.lineStyle(hov ? 2 : 1, hov ? PAL.n.borderGlow : PAL.n.border, 1);
      bg.strokeRoundedRect(lx, ty, cardW, cardH, R);
      bg.fillStyle(hov ? PAL.n.cyan : PAL.n.borderBright, 1);
      bg.fillRoundedRect(lx, ty, cardW, 3, { tl: R, tr: R, bl: 0, br: 0 });
    };
    draw(false);

    const icon = this.add.text(cx, ty + 36, display.icon, {
      fontSize: '28px', color: PAL.cyan, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(D);

    this.add.graphics().setDepth(D)
      .lineStyle(1, PAL.n.border, 1)
      .lineBetween(lx + 16, ty + 66, lx + cardW - 16, ty + 66);

    const flavorLbl = this.add.text(cx, ty + 82, display.label, {
      fontSize: '10px', color: PAL.cyan, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(D);

    const costLbl = this.add.text(cx, ty + 106, `$${option.cost.toLocaleString()}`, {
      fontSize: '22px', color: PAL.gold, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(D);

    const desc = this.add.text(cx, ty + 144, display.desc, {
      fontSize: '11px', color: C_ACTIVE,
      wordWrap: { width: cardW - 28 }, align: 'center', lineSpacing: 3,
    }).setOrigin(0.5, 0).setDepth(D);

    const buyBtn = this.add.text(cx, ty + cardH - 24, '[ PURCHASE ]', {
      fontSize: '13px', color: PAL.gold, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(D);

    const hit = this.add.rectangle(cx, cy, cardW, cardH)
      .setInteractive({ useHandCursor: true }).setDepth(D);
    hit.on('pointerover', () => { draw(true);  buyBtn.setColor(C_ACTIVE); });
    hit.on('pointerout',  () => { draw(false); buyBtn.setColor(PAL.gold); });
    hit.on('pointerdown', () => {
      const result = this.session.purchaseIntel(option.id);
      onSelect(result);
    });

    pop.push(bg, icon, flavorLbl, costLbl, desc, buyBtn, hit);
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
      this.sliderFillGfx.fillStyle(0xffffff, 0.85).fillRoundedRect(left, y - 4, tx - left, 8, 4);
    }
    this.sliderThumbGfx.clear();
    this.sliderThumbGfx.fillStyle(0xffffff, 1).fillCircle(tx, y, 14);
    this.sliderThumbGfx.lineStyle(2, 0x666677, 1).strokeCircle(tx, y, 14);
  }

  // ─── Bid submission ───────────────────────────────────────────────────────

  private submitBid() {
    if (this.bidAmount <= 0) {
      this.feedbackText.setText('Move the slider to place a bid');
      return;
    }
    if (this.bidAmount > this.effectiveMax) {
      this.feedbackText.setText('Bid exceeds your available balance');
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
    this.roundLabel.setText(`ROUND ${newRound} / 5`);
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
      accepted:   { text: 'BID ACCEPTED',    color: PAL.green, flashCol: PAL.n.green, holdMs: 900  },
      tooHigh:    { text: '▲  TOO HIGH',     color: PAL.red,   flashCol: PAL.n.red,   holdMs: 600  },
      tooLow:     { text: '▼  TOO LOW',      color: PAL.red,   flashCol: PAL.n.red,   holdMs: 600  },
      finalRound: { text: 'FINAL ROUND',     color: PAL.gold,  flashCol: PAL.n.gold,  holdMs: 1000 },
    };
    const { text, color, flashCol, holdMs } = cfg[type];

    this.screenFlash(flashCol, type === 'accepted' || type === 'finalRound' ? 0.30 : 0.18,
      type === 'accepted' ? 2 : 1);

    // Dark pill behind text
    const pill = this.add.graphics().setDepth(24);
    const textObj = this.add.text(MID_CX, H / 2, text, {
      fontSize: '46px', color, fontStyle: 'bold',
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

    this.add.text(MID_CX, 322, 'ITEMS FOUND', { fontSize: '11px', color: C_ACTIVE }).setOrigin(0.5);

    const runningText = this.add.text(MID_CX, 362, '$0', {
      fontSize: '30px', color: C_ACTIVE, fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    const netLabel = this.add.text(MID_CX, 420, '', {
      fontSize: '11px', color: C_GREY,
    }).setOrigin(0.5).setAlpha(0);

    const netResult = this.add.text(MID_CX, 456, '', {
      fontSize: '26px', color: C_ACTIVE, fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    // Clear intel effect outlines — items will reveal their true colours
    this.gridEffectGfx.clear();

    // ── Suspense buildup ──────────────────────────────────────────────────────
    const suspense = this.add.text(MID_CX, H / 2 - 10, 'OPENING VAULT', {
      fontSize: '20px', color: C_GREY, fontStyle: 'bold', letterSpacing: 6,
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
        this.feedbackText.setText('HIDDEN DOOR FOUND');
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
      fontSize: `${maxFontSize}px`, color: placed.item.tierDef.frameColor, fontStyle: 'bold',
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
      fontSize: '28px', color: PAL.gold, fontStyle: 'bold', align: 'center',
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

    netLabel.setText('NET RESULT').setAlpha(1);
    netResult.setText(`${sign}$0`).setAlpha(1);
    this.countUp(netResult, 0, abs, 900, `${sign}$`);

    this.time.delayedCall(1100, () => {
      this.add.text(MID_CX, H - 38, `New balance: $${newBalance.toLocaleString()}`, {
        fontSize: '12px', color: C_GREY,
      }).setOrigin(0.5);

      const sliderLeft  = LEFT_W + SLIDER_PAD;
      const sliderRight = W - RIGHT_W - SLIDER_PAD;
      const btnG = this.add.graphics();
      const drawBtn = (hov: boolean) => {
        btnG.clear();
        btnG.fillStyle(hov ? 0x444455 : 0x1e1e2e, 1)
          .fillRoundedRect(sliderLeft, H - 64, sliderRight - sliderLeft, 44, 6);
        btnG.lineStyle(1, hov ? 0xddddee : 0x888899, 1)
          .strokeRoundedRect(sliderLeft, H - 64, sliderRight - sliderLeft, 44, 6);
      };
      drawBtn(false);

      const playBtn = this.add.text(MID_CX, H - 42, 'PLAY AGAIN', {
        fontSize: '16px', color: C_ACTIVE, fontStyle: 'bold',
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
