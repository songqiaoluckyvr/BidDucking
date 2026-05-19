export const AssetKeys = {
  // Vault states
  VAULT_SEALED:   'vault_sealed',
  VAULT_CRACKED:  'vault_cracked',
  VAULT_OPEN:     'vault_open',
  VAULT_DOOR:     'vault_door',

  // Lucky Duck
  LUCKY_DUCK_IDLE:      'lucky_duck_idle',
  LUCKY_DUCK_HAPPY:     'lucky_duck_happy',
  LUCKY_DUCK_SAD:       'lucky_duck_sad',
  LUCKY_DUCK_SHOCKED:   'lucky_duck_shocked',
  LUCKY_DUCK_CELEBRATE: 'lucky_duck_celebrate',

  // Item frames (one per tier)
  FRAME_GARBAGE:   'frame_garbage',
  FRAME_COMMON:    'frame_common',
  FRAME_RARE:      'frame_rare',
  FRAME_EPIC:      'frame_epic',
  FRAME_LEGENDARY: 'frame_legendary',
  FRAME_ANCIENT:   'frame_ancient',

  // UI
  CHIP_STACK:    'chip_stack',
  SCANNER_SWEEP: 'scanner_sweep',
  COIN_SHOWER:   'coin_shower',

  // Audio
  SFX_ANTE:          'sfx_ante',
  SFX_INTEL:         'sfx_intel',
  SFX_BID_ACCEPT:    'sfx_bid_accept',
  SFX_BID_REJECT:    'sfx_bid_reject',
  SFX_ITEM_REVEAL:   'sfx_item_reveal',
  SFX_DOOR_OPEN:     'sfx_door_open',
  SFX_DOOR_EMPTY:    'sfx_door_empty',
  SFX_JACKPOT:       'sfx_jackpot',
  SFX_LOSS:          'sfx_loss',
} as const;

export type AssetKey = typeof AssetKeys[keyof typeof AssetKeys];
