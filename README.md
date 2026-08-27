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
than a wall-clock timer. The timeline HUD shows the current simulation time,
the ready actor, the current AP pool, and the Mage's available action costs.
The Mage starts ready at time `0` with three Action Points (AP).

- A Mage move costs `1` AP for every hex in the chosen legal path. A melee
  attack costs `2` AP. The Mage remains the ready actor while it has AP, so it
  can move then attack, or attack then retreat. Reaching `0` AP immediately
  ends the activation. Current movement range is the smaller of the unit's
  three-hex movement range and the AP that remains.
- Ending an activation applies one base recovery delay of `100` timeline time,
  modified only by Finesse-derived Tempo. Move and attack no longer apply
  independent recovery delays.
- **Wait** is available once per Mage activation. It moves the Mage behind the
  actors currently ready at that simulation time without spending AP. When the
  Mage becomes ready again, the control changes to **End Turn**; using it
  discards remaining AP and starts the normal recovery delay.
- Existing servant-strategy commands still end the Mage's activation as a
  whole-action decision. Their AP cost is intentionally deferred until the
  command-economy story, rather than being inferred in this tactical slice.
- A Mage command only schedules the Mage's next activation. It does not alter
  the servant's scheduled activation or make the servant act immediately.
- When a servant receives its own later activation, its autonomous resolver
  continues legal strategy actions while it can afford them. The only currently
  supported strategies are **Hold**, which resolves as a no-op Wait, **Pursue
  Designated Enemy**, and **Secure Designated Hex**. Pursuit stores one
  explicit Enemy identity and, on the servant's later activation, attacks that
  Enemy if adjacent or takes deterministic legal Ground steps toward an empty
  hex beside it. Secure stores one tactical hex: the servant advances to an
  empty target and completes the order on arrival; for an occupied target it
  approaches the nearest legal adjacent hex and attacks only a hostile
  occupant. Equal shortest paths use the GameMap's fixed axial-neighbour order.
  A blocked strategy Holds without losing its order.
- On its activation, an Enemy evaluates only hostiles within its own derived
  view range. It remembers the nearest visible hostile's position, then spends
  its available AP on adjacent attacks or legal neighbouring steps that reduce
  hex distance. If sight is lost, it continues toward that last-known position
  and Holds there when it cannot reacquire a target. Target ties use level
  registration order; equally valid local steps use axial `q`, then `r`. A
  defeated target is forgotten. This private Enemy perception never changes
  Mage fog or reveals hidden units.
- Neutral units Hold in this slice. There is no timer, polling, or global
  pathfinding AI.
- When two actors are ready at the same simulation time, their original level
  registration order is the stable tie-breaker. A Waited Mage is placed after
  actors that were ready at that same time. Dead units are removed from the
  event timeline before they can receive another activation.
- Only the Mage is directly controllable. A servant is never manually moved,
  attacked with, or made to Wait by the player.

- Hover the Mage to see the selection cursor, then click it to select it.
- With a ready Mage selected, click a currently Visible Player-faction servant
  to select it as the command target (amber highlight). Use **Assign Hold**,
  **Assign Pursue**, or **Assign Secure** in the command panel above the map.
  **Assign Pursue** enters target-selection mode: click one currently Visible
  living Enemy and store that specific Enemy as the servant's target. **Assign
  Secure** similarly requires one currently
  Visible map hex. The servant acts only during its own later activation. Its
  order persists until the Mage replaces or clears it; a pursuit also ends when
  its Enemy dies, while a secure order ends after the servant reaches an empty
  designated hex.
- A pursuit remains valid after the servant or target leave Mage sight, but the
  command panel and amber marker expose their targets only while they are
  currently Visible. A hidden Enemy's live position and actions are never
  revealed. **Clear strategy** also cancels a pending target selection without
  spending Mage Tempo. A hidden, defeated, Enemy, or Neutral unit cannot
  receive a command and does not consume Mage Tempo.
- After selection, reachable Ground hexes are highlighted in green. Click one
  to move there along a valid path that fits both the unit's current movement
  range and remaining AP. Every entered hex currently costs one AP and one
  pathfinding point; living units block paths and destinations.
- Hover a living adjacent hostile unit to see a red attack cursor and target
  highlight. Click it to deal 20 damage. A unit may attack only factions in
  its `dispositionToFactions.enemy` category.
- Use **Wait** in the timeline HUD to defer the Mage once without spending AP;
  its label then changes to **End Turn** for the rest of that activation.
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
- **Finesse:** Tempo = `clamp(100 + modifier, 90, 110)`. Activation recovery
  delay is `round(100 × 100 / Tempo)`, so higher Finesse acts sooner.
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

Turns/rounds beyond the current event timeline, advanced Enemy AI,
counterattacks, player win/lose conditions, terrain cost multipliers,
height-based line of sight, facing, stealth, animated movement/attacks,
interactive remains, final cursor art, and final unit art are intentionally
deferred.

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
