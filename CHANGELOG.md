# Changelog

All notable changes to this project are documented in this file.

## 2026-08-30

- Added a persistent campaign roundtrip between a radius-4 Strategic Map and
  the existing tactical encounter, with explicit accessible entry, reduced-
  motion-safe transition locking, deterministic party entry formation, and
  per-area tactical/fog persistence.
- Added a reciprocal Cobblestone Tower Ground Floor route with a safe passable
  tactical entry and persistent party return.
- Added a reciprocal Cobblestone Tower Upper Floor tactical-to-tactical stair
  route with persistent party transfer.

## 2026-08-29

- Increased every timeline activation to 4 AP while preserving movement,
  attack, and servant-command costs.
- Fixed non-visible fog to mask elevated terrain caps and side-wall geometry.
- Added default event-driven behaviour for unordered Player servants to follow
  the Mage when they perceive no hostile, without changing explicit orders or
  target memory.
- Expanded the radius-9 example encounter with deliberate Deep/Shallow Water
  river sections, passable Ground fords, and a small northern hill cluster.
- Added passable **Shallow Water** with 2-AP Ground exits (3 AP uphill), while
  preserving deep-Water blocking and existing Flying traversal.
- Added persistent, separate Mage **Wait** and **End Turn** controls: Wait
  disables after its one activation use, while End Turn remains available.

## 2026-08-28

- Added 1-AP servant orders, including Protect Mage: servants defend perceived
  hostile threats within two hexes of the Mage and otherwise keep to a legal
  adjacent position, while retaining autonomous turns and fog-safe
  presentation.
- Added deterministic elevation-blocked tactical sight: an intervening field
  two or more levels above an observer hides fields beyond it while remaining
  visible itself; Mage fog and private Enemy perception now share the rule.
- Added Ground elevation traversal: adjacent level or downhill movement costs
  1 AP, a one-level climb costs 2 AP, and differences above one level are
  illegal for Mage and autonomous pathfinding.

## 2026-08-27

- Added smooth, FIFO tactical movement presentation for Mage and autonomous
  paths, including per-hex timing, fog-safe final state, health-bar movement,
  temporary action locking, and a reduced-motion immediate fallback.
- Added default autonomous servant engagement: unordered servants retain the
  first perceived hostile, pursue it with legal AP-limited paths, and re-acquire
  a target after it becomes invalid; Hold now permits adjacent self-defence.
- Added a responsive, visibility-safe bottom initiative queue with deterministic
  ordering, unknown Enemy cards, and temporary accessible map highlighting.
- Added three-AP tactical activations: path-based movement costs one AP per
  hex, melee attacks cost two AP, and each completed activation receives one
  Finesse-adjusted recovery delay.
- Added full-AP autonomous activations, allowing servants and Enemies to make
  successive legal movement and attack decisions until they exhaust AP or have
  no affordable action.
- Added a one-time Wait that defers the Mage without spending AP, followed by
  an explicit End Turn control for the remainder of that activation.
- Added Mage-issued Secure Designated Hex orders, with autonomous legal-path
  approach, hostile-only assault, and completion on reaching an empty target.
- Added Mage-issued Pursue Designated Enemy orders, with delayed autonomous
  servant pursuit, safe hidden-target handling, and target-death cleanup.
- Added sight-limited Enemy pursuit with deterministic local movement,
  last-known-hostile memory, and autonomous melee attacks.
- Added Mage-issued, visibility-gated autonomous servant strategies with the
  initial Hold order and Mage-only direct tactical control.
- Added derived Might, Finesse, Vitality, and Insight attributes to tactical
  units, including level serialization and current combat, tempo, and vision
  effects.
- Added a deterministic discrete Event Timeline and a minimal tactical HUD.
- Added a radius-6 tactical encounter with Mage-centred three-state fog of war:
  undiscovered, discovered terrain, and current visibility.
- Fixed isometric camera clipping that could expose white gaps along the lower
  extent of larger tactical maps.

## 2026-08-26

- Added Player, Enemy, and Neutral factions with explicit
  `dispositionToFactions` categories.
- Added Ground movement range, legal-path highlighting, Player-only selection,
  incremental movement spending, and provisional round-budget state.
- Added adjacent hostile attacks, health, visual-only remains, health bars,
  contextual placeholder cursors, and a four-unit example level.
- Added domain, rendering-model, input-mapping, and level-fixture tests.
- Documented tactical controls and explicitly deferred turn, AI, and advanced
  terrain systems.
