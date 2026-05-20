// Central registry of all asset keys and their file paths.
// Drop the file into public/ at the path shown, then add the load call to BootScene.preload().

export const ASSETS = {
  // ── Backgrounds ───────────────────────────────────────────────────────────
  BG_MAIN:        'bg_main',        // images/backgrounds/background.png

  // ── Vault sprites (generated in BootScene until real art is ready) ────────
  VAULT_BODY:     'vault_body',     // images/vault/vault_body.png
  VAULT_DOOR:     'vault_door',     // images/vault/vault_door.png
  VAULT_DIAL:     'vault_dial',     // images/vault/vault_dial.png

  // ── Item tier icons (generated until real art is ready) ───────────────────
  ITEM_GARBAGE:   'item_garbage',   // images/items/item_garbage.png
  ITEM_COMMON:    'item_common',    // images/items/item_common.png
  ITEM_RARE:      'item_rare',      // images/items/item_rare.png
  ITEM_EPIC:      'item_epic',      // images/items/item_epic.png
  ITEM_LEGENDARY: 'item_legendary', // images/items/item_legendary.png
  ITEM_ANCIENT:   'item_ancient',   // images/items/item_ancient.png

  // ── UI ────────────────────────────────────────────────────────────────────
  TITLE:          'title',          // images/ui/title.png
  LOGO:           'logo',           // images/ui/logo.png
  DUCK_MASCOT:    'duck_mascot',    // images/characters/ducking_main.png
  DUCK_IDLE:      'duck_idle',      // images/animations/ducking_idle.png  (5×2 spritesheet, 10 frames)

  // ── Audio — SFX ──────────────────────────────────────────────────────────
  SFX_BID:        'sfx_bid',        // audio/sfx/bid_submit.mp3
  SFX_VAULT_OPEN: 'sfx_vault_open', // audio/sfx/vault_open.mp3
  SFX_ITEM:       'sfx_item',       // audio/sfx/item_reveal.mp3
  SFX_JACKPOT:    'sfx_jackpot',    // audio/sfx/jackpot.mp3
  SFX_WIN:        'sfx_win',        // audio/sfx/win.mp3
  SFX_LOSE:       'sfx_lose',       // audio/sfx/lose.mp3

  // ── Audio — Music ─────────────────────────────────────────────────────────
  BGM_LOBBY:      'bgm_lobby',      // audio/music/lobby.mp3
  BGM_BIDDING:    'bgm_bidding',    // audio/music/bidding.mp3
} as const;

export type AssetKey = typeof ASSETS[keyof typeof ASSETS];
