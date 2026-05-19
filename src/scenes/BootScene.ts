import Phaser from 'phaser';
import { TIER_CONFIG } from '@config/TierConfig';

const ICON_SIZE = 72;

export class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'Boot' }); }

  preload() { /* real assets loaded here later */ }

  create() {
    this.generateItemTextures();
    this.generateVaultTextures();
    this.scene.start('Lobby');
  }

  // ── Item tier placeholder textures ─────────────────────────────────────────

  private generateItemTextures() {
    Object.values(TIER_CONFIG).forEach(def => {
      const key = `item_${def.tier}`;
      if (this.textures.exists(key)) return;

      const g = this.make.graphics({ add: false } as never);
      const col = Phaser.Display.Color.HexStringToColor(def.frameColor).color;

      // Dark background
      g.fillStyle(0x0d0d18, 1);
      g.fillRoundedRect(0, 0, ICON_SIZE, ICON_SIZE, 6);

      // Tier-coloured border glow (outer)
      g.lineStyle(4, col, 0.4);
      g.strokeRoundedRect(0, 0, ICON_SIZE, ICON_SIZE, 6);

      // Tier-coloured border (inner, sharp)
      g.lineStyle(2, col, 1);
      g.strokeRoundedRect(3, 3, ICON_SIZE - 6, ICON_SIZE - 6, 4);

      // Corner accents
      g.fillStyle(col, 0.8);
      [[6, 6], [ICON_SIZE - 14, 6], [6, ICON_SIZE - 14], [ICON_SIZE - 14, ICON_SIZE - 14]].forEach(([x, y]) => {
        g.fillRect(x, y, 8, 8);
      });

      // Inner icon placeholder — tier-colored diamond
      const cx = ICON_SIZE / 2;
      const cy = ICON_SIZE / 2;
      const r = 18;
      g.fillStyle(col, 0.15);
      g.fillTriangle(cx, cy - r, cx + r, cy, cx, cy + r);
      g.fillTriangle(cx, cy - r, cx - r, cy, cx, cy + r);

      g.generateTexture(key, ICON_SIZE, ICON_SIZE);
      g.destroy();
    });
  }

  // ── Vault textures ─────────────────────────────────────────────────────────

  private generateVaultTextures() {
    // Vault body (static frame) — 220 × 300
    if (!this.textures.exists('vault_body')) {
      const g = this.make.graphics({ add: false } as never);
      const w = 220; const h = 300;

      g.fillStyle(0x0f1a2e, 1);
      g.fillRoundedRect(0, 0, w, h, 10);
      g.lineStyle(3, 0x3b4a6b, 1);
      g.strokeRoundedRect(0, 0, w, h, 10);

      // Bolt corners
      g.fillStyle(0x3b4a6b, 1);
      [[12, 12], [w - 22, 12], [12, h - 22], [w - 22, h - 22]].forEach(([x, y]) => {
        g.fillCircle(x, y, 7);
        g.lineStyle(1, 0x1e2d4a);
        g.strokeCircle(x, y, 7);
      });

      // Hinge plates
      g.fillStyle(0x2a3a5a, 1);
      g.fillRect(8, 55, 18, 12);
      g.fillRect(8, h - 67, 18, 12);

      g.generateTexture('vault_body', w, h);
      g.destroy();
    }

    // Vault door (separate — will be tweened on reveal)
    if (!this.textures.exists('vault_door')) {
      const g = this.make.graphics({ add: false } as never);
      const w = 188; const h = 270;

      g.fillStyle(0x1a2a42, 1);
      g.fillRoundedRect(0, 0, w, h, 6);
      g.lineStyle(2, 0x2a3d5e, 1);
      g.strokeRoundedRect(0, 0, w, h, 6);

      // Horizontal ribs
      for (let i = 1; i < 5; i++) {
        const y = (h / 5) * i;
        g.lineStyle(1, 0x1e3050, 1);
        g.lineBetween(10, y, w - 10, y);
      }

      g.generateTexture('vault_door', w, h);
      g.destroy();
    }

    // Vault dial (separate — rotated by tween)
    if (!this.textures.exists('vault_dial')) {
      const size = 120;
      const g = this.make.graphics({ add: false } as never);
      const cx = size / 2; const cy = size / 2; const r = 54;

      // Outer ring
      g.lineStyle(5, 0x4a6a9b, 1);
      g.strokeCircle(cx, cy, r);
      g.lineStyle(2, 0x2a3d5e, 1);
      g.strokeCircle(cx, cy, r - 10);

      // Spokes
      g.lineStyle(2, 0x3a5a8b, 1);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        g.lineBetween(
          cx + Math.cos(angle) * (r - 18), cy + Math.sin(angle) * (r - 18),
          cx + Math.cos(angle) * (r - 2),  cy + Math.sin(angle) * (r - 2),
        );
      }

      // Tick marks
      g.lineStyle(3, 0x5a7aab, 1);
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const inner = i % 3 === 0 ? r - 14 : r - 8;
        g.lineBetween(
          cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner,
          cx + Math.cos(angle) * r,     cy + Math.sin(angle) * r,
        );
      }

      // Knob (top marker)
      g.fillStyle(0x6a8abb, 1);
      g.fillCircle(cx, cy - r + 6, 5);

      // Center hub
      g.fillStyle(0x3a5a8b, 1);
      g.fillCircle(cx, cy, 12);
      g.lineStyle(2, 0x5a7aab, 1);
      g.strokeCircle(cx, cy, 12);
      g.fillStyle(0x6a8abb, 1);
      g.fillCircle(cx, cy, 5);

      g.generateTexture('vault_dial', size, size);
      g.destroy();
    }
  }
}
