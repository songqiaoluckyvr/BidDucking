# Bid Ducking — Game Design Document

---

## 1. Overview

**Title:** Bid Ducking
**Mascot:** Lucky Duck
**Art Style:** Vegas Infinite
**Format:** Single-player web game

You are the Duck Bidder. The house presents a sealed mystery vault and sets a price on it. You have five rounds to place a bid close enough to the house's price to claim the vault. Win the vault, and the reveal tells you what's really inside — the surface treasures the house priced, and possibly a hidden second door that could make you rich. Bid too far off and you leave empty-handed.

---

## 2. Design Pillars

### 2.1 You Are Buying, Not Guessing
The player is not guessing a random number. They are submitting a bid to purchase a real vault of items. Profit and loss come from whether they bought well or overpaid.

### 2.2 Information Is Currency
Each round the house reveals more about what is in the vault. More information means a more accurate bid — but the window to claim the vault also narrows. Intel can be purchased before Round 1 to get a head start.

### 2.3 The Hidden Door Changes Everything
Every vault has a chance to contain a hidden second door beyond what the house priced. That hidden value is pure upside — but only if you claim the vault first.

### 2.4 Early Risk vs. Late Precision
Claiming the vault in Round 1 with a ±60% range gives the most room to underbid and profit. Waiting for later rounds narrows the range and forces a tighter bid — the only remaining upside is the Jackpot and whatever is behind the hidden door.

### 2.5 The House Always Has an Edge
The house earns through lost antes, overpaid bids, and unfavorable hidden door outcomes. Players should feel that losses are their own misjudgement, not arbitrary.

---

## 3. Core Vocabulary

| Term | Definition |
|---|---|
| **House Value** | The price the house has set on the visible surface contents of the vault. This is the target the player's bid is judged against. |
| **Player Bid** | The amount the player offers to buy the vault. Paid upon acceptance. |
| **Ante** | A fixed entry fee paid at the start to play one session. Non-refundable. |
| **Acceptance Range** | The percentage tolerance on each side of the House Value. If the bid falls within this range, the bid is accepted and the vault is claimed. |
| **Surface Contents** | The visible portion of the vault. The House Value is based entirely on surface items. |
| **Hidden Door** | A secret second compartment with a random chance of containing additional items. The house does not price this into the House Value. |
| **Intel** | Optional information the player can purchase before Round 1 to reduce uncertainty about the vault's contents. |
| **Jackpot** | A bonus triggered when the player bids the exact House Value. |

---

## 4. Game Loop

```
Pay Ante
    ↓
[Optional] Purchase Intel
    ↓
House presents the sealed vault
    ↓
Round 1–5: Player places bid
    ↓ bid accepted?
  YES → Player pays bid → Reveal Phase
  NO  → New information revealed → Next round
    ↓ all 5 rounds failed?
  Ante lost. Session ends.
```

The player pays the ante upfront. They do not pay the bid until it is accepted. If no bid is accepted across all five rounds, only the ante is lost.

---

## 5. Round Structure

Each round, the player submits a bid. The game checks whether the bid falls within the acceptance range of the House Value for that round.

```
Accepted = | Player Bid − House Value | ≤ House Value × Acceptance %
```

| Round | Name | Acceptance Range | Jackpot Multiplier |
|---|---|---|---|
| 1 | First Glance | ±60% | ×5 |
| 2 | Market Read | ±40% | ×4 |
| 3 | Appraiser Eye | ±20% | ×3 |
| 4 | Shark Bid | ±10% | ×2 |
| 5 | Dead On | ±1% | ×1.5 |

**Example — House Value: $5,000**

| Round | Accepted Range |
|---|---|
| 1 | $2,000 — $8,000 |
| 2 | $3,000 — $7,000 |
| 3 | $4,000 — $6,000 |
| 4 | $4,500 — $5,500 |
| 5 | $4,950 — $5,050 |

When a bid is accepted, the round ends immediately. The player claims the vault and moves to the Reveal Phase. There is no push or cash-out choice.

---

## 6. Intel System

### Overview
Before placing their first bid, the player may purchase one piece of intel about the vault. Intel is optional, costs extra on top of the ante, and is designed like insurance: it potentially increases the player's expected value, but the cost is calibrated so it is not always worth buying. The decision should be a genuine trade-off.

### Rules
- Only one intel piece may be purchased per session.
- Intel must be purchased before Round 1. It cannot be bought mid-session.
- Intel never reveals the exact House Value. It reduces uncertainty, not eliminates it.

### Intel Options

| Intel | What It Reveals | Equivalent Round Reveal | Cost |
|---|---|---|---|
| **Tier Scan** | Exact item counts by tier — "Total: 6 items — High-value: 2 — Low-value: 4" | Round 2 | Low |
| **Value Band** | A rough price band the House Value falls in — e.g., "Between $3,000 and $7,000." Intentionally wide. | None (unique) | Medium |
| **Door Signal** | Whether the vault has a hidden second door. Does not reveal what is inside if one exists. | None (unique) | Medium |
| **Top Item Peek** | The value of the single highest-value surface item — e.g., "$1,200" | Round 3 | High |
| **Digit Peek** | One digit of the House Value revealed in position — e.g., "$X,7XX" | Round 4 | High |

### Design Note
Intel cost should be tuned alongside expected session outcomes. A well-calibrated intel purchase should return roughly its cost in improved bid accuracy on average — meaning it is break-even in pure EV, and its value is in reducing variance. A player who hates uncertainty buys intel. A player who is comfortable estimating blind skips it.

### Intel UX Framing
Intel should feel like a pre-auction service, not a power-up. Suggested labels:
- "Run Appraisal Scan"
- "Pull Manifest Report"
- "Check Vault Signal"
- "Request Tier Assessment"

---

## 7. Profit and Loss

The player's profit or loss is determined by what they paid versus what the vault is actually worth.

```
Profit = (Surface Value + Hidden Door Value) − Player Bid
```

- **Surface Value** equals the House Value. This is always revealed.
- **Hidden Door Value** is zero if no hidden door exists, or a bonus amount if one is present.
- A bid accepted at a low price is a good deal. A bid accepted at a high price is a bad deal.
- Even within an acceptance range, overbidding leads to a loss.

**Example A — Good deal:**
House Value $5,000. Player bids $3,500 in Round 1 (accepted). No hidden door. Surface reveals $5,000 worth of goods. Profit = $5,000 − $3,500 = **+$1,500**.

**Example B — Bad deal:**
House Value $5,000. Player bids $7,500 in Round 1 (accepted). No hidden door. Surface reveals $5,000. Profit = $5,000 − $7,500 = **−$2,500**.

**Example C — Hidden door rescues the bid:**
House Value $5,000. Player bids $7,500. Hidden door reveals $4,000 of secret items. Profit = ($5,000 + $4,000) − $7,500 = **+$1,500**.

---

## 8. Jackpot

If the player bids the exact House Value, the Jackpot triggers on top of the normal profit calculation.

```
Jackpot Bonus = House Value × Jackpot Multiplier (by round)
```

The Jackpot Bonus is added to whatever normal profit or loss the reveal produces.

**Example:**
House Value $5,000. Player bids $5,000 in Round 2 (accepted, jackpot). Surface value = $5,000. Normal profit = $0. Jackpot Bonus = $5,000 × 4 = **+$20,000 total bonus**.

The jackpot multiplier is highest in Round 1 because calling the exact price with zero information is a remarkable call. Hitting it in Round 5 with near-full information is skillful but less spectacular.

**Exact match tolerance:** The jackpot window requires a small tunable tolerance (e.g., ±0.5% or a fixed small dollar amount) to remain achievable in practice. Strict integer matching is too punishing.

---

## 9. Item Tier System

Every item inside a vault belongs to one of six tiers. Tier determines the item's value range — the exact value is randomised within that range each session. All items share the same steampunk antique visual style; the hexagonal frame color is the only visual tier indicator.

### Tier Table

Target: vault total value lands between **$500 – $15,000** with roughly even distribution across that range. All tier value ranges are tunable config — the numbers below are the starting baseline designed to hit that target.

| Tier | Frame Color | Value Range | Role in Vault |
|---|---|---|---|
| Garbage | White | $1 – $20 | Filler. Drags total down. Present in all vault types. |
| Common | Green | $50 – $150 | Baseline. Most vaults have several. |
| Rare | Blue | $250 – $700 | Meaningful contributor. Signals a decent vault. |
| Epic | Purple | $1,000 – $3,000 | Strong anchor. Usually the top item in mid-tier vaults. |
| Legendary | Gold | $5,000 – $10,000 | Dominant anchor. Defines high-end vault value. |
| Ancient | Red | $12,000 – $15,000 | Trophy item. Caps the vault ceiling. One Ancient item fills the top of the range. |

### Why These Ranges

With 5–9 items and the tier distributions below, vault totals land roughly:
- Low end (~$500): Scrap vault, 5–6 items, Garbage + Common + 1 Rare
- Mid range (~$5,000–$8,000): Standard/Premium vault, Rare + Epic mix
- High end (~$12,000–$15,000): Premium/Legendary vault with one Legendary or Ancient anchor

### High-value vs Low-value Definition

Used by the Round 2 tally reveal and Tier Scan intel:

- **High-value** = Epic, Legendary, Ancient (purple frame and above)
- **Low-value** = Garbage, Common, Rare (blue frame and below)

Rare sits in the low-value bucket because in the context of a vault that may contain a Legendary or Ancient anchor, a $150–$600 Rare reads as filler. This keeps the tally reveal informative rather than inflating the high-value count.

### Vault Rarity Band Composition

The rarity band label (shown before Round 1) reflects the expected tier distribution of items inside. Exact distributions are tunable config.

| Rarity Band | Typical Item Composition | Typical Total Range |
|---|---|---|
| Scrap | Garbage + Common dominant, max Rare | $200 – $1,500 |
| Standard | Common + Rare dominant, occasional Epic | $800 – $4,000 |
| Premium | Rare + Epic dominant, possible Legendary | $3,000 – $10,000 |
| Legendary | Epic + Legendary dominant, possible Ancient | $7,000 – $15,000 |

### Item Count per Vault

Each vault contains between 5 and 9 items, randomised within the rarity band. Higher bands lean toward more items and higher individual tiers, but this is not guaranteed. A Scrap vault with 9 items can still total less than a Premium vault with 5.

---

## 10. Hidden Door

### Presence
Each vault has a 30% chance of containing a hidden second door. The player does not know at the start of a session whether one exists, unless they purchased the Door Signal intel.

### Value
The hidden door contains items not priced by the house. These items have their own value added on top of the Surface Value at reveal.

### Reveal
The hidden door is always revealed at the end of the session regardless of whether it affects the outcome. If the player did not win the vault, the hidden door is shown as "what could have been" — a strong emotional beat that reinforces the desire to claim the vault next time.

### Tension Role
The possibility of a hidden door gives the player a reason to still want the vault even when they may have overbid or are in late rounds. It converts a likely loss into a potential profit with no additional player action required.

---

## 10. Round Information Reveals

Each round reveal type is fixed — players learn the meta and can target specific rounds deliberately. Reveals stack: each round the player has all prior information plus the new disclosure. Intel is early access to a later round's reveal, purchased before Round 1.

No single reveal exposes the House Value directly. Each adds a layer of precision.

---

### Before Round 1 — Vault Exterior (always free)

Shown before any bidding begins.

- **Rarity band**: Scrap / Standard / Premium / Legendary
- Lucky Duck opening line

All vaults look identical. The rarity band is the only pre-bid signal. It gives a rough price range impression — veterans learn what each band typically yields, new players read it at face value.

**Dominant strategy:** Bid immediately on rarity pattern recognition. High risk, highest jackpot multiplier (×5).

---

### Round 1 Reveal — Quick Peek

*Shown when Round 1 bid is rejected, before Round 2.*

The vault door cracks open briefly. Player sees a silhouetted glimpse of the contents — shapes and sizes, not identifiable items.

- Approximate **item count** visible (count the shapes)
- **Size distribution** apparent (mostly small, one large anchor, mixed)

**Dominant strategy:** Visual estimation. Judge item density and whether one large item dominates or value is spread across many smaller ones.

---

### Round 2 Reveal — Item Tally (one, randomly selected)

*Shown when Round 2 bid is rejected, before Round 3.*

One of the following three stats is revealed at random — the player does not know in advance which one they will receive:

- **Total items:** "This vault contains 6 items."
- **High-value count:** "This vault contains 2 high-value items." *(Epic, Legendary, Ancient)*
- **Low-value count:** "This vault contains 4 low-value items." *(Garbage, Common, Rare)*

Numbers only. No category names, no individual item identity.

**Dominant strategy:** Mathematical anchoring. The single stat anchors one end of the player's estimate. Getting "2 high-value items" tells a different story than "4 low-value items" — both are useful but in different ways.

*The Tier Scan intel gives all three stats before Round 1, making it strictly more informative than the free Round 2 reveal.*

---

### Round 3 Reveal — Top Item Value

*Shown when Round 3 bid is rejected, before Round 4.*

The value of the single highest-value surface item is shown:

> **Highest-value item: $1,200**

No name, no category — just the number.

**Dominant strategy:** Anchor estimation. The top item typically represents 40–60% of vault value. Combined with the item tally from Round 2, the player can anchor a total range: "Top item is $1,200, and there are 2 high-value items total, so surface value is probably $2,000–$3,000."

*This is the same output as the Top Item Peek intel.*

---

### Round 4 Reveal — Price Digit

*Shown when Round 4 bid is rejected, before Round 5.*

One digit of the House Value is revealed in its positional place:

> **The vault is valued at $X,7XX**

- Single digit shown in position (e.g., hundreds digit)
- Position is random but consistent within a session
- Eliminates large bands of wrong answers

**Dominant strategy:** Numerical precision. With all prior context plus a confirmed digit, a skilled player can often narrow to within a few hundred dollars. Round 5's tight acceptance range becomes achievable.

*This is the same output as the Digit Peek intel.*

---

### Round Strategy Summary

| Round | New Information | Numbers Given | Dominant Strategy |
|---|---|---|---|
| Pre-bid | Vault size + rarity band | — | Gambler — bet on rarity pattern, max jackpot multiplier |
| 1 Reveal | Quick peek, silhouettes | Rough count visible | Visual Reader — judge item density and anchor presence |
| 2 Reveal | Item tally | Total, high-value count, low-value count | Math Estimator — build a value range from counts |
| 3 Reveal | Top item value | Dollar value of highest item | Anchor Bidder — price total around the dominant item's value |
| 4 Reveal | One price digit in position | 1 confirmed digit | Jackpot Hunter — use digit to target exact House Value |

---

### Intel to Round Reveal Mapping

| Intel | Equivalent Round Reveal | Benefit of Buying |
|---|---|---|
| Tier Scan | Round 2+ (all three tally stats vs. one random) | Enter Round 1 with all count data; free Round 2 only gives one random stat |
| Top Item Peek | Round 3 (top item identity) | Enter Round 1 knowing the anchor item |
| Digit Peek | Round 4 (price digit) | Enter Round 1 with a confirmed digit |
| Door Signal | Unique — not revealed in any round | Only way to know if hidden door exists before reveal |
| Category Report | *(removed — superseded by item tally)* | — |

---

## 11. Economy

### Session Cost
- Player pays a fixed **Ante** to enter. Ante is lost regardless of outcome.
- Player optionally pays **Intel Cost** before Round 1. Also non-refundable.
- Player pays their **Bid** only when it is accepted.
- Total session cost = Ante + Intel (if purchased) + Bid (if accepted).

### House Edge Sources
1. **Lost Antes** — every failed session where no bid is accepted.
2. **Lost Intel** — intel purchased on sessions that result in a failed bid or a losing reveal.
3. **Overbidding** — players who claim the vault but paid too much for it.
4. **No Hidden Door** — players who count on the secret bonus and don't get it.
5. **Late round bids** — tighter acceptance windows reduce the underbidding advantage.

### Player Profit Sources
1. **Underbidding** — claiming the vault below House Value.
2. **Hidden Door** — secret items adding unpriced value.
3. **Jackpot Bonus** — exact bid triggering the round multiplier.

### Tunable Config
All economic values should be config-driven:
- Ante amount
- Intel costs per type
- Hidden door probability (default: 30%)
- Hidden door value range
- Acceptance range per round
- Jackpot multiplier per round
- Jackpot tolerance window

---

## 12. UX Flow

### Screen 1 — Lobby
- Current balance
- Ante amount displayed
- "Enter the Vault" button (pays ante, starts session)
- Lucky Duck hosts with intro line

### Screen 2 — Intel Shop (optional, pre-Round 1 only)
- Displayed before the vault is shown
- List of available intel options with cost
- Player selects one or skips
- Lucky Duck flavour line acknowledges the choice
- Once skipped or purchased, intel shop is closed for the session

### Screen 3 — Vault Preview + Bidding
- Sealed vault (large visual, centre stage)
- Lucky Duck sets the scene
- Round indicator (Round X of 5)
- Information disclosed so far (items revealed, hints given)
- Bid input field
- Submit bid button

### Screen 4 — Bid Result
- Player bid vs acceptance range feedback (accepted or rejected)
- If **rejected**: new information revealed, advance to next round
- If **accepted**: short acceptance animation → cut to Reveal Phase
- If Round 5 fails: "The vault slips away" → show ante loss → session ends

### Screen 5 — Reveal Phase
- Surface items revealed one by one with values
- Running total climbs to House Value
- Player bid vs House Value comparison shown
- Profit/loss calculated
- Hidden door moment:
  - If present: second door swings open, items tumble out, bonus value added, updated profit shown
  - If absent: compartment is empty — "Nothing behind the door"
- Jackpot: if triggered, explosive animation, bonus value added on top
- Final profit/loss displayed with breakdown

### Screen 6 — Results
- Net profit or loss this session
- Breakdown: ante paid, intel paid (if any), bid paid, surface value, hidden door bonus, jackpot bonus
- Lucky Duck reaction (win/loss flavour)
- "Play Again" button

---

## 13. Art Direction

### Visual Style
Vegas Infinite — high contrast neon on dark, ornate gold trim, glowing UI elements. The vault is the centerpiece: a large ornate floor safe or casino vault door. Everything should feel like it belongs on a high-roller casino floor.

### Lucky Duck
The game mascot. A stylized duck in a tuxedo or auctioneer's coat. Acts as the house representative and vault host. Delivers flavour lines at key moments: session start, bid rejection, jackpot, hidden door reveal, big loss.

### Key Visual Beats

| Moment | Visual Direction |
|---|---|
| Ante paid | Chip stack slides in |
| Intel purchased | Scanner sweep across the vault |
| Bid rejected | Red flash, Lucky Duck shakes head |
| Bid accepted | Gold flash, vault door cracks open |
| Item reveal | Card-flip animation per item, value counter climbs |
| Hidden door | Second vault door swings open with light burst |
| Hidden door empty | Door opens to darkness, brief silence |
| Jackpot | Full-screen explosion, coin shower, Lucky Duck celebration |
| Net loss | Lucky Duck winces, dark vignette, muted colours |

---

## 14. Tech Stack

### Engine and Core
- **Game Engine:** Phaser 3 (WebGL/Canvas 2D, scene management, asset pipeline, input)
- **Language:** TypeScript throughout
- **Build Tool:** Vite (fast HMR, clean TS/Phaser setup)
- **Testing:** Vitest for all game logic (runs without browser or Phaser)
- **Persistence:** localStorage for balance and session history (MVP)

### Why Phaser
Phaser's scene system maps naturally to the game's phase structure (lobby → intel → bid → reveal → results). It handles asset loading, WebGL rendering, and animation timelines without requiring a custom engine. The 2D WebGL renderer is sufficient for the Vegas Infinite style — no 3D needed.

---

## 15. Architecture

### Core Principle: Two Layers, Zero Coupling

The project is split into two layers that never import from each other in reverse:

```
game/      ← Pure TypeScript. No Phaser imports. Fully Vitest-testable.
scenes/    ← Phaser 3. Consumes game/ via defined interfaces only.
```

All game logic — vault generation, bid evaluation, intel, reveals, payout — lives in `game/`. Phaser scenes hold a reference to the session manager and call methods on it. They never own or mutate game state directly.

This means any reveal or intel implementation can be unit-tested without launching Phaser, and Phaser scenes can be swapped or redesigned without touching game math.

### Folder Structure

```
src/
├── main.ts                     ← Phaser.Game bootstrap only
├── config/
│   ├── GameConfig.ts           ← Ante, jackpot tolerance, hidden door probability
│   ├── RoundConfig.ts          ← Acceptance ranges and jackpot multipliers per round
│   ├── TierConfig.ts           ← Item tier value ranges, high/low cutoffs
│   └── EconomyConfig.ts        ← Intel costs, hidden door value ranges
├── game/
│   ├── types.ts                ← All shared pure-TS types
│   ├── VaultGenerator.ts       ← Procedural vault and item generation
│   ├── SessionManager.ts       ← State machine for one play session
│   ├── BidEvaluator.ts         ← Acceptance range check and jackpot detection
│   ├── ProfitCalculator.ts     ← Final P&L with all components
│   ├── simulation.ts           ← Headless RTP simulation runner
│   ├── intel/
│   │   ├── IIntelOption.ts     ← Interface contract
│   │   ├── IntelRegistry.ts
│   │   └── options/            ← One file per intel type
│   └── reveals/
│       ├── IRoundReveal.ts     ← Interface contract
│       ├── RevealRegistry.ts
│       └── rounds/             ← One file per round reveal
├── registry/
│   └── index.ts                ← Composition root: populates both registries
├── scenes/
│   ├── BootScene.ts
│   ├── LobbyScene.ts
│   ├── IntelShopScene.ts
│   ├── BiddingScene.ts         ← Heaviest scene; manages the full bid loop
│   ├── RevealScene.ts
│   └── ResultsScene.ts
├── ui/                         ← Reusable Phaser GameObjects
│   ├── VaultDisplay.ts
│   ├── IntelCard.ts
│   ├── RevealPanel.ts          ← Stacks all accumulated reveal results
│   ├── BidInput.ts
│   ├── ItemCard.ts
│   ├── LuckyDuck.ts
│   └── RoundIndicator.ts
└── assets/
    ├── AssetKeys.ts            ← Enum of all texture/audio keys
    └── AssetLoader.ts
```

### Intel System Contract

Each intel option implements `IIntelOption`. Adding or replacing an intel type is one file in `game/intel/options/` and one line in `registry/index.ts`. Nothing else changes.

```
IIntelOption {
  id: string
  label: string           ← displayed name
  flavorLabel: string     ← casino-framed action label ("Run Appraisal Scan")
  cost: number
  description: string
  execute(vault) → IntelResult
}

IntelResult {
  intelId: string
  displayData: unknown    ← typed by each implementation, cast by the Phaser renderer
}
```

### Round Reveal System Contract

Each round reveal implements `IRoundReveal`. The `rng` parameter is injected rather than called internally — this makes Round 2's random stat selection deterministic in tests.

```
IRoundReveal {
  id: string
  roundNumber: 1 | 2 | 3 | 4
  execute(vault, rng) → RevealResult
}

RevealResult {
  revealId: string
  roundNumber: number
  displayData: unknown    ← typed by each implementation
}
```

`RevealRegistry` is keyed by `roundNumber` — each round has exactly one registered reveal. Swapping Round 2's reveal is a one-line change in `registry/index.ts`.

### Session State Flow

The `SessionManager` is the single source of truth for a session. Scenes pass it forward via Phaser's `scene.start(key, data)` — no global singletons.

```
LobbyScene
  → creates Vault + SessionManager
  → scene.start('IntelShop', { session })

IntelShopScene
  → calls session.getAvailableIntel()
  → calls session.purchaseIntel(id) on selection
  → scene.start('Bidding', { session, intelResult })

BiddingScene
  → calls session.submitBid(amount) on each bid
  → on rejection: calls revealRegistry.getForRound(n).execute(vault, rng)
               → passes RevealResult to RevealPanel.addReveal()
  → on acceptance: scene.start('Reveal', { session })

RevealScene
  → calls session.getSessionOutcome()
  → orchestrates item card animations
  → scene.start('Results', { outcome })
```

### Configuration

All tunable values live in `config/`. No magic numbers anywhere in game logic or scenes.

```typescript
// config/RoundConfig.ts — example
const ROUND_CONFIG = {
  1: { underbidTolerance: 0.60, overbidTolerance: 0.60, jackpotMultiplier: 5   },
  2: { underbidTolerance: 0.40, overbidTolerance: 0.55, jackpotMultiplier: 4   },
  3: { underbidTolerance: 0.20, overbidTolerance: 0.40, jackpotMultiplier: 3   },
  4: { underbidTolerance: 0.10, overbidTolerance: 0.25, jackpotMultiplier: 2   },
  5: { underbidTolerance: 0.01, overbidTolerance: 0.10, jackpotMultiplier: 1.5 },
};
```

---

## 16. Implementation Plan

### Phase 1 — Scaffold
*Goal: Phaser boots and all scenes navigate with placeholder UI.*

- Vite + Phaser 3 + TypeScript project setup
- All six scenes as stubs that advance on a button press
- `AssetKeys.ts` with placeholder keys
- `BootScene` with stub preload

**Done when:** clicking through all six screens works end-to-end with placeholder text.

---

### Phase 2 — Game Logic Core
*Goal: complete game loop in pure TypeScript, fully tested.*

- All types in `game/types.ts`
- `VaultGenerator` — vault with items, house value, hidden door
- `BidEvaluator` — asymmetric acceptance range check and jackpot detection
- `ProfitCalculator` — net P&L with all components
- `SessionManager` — state machine connecting the above
- All intel option implementations + `IntelRegistry`
- All round reveal implementations + `RevealRegistry`
- `registry/index.ts` composing both registries
- All `config/` files with baseline values
- `simulation.ts` — headless runner for RTP validation

**Done when:** Vitest suite covers vault generation, all intel options, all round reveals, bid evaluation edge cases, jackpot tolerance, and P&L calculation. Simulation reports a plausible house edge.

---

### Phase 3 — Scenes Wired to Logic
*Goal: game is fully playable end-to-end with primitive visuals.*

- `LobbyScene` creates session, passes it forward
- `IntelShopScene` reads registry, renders options as text buttons
- `BiddingScene` submits bids, triggers reveals, accumulates reveal text panel
- `RevealScene` shows outcome numbers in sequence
- `ResultsScene` shows net P&L and loops back to lobby

**Done when:** a complete session can be played with correct numbers at every step.

---

### Phase 4 — UI Components
*Goal: each screen uses proper Phaser GameObjects in Vegas Infinite style.*

- `VaultDisplay` — sealed / cracked / open door states
- `IntelCard` — cost, flavor label, description
- `RevealPanel` — stacking reveal rows, one per round
- `BidInput` — number entry with formatting and validation
- `ItemCard` — hexagonal frame with tier color, value
- `LuckyDuck` — sprite with dialogue bubble
- `RoundIndicator` — Round X of 5

**Done when:** screens visually match the art direction in Section 13.

---

### Phase 5 — Animations and Audio
*Goal: all key visual beats from Section 13 are implemented.*

- Vault door states and transitions
- Item card flip sequence in RevealScene
- Hidden door swing-open with light burst
- Jackpot full-screen effect and coin shower
- Lucky Duck reaction animations tied to game events
- Audio cues at each key moment

**Done when:** a play-through feels like a casino game, not a form.

---

### Phase 6 — Tuning and Polish
*Goal: house edge is real, numbers feel right, experience is complete.*

- Run simulation at 10,000+ sessions, validate house edge is in target range
- Adjust `config/` values based on simulation output
- Intel EV validated as approximately break-even
- Lucky Duck dialogue pool expanded to minimum viable depth
- Mobile layout pass

**Done when:** simulation output confirms economy is sound and the game loop is fun in repeated play.

---

## 17. Open Design Questions

1. **Jackpot exact-match tolerance** — Fixed dollar window or percentage? Needs a number before implementation. Suggested starting point: ±0.5% of House Value.

2. **Hidden door value range** — Current config placeholder is $500–$8,000. Should it scale proportionally to vault rarity band, or be a flat independent range?

3. **Display currency** — Real dollar labels or stylised chips/credits? Chips avoid real-money framing in the prototype and are easier to tune.

4. **Intel cost values** — Costs are not yet assigned specific numbers. Requires a simulation pass after Phase 2 to calibrate break-even EV per intel type.

5. **Lucky Duck dialogue depth** — One line per key moment is the minimum viable pool. A larger pool makes repeat sessions feel fresh — decide depth before Phase 5.
