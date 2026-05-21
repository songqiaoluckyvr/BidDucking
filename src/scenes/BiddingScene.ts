import Phaser from 'phaser';
import { SessionManager } from '@game/SessionManager';
import type { IntelResult, RevealResult, SessionOutcome, VaultItem } from '@game/types';
import { GAME_CONFIG } from '@config/GameConfig';
import { VAULT_TIER_CONFIG, type VaultTierDef } from '@config/VaultTierConfig';
import { ROUND_CONFIG } from '@config/RoundConfig';
import type { RoundNumber } from '@config/RoundConfig';
import { PAL } from '@ui/palette';
import { ASSETS } from '@assets/AssetKeys';

interface BiddingData {
  session:    SessionManager;
  vaultTier?: VaultTierDef;
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

const LEFT_W  = 185;
const RIGHT_W = 295;
const W       = 960;
const H       = 600;
const MID_CX  = LEFT_W + (W - LEFT_W - RIGHT_W) / 2;  // ≈ 432

const SLIDER_MIN = 100;
const SLIDER_MAX = 200_000;
const SLIDER_PAD = 24;

const DUCK_HISTORY_BOTTOM = 238;   // y where duck area starts (below bid scale)
const DUCK_BANKROLL_H     = 32;    // bankroll strip height at bottom of left panel
const DUCK_Y_FACTOR       = 0.58;  // fraction of available height for duck center

// ── Vault loot grid ──────────────────────────────────────────────────────────
const GSTEP  = 40;          // grid step (cell + gap)
const GCELL  = 37;          // visible cell size
const GCOLS  = 6;
const GROW_M = 10;          // main vault rows
const GROW_S = 4;           // secret vault rows

// Left edge of grid, centred inside the right panel
const GRID_X   = (W - RIGHT_W) + Math.round((RIGHT_W - ((GCOLS - 1) * GSTEP + GCELL)) / 2);
const GRID_Y_M = 18;                                // top of main grid
const GRID_Y_S = GRID_Y_M + GROW_M * GSTEP + 18;  // top of secret grid

// Colours — white / greys only for game UI
const C_ACTIVE = '#ffffff';
const C_GREY   = '#ffffff';

// Bid-remaining dot indicators (one per round, left = earliest)
const DOT_COLORS  = [0x00d4ff, 0x00d4ff, 0xffd700, 0xff9944, 0xff3355] as const;
const DOT_R       = 6;
const DOT_SPACING = 22;
const MAX_ROUNDS  = 5;

// Stroke shorthands — white/light → black; colored → dark shade of same hue
const S_SM   = { stroke: '#000000', strokeThickness: 2 } as const; // ≤13px
const S_MD   = { stroke: '#000000', strokeThickness: 3 } as const; // 14–22px
const S_LG   = { stroke: '#000000', strokeThickness: 5 } as const; // 23–40px
const S_XL   = { stroke: '#000000', strokeThickness: 7 } as const; // 41+px
const SC_SM  = { stroke: '#004d5e', strokeThickness: 2 } as const; // cyan  ≤13px
const SC_MD  = { stroke: '#004d5e', strokeThickness: 3 } as const; // cyan  14–22px
const SG_SM  = { stroke: '#005c2e', strokeThickness: 2 } as const; // green ≤13px
const SGD_SM = { stroke: '#664f00', strokeThickness: 2 } as const; // gold  ≤13px
const SGD_LG = { stroke: '#664f00', strokeThickness: 5 } as const; // gold  23–40px

// Intel shop display config (overrides option.flavorLabel / option.description)
const INTEL_DISPLAY: Record<string, { icon: string; label: string; desc: string }> = {
  valueBand: {
    icon:  '□',
    label: 'ITEM SWEEP',
    desc:  'See the size of every item\nin the vault grid.',
  },
  doorSignal: {
    icon:  '◈',
    label: 'RARITY SCANNER',
    desc:  'Color-codes rare and above\nitems on the grid.',
  },
  digitPeek: {
    icon:  '⬡',
    label: 'SECRET BOX',
    desc:  'Reveals what\'s inside\nthe secret vault chamber.',
  },
};

export class BiddingScene extends Phaser.Scene {
  private session!:       SessionManager;
  private vaultTierDef!:  VaultTierDef;

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
  private sliderMin        = SLIDER_MIN;
  private sliderMax        = SLIDER_MAX;
  private rangeMinLabel!:  Phaser.GameObjects.Text;
  private rangeMaxLabel!:  Phaser.GameObjects.Text;

  // Bid section objects hidden during reveal
  private bidSectionObjects: Phaser.GameObjects.GameObject[] = [];

  // Dynamic UI
  private totalValueText!: Phaser.GameObjects.Text;
  private bidAmountText!:  Phaser.GameObjects.Text;
  private feedbackText!:   Phaser.GameObjects.Text;
  private sliderFillGfx!:  Phaser.GameObjects.Graphics;
  private sliderThumb!:    Phaser.GameObjects.Image;
  private infoLines:       Phaser.GameObjects.Text[] = [];
  private duckImage!:      Phaser.GameObjects.Image;
  private bgImage!:        Phaser.GameObjects.Image;
  private bgVideo!:        Phaser.GameObjects.Video;
  private isProcessing     = false;
  private tutorialOpen     = false;

  // Bid scale
  private bidScaleGfx!:    Phaser.GameObjects.Graphics;
  private scaleLabelTexts: Phaser.GameObjects.Text[] = [];
  private bidDots:         Phaser.GameObjects.Graphics[] = [];

  // Vault grid
  private mainGridItems:   PlacedItem[] = [];
  private secretGridItems: PlacedItem[] = [];
  private gridEffectGfx!:  Phaser.GameObjects.Graphics;
  private secretDoorClosed?: Phaser.GameObjects.Image;
  private secretDoorOpen?:   Phaser.GameObjects.Image;
  private secretDoorOpened   = false;

  constructor() { super({ key: 'Bidding' }); }

  create(data: BiddingData) {
    this.session        = data.session;
    this.vaultTierDef   = data.vaultTier ?? VAULT_TIER_CONFIG.bronze;
    this.bidAmount      = 0;
    this.sliderThumbX   = 0;
    this.isDragging     = false;
    this.infoLines        = [];
    this.bidSectionObjects = [];
    this.isProcessing     = false;
    this.mainGridItems    = [];
    this.secretGridItems  = [];
    this.scaleLabelTexts  = [];
    this.bidDots          = [];
    this.secretDoorOpened = false;
    this.secretDoorClosed = undefined;
    this.secretDoorOpen   = undefined;

    this.playerBalance = parseInt(
      localStorage.getItem(BALANCE_KEY) ?? String(GAME_CONFIG.startingBalance), 10,
    );
    this.effectiveMax = this.vaultTierDef.sliderMax;
    this.sliderMin    = SLIDER_MIN;
    this.sliderMax    = this.effectiveMax;

    // Particle dot texture (used for clue reveals & bid bursts)
    if (!this.textures.exists('pdot')) {
      const pg = this.make.graphics({ add: false } as never);
      pg.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
      pg.generateTexture('pdot', 8, 8);
      pg.destroy();
    }

    this.sound.stopAll();
    this.sound.play(ASSETS.BGM_BIDDING, { loop: true, volume: 0.18 });

    // Static background — swapped for video when vault opens
    if (this.textures.exists(ASSETS.BG_GAME_IMG)) {
      this.bgImage = this.add.image(W / 2, H / 2, ASSETS.BG_GAME_IMG).setDepth(-1);
      const bgScale = Math.max(W / this.bgImage.width, H / this.bgImage.height);
      this.bgImage.setScale(bgScale);
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(-1);
    } else {
      this.add.rectangle(W / 2, H / 2, W, H, PAL.n.bg);
    }
    this.drawPanels();
    const viLogo = this.add.image(8, 8, ASSETS.VI_LOGO).setOrigin(0, 0).setDepth(30).setAlpha(0.85);
    viLogo.setScale(40 / viLogo.height);
    this.buildLeftPanel();
    this.buildCenterPanel();
    this.buildRightPanel();
    this.setupSliderInput();
    this.buildHelpButton(8 + viLogo.displayWidth + 10);

    const startIntel = () => {
      if (data.intelResult === undefined) {
        this.showIntelShopOverlay();
      } else {
        if (data.intelResult) {
          this.applyIntelEffect(data.intelResult.intelId);
        }
      }
    };

    if (!localStorage.getItem('bidducking_tutorial_seen')) {
      this.showTutorial(startIntel);
    } else {
      startIntel();
    }
  }

  // ─── Panel backgrounds ────────────────────────────────────────────────────

  private drawPanels() {
    const g = this.add.graphics();

    const neonPanel = (x: number, y: number, w: number, h: number) => {
      // Fill
      g.fillStyle(PAL.n.panel, 0.80).fillRect(x, y, w, h);
      // Glow layers
      g.lineStyle(10, PAL.n.borderGlow, 0.04).strokeRect(x, y, w, h);
      g.lineStyle(5,  PAL.n.borderGlow, 0.10).strokeRect(x, y, w, h);
      g.lineStyle(1,  PAL.n.borderGlow, 0.75).strokeRect(x, y, w, h);
      // Top accent bar
      g.fillStyle(PAL.n.cyan, 1).fillRect(x, y, w, 2);
      // Corner brackets
      const s = 10;
      g.fillStyle(PAL.n.cyan, 1);
      [[x, y], [x + w - s, y], [x, y + h - 2], [x + w - s, y + h - 2]].forEach(([bx, by]) => g.fillRect(bx, by, s, 2));
      [[x, y], [x + w - 2, y], [x, y + h - s], [x + w - 2, y + h - s]].forEach(([bx, by]) => g.fillRect(bx, by, 2, s));
    };

    neonPanel(0, 0, LEFT_W, H);
    neonPanel(W - RIGHT_W, 0, RIGHT_W, H);

    // Center divider lines
    g.lineStyle(1, PAL.n.borderBright, 0.35);
    g.lineBetween(LEFT_W, 0, LEFT_W, H);
    g.lineBetween(W - RIGHT_W, 0, W - RIGHT_W, H);

    // Animated pulse glow on both panels
    const glowG = this.add.graphics().setDepth(0);
    const glowObj = { a: 0.04 };
    const redrawGlow = () => {
      glowG.clear();
      glowG.lineStyle(12, PAL.n.borderGlow, glowObj.a).strokeRect(0, 0, LEFT_W, H);
      glowG.lineStyle(12, PAL.n.borderGlow, glowObj.a).strokeRect(W - RIGHT_W, 0, RIGHT_W, H);
    };
    redrawGlow();
    this.tweens.add({
      targets: glowObj, a: 0.14, duration: 2200,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      onUpdate: redrawGlow,
    });
  }

  // ─── Left panel ───────────────────────────────────────────────────────────

  private buildLeftPanel() {
    const cx     = LEFT_W / 2;
    const availH = H - DUCK_HISTORY_BOTTOM - DUCK_BANKROLL_H;
    const duckCY = DUCK_HISTORY_BOTTOM + availH * DUCK_Y_FACTOR;

    this.add.text(cx, 84, 'BID SCALE', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: C_ACTIVE,
      ...S_SM,
    }).setOrigin(0.5);

    this.bidScaleGfx = this.add.graphics();
    this.redrawBidScale();

    this.add.graphics().lineStyle(1, PAL.n.border, 0.4).lineBetween(8, 232, LEFT_W - 8, 232);

    // Soft spotlight behind duck — layered radial glow
    const spotG = this.add.graphics();
    [[110, 0.04], [80, 0.07], [55, 0.09], [32, 0.07]].forEach(([r, a]) =>
      spotG.fillStyle(0x1e0a4a, a as number).fillCircle(cx, duckCY, r as number),
    );
    spotG.lineStyle(1, PAL.n.cyan, 0.12).strokeCircle(cx, duckCY, 105);

    this.duckImage = this.add.image(cx, duckCY, ASSETS.DUCK_STAND);
    this.duckImage.setScale(Math.min(LEFT_W / this.duckImage.width, availH / this.duckImage.height) * 1.45);

    this.add.text(cx, H - DUCK_BANKROLL_H / 2 - 2, `BANK  $${this.playerBalance.toLocaleString()}`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: C_GREY,
      ...S_SM,
    }).setOrigin(0.5);
  }

  private setDuckState(state: 'stand' | 'think' | 'win' | 'lose') {
    const KEY_MAP = {
      stand: ASSETS.DUCK_STAND,
      think: ASSETS.DUCK_THINK,
      win:   ASSETS.DUCK_WIN,
      lose:  ASSETS.DUCK_LOSE,
    };
    const availH = H - DUCK_HISTORY_BOTTOM - DUCK_BANKROLL_H;
    const duckCY = DUCK_HISTORY_BOTTOM + availH * DUCK_Y_FACTOR;
    const cx     = LEFT_W / 2;
    this.duckImage.setTexture(KEY_MAP[state]);
    this.duckImage.setPosition(cx, duckCY);
    this.duckImage.setScale(Math.min(LEFT_W / this.duckImage.width, availH / this.duckImage.height) * 1.45);
  }

  private redrawBidScale() {
    this.bidScaleGfx.clear();
    this.scaleLabelTexts.forEach(t => t.destroy());
    this.scaleLabelTexts = [];

    const state = this.session.getSessionState();
    if (state.complete) return;

    const round    = this.session.getCurrentRound() as RoundNumber;
    const roundCfg = ROUND_CONFIG[round];
    if (!roundCfg) return;

    const g     = this.bidScaleGfx;
    const PAD   = 14;
    const xL    = PAD;
    const xR    = LEFT_W - PAD;
    const barY  = 120;
    const barH  = 10;
    const cx    = (xL + xR) / 2;
    const halfW = (xR - xL) / 2;

    const under = roundCfg.underbidTolerance;
    const over  = roundCfg.overbidTolerance;
    const jpTol = GAME_CONFIG.jackpotTolerancePercent;

    const greenL = cx - under * halfW;
    const greenR = cx + over  * halfW;
    const jpHW   = Math.max(3, jpTol * halfW); // minimum 3px so gold is always visible

    // Track
    g.fillStyle(0x14142a, 1).fillRoundedRect(xL, barY, xR - xL, barH, 5);
    g.lineStyle(1, 0x2a2a4a, 1).strokeRoundedRect(xL, barY, xR - xL, barH, 5);

    // Acceptance zone (green)
    g.fillStyle(PAL.n.green, 0.30).fillRect(greenL, barY, greenR - greenL, barH);
    g.lineStyle(1, PAL.n.green, 0.65).strokeRect(greenL, barY, greenR - greenL, barH);

    // Jackpot zone (gold sliver at center)
    g.fillStyle(PAL.n.gold, 0.95).fillRect(cx - jpHW, barY, jpHW * 2, barH);

    // Center tick
    g.lineStyle(1, 0x666688, 0.45).lineBetween(cx, barY - 5, cx, barY + barH + 5);

    // Acceptance % labels above bar edges
    const underLbl = this.add.text(greenL, barY - 5, `-${Math.round(under * 100)}%`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: PAL.green,
      ...SG_SM,
    }).setOrigin(0.5, 1);

    const overLbl = this.add.text(greenR, barY - 5, `+${Math.round(over * 100)}%`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: PAL.green,
      ...SG_SM,
    }).setOrigin(0.5, 1);

    // Jackpot label below bar
    const jpLbl = this.add.text(cx, barY + barH + 4, 'JACKPOT  ±0.5%', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '11px', color: PAL.gold,
      ...SGD_SM,
    }).setOrigin(0.5, 0).setAlpha(0.85);

    // ── Jackpot bonus info (space below bar) ─────────────────────────────────
    const jpInfoY = 166;
    const jpHdr = this.add.text(cx, jpInfoY, 'JACKPOT BONUS', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '11px', color: '#ffffff',
      ...S_SM,
    }).setOrigin(0.5, 0);

    const jpMult = this.add.text(cx, jpInfoY + 18, `${roundCfg.jackpotMultiplier}×`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '38px', color: PAL.gold,
      shadow: { offsetX: 0, offsetY: 0, color: PAL.gold, blur: 18, fill: true },
      ...SGD_LG,
    }).setOrigin(0.5, 0);

    this.scaleLabelTexts.push(underLbl, overLbl, jpLbl, jpHdr, jpMult);
  }

  // ─── Center panel ─────────────────────────────────────────────────────────

  private buildCenterPanel() {
    const centerW = W - LEFT_W - RIGHT_W;

    // Segmented neon divider helper
    const segDiv = (y: number) => {
      const g  = this.add.graphics();
      const x1 = LEFT_W + 16;
      const x2 = W - RIGHT_W - 16;
      const segW = 14; const gap = 7;
      for (let x = x1; x < x2; x += segW + gap) {
        g.fillStyle(PAL.n.cyan, 0.48).fillRect(x, y - 0.5, Math.min(segW, x2 - x), 1);
      }
      g.lineStyle(1, PAL.n.border, 0.15).lineBetween(x1, y, x2, y);
    };

    // ── Zone 1: Vault value ───────────────────────────────────────────────────
    this.add.text(MID_CX, 22, 'VAULT VALUE', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '11px', color: C_GREY,
      ...S_SM,
    }).setOrigin(0.5);

    this.totalValueText = this.add.text(MID_CX, 68, '?', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '68px', color: C_GREY,
      ...S_XL,
    }).setOrigin(0.5);

    this.feedbackText = this.add.text(MID_CX, 136, '', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '16px', color: C_GREY,
      ...S_MD,
    }).setOrigin(0.5);

    // ── Zone 2: Clue lines ────────────────────────────────────────────────────
    segDiv(170);

    for (let i = 0; i < 4; i++) {
      const t = this.add.text(MID_CX, 182 + i * 32, '', {
        fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '24px', color: C_GREY, align: 'center',
        wordWrap: { width: centerW - 24 },
        ...S_LG,
      }).setOrigin(0.5);
      this.infoLines.push(t);
    }

    // ── Zone 3: Bid controls ──────────────────────────────────────────────────
    segDiv(304);

    const sliderLeft  = LEFT_W + SLIDER_PAD;
    const sliderRight = W - RIGHT_W - SLIDER_PAD;
    const sliderW     = sliderRight - sliderLeft;
    const sliderY     = 400;

    this.sliderTrackLeft  = sliderLeft;
    this.sliderTrackRight = sliderRight;
    this.sliderTrackY     = sliderY;
    this.sliderThumbX     = sliderLeft;

    // Bid amount — main visual focus with idle scale pulse
    const yourBidLabel = this.add.text(MID_CX, 318, 'YOUR BID', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '11px', color: C_GREY,
      ...S_SM,
    }).setOrigin(0.5);
    this.bidSectionObjects.push(yourBidLabel);

    this.bidAmountText = this.add.text(MID_CX, 350, '—', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '52px', color: C_ACTIVE,
      ...S_XL,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: this.bidAmountText, scaleX: 1.014, scaleY: 1.014,
      duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.bidSectionObjects.push(this.bidAmountText);

    // Neon tick marks above slider track
    const tickG = this.add.graphics();
    for (let i = 0; i <= 8; i++) {
      const tx = sliderLeft + (i / 8) * sliderW;
      const isMajor = i % 4 === 0;
      tickG.fillStyle(PAL.n.cyan, isMajor ? 0.38 : 0.16)
        .fillRect(tx - 0.5, sliderY - 8 - (isMajor ? 7 : 4), 1, isMajor ? 7 : 4);
    }
    this.bidSectionObjects.push(tickG);

    // Thicker slider track (14px)
    const trackGfx = this.add.graphics()
      .fillStyle(0x14122e, 1).fillRoundedRect(sliderLeft, sliderY - 7, sliderW, 14, 7);
    this.bidSectionObjects.push(trackGfx);

    this.sliderFillGfx = this.add.graphics();
    this.sliderThumb   = this.add.image(sliderLeft, sliderY, ASSETS.BID_COIN)
      .setDisplaySize(38, 38).setOrigin(0.5);
    this.bidSectionObjects.push(this.sliderFillGfx, this.sliderThumb);
    this.redrawSlider();

    this.rangeMinLabel = this.add.text(sliderLeft, sliderY + 24, `$${this.sliderMin.toLocaleString()}`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '16px', color: C_GREY,
      ...S_MD,
    }).setOrigin(0, 0.5);
    this.rangeMaxLabel = this.add.text(sliderRight, sliderY + 24, `$${this.sliderMax.toLocaleString()}`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '16px', color: C_GREY,
      ...S_MD,
    }).setOrigin(1, 0.5);
    this.bidSectionObjects.push(this.rangeMinLabel, this.rangeMaxLabel);

    const hitZone = this.add.rectangle(
      (sliderLeft + sliderRight) / 2, sliderY, sliderW + 28, 60,
    ).setInteractive({ useHandCursor: true })
      .on('pointerdown', (ptr: Phaser.Input.Pointer) => {
        this.isDragging = true;
        this.setDuckState('think');
        this.updateSliderFromX(ptr.x);
      });
    this.bidSectionObjects.push(hitZone);

    // Lock-in button — taller, closer to slider, idle glow pulse
    const btnY  = 500;
    const btnCx = (sliderLeft + sliderRight) / 2;
    const btnImg = this.add.image(btnCx, btnY, ASSETS.MAIN_BTN)
      .setDisplaySize(sliderW, 60).setOrigin(0.5);
    this.tweens.add({
      targets: btnImg, alpha: 0.82,
      duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    const submitLabel = this.add.text(btnCx, btnY, 'LOCK IT IN', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '22px', color: C_ACTIVE,
      ...S_MD,
    }).setOrigin(0.5);
    const submitHit = this.add.rectangle(btnCx, btnY, sliderW, 60)
      .setInteractive({ useHandCursor: true });
    this.bidSectionObjects.push(btnImg, submitLabel, submitHit);

    submitHit.on('pointerover',  () => btnImg.setTint(0xaaeeff));
    submitHit.on('pointerout',   () => btnImg.clearTint());
    submitHit.on('pointerdown',  () => {
      this.tweens.killTweensOf(btnImg);
      this.tweens.add({ targets: btnImg, alpha: 0.6, duration: 60, yoyo: true, onComplete: () => {
        btnImg.setAlpha(1);
        this.tweens.add({ targets: btnImg, alpha: 0.82, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }});
      this.submitBid();
    });

    // ── Bid-remaining dot indicators ──────────────────────────────────────────
    const dotsY    = btnY + 44;
    const dotSpanW = (MAX_ROUNDS - 1) * DOT_SPACING;

    for (let i = 0; i < MAX_ROUNDS; i++) {
      const dx = MID_CX - dotSpanW / 2 + i * DOT_SPACING;
      const g  = this.add.graphics();
      g.fillStyle(DOT_COLORS[i], 0.22).fillCircle(dx, dotsY, DOT_R + 4);
      g.fillStyle(DOT_COLORS[i], 1.00).fillCircle(dx, dotsY, DOT_R);
      this.bidDots.push(g);
      this.bidSectionObjects.push(g);
    }

    const dotsLabel = this.add.text(MID_CX, dotsY + 17, 'BIDS REMAINING', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '11px', color: C_GREY,
      ...S_SM,
    }).setOrigin(0.5);
    this.bidSectionObjects.push(dotsLabel);

    // ── Give-up button (right of dots) ────────────────────────────────────────
    const GU_W  = 82;
    const GU_H  = 24;
    const GU_CX = MID_CX + dotSpanW / 2 + DOT_SPACING + GU_W / 2 + 4;
    const GU_CY = dotsY;

    const guBg = this.add.graphics();
    guBg.fillStyle(0x1a0a0a, 0.90).fillRoundedRect(GU_CX - GU_W / 2, GU_CY - GU_H / 2, GU_W, GU_H, 4);
    guBg.lineStyle(1, 0xff3355, 0.50).strokeRoundedRect(GU_CX - GU_W / 2, GU_CY - GU_H / 2, GU_W, GU_H, 4);
    this.bidSectionObjects.push(guBg);

    const guLabel = this.add.text(GU_CX, GU_CY, 'GIVE UP', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '12px', color: '#ff3355', ...S_SM,
    }).setOrigin(0.5);
    this.bidSectionObjects.push(guLabel);

    const guHit = this.add.rectangle(GU_CX, GU_CY, GU_W, GU_H).setInteractive({ useHandCursor: true });
    guHit.on('pointerover',  () => { guBg.clear(); guBg.fillStyle(0x3a0a12, 0.95).fillRoundedRect(GU_CX - GU_W / 2, GU_CY - GU_H / 2, GU_W, GU_H, 4); guBg.lineStyle(1, 0xff3355, 1).strokeRoundedRect(GU_CX - GU_W / 2, GU_CY - GU_H / 2, GU_W, GU_H, 4); guLabel.setColor('#ff6677'); });
    guHit.on('pointerout',   () => { guBg.clear(); guBg.fillStyle(0x1a0a0a, 0.90).fillRoundedRect(GU_CX - GU_W / 2, GU_CY - GU_H / 2, GU_W, GU_H, 4); guBg.lineStyle(1, 0xff3355, 0.50).strokeRoundedRect(GU_CX - GU_W / 2, GU_CY - GU_H / 2, GU_W, GU_H, 4); guLabel.setColor('#ff3355'); });
    guHit.on('pointerdown',  () => this.giveUp());
    this.bidSectionObjects.push(guHit);
  }

  private giveUp() {
    if (this.isProcessing) return;
    this.session.forfeit();
    this.hideBidSection();
    this.setDuckState('lose');
    this.updateBidDots(MAX_ROUNDS);
    this.showBidPopup('bidFailed', () => this.startReveal());
  }

  private updateBidDots(roundsUsed: number) {
    const dotSpanW = (MAX_ROUNDS - 1) * DOT_SPACING;
    const dotsY    = 544; // btnY(500) + 44

    this.bidDots.forEach((g, i) => {
      g.clear();
      const dx = MID_CX - dotSpanW / 2 + i * DOT_SPACING;
      if (i < roundsUsed) {
        g.fillStyle(0x1e1e36, 1).fillCircle(dx, dotsY, DOT_R);
        g.lineStyle(1, 0x2a2a50, 1).strokeCircle(dx, dotsY, DOT_R);
      } else {
        g.fillStyle(DOT_COLORS[i], 0.22).fillCircle(dx, dotsY, DOT_R + 4);
        g.fillStyle(DOT_COLORS[i], 1.00).fillCircle(dx, dotsY, DOT_R);
      }
    });
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

    // Separator between main and secret grids
    const sepY = GRID_Y_M + GROW_M * GSTEP + 6;
    this.add.graphics().setDepth(1)
      .lineStyle(1, PAL.n.border, 0.5)
      .lineBetween(GRID_X, sepY, GRID_X + (GCOLS - 1) * GSTEP + GCELL, sepY);

    this.drawGridCells(g, GRID_Y_S, GROW_S, true);
    this.buildSecretDoor();

    // Overlay graphics for intel effects (drawn above grid cells)
    this.gridEffectGfx = this.add.graphics().setDepth(2);

    this.startVaultScanWave();
  }

  private drawGridCells(g: Phaser.GameObjects.Graphics, gridY: number, rows: number, isSecret: boolean) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < GCOLS; c++) {
        const x = GRID_X + c * GSTEP;
        const y = gridY + r * GSTEP;
        if (isSecret) {
          // Amber/gold warning aesthetic — high risk, high reward
          g.fillStyle(0x1a0c00, 0.80).fillRect(x, y, GCELL, GCELL);
          g.lineStyle(1, 0xdd7700, 0.70).strokeRect(x, y, GCELL, GCELL);
          g.lineStyle(1, 0xffaa00, 0.14).strokeRect(x + 2, y + 2, GCELL - 4, GCELL - 4);
        } else {
          g.fillStyle(0x0d0b22, 0.85).fillRect(x, y, GCELL, GCELL);
          g.lineStyle(1, 0x2e2c58, 0.80).strokeRect(x, y, GCELL, GCELL);
        }
      }
    }
  }

  private buildSecretDoor() {
    const doorW = (GCOLS - 1) * GSTEP + GCELL; // 237
    const doorH = (GROW_S - 1) * GSTEP + GCELL; // 157
    const cx    = GRID_X + doorW / 2;
    const cy    = GRID_Y_S + doorH / 2;

    if (this.textures.exists(ASSETS.SECRET_VAULT_DOOR)) {
      this.secretDoorClosed = this.add.image(cx, cy, ASSETS.SECRET_VAULT_DOOR)
        .setDisplaySize(doorW, doorH).setOrigin(0.5).setDepth(6);
    }
    if (this.textures.exists(ASSETS.SECRET_VAULT_OPEN)) {
      this.secretDoorOpen = this.add.image(cx, cy, ASSETS.SECRET_VAULT_OPEN)
        .setDisplaySize(doorW, doorH).setOrigin(0.5).setDepth(6).setAlpha(0);
    }
  }

  // Total animation time from call to door fully gone — used by playOpenSequence
  // to schedule hidden item reveals after the door clears.
  static readonly DOOR_OPEN_MS = 2_200;

  private openSecretDoor(onReveal?: () => void) {
    if (this.secretDoorOpened) return;
    this.secretDoorOpened = true;

    const doorW = (GCOLS - 1) * GSTEP + GCELL;
    const doorH = (GROW_S - 1) * GSTEP + GCELL;
    const cx    = GRID_X + doorW / 2;
    const cy    = GRID_Y_S + doorH / 2;

    const secretTotal   = this.secretGridItems.reduce((s, p) => s + p.item.value, 0);
    const particleCount = Phaser.Math.Clamp(20 + Math.floor(secretTotal / 600), 24, 80);
    const isRich        = secretTotal > 15_000;
    const tints         = isRich
      ? [0xffd700, 0xff6600, 0xcc44ff, 0xffffff]
      : [0xffaa00, 0xdd7700, 0xffd700, 0xffffff];

    // ── Phase 1: fade closed → open (0–800 ms) ───────────────────────────────
    this.tweens.add({
      targets: this.secretDoorClosed, alpha: 0,
      duration: 600, ease: 'Sine.easeIn',
      onComplete: () => this.secretDoorClosed?.destroy(),
    });
    this.tweens.add({
      targets: this.secretDoorOpen, alpha: 1,
      duration: 600, delay: 150, ease: 'Sine.easeOut',
    });

    // ── Phase 2: brief hold, then fade open → grid (900–1 700 ms) ───────────
    this.time.delayedCall(900, () => {
      this.tweens.add({
        targets: this.secretDoorOpen, alpha: 0,
        duration: 700, ease: 'Sine.easeIn',
        onComplete: () => {
          this.secretDoorOpen?.destroy();

          // Particles fire only after the open image is fully gone
          this.emitBurst(cx, cy, tints, particleCount, true);
          if (isRich) {
            this.time.delayedCall(120, () =>
              this.emitBurst(cx, cy, tints, Math.floor(particleCount * 0.5), true),
            );
          }

          onReveal?.();
        },
      });
    });
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
      // SECRET BOX — open the door and show tier outlines on secret-vault items
      this.openSecretDoor();
      for (const placed of this.secretGridItems) {
        const { x, y, pw, ph } = this.placedRect(placed);
        const col = Phaser.Display.Color.HexStringToColor(placed.item.tierDef.frameColor).color;
        g.lineStyle(2, col, 0.9).strokeRect(x, y, pw, ph);
      }
    }
  }

  // ─── Tutorial Overlay ─────────────────────────────────────────────────────

  private showTutorial(onDone: () => void) {
    this.tutorialOpen = true;
    const pop: Phaser.GameObjects.GameObject[] = [];

    const dismiss = () => {
      this.tutorialOpen = false;
      localStorage.setItem('bidducking_tutorial_seen', '1');
      pop.forEach(o => o.destroy());
      onDone();
    };

    const CW = 560; const CH = 390;
    const CX = W / 2; const CY = H / 2;
    const CL = CX - CW / 2; const CT = CY - CH / 2;
    const D  = 16;

    // Dim backdrop
    pop.push(
      this.add.rectangle(CX, CY, W, H, 0x000000, 0.60)
        .setDepth(14).setInteractive(),
    );

    // Card — same neon panel style as side panels
    const card = this.add.graphics().setDepth(15);
    card.fillStyle(PAL.n.panel, 0.97).fillRect(CL, CT, CW, CH);
    card.lineStyle(10, PAL.n.borderGlow, 0.04).strokeRect(CL, CT, CW, CH);
    card.lineStyle(5,  PAL.n.borderGlow, 0.10).strokeRect(CL, CT, CW, CH);
    card.lineStyle(1,  PAL.n.borderGlow, 0.75).strokeRect(CL, CT, CW, CH);
    card.fillStyle(PAL.n.cyan, 1).fillRect(CL, CT, CW, 2);
    pop.push(card);

    // Title
    pop.push(this.add.text(CX, CT + 22, 'HOW IT WORKS', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '20px', color: PAL.cyan,
      ...SC_MD,
    }).setOrigin(0.5, 0).setDepth(D));

    // Title divider
    const divG = this.add.graphics().setDepth(D);
    divG.lineStyle(1, PAL.n.border, 0.55).lineBetween(CL + 20, CT + 54, CL + CW - 20, CT + 54);
    pop.push(divG);

    // Rules
    const RULES: { icon: string; label: string; desc: string }[] = [
      {
        icon:  '⬡',
        label: 'YOUR MISSION',
        desc:  'Lowball the vault. Your cut = vault value − your bid. The lower you bid, the more you keep.',
      },
      {
        icon:  '↻',
        label: 'UP TO 5 ROUNDS',
        desc:  'Each rejected bid tells you if you went too high or too low. Narrow the gap.',
      },
      {
        icon:  '▮',
        label: 'BID SCALE',
        desc:  'Green zone = bid accepted. Gold sliver at centre = jackpot bonus on top.',
      },
      {
        icon:  '◈',
        label: 'SECRET VAULT',
        desc:  'A hidden chamber may exist — its loot adds to your cut if your bid is accepted.',
      },
    ];

    RULES.forEach((rule, i) => {
      const rowY = CT + 70 + i * 68;
      pop.push(this.add.text(CL + 26, rowY + 8, rule.icon, {
        fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '22px', color: PAL.cyan,
        ...SC_MD,
      }).setOrigin(0, 0.5).setDepth(D));
      pop.push(this.add.text(CL + 60, rowY, rule.label, {
        fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '15px', color: C_ACTIVE,
        ...S_MD,
      }).setOrigin(0, 0).setDepth(D));
      pop.push(this.add.text(CL + 60, rowY + 20, rule.desc, {
        fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: C_GREY,
        ...S_SM,
      }).setOrigin(0, 0).setDepth(D));
    });

    // GOT IT button
    const btnY = CT + CH - 40;
    const btnImg = this.add.image(CX, btnY, ASSETS.MAIN_BTN)
      .setDisplaySize(220, 56).setOrigin(0.5).setDepth(D);
    pop.push(btnImg);
    pop.push(this.add.text(CX, btnY, 'GOT IT', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '20px', color: C_ACTIVE,
      ...S_MD,
    }).setOrigin(0.5).setDepth(D + 1));
    const btnHit = this.add.rectangle(CX, btnY, 220, 56)
      .setInteractive({ useHandCursor: true }).setDepth(D + 1);
    btnHit.on('pointerover',  () => btnImg.setTint(0xaaeeff));
    btnHit.on('pointerout',   () => btnImg.clearTint());
    btnHit.on('pointerdown',  () => dismiss());
    pop.push(btnHit);
  }

  // ─── Intel Shop Overlay ───────────────────────────────────────────────────

  private showIntelShopOverlay() {
    const pop: Phaser.GameObjects.GameObject[] = [];

    const dismiss = (result: IntelResult | null) => {
      pop.forEach(o => o.destroy());
      if (result) {
        this.applyIntelEffect(result.intelId);
      }
      this.effectiveMax = this.vaultTierDef.sliderMax;
      this.sliderMax    = this.effectiveMax;
      this.rangeMaxLabel.setText(`$${this.sliderMax.toLocaleString()}`);
      this.redrawBidScale();
    };

    const D = 11;

    // Dim backdrop
    pop.push(
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.60)
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



      // Description
      const display = INTEL_DISPLAY[opt.id];
      pop.push(
        this.add.text(cx, cardsTopY + 188, display?.desc ?? opt.description, {
          fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: C_GREY,
          wordWrap: { width: CARD_W - 24 }, align: 'center', lineSpacing: 5,
          ...S_SM,
        }).setOrigin(0.5, 0).setDepth(D),
      );

      // SELECT button
      const btnY = cardsTopY + CARD_H - 44;
      const btnImg = this.add.image(cx, btnY, ASSETS.UI_BTN_2)
        .setDisplaySize(CARD_W - 26, 58).setOrigin(0.5).setDepth(D);
      pop.push(btnImg);
      pop.push(
        this.add.text(cx, btnY, 'SELECT', {
          fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '17px', color: C_ACTIVE,
          ...S_MD,
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
  }

  // ─── Slider ───────────────────────────────────────────────────────────────

  private buildHelpButton(logoRightX: number) {
    const R  = 14;
    const bx = logoRightX + R;
    const by = 8 + R;

    const g = this.add.graphics().setDepth(28);
    g.fillStyle(0x000000, 0.55).fillCircle(bx, by, R);
    g.lineStyle(1, PAL.n.cyan, 0.55).strokeCircle(bx, by, R);

    this.add.text(bx, by, '?', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '18px', color: PAL.cyan,
      ...SC_MD,
    }).setOrigin(0.5).setDepth(29);

    this.add.circle(bx, by, R)
      .setInteractive({ useHandCursor: true })
      .setDepth(30)
      .on('pointerover',  () => { g.clear(); g.fillStyle(0x001a22, 0.80).fillCircle(bx, by, R); g.lineStyle(1, PAL.n.cyan, 1).strokeCircle(bx, by, R); })
      .on('pointerout',   () => { g.clear(); g.fillStyle(0x000000, 0.55).fillCircle(bx, by, R); g.lineStyle(1, PAL.n.cyan, 0.55).strokeCircle(bx, by, R); })
      .on('pointerdown',  () => { if (!this.tutorialOpen) this.showTutorial(() => {}); });
  }

  private setupSliderInput() {
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (this.isDragging) this.updateSliderFromX(ptr.x);
    });
    this.input.on('pointerup', () => {
      if (this.isDragging) this.setDuckState('stand');
      this.isDragging = false;
    });
  }

  private updateSliderFromX(x: number) {
    this.sliderThumbX = Phaser.Math.Clamp(x, this.sliderTrackLeft, this.sliderTrackRight);
    const t = (this.sliderThumbX - this.sliderTrackLeft) / (this.sliderTrackRight - this.sliderTrackLeft);
    this.bidAmount = Math.round(t * (this.sliderMax - this.sliderMin) + this.sliderMin);
    this.redrawSlider();
    this.bidAmountText.setText(`$${this.bidAmount.toLocaleString()}`);
  }

  private redrawSlider() {
    const { sliderTrackLeft: left, sliderTrackY: y, sliderThumbX: tx } = this;
    this.sliderFillGfx.clear();
    if (tx > left) {
      this.sliderFillGfx.fillStyle(PAL.n.cyan, 0.9).fillRoundedRect(left, y - 7, tx - left, 14, 7);
    }
    this.sliderThumb.setPosition(tx, y);
  }

  // ─── Bid submission ───────────────────────────────────────────────────────

  private submitBid() {
    if (this.bidAmount <= 0) {
      this.feedbackText.setText('Set your price first');
      return;
    }
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Suspense delay — pulsing "PROCESSING..." before revealing the result
    const procText = this.add.text(MID_CX, 286, 'PROCESSING...', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '22px',
      color: C_GREY, letterSpacing: 6,
      ...S_MD,
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({ targets: procText, alpha: 0.15, duration: 380, yoyo: true, repeat: -1 });

    this.time.delayedCall(1100, () => {
      this.tweens.killTweensOf(procText);
      procText.destroy();
      this.isProcessing = false;
      this.resolveBid();
    });
  }

  private resolveBid() {
    const result = this.session.submitBid(this.bidAmount);

    if (result.accepted) {
      this.hideBidSection();
      this.feedbackText.setText('');
      this.setDuckState('win');
      this.showBidPopup('accepted', () => this.startReveal());
      return;
    }

    const type     = result.sessionComplete ? 'bidFailed'
      : result.bidDirection === 'tooHigh' ? 'tooHigh' : 'tooLow';
    const newRound = this.session.getCurrentRound();
    this.feedbackText.setText('');
    this.setDuckState('lose');
    this.time.delayedCall(1200, () => this.setDuckState('stand'));

    // Grey out the dot for the round just spent
    const roundsUsed = result.sessionComplete ? MAX_ROUNDS : (newRound as number) - 1;
    this.updateBidDots(roundsUsed);

    const afterDirection = result.sessionComplete
      ? () => { this.hideBidSection(); this.startReveal(); }
      : undefined;
    this.showBidPopup(type, afterDirection);

    // Narrow the slider range and redraw scale
    if (result.bidDirection === 'tooLow') {
      this.sliderMin = Math.max(this.sliderMin, this.bidAmount);
      this.rangeMinLabel.setText(`$${this.sliderMin.toLocaleString()}`);
    } else {
      this.sliderMax = Math.min(this.sliderMax, this.bidAmount);
      this.rangeMaxLabel.setText(`$${this.sliderMax.toLocaleString()}`);
    }
    this.redrawBidScale();

    this.sliderThumbX = this.sliderTrackLeft;
    this.bidAmount    = 0;
    this.redrawSlider();
    this.bidAmountText.setText('—');


    if (result.revealResult) this.appendReveal(result.revealResult);
  }

  private showBidPopup(type: string, onDone?: () => void) {
    const cfg: Record<string, { text: string; sub?: string; color: string; flashCol: number; holdMs: number; flashAlpha?: number; flashRep?: number }> = {
      accepted:  { text: 'DEAL SEALED!',     color: PAL.green, flashCol: PAL.n.green, holdMs: 900, flashAlpha: 0.30, flashRep: 2 },
      tooHigh:   { text: '▲  OVERSHOT',     color: PAL.red,   flashCol: PAL.n.red,   holdMs: 600, flashAlpha: 0.18, flashRep: 1 },
      tooLow:    { text: '▼  THINK BIGGER', color: PAL.red,   flashCol: PAL.n.red,   holdMs: 600, flashAlpha: 0.18, flashRep: 1 },
      bidFailed: { text: '✕  BID FAILED',   color: PAL.red,   flashCol: PAL.n.red,   holdMs: 900, flashAlpha: 0.28, flashRep: 2 },
    };
    const entry = cfg[type];
    if (!entry) return;
    const { text, sub, color, flashCol, holdMs, flashAlpha = 0.18, flashRep = 1 } = entry;

    this.screenFlash(flashCol, flashAlpha, flashRep);

    const mainY = sub ? 386 : 400;

    const pill = this.add.graphics().setDepth(24);
    const textObj = this.add.text(MID_CX, mainY, text, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '48px', color,
      stroke: '#000000', strokeThickness: 10,
    }).setOrigin(0.5).setScale(0).setAlpha(0).setDepth(25);

    const subObj = sub ? this.add.text(MID_CX, mainY + 34, sub, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '16px', color: '#ffffff',
      ...S_MD,
    }).setOrigin(0.5).setAlpha(0).setDepth(25) : null;

    const pillH = sub ? 96 : 72;
    const pillCY = sub ? 404 : 400;

    const drawPill = (alpha: number) => {
      pill.clear();
      if (alpha <= 0) return;
      const pw = Math.max(textObj.width, subObj?.width ?? 0) + 60;
      pill.fillStyle(0x000000, alpha * 0.72)
        .fillRoundedRect(MID_CX - pw / 2, pillCY - pillH / 2, pw, pillH, 10);
      pill.lineStyle(2, Phaser.Display.Color.HexStringToColor(color).color, alpha)
        .strokeRoundedRect(MID_CX - pw / 2, pillCY - pillH / 2, pw, pillH, 10);
    };
    drawPill(0);

    const allObjs = subObj ? [textObj, subObj] : [textObj];

    this.tweens.add({
      targets: textObj, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut',
      onUpdate: () => drawPill(textObj.alpha),
      onComplete: () => {
        if (subObj) {
          this.tweens.add({ targets: subObj, alpha: 0.65, duration: 180, delay: 60 });
        }
        this.time.delayedCall(holdMs, () => {
          this.tweens.add({
            targets: allObjs, alpha: 0, y: `-=24`, duration: 280, ease: 'Cubic.easeIn',
            onUpdate: () => drawPill(textObj.alpha),
            onComplete: () => {
              allObjs.forEach(o => o.destroy());
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

    // Crossfade from static background to the reveal video
    if (this.cache.video.exists(ASSETS.BG_GAME_VIDEO)) {
      this.bgVideo = this.add.video(W / 2, H / 2, ASSETS.BG_GAME_VIDEO).setDepth(-1).setAlpha(0).setMute(true);
      this.bgVideo.play(true);
      this.bgVideo.once('play', () => {
        const el = (this.bgVideo as unknown as { video: HTMLVideoElement }).video;
        if (el) el.playbackRate = 0.75;
        const scale = Math.max(W / this.bgVideo.width, H / this.bgVideo.height);
        this.bgVideo.setScale(scale);
      });
      this.tweens.add({ targets: this.bgVideo, alpha: 1, duration: 800, ease: 'Sine.easeIn' });
      if (this.bgImage) {
        this.tweens.add({
          targets: this.bgImage, alpha: 0, duration: 800, ease: 'Sine.easeIn',
          onComplete: () => this.bgImage?.destroy(),
        });
      }
    }

    this.add.text(MID_CX, 322, 'YOUR BID', { fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '11px', color: C_GREY, ...S_SM }).setOrigin(0.5);

    const bidText = this.add.text(MID_CX, 362, `$${outcome.bidAmount.toLocaleString()}`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '36px', color: C_GREY,
      ...S_LG,
    }).setOrigin(0.5).setAlpha(0);

    // Clear intel effect outlines — items will reveal their true colours
    this.gridEffectGfx.clear();

    this.setDuckState('think');

    // ── Suspense buildup ──────────────────────────────────────────────────────
    const suspense = this.add.text(MID_CX, H / 2 - 10, 'CRACKING THE SAFE', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '22px', color: C_GREY, letterSpacing: 6,
      ...S_MD,
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
      this.tweens.add({ targets: bidText, alpha: 1, duration: 200 });
      this.playOpenSequence(
        vault.surfaceItems, vault.hasHiddenDoor, vault.hiddenItems,
        outcome,
      );
    });
  }

  private playOpenSequence(
    surfaceItems: VaultItem[],
    hasHiddenDoor: boolean,
    hiddenItems: VaultItem[],
    outcome: SessionOutcome,
  ) {
    const baseDelay = 400;
    const step      = 416; // 320 × 1.3
    let   runTotal  = 0;

    surfaceItems.forEach((item, i) => {
      this.time.delayedCall(baseDelay + i * step, () => {
        const placed = this.mainGridItems[i];
        if (placed) this.revealGridItem(placed);
        const prev = runTotal;
        runTotal += item.value;
        this.countUp(this.totalValueText, prev, runTotal, 300, '$');
      });
    });

    const afterSurface = baseDelay + surfaceItems.length * step;

    // Always open the secret door — reveals chamber contents or shows it's empty
    this.time.delayedCall(afterSurface + 300, () => {
      if (hasHiddenDoor) this.feedbackText.setText('SECRET PASSAGE FOUND!');
      this.openSecretDoor(() => {
        hiddenItems.forEach((item, i) => {
          this.time.delayedCall(i * step, () => {
            const placed = this.secretGridItems[i];
            if (placed) this.revealGridItem(placed);
            const prev = runTotal;
            runTotal += item.value;
            this.countUp(this.totalValueText, prev, runTotal, 300, '$');
          });
        });
      });
    });

    // afterAll: surface + door trigger + full door anim + hidden items (0 if no hidden door)
    const afterAll = afterSurface + 300 + BiddingScene.DOOR_OPEN_MS + hiddenItems.length * step;

    if (outcome.isJackpot) {
      this.time.delayedCall(afterAll + 200, () => this.flashJackpot(outcome.jackpotBonus));
    }

    const endDelay = afterAll + (outcome.isJackpot ? 1500 : 700);
    this.time.delayedCall(endDelay, () => {
      this.showNetResult(outcome);
    });
  }

  // ─── Grid item reveal ─────────────────────────────────────────────────────

  private revealGridItem(placed: PlacedItem) {
    const { x, y, pw, ph } = this.placedRect(placed);

    // Dark tile bg (no tier colour)
    const tileGfx = this.add.graphics().setDepth(4).setAlpha(0);
    tileGfx.fillStyle(0x050510, 0.85).fillRect(x, y, pw, ph);
    if (placed.isHidden) {
      tileGfx.lineStyle(1, 0xffd700, 0.5).strokeRect(x + 1, y + 1, pw - 2, ph - 2);
    }
    this.tweens.add({ targets: tileGfx, alpha: 1, duration: 220, ease: 'Power2' });

    // Item sprite — pick a deterministic variant (0-4) from the tier sheet
    const TIER_SHEET: Record<string, string> = {
      common:    ASSETS.ITEM_SHEET_COMMON,
      uncommon:  ASSETS.ITEM_SHEET_UNCOMMON,
      rare:      ASSETS.ITEM_SHEET_RARE,
      epic:      ASSETS.ITEM_SHEET_EPIC,
      legendary: ASSETS.ITEM_SHEET_LEGENDARY,
    };
    // Frame width = 1536 / 5 = 307 for all tiers
    const FRAME_W = 307;
    const frame = placed.item.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
    const tier  = placed.item.tier;
    // Scale to 115% of cell width — fills cell with slight border bleed, mask clips overflow.
    // Per-tier origin y: tuned to where each sheet's icons sit within the 1024px frame.
    const TIER_ORIGIN_Y: Record<string, number> = {
      common:    0.50,
      uncommon:  0.45,
      rare:      0.45,
      epic:      0.45,
      legendary: 0.45,
    };
    const imgScale = (pw / FRAME_W) * 1.15;
    const itemImg = this.add.image(x + pw / 2, y + ph / 2, TIER_SHEET[tier], frame)
      .setScale(imgScale)
      .setOrigin(0.5, TIER_ORIGIN_Y[tier] ?? 0.38).setDepth(4).setAlpha(0);
    const maskGfx = this.add.graphics().fillStyle(0xffffff).fillRect(x, y, pw, ph);
    itemImg.setMask(maskGfx.createGeometryMask());
    this.tweens.add({ targets: itemImg, alpha: 1, duration: 220, ease: 'Power2' });

    // Value text at bottom of tile
    const fontSize = ph >= 70 ? 13 : 10;
    const price = this.add.text(x + pw / 2, y + ph - 2, `$${placed.item.value.toLocaleString()}`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: `${fontSize}px`,
      color: '#ffffff', stroke: '#000000', strokeThickness: 2, align: 'center',
    }).setOrigin(0.5, 1).setAlpha(0).setDepth(5);
    this.tweens.add({ targets: price, alpha: 1, duration: 200, delay: 140 });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private startVaultScanWave() {
    const scanTop    = GRID_Y_M;
    const scanBottom = GRID_Y_S + GROW_S * GSTEP;
    const scanLeft   = GRID_X - 2;
    const scanRight  = GRID_X + (GCOLS - 1) * GSTEP + GCELL + 2;
    const scanGfx    = this.add.graphics().setDepth(3);
    const obj        = { y: scanTop };

    const runScan = () => {
      obj.y = scanTop;
      this.tweens.add({
        targets: obj, y: scanBottom, duration: 2600, ease: 'Linear',
        onUpdate: () => {
          scanGfx.clear();
          scanGfx.fillStyle(PAL.n.cyan, 0.06)
            .fillRect(scanLeft, obj.y - 5, scanRight - scanLeft, 10);
          scanGfx.lineStyle(1, PAL.n.cyan, 0.28)
            .lineBetween(scanLeft, obj.y, scanRight, obj.y);
        },
        onComplete: () => {
          scanGfx.clear();
          this.time.delayedCall(2200 + Math.random() * 2000, runScan);
        },
      });
    };

    this.time.delayedCall(1800, runScan);
  }

  private emitBurst(x: number, y: number, tints: number[], count: number, upward = false) {
    const em = this.add.particles(x, y, 'pdot', {
      speed:    { min: 80, max: 260 },
      angle:    upward ? { min: -150, max: -30 } : { min: 0, max: 360 },
      scale:    { start: 0.7, end: 0 },
      alpha:    { start: 1, end: 0 },
      tint:     tints,
      lifespan: 750,
      quantity: count,
      emitting: false,
    }).setDepth(22);
    em.explode(count);
    this.time.delayedCall(900, () => em.destroy());
  }

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

  private showNetResult(outcome: SessionOutcome) {
    const prevBalance = parseInt(localStorage.getItem(BALANCE_KEY) ?? String(GAME_CONFIG.startingBalance), 10);
    const newBalance  = prevBalance + outcome.netProfit;
    localStorage.setItem(BALANCE_KEY, String(newBalance));

    const displayProfit = outcome.netProfit - this.vaultTierDef.ante;
    const profit  = displayProfit >= 0;
    const sign    = profit ? '+' : '-';
    const abs     = Math.abs(displayProfit);
    const color   = profit ? PAL.green : PAL.red;
    const colNum  = profit ? PAL.n.green : PAL.n.red;

    this.setDuckState(profit ? 'win' : 'lose');

    // ── YOUR CUT panel ────────────────────────────────────────────────────────
    const popY  = H / 2 - 44;
    const PW    = 270;
    const PH    = 118;
    const panelX = MID_CX - PW / 2;
    const panelY = popY - PH / 2;

    const panel = this.add.graphics().setDepth(24).setAlpha(0);
    panel.fillStyle(0x05040f, 0.96).fillRoundedRect(panelX, panelY, PW, PH, 10);
    panel.lineStyle(10, colNum, 0.07).strokeRoundedRect(panelX, panelY, PW, PH, 10);
    panel.lineStyle(3,  colNum, 0.20).strokeRoundedRect(panelX, panelY, PW, PH, 10);
    panel.lineStyle(1,  colNum, 0.90).strokeRoundedRect(panelX, panelY, PW, PH, 10);
    panel.fillStyle(colNum, 1).fillRect(panelX, panelY, PW, 2);

    this.tweens.add({ targets: panel, alpha: 1, duration: 220 });

    const cutLbl = this.add.text(MID_CX, popY - 24, 'YOUR CUT', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '13px', color: '#ffffff',
      ...S_SM,
    }).setOrigin(0.5).setDepth(25).setAlpha(0);

    const cutAmt = this.add.text(MID_CX, popY + 12, `${sign}$0`, {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '52px', color,
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(25).setAlpha(0);

    this.tweens.add({ targets: [cutLbl, cutAmt], alpha: 1, duration: 220, delay: 100 });
    this.countUp(cutAmt, 0, abs, 900, `${sign}$`);

    const burstTints = profit ? [PAL.n.green, PAL.n.gold, 0xffffff] : [PAL.n.red, PAL.n.purple, 0x888888];
    this.time.delayedCall(920, () => this.emitBurst(MID_CX, popY, burstTints, profit ? 40 : 20));

    this.time.delayedCall(1100, () => {
      this.add.text(MID_CX, H - 38, `BANK: $${newBalance.toLocaleString()}`, {
        fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '12px', color: C_GREY,
        ...S_SM,
      }).setOrigin(0.5);

      const sliderLeft  = LEFT_W + SLIDER_PAD;
      const sliderRight = W - RIGHT_W - SLIDER_PAD;
      const bw = sliderRight - sliderLeft;
      const playImg = this.add.image(MID_CX, H - 43, ASSETS.MAIN_BTN).setDisplaySize(bw, 50).setOrigin(0.5);
      this.add.text(MID_CX, H - 43, 'HIT ANOTHER VAULT', {
        fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '20px', color: C_ACTIVE,
        ...S_MD,
      }).setOrigin(0.5);
      const playHit = this.add.rectangle(MID_CX, H - 43, bw, 50).setInteractive({ useHandCursor: true });
      playHit.on('pointerover',  () => playImg.setTint(0xaaeeff));
      playHit.on('pointerout',   () => playImg.clearTint());
      playHit.on('pointerdown',  () => this.startNewSession());
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
    const t = this.infoLines[slot];
    const targetY = t.y;

    // ── Phase 1: cyan screen flash + banner ──────────────────────────────────
    this.screenFlash(PAL.n.cyan, 0.18, 0);

    const banner = this.add.text(MID_CX, targetY - 18, '◈  CLUE ACQUIRED', {
      fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '11px',
      color: PAL.cyan,
      shadow: { offsetX: 0, offsetY: 0, color: '#00d4ff', blur: 10, fill: true },
      ...SC_SM,
    }).setOrigin(0.5).setAlpha(0).setDepth(26);

    this.tweens.add({
      targets: banner, alpha: 1, duration: 160,
      onComplete: () => {
        this.time.delayedCall(500, () => {
          this.tweens.add({ targets: banner, alpha: 0, duration: 280, onComplete: () => banner.destroy() });
        });
      },
    });

    // ── Phase 2: horizontal scan line sweeps across center panel ────────────
    const panelLeft  = LEFT_W + 4;
    const panelRight = W - RIGHT_W - 4;
    const scanW      = panelRight - panelLeft;
    const scanGfx    = this.add.graphics().setDepth(25);
    const scanObj    = { pct: 0 };
    this.tweens.add({
      targets: scanObj, pct: 1, duration: 320, ease: 'Cubic.easeOut',
      onUpdate: () => {
        scanGfx.clear();
        const w = scanObj.pct * scanW;
        scanGfx.fillStyle(PAL.n.cyan, 0.18).fillRect(panelLeft, targetY - 10, w, 20);
        scanGfx.lineStyle(1, PAL.n.cyan, 0.55).lineBetween(panelLeft + w, targetY - 10, panelLeft + w, targetY + 10);
      },
      onComplete: () => {
        this.tweens.add({
          targets: scanObj, pct: 0, duration: 180,
          onUpdate: () => scanGfx.clear(),
          onComplete: () => scanGfx.destroy(),
        });
      },
    });

    // ── Phase 3 (slight delay): clue text slides in from left with neon glow ─
    this.time.delayedCall(180, () => {
      t.setText(this.formatReveal(reveal))
        .setAlpha(0)
        .setX(panelLeft + 20)
        .setColor(PAL.cyan);

      (t.setStyle as (style: object) => void)({
        fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '24px', color: PAL.cyan,
        shadow: { offsetX: 0, offsetY: 0, color: '#00d4ff', blur: 14, fill: true },
        stroke: '#000000', strokeThickness: 5,
      });

      this.tweens.add({
        targets: t, x: MID_CX, alpha: 1, duration: 280, ease: 'Cubic.easeOut',
        onComplete: () => {
          // Settle: fade glow shadow, switch to white
          this.time.delayedCall(600, () => {
            t.setX(MID_CX).setColor(C_ACTIVE);
            (t.setStyle as (style: object) => void)({
              fontFamily: 'Rajdhani', fontStyle: 'bold', fontSize: '24px', color: C_ACTIVE,
              shadow: { offsetX: 0, offsetY: 0, color: '#00d4ff', blur: 4, fill: true },
              stroke: '#000000', strokeThickness: 5,
            });
          });
        },
      });

      // Particle burst from settled position
      this.time.delayedCall(300, () =>
        this.emitBurst(MID_CX, targetY, [PAL.n.cyan, PAL.n.borderGlow, 0xffffff, PAL.n.gold], 28, true),
      );
    });
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

  // ─── New session ──────────────────────────────────────────────────────────

  private startNewSession() {
    // Return to lobby so the player can choose vault tier again
    this.scene.start('Lobby');
  }
}
