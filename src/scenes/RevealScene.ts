import Phaser from 'phaser';
import type { SessionManager } from '@game/SessionManager';
import type { SessionOutcome, VaultItem } from '@game/types';

interface RevealData { session: SessionManager; }

const W = 960;
const H = 600;

const COL = {
  bg:     0x0a0a0f,
  panel:  0x12121a,
  border: 0x2a2a3a,
  gold:   '#ffd700',
  white:  '#ffffff',
  dim:    '#6b7280',
  green:  '#86efac',
  red:    '#f87171',
  purple: '#a78bfa',
};

// Vault centered in canvas
const VAULT_CX = 480;
const VAULT_CY = 270;

// vault_body is 220×300 — interior usable area after door opens:
// x: VAULT_CX ± 88,  y: VAULT_CY - 125 to VAULT_CY + 125
const INTERIOR_TOP  = VAULT_CY - 118;
const INTERIOR_LEFT = VAULT_CX - 84;

// Item cards inside vault — 3 columns, 50 px icons
const ITEM_COLS     = 3;
const ITEM_ICON     = 50;
const ITEM_CELL_W   = 56;   // icon + gap
const ITEM_CELL_H   = 72;   // icon + price text + gap

export class RevealScene extends Phaser.Scene {
  private session!: SessionManager;

  constructor() { super({ key: 'Reveal' }); }

  create(data: RevealData) {
    this.session = data.session;
    const outcome = this.session.getSessionOutcome();
    const state   = this.session.getSessionState();
    const vault   = state.vault;

    // ── background ────────────────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H, COL.bg);

    // ── left info panel ───────────────────────────────────────────────────────
    const gLeft = this.add.graphics();
    gLeft.fillStyle(COL.panel, 1).fillRect(0, 0, 260, H);
    gLeft.lineStyle(1, COL.border, 1).strokeRect(0, 0, 260, H);

    this.add.text(130, 22, 'VAULT OPENED', {
      fontSize: '15px', color: COL.gold, fontStyle: 'bold',
    }).setOrigin(0.5);

    const sm = { fontSize: '12px', color: COL.dim };
    let infoY = 52;
    this.add.text(130, infoY, `Bid:  $${outcome.bidAmount.toLocaleString()}`,  sm).setOrigin(0.5); infoY += 18;
    this.add.text(130, infoY, `Ante: -$${state.antePaid.toLocaleString()}`,    sm).setOrigin(0.5); infoY += 18;
    if (state.intelCost > 0) {
      this.add.text(130, infoY, `Intel: -$${state.intelCost.toLocaleString()}`, sm).setOrigin(0.5); infoY += 18;
    }

    gLeft.lineStyle(1, COL.border, 1).lineBetween(10, infoY + 6, 250, infoY + 6);
    infoY += 20;

    this.add.text(130, infoY, 'ITEMS FOUND', { fontSize: '11px', color: COL.dim }).setOrigin(0.5);
    infoY += 24;
    const runningText = this.add.text(130, infoY, '$0', {
      fontSize: '28px', color: COL.white, fontStyle: 'bold',
    }).setOrigin(0.5);

    // Net result (shown at end)
    const netLabel  = this.add.text(130, H - 78, '',  { fontSize: '12px', color: COL.dim }).setOrigin(0.5).setAlpha(0);
    const netResult = this.add.text(130, H - 50, '',  { fontSize: '26px', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0);

    // ── right info panel ──────────────────────────────────────────────────────
    const gRight = this.add.graphics();
    gRight.fillStyle(COL.panel, 1).fillRect(W - 230, 0, 230, H);
    gRight.lineStyle(1, COL.border, 1).strokeRect(W - 230, 0, 230, H);

    const rcx = W - 115;
    this.add.text(rcx, 22, 'THE VAULT', { fontSize: '15px', color: COL.gold, fontStyle: 'bold' }).setOrigin(0.5);

    const hiddenLabel = this.add.text(rcx, H - 28, '[ ? HIDDEN DOOR ? ]', {
      fontSize: '10px', color: COL.dim,
    }).setOrigin(0.5);

    // Continue button
    const continueBtn = this.add.text(rcx, H - 50, '[ SEE RESULTS ]', {
      fontSize: '16px', color: COL.gold, fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true });
    continueBtn.on('pointerover', () => continueBtn.setColor(COL.white));
    continueBtn.on('pointerout',  () => continueBtn.setColor(COL.gold));
    continueBtn.on('pointerdown', () => this.scene.start('Results', { session: this.session }));

    // ── vault sprites (centered) ──────────────────────────────────────────────
    this.add.image(VAULT_CX, VAULT_CY, 'vault_body').setOrigin(0.5);

    // Door: origin left-edge so scaleX→0 swings it open from left hinge
    const doorLeftX = VAULT_CX - 94;
    const vaultDoor = this.add.image(doorLeftX, VAULT_CY - 8, 'vault_door').setOrigin(0, 0.5);

    const vaultDial = this.add.image(VAULT_CX, VAULT_CY - 20, 'vault_dial').setOrigin(0.5);

    const statusText = this.add.text(VAULT_CX, VAULT_CY + 168, 'SEALED', {
      fontSize: '13px', color: COL.dim, fontStyle: 'bold',
    }).setOrigin(0.5);

    // ── run the sequence ──────────────────────────────────────────────────────
    this.playOpenSequence(
      vault.surfaceItems, vault.hasHiddenDoor, vault.hiddenItems,
      outcome, vaultDial, vaultDoor, statusText,
      runningText, hiddenLabel, netLabel, netResult, continueBtn,
    );
  }

  // ─── Sequence orchestrator ────────────────────────────────────────────────

  private playOpenSequence(
    surfaceItems:   VaultItem[],
    hasHiddenDoor:  boolean,
    hiddenItems:    VaultItem[],
    outcome:        SessionOutcome,
    dial:           Phaser.GameObjects.Image,
    door:           Phaser.GameObjects.Image,
    statusText:     Phaser.GameObjects.Text,
    runningText:    Phaser.GameObjects.Text,
    hiddenLabel:    Phaser.GameObjects.Text,
    netLabel:       Phaser.GameObjects.Text,
    netResult:      Phaser.GameObjects.Text,
    continueBtn:    Phaser.GameObjects.Text,
  ) {
    // t=0 — fast dial spin (4 full rotations, ease-out)
    this.tweens.add({
      targets: dial,
      rotation: Math.PI * 8,
      duration: 1800,
      ease: 'Cubic.easeOut',
    });
    statusText.setText('OPENING...');

    // t=1900 — door swings open (scaleX 1→0 from left origin)
    this.time.delayedCall(1900, () => {
      this.tweens.add({
        targets: door,
        scaleX: 0,
        duration: 650,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          door.setVisible(false);
          statusText.setText('OPEN').setColor(COL.green);
        },
      });
    });

    // t=2650 — items reveal one by one inside vault
    const baseDelay = 2650;
    const step      = 450;
    let   runTotal  = 0;

    surfaceItems.forEach((item, i) => {
      this.time.delayedCall(baseDelay + i * step, () => {
        runTotal += item.value;
        this.spawnItemCard(item, i, false);
        this.countUp(runningText, runTotal - item.value, runTotal, 380, '$');
      });
    });

    const afterSurface = baseDelay + surfaceItems.length * step;

    // Hidden door sequence
    if (hasHiddenDoor) {
      this.time.delayedCall(afterSurface + 300, () => {
        statusText.setText('HIDDEN DOOR!').setColor(COL.purple);
        hiddenLabel.setText('[ HIDDEN DOOR FOUND ]').setColor(COL.purple);
        this.screenFlash(0x4a0080, 0.22, 3);
      });

      hiddenItems.forEach((item, i) => {
        const idx = surfaceItems.length + i;
        this.time.delayedCall(afterSurface + 750 + i * step, () => {
          runTotal += item.value;
          this.spawnItemCard(item, idx, true);
          this.countUp(runningText, runTotal - item.value, runTotal, 380, '$');
        });
      });
    }

    const afterAll = hasHiddenDoor
      ? afterSurface + 750 + hiddenItems.length * step
      : afterSurface;

    // Jackpot flash
    if (outcome.isJackpot) {
      this.time.delayedCall(afterAll + 200, () => this.flashJackpot(outcome.jackpotBonus));
    }

    // Net result
    const endDelay = afterAll + (outcome.isJackpot ? 1500 : 600);
    this.time.delayedCall(endDelay, () => {
      this.showNetResult(outcome, netLabel, netResult, continueBtn);
    });
  }

  // ─── Item card — appears inside vault opening ─────────────────────────────

  private spawnItemCard(item: VaultItem, idx: number, isHidden: boolean) {
    const col = idx % ITEM_COLS;
    const row = Math.floor(idx / ITEM_COLS);

    // Center the grid within the vault interior
    const gridWidth = ITEM_COLS * ITEM_CELL_W - (ITEM_CELL_W - ITEM_ICON);
    const x = INTERIOR_LEFT + (188 - gridWidth) / 2 + col * ITEM_CELL_W + ITEM_ICON / 2;
    const y = INTERIOR_TOP + row * ITEM_CELL_H + ITEM_ICON / 2;

    const icon = this.add.image(x, y, `item_${item.tier}`)
      .setOrigin(0.5)
      .setDisplaySize(ITEM_ICON, ITEM_ICON)
      .setScale(0)
      .setAlpha(0);

    if (isHidden) icon.setTint(0xffd700);

    this.tweens.add({
      targets: icon,
      scale: 1,
      alpha: 1,
      duration: 260,
      ease: 'Back.easeOut',
    });

    const priceText = this.add.text(x, y + ITEM_ICON / 2 + 10, '$0', {
      fontSize: '11px', color: item.tierDef.frameColor, fontStyle: 'bold', align: 'center',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: priceText, alpha: 1, duration: 200, delay: 150 });
    this.countUp(priceText, 0, item.value, 280, '$');
  }

  // ─── Numeric count-up ─────────────────────────────────────────────────────

  private countUp(
    target: Phaser.GameObjects.Text,
    from: number,
    to: number,
    duration: number,
    prefix: string,
  ) {
    const counter = { value: from };
    this.tweens.add({
      targets: counter,
      value: to,
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: () => target.setText(`${prefix}${Math.round(counter.value).toLocaleString()}`),
    });
  }

  // ─── Screen flash ─────────────────────────────────────────────────────────

  private screenFlash(color: number, alpha: number, repeats: number) {
    const flash = this.add.rectangle(W / 2, H / 2, W, H, color, 0).setDepth(20);
    this.tweens.add({
      targets: flash,
      alpha,
      duration: 180,
      yoyo: true,
      repeat: repeats,
      onComplete: () => flash.destroy(),
    });
  }

  // ─── Jackpot burst ────────────────────────────────────────────────────────

  private flashJackpot(bonus: number) {
    this.screenFlash(0xffd700, 0.4, 3);

    const jp = this.add.text(VAULT_CX, VAULT_CY, `JACKPOT!\n+$${bonus.toLocaleString()}`, {
      fontSize: '32px', color: COL.gold, fontStyle: 'bold', align: 'center',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setScale(0).setDepth(21);

    this.tweens.add({ targets: jp, scale: 1, duration: 380, ease: 'Back.easeOut' });
    this.time.delayedCall(1100, () => {
      this.tweens.add({ targets: jp, alpha: 0, duration: 300, onComplete: () => jp.destroy() });
    });
  }

  // ─── Net result reveal ────────────────────────────────────────────────────

  private showNetResult(
    outcome:     SessionOutcome,
    netLabel:    Phaser.GameObjects.Text,
    netResult:   Phaser.GameObjects.Text,
    continueBtn: Phaser.GameObjects.Text,
  ) {
    const profit = outcome.netProfit >= 0;
    const color  = profit ? COL.green : COL.red;
    const sign   = profit ? '+' : '-';
    const abs    = Math.abs(outcome.netProfit);

    netLabel.setText('NET RESULT').setAlpha(1);
    netResult.setColor(color).setText(`${sign}$0`).setAlpha(1);
    this.countUp(netResult, 0, abs, 900, `${sign}$`);

    this.tweens.add({ targets: continueBtn, alpha: 1, duration: 400, delay: 1100 });
  }
}
