import {
  GameActionPreviewType,
  type GameActionPreview,
} from "@/game/gameSession/GameSession";

export enum TacticalCursor {
  Select = "select",
  Move = "move",
  Attack = "attack",
  Unavailable = "unavailable",
}

interface CursorHotspot {
  readonly x: number;
  readonly y: number;
}

/** Pixel position within each temporary cursor image that points at a hex. */
const tacticalCursorHotspot: CursorHotspot = { x: 8, y: 8 };

function buildCursorStyle(assetPath: string, fallback: string): string {
  return `url("${assetPath}") ${tacticalCursorHotspot.x} ${tacticalCursorHotspot.y}, ${fallback}`;
}

const cursorStyles: Readonly<Record<TacticalCursor, string>> = {
  [TacticalCursor.Select]: buildCursorStyle("/cursors/select.png", "pointer"),
  [TacticalCursor.Move]: buildCursorStyle("/cursors/move.png", "move"),
  [TacticalCursor.Attack]: buildCursorStyle("/cursors/attack.png", "crosshair"),
  [TacticalCursor.Unavailable]: buildCursorStyle(
    "/cursors/unavailable.png",
    "not-allowed",
  ),
};

/** Maps semantic game intent to a browser cursor without DOM dependencies. */
export function getTacticalCursor(
  preview: GameActionPreview | undefined,
): TacticalCursor {
  if (!preview) {
    return TacticalCursor.Unavailable;
  }

  switch (preview.type) {
    case GameActionPreviewType.Selection:
    case GameActionPreviewType.ServantCommandSelection:
    case GameActionPreviewType.PursuitTargetSelection:
    case GameActionPreviewType.SecureTargetSelection:
      return TacticalCursor.Select;
    case GameActionPreviewType.ValidMove:
      return TacticalCursor.Move;
    case GameActionPreviewType.ValidAttack:
      return TacticalCursor.Attack;
    case GameActionPreviewType.OutOfRange:
      return TacticalCursor.Unavailable;
  }
}

export function getTacticalCursorStyle(cursor: TacticalCursor): string {
  return cursorStyles[cursor];
}
