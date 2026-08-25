# Web Hex Game

Live demo: https://web-hex-game.vercel.app/

A browser-based hex-grid prototype built with TypeScript, Vite, and Three.js.

## Getting started

```bash
npm install
npm run dev
```

The development server starts at the address printed by Vite. Select the player by clicking its hex, then click any other map hex to move it. Press `C` to toggle the camera mode.

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
