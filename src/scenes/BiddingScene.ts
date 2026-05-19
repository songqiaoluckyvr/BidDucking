import Phaser from 'phaser';
import type { SessionManager } from '@game/SessionManager';
import type { IntelResult, RevealResult } from '@game/types';
import { RARITY_BAND_CONFIG } from '@config/GameConfig';
import { ROUND_CONFIG } from '@config/RoundConfig';

interface BiddingData { session: SessionManager; intelResult: IntelResult | null; }

// Layout constants
const LEFT_W   = 280;  // bid panel
const RIGHT_W  = 300;  // vault panel
const W        = 960;
const H        = 600;
const CENTER_X = LEFT_W + (W - LEFT_W - RIGHT_W) / 2;

// Colour palette
const COL = {
  bg:        0x0a0a0f,
  panel:     0x12121a,
  border:    0x2a2a3a,
  gold:      '#ffd700',
  white:     '#ffffff',
  dim:       '#6b7280',
  tooHigh:   '#f87171',
  tooLow:    '#60a5fa',
  accepted:  '#86efac',
  reveal:    '#67e8f9',
  vaultBg:   0x0f1a2e,
  vaultBorder: 0x3b4a6b,
};

export class BiddingScene extends Phaser.Scene {
  private session!: SessionManager;
  private bidInput = '';

  // Left panel elements
  private roundLabel!: Phaser.GameObjects.Text;
  private roundName!: Phaser.GameObjects.Text;
  private inputDisplay!: Phaser.GameObjects.Text;
  private submitBtn!: Phaser.GameObjects.Text;
  private bidHistoryTexts: Phaser.GameObjects.Text[] = [];

  // Center panel elements
  private infoLines: Phaser.GameObjects.Text[] = [];
  private feedbackBanner!: Phaser.GameObjects.Text;


  constructor() { super({ key: 'Bidding' }); }

  create(data: BiddingData) {
    this.session = data.session;
    this.bidInput = '';
    this.bidHistoryTexts = [];
    this.infoLines = [];

    this.drawPanels();
    this.buildLeftPanel();
    this.buildCenterPanel(data.intelResult);
    this.buildRightPanel();
    this.setupKeyboard();
  }

  // ─── Panel backgrounds ─────────────────────────────────────────────────────

  private drawPanels() {
    const g = this.add.graphics();

    // Left panel
    g.fillStyle(COL.panel).fillRect(0, 0, LEFT_W, H);
    g.lineStyle(1, COL.border).strokeRect(0, 0, LEFT_W, H);

    // Right panel
    g.fillStyle(COL.panel).fillRect(W - RIGHT_W, 0, RIGHT_W, H);
    g.lineStyle(1, COL.border).strokeRect(W - RIGHT_W, 0, RIGHT_W, H);

    // Divider lines
    g.lineStyle(1, COL.border);
    g.lineBetween(LEFT_W, 0, LEFT_W, H);
    g.lineBetween(W - RIGHT_W, 0, W - RIGHT_W, H);
  }

  // ─── Left panel — bid interface ────────────────────────────────────────────

  private buildLeftPanel() {
    const cx = LEFT_W / 2;
    const state = this.session.getSessionState();
    const round = state.currentRound;

    // Title
    this.add.text(cx, 22, 'BID DUCKING', { fontSize: '20px', color: COL.gold, fontStyle: 'bold' }).setOrigin(0.5);

    // Round indicator
    this.roundLabel = this.add.text(cx, 52, `ROUND ${round} / 5`, {
      fontSize: '13px', color: COL.dim,
    }).setOrigin(0.5);

    this.roundName = this.add.text(cx, 70, ROUND_CONFIG[round].name.toUpperCase(), {
      fontSize: '11px', color: COL.dim,
    }).setOrigin(0.5);

    // Divider
    this.add.graphics().lineStyle(1, COL.border).lineBetween(10, 86, LEFT_W - 10, 86);

    // Bid history label
    this.add.text(10, 96, 'BID HISTORY', { fontSize: '10px', color: COL.dim }).setOrigin(0, 0.5);

    // Bid history rows (populated on each rejection)
    // Reserved space: rows at y=112, 132, 152, 172, 192
    for (let i = 0; i < 5; i++) {
      const t = this.add.text(cx, 112 + i * 22, '', { fontSize: '13px', color: COL.dim }).setOrigin(0.5);
      this.bidHistoryTexts.push(t);
    }

    // Divider
    this.add.graphics().lineStyle(1, COL.border).lineBetween(10, 230, LEFT_W - 10, 230);

    // Bid input label
    this.add.text(cx, 248, 'YOUR BID', { fontSize: '11px', color: COL.dim }).setOrigin(0.5);

    // Dollar sign + input display
    this.add.text(20, 278, '$', { fontSize: '32px', color: COL.gold, fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.inputDisplay = this.add.text(45, 278, '___', {
      fontSize: '32px', color: COL.white, fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // Input border
    const ib = this.add.graphics();
    ib.lineStyle(1, 0x3b4a6b).strokeRect(12, 258, LEFT_W - 24, 42);

    // Submit button
    this.submitBtn = this.add.text(cx, 340, '[ SUBMIT BID ]', {
      fontSize: '18px', color: COL.gold, fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.submitBtn.on('pointerover', () => this.submitBtn.setColor(COL.white));
    this.submitBtn.on('pointerout',  () => this.submitBtn.setColor(COL.gold));
    this.submitBtn.on('pointerdown', () => this.submitBid());

    // Ante / balance reminder
    const s = this.session.getSessionState();
    this.add.text(cx, H - 40, `Ante paid: $${s.antePaid.toLocaleString()}`, {
      fontSize: '11px', color: COL.dim,
    }).setOrigin(0.5);
    if (s.intelCost > 0) {
      this.add.text(cx, H - 24, `Intel paid: $${s.intelCost.toLocaleString()}`, {
        fontSize: '11px', color: COL.dim,
      }).setOrigin(0.5);
    }
  }

  // ─── Center panel — info & reveals ────────────────────────────────────────

  private buildCenterPanel(intelResult: IntelResult | null) {
    const state = this.session.getSessionState();
    const vault = state.vault;
    const band = RARITY_BAND_CONFIG[vault.rarityBand];

    // Vault rarity label
    this.add.text(CENTER_X, 28, band.label.toUpperCase() + ' VAULT', {
      fontSize: '22px', color: COL.gold, fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(CENTER_X, 54, 'Inspect carefully. Bid wisely.', {
      fontSize: '12px', color: COL.dim,
    }).setOrigin(0.5);

    this.add.graphics().lineStyle(1, COL.border).lineBetween(LEFT_W + 10, 68, W - RIGHT_W - 10, 68);

    // Intel result (if purchased)
    let y = 82;
    if (intelResult) {
      this.add.text(CENTER_X, y, '── INTEL REPORT ──', { fontSize: '11px', color: '#a78bfa' }).setOrigin(0.5);
      y += 18;
      this.add.text(CENTER_X, y, this.formatIntel(intelResult), {
        fontSize: '13px', color: '#c4b5fd', align: 'center', wordWrap: { width: W - LEFT_W - RIGHT_W - 20 },
      }).setOrigin(0.5);
      y += 36;
      this.add.graphics().lineStyle(1, COL.border).lineBetween(LEFT_W + 10, y, W - RIGHT_W - 10, y);
      y += 12;
    }

    // Feedback banner (updated on each bid result)
    this.feedbackBanner = this.add.text(CENTER_X, y + 10, '', {
      fontSize: '20px', color: COL.tooHigh, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5);

    // Reveal info lines (stacked below feedback)
    this.add.text(CENTER_X, y + 40, '── VAULT INTEL ──', { fontSize: '11px', color: COL.dim }).setOrigin(0.5);

    for (let i = 0; i < 5; i++) {
      const t = this.add.text(CENTER_X, y + 60 + i * 28, '', {
        fontSize: '13px', color: COL.reveal, align: 'center', wordWrap: { width: W - LEFT_W - RIGHT_W - 20 },
      }).setOrigin(0.5);
      this.infoLines.push(t);
    }
  }

  // ─── Right panel — vault ───────────────────────────────────────────────────

  private buildRightPanel() {
    const rx = W - RIGHT_W;
    const cx = rx + RIGHT_W / 2;

    this.add.text(cx, 22, 'THE VAULT', { fontSize: '16px', color: COL.gold, fontStyle: 'bold' }).setOrigin(0.5);

    // Vault body
    this.add.image(cx, 200, 'vault_body').setOrigin(0.5);

    // Vault door (overlaid on body)
    this.add.image(cx, 200, 'vault_door').setOrigin(0.5);

    // Vault dial (static — no idle rotation during bidding)
    this.add.image(cx, 190, 'vault_dial').setOrigin(0.5);

    // SEALED label
    this.add.text(cx, 348, 'SEALED', { fontSize: '11px', color: COL.dim, fontStyle: 'bold' }).setOrigin(0.5);

    this.add.text(cx, H - 28, '[ ? HIDDEN DOOR ? ]', {
      fontSize: '10px', color: COL.dim,
    }).setOrigin(0.5);
  }

  // ─── Keyboard input ────────────────────────────────────────────────────────

  private setupKeyboard() {
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (this.bidInput.length < 8) this.bidInput += e.key;
      } else if (e.key === 'Backspace') {
        this.bidInput = this.bidInput.slice(0, -1);
      } else if (e.key === 'Enter') {
        this.submitBid(); return;
      }
      const n = parseInt(this.bidInput || '0', 10);
      this.inputDisplay.setText(this.bidInput ? n.toLocaleString() : '___');
    });
  }

  // ─── Bid submission ────────────────────────────────────────────────────────

  private submitBid() {
    const amount = parseInt(this.bidInput, 10);
    if (!amount || amount <= 0) {
      this.feedbackBanner.setText('Enter a valid amount').setColor(COL.tooHigh);
      return;
    }

    const result = this.session.submitBid(amount);

    if (result.accepted) {
      this.scene.start('Reveal', { session: this.session });
      return;
    }

    // Show HIGH / LOW feedback
    const direction = result.bidDirection === 'tooHigh' ? '▲  TOO HIGH' : '▼  TOO LOW';
    const color = result.bidDirection === 'tooHigh' ? COL.tooHigh : COL.tooLow;
    this.feedbackBanner.setText(direction).setColor(color);

    // Add to bid history
    const round = this.session.getSessionState().currentRound - 1;
    const histIdx = round - 1;
    if (histIdx >= 0 && histIdx < this.bidHistoryTexts.length) {
      const label = result.bidDirection === 'tooHigh' ? '▲' : '▼';
      this.bidHistoryTexts[histIdx]
        .setText(`R${round}  $${amount.toLocaleString()}  ${label}`)
        .setColor(color);
    }

    // Clear input
    this.bidInput = '';
    this.inputDisplay.setText('___');

    // Update round labels
    const newRound = this.session.getCurrentRound();
    this.roundLabel.setText(`ROUND ${newRound} / 5`);
    this.roundName.setText(ROUND_CONFIG[newRound].name.toUpperCase());

    // Show reveal
    if (result.revealResult) this.appendReveal(result.revealResult);

    if (result.sessionComplete) {
      this.time.delayedCall(1200, () => this.scene.start('Reveal', { session: this.session }));
    }
  }

  // ─── Reveal rendering ──────────────────────────────────────────────────────

  private appendReveal(reveal: RevealResult) {
    const nextSlot = this.infoLines.findIndex(t => t.text === '');
    if (nextSlot === -1) return;
    this.infoLines[nextSlot].setText(this.formatReveal(reveal));
  }

  private formatReveal(reveal: RevealResult): string {
    const d = reveal.displayData as Record<string, unknown>;
    switch (reveal.revealId) {
      case 'quickPeek': {
        const anchor = d['hasDominantAnchor'] ? ' — one large anchor item' : '';
        return `👁  ~${d['itemCount']} items visible${anchor}`;
      }
      case 'itemTally': {
        const stat = d['statShown'] as string;
        const val  = d['value'] as number;
        if (stat === 'total')     return `📦  Total items: ${val}`;
        if (stat === 'highValue') return `💎  High-value items: ${val}`;
        return `🗑  Low-value items: ${val}`;
      }
      case 'topItemValue':
        return `🏆  Top item worth: $${(d['topItemValue'] as number).toLocaleString()}`;
      case 'digitReveal':
        return `🔢  Value hint: ${d['formattedHint']}`;
      default:
        return JSON.stringify(d);
    }
  }

  // ─── Intel formatting ──────────────────────────────────────────────────────

  private formatIntel(result: IntelResult): string {
    const d = result.displayData as Record<string, unknown>;
    switch (result.intelId) {
      case 'tierScan':
        return `${d['totalItems']} items total · ${d['highValueCount']} high-value · ${d['lowValueCount']} low-value`;
      case 'valueBand':
        return `Value range: $${(d['lowerBound'] as number).toLocaleString()} – $${(d['upperBound'] as number).toLocaleString()}`;
      case 'doorSignal':
        return d['hasHiddenDoor'] ? '🚪 Hidden door signal detected' : '🔒 No hidden door signal';
      case 'topItemPeek':
        return `Top item worth: $${(d['topItemValue'] as number).toLocaleString()}`;
      case 'digitPeek':
        return `Value hint: ${d['formattedHint']}`;
      default:
        return JSON.stringify(d);
    }
  }
}
