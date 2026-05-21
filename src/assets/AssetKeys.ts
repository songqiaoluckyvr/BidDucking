// Central registry of all asset keys and their file paths.
// Drop the file into public/ at the path shown, then add the load call to BootScene.preload().

export const ASSETS = {
  // ── Backgrounds ───────────────────────────────────────────────────────────
  BG_MAIN:        'bg_main',        // images/backgrounds/background.png
  BG_VIDEO:       'bg_video',       // video/background.mp4

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

  // ── Item tier spritesheets (5 variants per sheet) ─────────────────────────
  ITEM_SHEET_COMMON:    'item_sheet_common',    // images/items/common_items.png
  ITEM_SHEET_UNCOMMON:  'item_sheet_uncommon',  // images/items/uncommon_items.png
  ITEM_SHEET_RARE:      'item_sheet_rare',      // images/items/rare_items.png
  ITEM_SHEET_EPIC:      'item_sheet_epic',      // images/items/epic_items.png
  ITEM_SHEET_LEGENDARY: 'item_sheet_legendary', // images/items/legendary_items.png

  // ── UI ────────────────────────────────────────────────────────────────────
  TITLE:          'title',          // images/ui/title.png
  LOGO:           'logo',           // images/ui/logo.png
  VI_LOGO:        'vi_logo',        // images/ui/VI_logo.png
  BID_COIN:       'bid_coin',       // images/ui/bid_coin.png
  MAIN_BTN:       'main_btn',       // images/ui/main_btn.png
  UI_BORDER:      'ui_border',      // images/ui/ui_border.png
  UI_BTN_2:       'ui_btn_2',       // images/ui/ui_btn_2.png
  EDGE_TITLE:     'edge_title',     // images/ui/edge_title.png
  ITEM_SWEEP_CARD:  'item_sweep_card',  // images/ui/item_sweep_card.png
  RARITY_SCAN_CARD: 'rarity_scan_card', // images/ui/Rarity_Scan_btn.png
  SECRET_BOX_CARD:  'secret_box_card',  // images/ui/secret_box_btn.png
  DUCK_MASCOT:    'duck_mascot',    // images/characters/ducking_main.png
  DUCK_IDLE:      'duck_idle',      // images/animations/ducking_idle.png  (5×2 spritesheet, 10 frames)
  DUCK_STAND:     'duck_stand',     // images/characters/ducking_stand.png
  DUCK_THINK:     'duck_think',     // images/characters/ducking_think.png
  DUCK_WIN:       'duck_win',       // images/characters/ducking_win.png
  DUCK_LOSE:      'duck_lose',      // images/characters/ducking_lose.png

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
