/**
 * Private default-engagement memory for autonomous Player-faction servants.
 * It stores unit identities only; target position stays in GameSession.
 */
export class ServantTacticalMemory {
  private readonly defaultTargetIdByServantId = new Map<string, string>();

  getDefaultTargetId(servantId: string): string | undefined {
    return this.defaultTargetIdByServantId.get(servantId);
  }

  rememberDefaultTarget(servantId: string, targetId: string): void {
    this.defaultTargetIdByServantId.set(servantId, targetId);
  }

  clear(servantId: string): void {
    this.defaultTargetIdByServantId.delete(servantId);
  }

  /** Removes a defeated or otherwise invalid target from every servant. */
  forgetTarget(targetId: string): void {
    for (const [servantId, rememberedTargetId] of this.defaultTargetIdByServantId) {
      if (rememberedTargetId === targetId) {
        this.defaultTargetIdByServantId.delete(servantId);
      }
    }
  }
}
