# Web Hex Game — Engineering Rules

These instructions apply to every code change in this repository.

## Scope and delivery

- Implement only the agreed Jira User Story or explicitly requested fix. Do not
  add speculative mechanics, refactor unrelated code, or alter level topology
  without Product Owner approval.
- A User Story is one reviewable delivery unit. Stop after it is implemented,
  tested, and documented so the Product Owner can review and create the manual
  commit before the next Story begins.
- Never create commits, push branches, reset history, or overwrite user work.
- Keep Jira status and implementation comments current. Write Jira tickets in
  English, but do not create or change tickets before the Product Owner accepts
  the proposed plan.
- Use only agents and roles explicitly approved by the Product Owner. Do not
  create additional roles or delegate work without that approval.

## TypeScript and domain conventions

- Use strict TypeScript. Prefer `readonly` data, narrow unions, and explicit
  return types for public APIs and non-trivial helpers.
- Every gameplay/serialized enum must use explicit stable string values.
  Use enums for finite domain concepts; use named constants for presentation
  copy, configuration values, offsets, costs, and other non-domain literals.
- Keep a one-off, obvious UI label local when that is clearer. Extract UI copy
  into a named constant when it is repeated or carries gameplay, accessibility,
  or interaction meaning.
- Do not introduce magic numbers or unexplained string literals. Give values a
  descriptive name close to their owning module. This includes gameplay costs,
  ranges, render offsets, cursor hotspots, and non-obvious geometry formulae.
- Prefer clear names over abbreviated names. Keep one responsibility per class,
  module, or helper.
- Do not use unexplained shortened or abbreviated variable, parameter, or
  helper names; prefer complete names when they improve clarity.
- Do not use `any`, unsafe casts, or implicit mutable shared state to avoid a
  type error. Model the valid state explicitly instead.
- Preserve deterministic behaviour: define stable tie-breakers for target,
  path, and timeline decisions.

## Architecture boundaries

- `src/game/` owns gameplay state and rules. It must not depend on the DOM,
  Three.js, browser APIs, or rendering state.
- `GameSession` is the authoritative tactical state boundary. Controllers adapt
  user intent and synchronize presentation; they must not duplicate game rules.
- `src/rendering/` and `src/app/` consume safe domain projections. Rendering
  must not mutate gameplay state or infer hidden information.
- Presentation reads must be side-effect free. Reading a HUD, queue, cursor,
  or highlight model must not silently change selection, commands, strategies,
  or other gameplay state.
- Treat visibility and private AI memory as data-security boundaries: hidden
  unit identity, position, targets, and actions must never leak through HUD,
  cursors, highlights, queue cards, logs, or renderer state.
- Keep gameplay calculations event-driven. Do not run pathfinding, visibility,
  timeline, or AI logic from the render loop.

## Performance and rendering

- Reuse meshes, materials, buffers, maps, and temporary collections in steady
  rendering paths. Avoid per-frame object allocation where a reusable structure
  is practical.
- Make animation presentation-only: the domain resolves the final legal state
  immediately, and visual playback never changes rules, AP, occupancy, AI, or
  visibility.
- Keep UI controls responsive for desktop and mobile. Use accessible semantic
  elements, labels, keyboard/focus behaviour, and clear unavailable states.
- Do not launch or request a browser session to validate WebGL/GPU rendering:
  the available browser does not provide usable GPU support. Do not claim a
  visual rendering check from it; use automated checks and leave visual GPU
  acceptance to the Product Owner's manual review.

## Tests and verification

- Add or update focused automated tests for every changed rule, public API, and
  regression. Test edge cases and negative paths, not only happy paths.
- A refactored module needs complete behavioural and regression coverage for
  the responsibility being moved or changed. Do not use a numeric coverage
  percentage as a substitute for meaningful test cases.
- Test domain rules independently from DOM and rendering. Where a UI module is
  changed, add interaction and accessibility tests for its relevant states.
- Before handoff, run:

  ```bash
  npm test -- --run
  npm run build
  git diff --check
  ```

- Report any known build warning separately from failures. Do not weaken tests
  or lower type-safety merely to make verification pass.

## Documentation and data

- Keep `README.md` accurate for player-visible controls, costs, behaviour, and
  deferred systems.
- Add only concise, dated feature entries to `CHANGELOG.md`. Do not add entries
  solely for implementation corrections or review feedback within the same
  feature delivery.
- Level JSON must use explicit enum string values and remain valid as a
  reproducible test fixture.
