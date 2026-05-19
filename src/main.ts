import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LobbyScene } from './scenes/LobbyScene';
import { IntelShopScene } from './scenes/IntelShopScene';
import { BiddingScene } from './scenes/BiddingScene';
import { RevealScene } from './scenes/RevealScene';
import { ResultsScene } from './scenes/ResultsScene';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 600,
  backgroundColor: '#0a0a0f',
  scene: [BootScene, LobbyScene, IntelShopScene, BiddingScene, RevealScene, ResultsScene],
  parent: document.body,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
