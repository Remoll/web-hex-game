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
an Enemy, and a Neutral unit. All units begin with 100 HP, 20 attack power,
Ground movement, and a movement range of three hexes.

### Mage vision and exploration

The encounter is a radius-6 hex map (127 fields). Its original radius-2
terrain layout, including terrain and elevation values, is preserved at the
centre; the additional outer rings are exploration space.

The Mage is the only current source of player sight and has a fixed view range
of four hexes. Visibility is recalculated only when relevant game state changes
(currently session setup and Mage movement), never by the render loop.

- **Undiscovered** hexes are covered by black fog.
- **Discovered** hexes retain visible terrain under translucent fog, but units
  and remains are hidden.
- **Visible** hexes show terrain, living units, and remains normally.

Player-faction units can be selected only while currently Visible to the Mage.
Hovering or clicking a hidden unit remains unavailable and reveals no unit
information.

- Hover a Player-faction unit to see the selection cursor, then click it to
  select it. Only Player-faction units are controllable in this slice.
- After selection, reachable Ground hexes are highlighted in green. Click one
  to move there along a valid path of up to three hexes. Every entered hex has
  a cost of one; unused movement remains available until the three-point pool
  is exhausted. Living units block paths and destinations.
- Hover a living adjacent hostile unit to see a red attack cursor and target
  highlight. Click it to deal 20 damage. A unit may attack only factions in
  its `dispositionToFactions.enemy` category.
- Movement does not consume the unit's attack action. An attack exhausts the
  action and any remaining movement; a future round system will restore both
  through the existing domain reset API. There is intentionally no turn UI yet.
- Living units display a health bar. At zero HP, a unit becomes non-interactive
  and leaves a visual-only temporary remains marker. Remains do not block
  movement or receive input.

The canvas uses the unavailable cursor by default (including empty hexes before
selection), then switches to temporary selection, move, or attack cursor art
when that action is valid.
They are placeholders under `public/cursors/` and will be replaced by final
game assets later.

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

The Event Timeline, turns/rounds, enemy AI, standing orders, counterattacks,
player win/lose conditions, terrain cost multipliers, height-based line of
sight, facing, stealth, animated movement/attacks, interactive remains, final
cursor art, and final unit art are intentionally deferred.

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
