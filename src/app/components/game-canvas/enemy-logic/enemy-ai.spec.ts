import { describe, it, expect } from 'vitest';
import { getEnemyBehaviorType, updateEnemyMovement } from './enemy-ai';

describe('enemy-ai', () => {
  it('uses a direct chase in easy rooms', () => {
    expect(getEnemyBehaviorType({}, 'EASY')).toBe('chaser');
  });

  it('uses a more reactive behavior in medium rooms', () => {
    const enemy = { x: 0, y: 0, speed: 2 };
    const target = { x: 100, y: 0, vx: 8, vy: 0 };
    const result = updateEnemyMovement(enemy, target, 'MEDIUM', 16, 0);

    expect(result.vx).toBeGreaterThan(0.8);
    expect(result.vy).toBe(0);
  });

  it('adds lateral motion in hard rooms for a more Pacman-like pursuit', () => {
    const enemy = { x: 0, y: 0, speed: 2 };
    const target = { x: 100, y: 0, vx: 0, vy: 0 };
    const result = updateEnemyMovement(enemy, target, 'HARD', 16, 120);

    expect(result.vx).toBeGreaterThan(0);
    expect(result.vy).not.toBe(0);
  });
});
