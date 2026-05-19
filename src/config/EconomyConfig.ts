export const INTEL_COSTS = {
  tierScan:     100,
  valueBand:    150,
  doorSignal:   150,
  topItemPeek:  250,
  digitPeek:    250,
} as const;

export type IntelId = keyof typeof INTEL_COSTS;
