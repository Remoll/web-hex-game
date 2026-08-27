# Changelog

All notable changes to this project are documented in this file.

## 2026-08-27

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
