import type { HexCoord } from "@/game/types";

/**
 * Private Enemy knowledge. Coordinates are copied at the boundary so later
 * unit movement cannot mutate the remembered last-seen position.
 */
export class EnemyTacticalMemory {
  private readonly lastKnownHostileByEnemyId = new Map<string, LastKnownHostile>();

  rememberHostilePosition(
    enemyId: string,
    hostileId: string,
    position: HexCoord,
  ): void {
    this.lastKnownHostileByEnemyId.set(enemyId, {
      hostileId,
      position: { ...position },
    });
  }

  getLastKnownHostilePosition(enemyId: string): HexCoord | undefined {
    const memory = this.lastKnownHostileByEnemyId.get(enemyId);
    return memory ? { ...memory.position } : undefined;
  }

  clear(enemyId: string): void {
    this.lastKnownHostileByEnemyId.delete(enemyId);
  }

  /** A dead hostile must not remain an autonomous pursuit destination. */
  forgetHostile(hostileId: string): void {
    for (const [enemyId, memory] of this.lastKnownHostileByEnemyId) {
      if (memory.hostileId === hostileId) {
        this.lastKnownHostileByEnemyId.delete(enemyId);
      }
    }
  }
}

interface LastKnownHostile {
  readonly hostileId: string;
  readonly position: HexCoord;
}
