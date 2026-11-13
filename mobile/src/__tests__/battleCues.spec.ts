import * as Haptics from 'expo-haptics';
import type { BattleEvent } from '../domain/battle';
import { cueFor } from '../platform/battleCues';

function event(partial: Partial<BattleEvent>): BattleEvent {
  return { seq: 1, kind: 'DAMAGE', target: 'ENEMY', source: 'PLAYER', ...partial };
}

describe('som e vibração de cada golpe', () => {
  it('crítico pesa mais que golpe comum', () => {
    expect(cueFor(event({ crit: true }), 0)).toMatchObject({
      cue: 'crit',
      haptic: Haptics.ImpactFeedbackStyle.Heavy,
    });
    expect(cueFor(event({}), 0)).toMatchObject({
      cue: 'hit',
      haptic: Haptics.ImpactFeedbackStyle.Light,
    });
  });

  it('apanhar vibra mais do que bater', () => {
    expect(cueFor(event({ target: 'PLAYER', source: 'ENEMY' }), 0)?.haptic).toBe(
      Haptics.ImpactFeedbackStyle.Medium,
    );
  });

  it('cura, escudo e esquiva têm som próprio; golpe em si mesmo não faz whoosh', () => {
    expect(cueFor(event({ kind: 'HEAL', target: 'PLAYER' }), 0)?.cue).toBe('heal');
    expect(cueFor(event({ kind: 'SHIELD', target: 'PLAYER' }), 0)?.cue).toBe('shield');
    expect(cueFor(event({ kind: 'MISS' }), 0)?.cue).toBe('whoosh');
    expect(cueFor(event({ kind: 'CAST', target: 'PLAYER', source: 'PLAYER' }), 0)).toBeNull();
    expect(cueFor(event({ kind: 'KO' }), 0)).toBeNull();
  });

  it('cada evento toca depois do anterior', () => {
    const first = cueFor(event({}), 0)?.at ?? 0;
    const second = cueFor(event({}), 1)?.at ?? 0;
    expect(second).toBeGreaterThan(first);
  });
});
