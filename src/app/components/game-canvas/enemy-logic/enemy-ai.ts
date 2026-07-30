export type EnemyBehaviorType = 'chaser' | 'ambusher';

export function getEnemyBehaviorType(enemy: any, difficulty: string): EnemyBehaviorType {
  const normalized = (difficulty || 'MEDIUM').toUpperCase();

  if (normalized === 'HARD') {
    return enemy.behaviorType === 'ambusher' ? 'ambusher' : 'chaser';
  }

  return 'chaser';
}

export function updateEnemyMovement(enemy: any, target: any, difficulty: string, enemyRadius = 12, time = 0) {
  const normalized = (difficulty || 'MEDIUM').toUpperCase();
  const behavior = getEnemyBehaviorType(enemy, normalized);

  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;

  const baseSpeed = enemy.speed || 1.2;
  let vx = (dx / distance) * baseSpeed;
  let vy = (dy / distance) * baseSpeed;

  if (behavior === 'ambusher') {
    // Ambusher: Patrulla y luego explosión de velocidad
    const patrolCycle = 12000;
    const cyclePos = (time + enemyRadius * 1000) % patrolCycle;
    const waitTime = 7000;
    
    if (cyclePos < waitTime) {
      const patrolAngle = Math.sin((time + enemyRadius) / 2000) * Math.PI * 0.3;
      const lateralX = Math.cos(patrolAngle) * 0.3;
      const lateralY = Math.sin(patrolAngle) * 0.3;
      vx = vx * 0.4 + lateralX * baseSpeed;
      vy = vy * 0.4 + lateralY * baseSpeed;
    } else {
      const burstStrength = normalized === 'HARD' ? 1.8 : 1.3;
      vx *= burstStrength;
      vy *= burstStrength;
      const lateralX = -vy * 0.5;
      const lateralY = vx * 0.5;
      vx += lateralX;
      vy += lateralY;
    }
  }

  if (behavior === 'chaser') {
    // Chaser es directo y agresivo: persigue constantemente
    const aggressionFactor = normalized === 'HARD' ? 1.5 : 1.1;
    vx *= aggressionFactor;
    vy *= aggressionFactor;
  }

  const speedScale = normalized === 'HARD' ? 1.18 : normalized === 'MEDIUM' ? 1.05 : 1;
  const speed = baseSpeed * speedScale;

  return {
    vx: vx * speed,
    vy: vy * speed,
    behavior,
    distance
  };
}
