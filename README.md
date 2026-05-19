# Bid Ducking

A web-based auction game built with Phaser 3 and TypeScript. Players bid on mystery vaults, using pre-auction intel and round-by-round reveals to zero in on the house value before their chances run out.

## Gameplay

- **5 rounds** of bidding on a sealed vault, each with a narrowing acceptance range
- **Round reveals** — each failed bid unlocks a clue (item count peek, value tally, top item hint, digit reveal)
- **Pre-auction intel** — spend chips before Round 1 for an early edge: value band estimate, hidden door signal, or a digit peek
- **Hidden door** — some vaults have a secret compartment that pays out on top of the surface value
- **Jackpot** — bid within ±0.5% of the exact house value for a round multiplier bonus (×5 down to ×1.5)

## Tech Stack

| Layer | Tech |
|---|---|
| Game engine | [Phaser 3](https://phaser.io/) |
| Language | TypeScript |
| Build | Vite |
| Tests | Vitest |

## Project Structure

```
src/
  config/       # Game tuning — tiers, rounds, economy, rarity bands
  game/         # Pure logic (no Phaser) — vault gen, bid evaluation, session state
    intel/      # Pluggable pre-auction intel options
    reveals/    # Pluggable per-round reveal clues
  registry/     # Wires intel + reveal implementations into registries
  scenes/       # Phaser scenes — Boot, Lobby, IntelShop, Bidding, Reveal, Results
```

## Development

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build → dist/
npm test         # run Vitest unit tests
```

## Item Tiers

| Tier | Color | Value Range |
|---|---|---|
| Garbage | White | $1 – $20 |
| Common | Green | $50 – $150 |
| Rare | Blue | $250 – $700 |
| Epic | Purple | $1,000 – $3,000 |
| Legendary | Gold | $5,000 – $10,000 |
| Ancient | Red | $12,000 – $15,000 |
