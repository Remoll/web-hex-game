# Web Hex Game

Live demo: https://web-hex-game.vercel.app/

A browser-based hex-grid prototype built with TypeScript, Vite, and Three.js.

## Getting started

```bash
npm install
npm run dev
```

The development server starts at the address printed by Vite. Press `C` to toggle the camera mode.

## Tactical prototype controls

The current example level contains a Mage, an additional Player-faction unit,
an Enemy, and a Neutral unit. Every unit has base 100 maximum HP, 20 melee
damage, Ground movement, and a movement range of three hexes before tactical
attributes are derived.

### Mage vision and exploration

The encounter is a radius-6 hex map (127 fields). Its original radius-2
terrain layout, including terrain and elevation values, is preserved at the
centre; the additional outer rings are exploration space.

The Mage is the only current source of player sight and has a base view range
of four hexes. Visibility is recalculated only when relevant game state changes
(currently session setup and Mage movement), never by the render loop.

- **Undiscovered** hexes are covered by black fog.
- **Discovered** hexes retain visible terrain under translucent fog, but units
  and remains are hidden.
- **Visible** hexes show terrain, living units, and remains normally.

The Mage can be selected only while currently Visible. Hovering or clicking a
hidden unit remains unavailable and reveals no unit information.

### Event timeline

The Mage and autonomous units share a discrete, integer event timeline rather
than a wall-clock timer. The timeline HUD at the top of the screen shows the
current simulation time, the ready actor, and the named cost of each Mage
action. The Mage starts ready at time `0`.

- A Mage move and a servant-strategy command have base cost `100` timeline
  time, an attack `140`, and **Wait** `100`. Tempo adjusts those recovery
  delays; the HUD always displays the resolved integer cost. A move may still
  traverse a legal Ground path of up to three hexes; its path length does not
  change this temporary base cost.
- A Mage command only schedules the Mage's next activation. It does not alter
  the servant's scheduled activation or make the servant act immediately.
- When a servant receives its own later activation, its autonomous resolver
  performs at most one legal strategy action. The only currently supported
  strategies are **Hold**, which resolves as a no-op Wait, and **Pursue
  Designated Enemy**. Pursuit stores one explicit Enemy identity and, on the
  servant's later activation, attacks that Enemy if adjacent or takes one step
  on a deterministic shortest legal Ground path to an empty hex beside it.
  Equal shortest paths use the GameMap's fixed axial-neighbour order. A blocked
  pursuit Holds without losing its order.
- On its activation, an Enemy evaluates only hostiles within its own derived
  view range. It remembers the nearest visible hostile's position, attacks an
  adjacent target once, or otherwise takes one legal neighbouring step that
  reduces hex distance. If sight is lost, it continues toward that last-known
  position and Holds there when it cannot reacquire a target. Target ties use
  level registration order; equally valid local steps use axial `q`, then `r`.
  A defeated target is forgotten. This private Enemy perception never changes
  Mage fog or reveals hidden units.
- Neutral units Hold in this slice. There is no timer, polling, or global
  pathfinding AI.
- When two actors are ready at the same simulation time, their original level
  registration order is the stable tie-breaker. Dead units are removed from
  the event timeline before they can receive another activation.
- Only the Mage is directly controllable. A servant is never manually moved,
  attacked with, or made to Wait by the player.

- Hover the Mage to see the selection cursor, then click it to select it.
- With a ready Mage selected, click a currently Visible Player-faction servant
  to select it as the command target (amber highlight). Use **Assign Hold** or
  **Assign Pursue** in the command panel above the map. **Assign Pursue**
  enters target-selection mode: click one currently Visible living Enemy to
  spend the Mage's Command cost and store that specific Enemy as the servant's
  target. The servant acts only during its own later activation. Its order
  persists until the Mage replaces or clears it, or that Enemy dies.
- A pursuit remains valid after the servant or target leave Mage sight, but the
  command panel and amber marker expose the target only while it is currently
  Visible. A hidden Enemy's live position and actions are never revealed.
  **Clear strategy** also cancels a pending target selection without spending
  Mage Tempo. A hidden, defeated, Enemy, or Neutral unit cannot receive a
  command and does not consume Mage Tempo.
- After selection, reachable Ground hexes are highlighted in green. Click one
  to move there along a valid path of up to three hexes. Every entered hex has
  a cost of one for pathfinding; living units block paths and destinations.
- Hover a living adjacent hostile unit to see a red attack cursor and target
  highlight. Click it to deal 20 damage. A unit may attack only factions in
  its `dispositionToFactions.enemy` category.
- Mage movement and attacks each schedule the next Mage activation on the
  timeline. Use the **Wait** button in the timeline HUD to schedule a no-op
  Mage activation instead.
- Living units display a health bar. At zero HP, a unit becomes non-interactive
  and leaves a visual-only temporary remains marker. Remains do not block
  movement or receive input.

The canvas uses the unavailable cursor by default (including empty hexes before
selection), then switches to temporary selection, move, or attack cursor art
when that action is valid. The selection cursor also identifies an eligible
servant command target.
They are placeholders under `public/cursors/` and will be replaced by final
game assets later.

### Tactical attributes

Every unit has the serialized integer attributes `might`, `finesse`,
`vitality`, and `insight`. Omitted attributes default to `10`; values must be
non-negative integers. Their common modifier is:

```text
modifier = floor((score - 10) / 2)
```

- **Might:** melee damage = base damage + `2 × modifier`.
- **Vitality:** maximum HP = base maximum HP + `10 × modifier`. An explicit
  save-state `currentHp` must not exceed that value; otherwise a new unit
  begins at its derived maximum.
- **Finesse:** Tempo = `clamp(100 + modifier, 90, 110)`. Recovery delay is
  `round(base action cost × 100 / Tempo)`, so higher Finesse acts sooner.
- **Insight:** unit view range = base view range + modifier (minimum one hex).
  Mage range drives player fog; Enemy range drives private perception only.

These values are derived when a unit is constructed, never in the render loop.
The example JSON deliberately gives its units different scores so the health,
vision, damage, and tempo effects are observable.

### Current faction dispositions

| Acting faction | Friendly | Enemy | Neutral |
| --- | --- | --- | --- |
| Player | Player | Enemy | Neutral |
| Enemy | Enemy | Player | Neutral |
| Neutral | Neutral | — | Player, Enemy |

The game stores this as `dispositionToFactions` with the three explicit
categories `friendly`, `enemy`, and `neutral`. Every known faction appears in
exactly one category for each acting faction.

### Deferred systems

Turns/rounds beyond the current event timeline, advanced Enemy AI, Secure
Designated Hex servant strategy, counterattacks, player win/lose conditions,
terrain cost multipliers, height-based line of sight, facing, stealth,
animated movement/attacks, interactive remains, final cursor art, and final
unit art are intentionally deferred.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run tests in watch mode. |
| `npm run build` | Type-check and create a production build. |
| `npm run preview` | Serve the production build locally. |

## Project structure

```text
src/
  app/          Application composition, input, and UI-to-game coordination.
  game/         Framework-independent game state, rules, and level factories.
  rendering/    Three.js scene, meshes, geometry, textures, and camera.
```

- `game/board` contains the runtime board model: `GameMap` and `Field`.
- `public/levels` contains JSON level definitions loaded by the browser.
- `game/levels` converts serializable level definitions into runtime game state.
- `game/unit` contains the concrete `Unit`; subclasses belong below it, such as `unit/player/Player`.
- `rendering/customInstancedMesh` contains `CustomInstancedMesh`; derived renderers belong below it.
- Each class resides in its own lower-camel-case directory. Tests live beside the module they exercise.

## Development guidelines

- Keep `game/` independent from Three.js, DOM APIs, physical texture files, atlas indices, and browser globals.
- Put game rules and state transitions in `GameSession` or future game systems; keep `app/` responsible for connecting input, state, and views.
- Put Three.js-specific transforms and atlas mappings in `rendering/`.
- Place domain-wide types in `game/types.ts`; keep types owned by a single module next to that module.
- Use the `@/` import alias for modules under `src/`.
- Add or update focused Vitest tests with every behavior change, then run `npm test` and `npm run build`.

## Notes for coding agents

Before changing behavior, identify whether the change belongs to the game domain, rendering adapter, or application composition layer. Preserve the dependency direction: `app/` may depend on `game/` and `rendering/`; `rendering/` may depend on game models; `game/` must not depend on either outer layer.
