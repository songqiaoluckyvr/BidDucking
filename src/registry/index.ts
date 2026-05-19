import { IntelRegistry } from '@game/intel/IntelRegistry';
import { RevealRegistry } from '@game/reveals/RevealRegistry';
import { ValueBandIntel } from '@game/intel/options/ValueBandIntel';
import { DoorSignalIntel } from '@game/intel/options/DoorSignalIntel';
import { DigitPeekIntel } from '@game/intel/options/DigitPeekIntel';
import { QuickPeekReveal } from '@game/reveals/rounds/QuickPeekReveal';
import { ItemTallyReveal } from '@game/reveals/rounds/ItemTallyReveal';
import { TopItemReveal } from '@game/reveals/rounds/TopItemReveal';
import { DigitReveal } from '@game/reveals/rounds/DigitReveal';

// DigitPeekIntel needs rng — it is re-instantiated per session in LobbyScene.
// The registry holds a placeholder constructed with Math.random; LobbyScene
// overwrites the intel registry entry with a session-seeded instance.
export function buildIntelRegistry(rng: () => number = Math.random): IntelRegistry {
  const registry = new IntelRegistry();
  registry.register(new ValueBandIntel());
  registry.register(new DoorSignalIntel());
  registry.register(new DigitPeekIntel(rng));
  return registry;
}

export function buildRevealRegistry(): RevealRegistry {
  const registry = new RevealRegistry();
  registry.register(new QuickPeekReveal());
  registry.register(new ItemTallyReveal());
  registry.register(new TopItemReveal());
  registry.register(new DigitReveal());
  return registry;
}
