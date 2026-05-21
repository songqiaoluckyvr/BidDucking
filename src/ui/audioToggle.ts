import Phaser from 'phaser';

const MUTE_KEY = 'bidducking_muted';

export function isMuted(): boolean {
  return localStorage.getItem(MUTE_KEY) === '1';
}

/**
 * Adds a speaker icon toggle button at (bx, by).
 * Reads/writes localStorage so the preference persists across scenes.
 */
export function buildAudioToggle(scene: Phaser.Scene, bx: number, by: number, depth = 30) {
  const R = 14;
  let muted = isMuted();

  scene.sound.setMute(muted);

  const g = scene.add.graphics().setDepth(depth - 1);

  const label = scene.add.text(bx, by, muted ? '🔇' : '🔊', {
    fontSize: '15px',
  }).setOrigin(0.5).setDepth(depth);

  const draw = () => {
    g.clear();
    g.fillStyle(0x000000, 0.55).fillCircle(bx, by, R);
    g.lineStyle(1, muted ? 0x666688 : 0x00d4ff, muted ? 0.35 : 0.55).strokeCircle(bx, by, R);
  };
  draw();

  scene.add.circle(bx, by, R)
    .setInteractive({ useHandCursor: true })
    .setDepth(depth + 1)
    .on('pointerover', () => {
      g.clear();
      g.fillStyle(0x001a22, 0.80).fillCircle(bx, by, R);
      g.lineStyle(1, 0x00d4ff, 1).strokeCircle(bx, by, R);
    })
    .on('pointerout', draw)
    .on('pointerdown', () => {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      scene.sound.setMute(muted);
      label.setText(muted ? '🔇' : '🔊');
      draw();
    });
}
