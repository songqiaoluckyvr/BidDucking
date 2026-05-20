import Phaser from 'phaser';
import { BootScene }    from './scenes/BootScene';
import { LobbyScene }   from './scenes/LobbyScene';
import { BiddingScene } from './scenes/BiddingScene';

const startGame = () => new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 600,
  backgroundColor: '#05040f',
  scene: [BootScene, LobbyScene, BiddingScene],
  parent: document.body,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

document.fonts.load('700 1em Rajdhani').then(startGame).catch(startGame);
