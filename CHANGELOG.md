# Changelog

All notable changes to this project are documented in this file.

## 2026-08-27

- Added a radius-6 tactical encounter with Mage-centred three-state fog of war:
  undiscovered, discovered terrain, and current visibility.

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
