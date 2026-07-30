export function selectEnemyTargetId(enemy: any, players: Record<string, any> | undefined, deadPlayers: Set<string> | undefined): string | null {
  if (!players) return null;

  let nearestId: string | null = null;
  let nearestDist = Infinity;

  for (const [playerId, player] of Object.entries(players) as any) {
    if (deadPlayers?.has(playerId)) continue;
    const dx = player.x - (enemy.x || 0);
    const dy = player.y - (enemy.y || 0);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestId = playerId;
    }
  }

  return nearestId;
}

export function getEnemyCaptureThreshold(enemy: any, player: any): number {
  const playerSize = Math.max(player?.width || 20, player?.height || 20);
  return (enemy.radius || 12) + playerSize * 0.6;
}
