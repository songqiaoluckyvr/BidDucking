import type Phaser from 'phaser';
import { ASSETS } from '@assets/AssetKeys';
import { PAL } from './palette';

const W = 960;
const H = 600;

/**
 * Adds the background to a scene.
 * Uses bg_main image when loaded; falls back to the solid colour + grid.
 */
export function addBackground(scene: Phaser.Scene): void {
  if (scene.textures.exists(ASSETS.BG_MAIN)) {
    scene.add.image(W / 2, H / 2, ASSETS.BG_MAIN).setDisplaySize(W, H);
  } else {
    scene.add.rectangle(W / 2, H / 2, W, H, PAL.bg);
    const g = scene.add.graphics();
    g.lineStyle(1, PAL.n.border, 0.2);
    for (let x = 0; x <= W; x += 60) g.lineBetween(x, 0, x, H);
    for (let y = 0; y <= H; y += 60) g.lineBetween(0, y, W, y);
  }
}
