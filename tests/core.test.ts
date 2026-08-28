import { describe, expect, it } from 'vitest';
import { BUILDINGS, GAME_CONFIG, newPlayer } from '../src/core/config';
import { buy, canUnlock, cloneState, maxAffordable, solveRates, techBuildingMultiplier, unlockTech, validateDag } from '../src/core/engine';
import { applyOffline, simulate } from '../src/core/offline';
import type { PlayerState } from '../src/core/types';

function rich(): PlayerState {
  const s = newPlayer();
  s.resources.money = 1e9;
  s.resources.energy = 1e9;
  s.resources.research = 1e9;
  return s;
}

describe('config / DAG', () => {
  it('validates the technology tree without errors', () => {
    expect(validateDag(GAME_CONFIG)).toEqual([]);
  });

  it('detects broken references and cycles', () => {
    const broken = {
      ...GAME_CONFIG,
      techs: GAME_CONFIG.techs.map((t) => (t.id === 'solar_v1' ? { ...t, requires: ['ghost'] } : t)),
    };
    expect(validateDag(broken).some((e) => e.includes('ghost'))).toBe(true);

    const cyclic: typeof GAME_CONFIG = {
      ...GAME_CONFIG,
      techs: GAME_CONFIG.techs.map((t) => {
        if (t.id === 'solar_v1') return { ...t, requires: ['quantum_core'] };
        if (t.id === 'quantum_core') return { ...t, requires: ['solar_v1'] };
        return t;
      }),
    };
    expect(validateDag(cyclic)).not.toEqual([]);
  });
});

describe('building economy', () => {
  it('single and cumulative cost, and max affordable', () => {
    const collector = BUILDINGS[0]!;
    expect(maxAffordable(collector, 0, 9)).toBe(0);
    expect(maxAffordable(collector, 0, 21.5 + 1e-9)).toBe(2);
  });

  it('bulk purchase equals individual purchases', () => {
    let a = rich();
    a.buildings.collector = 0;
    for (let i = 0; i < 10; i++) {
      const r = buy(a, GAME_CONFIG, 'collector', 1);
      if (!r.ok) throw new Error(r.error);
      a = r.state;
    }
    const b = rich();
    b.buildings.collector = 0;
    const r2 = buy(b, GAME_CONFIG, 'collector', 10);
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.state.resources.money).toBeCloseTo(a.resources.money ?? 0, 3);
    expect(r2.state.buildings.collector).toBe(10);
  });

  it('rejects unaffordable purchases', () => {
    const s = newPlayer();
    const r = buy(s, GAME_CONFIG, 'collector', 100);
    expect(r.ok).toBe(false);
  });
});

describe('technologies', () => {
  it('enforces prerequisites and cost', () => {
    const s = newPlayer();
    s.resources.money = 0;
    expect(canUnlock(s, GAME_CONFIG, 'solar_v1')).toBe(false);
    s.resources.money = 30;
    expect(canUnlock(s, GAME_CONFIG, 'solar_v1')).toBe(true);
    expect(canUnlock(s, GAME_CONFIG, 'solar_v2')).toBe(false);
  });

  it('applies production multipliers', () => {
    const r = unlockTech(rich(), GAME_CONFIG, 'solar_v1');
    if (!r.ok) throw new Error(r.error);
    expect(techBuildingMultiplier(r.state, GAME_CONFIG, 'collector')).toBe(2);
    expect(solveRates(r.state, GAME_CONFIG).perBuilding['collector']!.mult).toBe(2);
  });

  it('unlocks buildings and records level 0', () => {
    const r = unlockTech(rich(), GAME_CONFIG, 'metallurgy');
    if (!r.ok) throw new Error(r.error);
    expect(r.state.unlocked['refinery']).toBe(true);
    expect(r.state.buildings['refinery']).toBe(0);
  });
});

describe('rates', () => {
  it('collector produces pure energy', () => {
    const rates = solveRates(newPlayer(), GAME_CONFIG);
    expect(rates.net.energy).toBeCloseTo(1, 6);
    expect(rates.net.money).toBe(0);
  });

  it('refinery consumes energy and produces credits', () => {
    const s = rich();
    s.buildings.refinery = 1;
    s.unlocked.refinery = true;
    const rates = solveRates(s, GAME_CONFIG);
    expect(rates.perBuilding['refinery']!.scale).toBeCloseTo(1, 6);
    expect(rates.net.money).toBeCloseTo(2, 6);
    expect(rates.net.energy).toBeCloseTo(0.4, 6);
  });

  it('splits the energy shortfall between consumers', () => {
    const s = rich();
    s.buildings.refinery = 3;
    s.buildings.lab = 2;
    s.unlocked.refinery = true;
    s.unlocked.lab = true;
    const rates = solveRates(s, GAME_CONFIG);
    expect(rates.net.energy).toBeGreaterThanOrEqual(-1e-9);
    expect(rates.net.money).toBeGreaterThan(0);
    expect(rates.net.research).toBeGreaterThan(0);
  });
});

describe('offline progress', () => {
  it('applies one day of energy at level 1 rate', () => {
    const res = applyOffline(newPlayer(), GAME_CONFIG, 24 * 3_600_000);
    expect(res.appliedMs).toBe(24 * 3_600_000);
    expect(res.gains.energy).toBeCloseTo(24 * 3600, 0);
    expect(res.state.resources.energy).toBeCloseTo(24 * 3600, 0);
    expect(res.state.resources.money).toBe(60);
  });

  it('supply == demand keeps energy at zero', () => {
    const s = rich();
    s.resources.energy = 0;
    s.buildings.collector = 3;
    s.buildings.refinery = 2;
    s.buildings.lab = 2;
    s.unlocked.refinery = true;
    s.unlocked.lab = true;
    const res = applyOffline(s, GAME_CONFIG, 3_600_000);
    expect(res.state.resources.energy).toBeCloseTo(0, 3);
    expect(res.gains.money).toBeCloseTo(3.8 * 3600, 0);
    expect(res.gains.research).toBeCloseTo(3600, 0);
  });

  it('never leaves negative resources or losses', () => {
    const s = rich();
    s.resources.energy = 5;
    s.buildings.refinery = 20;
    s.unlocked.refinery = true;
    s.buildings.lab = 20;
    s.unlocked.lab = true;
    const res = applyOffline(s, GAME_CONFIG, 30 * 3_600_000);
    for (const r of GAME_CONFIG.resources) {
      expect(res.state.resources[r.id]).toBeGreaterThanOrEqual(0);
      expect(res.gains[r.id]).toBeGreaterThanOrEqual(0);
    }
  });

  it('respects the offline time cap', () => {
    const res = applyOffline(newPlayer(), GAME_CONFIG, 100 * 3_600_000);
    expect(res.capped).toBe(true);
    expect(res.appliedMs).toBe(48 * 3_600_000);
    expect(res.gains.energy).toBeCloseTo(48 * 3600, 0);
  });

  it('is deterministic', () => {
    const s = rich();
    s.buildings.refinery = 3;
    s.unlocked.refinery = true;
    expect(JSON.stringify(applyOffline(s, GAME_CONFIG, 9_000_000))).toBe(
      JSON.stringify(applyOffline(s, GAME_CONFIG, 9_000_000)),
    );
  });

  it('stepwise integration approximates the exact solve', () => {
    const s = rich();
    s.buildings.refinery = 3;
    s.unlocked.refinery = true;
    const exact = applyOffline(s, GAME_CONFIG, 3_600_000).state.resources.money ?? 0;
    let cur = cloneState(s);
    for (let i = 0; i < 3600; i++) cur = simulate(cur, GAME_CONFIG, 1000);
    expect(Math.abs((cur.resources.money ?? 0) - exact)).toBeLessThan(1.5);
  });
});

describe('full progression', () => {
  it('starts, buys, unlocks and grows without deadlocks', () => {
    let s = rich();
    const buyUp = (id: string) => {
      const r = buy(s, GAME_CONFIG, id);
      if (!r.ok) throw new Error(`buy ${id}: ${r.error}`);
      s = r.state;
    };
    const buyUntil = (id: string, target: number) => {
      while ((s.buildings[id] ?? 0) < target) buyUp(id);
    };
    const unlock = (id: string) => {
      const r = unlockTech(s, GAME_CONFIG, id);
      if (!r.ok) throw new Error(`unlock ${id}: ${r.error}`);
      s = r.state;
    };

    buyUntil('collector', 5);
    unlock('metallurgy');
    buyUp('refinery');
    unlock('solar_v1');
    unlock('solar_v2');
    unlock('automation');
    buyUntil('collector', 8);
    buyUntil('refinery', 4);

    const mid = solveRates(s, GAME_CONFIG);
    expect(mid.net.money).toBeGreaterThan(0);
    expect(mid.net.energy).toBeGreaterThan(-1e-9);

    const before = s.resources.money ?? 0;
    const off = applyOffline(s, GAME_CONFIG, 12 * 3_600_000);
    expect(off.state.resources.money).toBeGreaterThan(before);
    s = off.state;

    unlock('turbines');
    unlock('lab_blueprint');
    buyUp('wind_turbine');
    buyUntil('lab', 3);
    unlock('solar_v3');
    unlock('logistics');
    unlock('grid_boost');

    const final = solveRates(s, GAME_CONFIG);
    expect(final.net.money).toBeGreaterThan(0);
    expect(final.net.research).toBeGreaterThan(0);
    expect(final.perBuilding['collector']!.mult).toBeGreaterThan(1);
    expect(s.techs['grid_boost']).toBe(true);
  });
});