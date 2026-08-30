# Web Hex Game

Live demo: https://web-hex-game.vercel.app/

A browser-based hex-grid prototype built with TypeScript, Vite, and Three.js.

## Getting started

```bash
npm install
npm run dev
```

The development server starts at the address printed by Vite. Press `C` to toggle the camera mode.

## Campaign travel

The demo now starts on a navigation-only radius-4 Strategic Map. A persistent
gold route glow marks every public entrance or exit: move the single Mage party
marker to the highlighted entrance, then use the accessible **Enter Existing
Tactical Map** control. The tactical return exit stays highlighted alongside
selection, movement, and attack feedback, and its **Return** control remains
disabled until the Mage reaches it. Transitions briefly lock input and respect
`prefers-reduced-motion`.

The campaign owns the Mage and living Player-servant state, including HP.
Leaving and re-entering the existing tactical area also restores that area's
local unit positions, HP, defeated-unit remains, and discovered fog. Servant
orders are map-local and clear whenever the party leaves a tactical area, so
servants use their default autonomous behaviour after arriving elsewhere. Only
selection, activation AP, timeline, and presentation queue restart.
The tactical destination always begins with the Mage ready at 4 AP. Strategic
areas intentionally have no fog, combat, AI, AP, or timeline simulation yet.
The route's explicit tactical entry direction places the Mage on the endpoint,
then places servants in a stable direction-relative neighbouring sequence.

### Tactical hex structure data

Level JSON may optionally declare full-hex structures through a top-level
`structures` array. Legacy maps may omit the array. Every placement has one
stable non-empty `id`, one `q`/`r` map coordinate, and one type-specific
`structure`; ids and coordinates must each be unique and every coordinate must
exist in that level's `map`.

- `wall-block` requires `sideMaterial` of `stone` or `timber`; its top-cap
  presentation is always the standard dark cap.
- `door-block` requires `axis` of `q`, `r`, or `s`, plus `initialState` of
  `open` or `closed`.
- `window-block` requires only `axis` of `q`, `r`, or `s`.
- `tree` accepts no material, axis, or door state.

The loader validates these explicit values before a tactical session begins.
The GameMap exposes immutable, deterministic lookups by coordinate and stable
placement id. `wall-block` and `tree` prevent Ground entry and block sight
beyond their own field; the solid field itself remains visible. The same rule
therefore applies to Mage movement previews, pathfinding, autonomous Ground
movement, and fog of war. Flying remains unaffected. `door-block` and
`window-block` retain no collision or sight effect until their dedicated
axis-sight story. A selected ready Mage may click an adjacent visible
`door-block` to toggle it for 1 AP: closed doors block Ground entry and sight,
while open doors allow both. The initial door state remains authored in JSON;
each tactical session owns its current state. No structure renderer or door UI
exists yet.

The opposite highlighted Strategic entrance leads to the safe, enemy-free
**Cobblestone Tower Ground Floor**. Its compact passable Cobblestone room uses
the same party persistence and fresh 4-AP Mage entry as the existing encounter.
One highlighted exit returns to the tower entrance on the Strategic Map; the
other leads to the **Cobblestone Tower Upper Floor**. Its highlighted stair exit
returns to the Ground Floor. Both compact passable Cobblestone layouts are
authored separately in `public/levels/tower-ground.json` and
`public/levels/tower-upper.json`. This uses the same generic Tactical-to-
Tactical campaign routes as any future room or interior connection; tower
gameplay beyond traversal is still deferred.

## Tactical prototype controls

The current example level contains a Mage, two nearby Player-faction servants,
and seven Enemies distributed across the encounter. Every unit has base 100
maximum HP, 20 melee damage, Ground movement, and a movement range of three
hexes before tactical attributes are derived.

### Mage vision and exploration

The encounter is a radius-9 hex map (271 fields). Its original radius-6
topology, including the central radius-2 terrain and elevation layout, is
preserved; the three additional outer rings add exploration space, passable
hills, and a river with Ground crossings.

The demo river uses impassable Deep Water plus intentional **Shallow Water**
fords on its west, north, and south routes. Ground can cross a ford, paying its
standard 2-AP exit cost (3 AP for an uphill edge), while the surrounding Deep
Water remains Flying-only.

The Mage is the only current source of player sight and has a base view range
of four hexes. Visibility is recalculated only when relevant game state changes
(currently session setup and Mage movement), never by the render loop.

An intervening field at least two ground levels above the observer blocks
fields beyond it only when every equally direct tactical sight line contains
such a blocker. The elevated blocking field itself remains visible. Standing
on high ground does not yet increase view range; elevated-observer bonuses,
facing, and stealth remain deferred.

- **Undiscovered** hexes are covered by black fog that masks their caps and
  vertical terrain walls.
- **Discovered** hexes retain terrain caps and vertical sides under translucent
  fog, but units and remains are hidden.
- **Visible** hexes show terrain, living units, and remains normally.

The Mage can be selected only while currently Visible. Hovering or clicking a
hidden unit remains unavailable and reveals no unit information.

### Event timeline

The Mage and autonomous units share a discrete, integer event timeline rather
than a wall-clock timer. The timeline HUD shows the current simulation time,
the ready actor, the current AP pool, and the Mage's available action costs.
The Mage starts ready at time `0` with four Action Points (AP).

The bottom initiative queue mirrors the deterministic upcoming timeline order.
Its cards are horizontally scrollable on touch devices, while the current actor
remains marked as **Now**. Hover, keyboard focus, or tap temporarily highlights
an actor only when that unit is currently Visible. An undiscovered Enemy appears
only as `?`; a discovered-but-hidden Enemy may be identified but cannot reveal
its current map position.

- A Mage move costs `1` AP for every hex in the chosen legal path. A melee
  attack costs `2` AP. The Mage remains the ready actor while it has AP, so it
  can move then attack, or attack then retreat. Reaching `0` AP immediately
  ends the activation. Current movement range is the smaller of the unit's
  three-hex movement range and the AP that remains.
- Ending an activation applies one base recovery delay of `100` timeline time,
  modified only by Finesse-derived Tempo. Move and attack no longer apply
  independent recovery delays.
- **Wait** and **End Turn** are separate controls while the Mage is ready.
  **Wait** is available once per Mage activation and moves the Mage behind the
  actors currently ready at that simulation time without spending AP. It then
  disables until the next activation. **End Turn** always remains available to
  discard remaining AP and start the normal recovery delay.
- Every completed servant command—**Hold**, **Protect Mage**, **Pursue
  Designated Enemy**, **Secure Designated Hex**, or **Clear strategy**—costs
  1 AP. The Mage remains ready while AP remain; at zero AP the activation ends
  normally. Entering or cancelling target-selection mode is free because no
  order has been issued yet. The selected servant remains the command target
  while the Mage has AP, so the player can change or clear its order without
  reselecting it.
- A Mage command only schedules the Mage's next activation. It does not alter
  the servant's scheduled activation or make the servant act immediately.
- When a servant receives its own later activation, its autonomous resolver
  continues legal strategy actions while it can afford them. The only currently
  supported strategies are **Hold**, which stays in place but defends itself
  against an adjacent hostile, **Protect Mage**, **Pursue Designated Enemy**,
  and **Secure Designated Hex**. A servant with no Mage-issued strategy
  remembers the first hostile it currently perceives and uses legal AP-limited
  paths to engage it. If it perceives no hostile, it uses the same deterministic
  legal approach to move toward an unoccupied hex beside the Mage, then waits
  while already adjacent or blocked. An explicit strategy always takes
  precedence over this default behaviour; following stores no target memory.
  Pursuit stores one
  explicit Enemy identity and, on the servant's later activation, attacks that
  Enemy if adjacent or takes deterministic legal Ground steps toward an empty
  hex beside it. Secure stores one tactical hex: the servant advances to an
  empty target and holds it on arrival; for an occupied target it approaches
  the nearest legal adjacent hex and attacks only a hostile occupant. A servant
  already holding a Secure hex attacks only adjacent hostiles and never switches
  to default pursuit until the Mage changes or clears the order. Equal shortest
  paths use the GameMap's fixed axial-neighbour order. A blocked strategy Holds
  without losing its order. **Protect Mage** attacks perceived hostile threats
  within two hexes of the Mage, moves toward the lowest-AP reachable adjacent
  attack position when needed, and otherwise follows the Mage to the nearest
  legal empty neighbouring hex. It retains the order when blocked; if the Mage
  dies, the order clears and the servant returns to default autonomy.
- On its activation, an Enemy evaluates only hostiles within its own derived
  view range and an unblocked elevation-aware tactical sight line. It remembers
  the nearest visible hostile's position, then spends its available AP on
  adjacent attacks or legal neighbouring steps that reduce hex distance. If
  sight is lost, it continues toward that last-known position and Holds there
  when it cannot reacquire a target. Target ties use level registration order;
  equally valid local steps use axial `q`, then `r`. A defeated target is
  forgotten. This private Enemy perception never changes Mage fog or reveals
  hidden units.
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
  **Assign Protect Mage**, **Assign Pursue**, or **Assign Secure** in
  the command panel above the map.
  **Assign Pursue** enters target-selection mode: click one currently Visible
  living Enemy and store that specific Enemy as the servant's target. **Assign
  Secure** similarly requires one currently
  Visible map hex. Each completed assignment costs 1 AP; the servant acts only
  during its own later activation. Its
  order persists until the Mage replaces or clears it; a pursuit also ends when
  its Enemy dies, while a secure order ends after the servant reaches an empty
  designated hex.
- A pursuit remains valid after the servant or target leave Mage sight, but the
  command panel and amber marker expose their targets only while they are
  currently Visible. A hidden Enemy's live position and actions are never
  revealed. **Clear strategy** costs 1 AP only when it removes an active order;
  it cancels a pending target selection for free. A hidden, defeated, Enemy, or
  Neutral unit cannot receive a command and does not consume Mage AP.
- After selection, reachable Ground hexes are highlighted in green. Click one
  to move there along a valid path that fits both the unit's current movement
  range and remaining AP. Ground units may cross only an elevation difference
  of one level per entered edge. A legal Ground edge costs the base 1 AP times
  its origin field's `leavingCostMultiplier`, plus 1 AP for a one-level climb.
  A passable **Shallow Water** field uses multiplier 2: exiting it at the same
  level or downhill costs 2 AP, while climbing one level costs 3 AP. Deep
  **Water** remains impassable to Ground. Flying continues to use its existing
  1-AP edge cost where the destination permits Flying. A difference greater
  than one level in either direction is impassable to Ground. Highlights,
  clicks, and autonomous paths use the same deterministic lowest-AP legal
  path; living units block paths and destinations.
- Each resolved movement path is presented as a smooth, ordered walk through
  every entered hex. Simulation still resolves the legal destination, AP,
  occupancy, timeline, AI, and fog immediately; while its visual queue catches
  up, conflicting tactical actions are temporarily unavailable. The camera
  follows the Mage's displayed position rather than jumping to the final hex.
  The default is `180 ms` per hex through the named
  `unitMovementStepDurationMs` render configuration. A system
  `prefers-reduced-motion: reduce` preference skips the animation and leaves
  controls available with the correct final state.
- Hover a living adjacent hostile unit to see a red attack cursor and target
  highlight. Click it to deal 20 damage. A unit may attack only factions in
  its `dispositionToFactions.enemy` category.
- Use **Wait** in the timeline HUD to defer the Mage once without spending AP.
  It then disables for that activation, while **End Turn** remains available
  to finish the Mage's turn at any time.
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
elevated-observer sight-range bonuses, facing, stealth, animated attacks,
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
- HUD DOM contract tests use the development-only `jsdom` environment; they do
  not require a browser session, WebGL, or GPU.

## Notes for coding agents

Before changing behavior, identify whether the change belongs to the game domain, rendering adapter, or application composition layer. Preserve the dependency direction: `app/` may depend on `game/` and `rendering/`; `rendering/` may depend on game models; `game/` must not depend on either outer layer.
