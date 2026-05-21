export const INTEL_COSTS = {
  tierScan:     0,
  valueBand:    0,
  doorSignal:   0,
  topItemPeek:  0,
  digitPeek:    0,
} as const;

export type IntelId = keyof typeof INTEL_COSTS;
