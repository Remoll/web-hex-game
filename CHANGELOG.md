# Changelog

All notable changes to this project are documented in this file.

## 2026-08-27

- Added sight-limited Enemy pursuit with deterministic local movement,
  last-known-hostile memory, and autonomous melee attacks.
- Added Mage-issued, visibility-gated autonomous servant strategies with the
  initial Hold order and Mage-only direct tactical control.
- Added derived Might, Finesse, Vitality, and Insight attributes to tactical
  units, including level serialization and current combat, tempo, and vision
  effects.
- Added a deterministic discrete Event Timeline for Mage movement, attacks,
  and waiting, with named integer action costs and a minimal timeline HUD.
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
