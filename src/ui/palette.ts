// Vegas Infinite-inspired colour palette — shared across all scenes

export const PAL = {
  // ── Backgrounds ───────────────────────────────────────────────────────────
  bg:          0x05040f,   // deep purple-black canvas fill
  panel:       0x0d0b20,   // panel fill — clearly distinct from bg
  panelAlt:    0x13103a,   // slightly lighter panel (hover states, headers)
  overlay:     0x07061a,   // modal / sidebar overlay

  // ── Borders ───────────────────────────────────────────────────────────────
  border:      0x2a2560,   // default panel border (purple-tinted)
  borderBright:0x4a44a0,   // visible border, e.g. input boxes
  borderGlow:  0x00d4ff,   // neon cyan — hover / selected / active

  // ── Text (CSS hex strings) ────────────────────────────────────────────────
  gold:        '#ffd700',  // titles, accents, button labels
  white:       '#ffffff',  // primary body text
  muted:       '#c8cce8',  // secondary / label text — light lavender, clearly readable
  dim:         '#a0a8c8',  // tertiary / meta text — visible but recessed

  // ── Feedback colours ──────────────────────────────────────────────────────
  cyan:        '#00d4ff',  // VI brand highlight, reveals, links
  green:       '#00e676',  // profit, success, accepted
  red:         '#ff3355',  // loss, danger, tooHigh
  blue:        '#4da6ff',  // tooLow
  purple:      '#c084fc',  // intel / hidden door / special
  orange:      '#ff9f00',  // warning / jackpot secondary

  // ── Number equivalents for Graphics fills ─────────────────────────────────
  n: {
    bg:           0x05040f,
    panel:        0x0d0b20,
    panelAlt:     0x13103a,
    border:       0x2a2560,
    borderBright: 0x4a44a0,
    borderGlow:   0x00d4ff,
    green:        0x00e676,
    cyan:         0x00d4ff,
    gold:         0xffd700,
    red:          0xff3355,
    purple:       0xc084fc,
  },
  // ── Panel transparency ────────────────────────────────────────────────────
  panelAlpha:    0.52,   // main panel fill — lets background show through
  panelAltAlpha: 0.65,   // hovered / elevated panel
  cardAlpha:     0.58,   // intel cards, result cards
} as const;
