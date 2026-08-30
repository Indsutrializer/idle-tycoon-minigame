import { describe, expect, it } from 'vitest';
import { BUILDINGS, GAME_CONFIG, newPlayer } from '../src/core/config';
import {
  buy,
  canUnlock,
  cloneState,
  exchange,
  exchangeRateFor,
  maxAffordable,
  maxExchange,
  solveRates,
  techBuildingMultiplier,
  unlockTech,
  validateDag,
} from '../src/core/engine';
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

  it('unlocks buildings as working units that immediately produce', () => {
    const r = unlockTech(rich(), GAME_CONFIG, 'metallurgy');
    if (!r.ok) throw new Error(r.error);
    expect(r.state.unlocked['refinery']).toBe(true);
    expect(r.state.buildings['refinery']).toBe(1);
    expect(solveRates(r.state, GAME_CONFIG).perBuilding['refinery']!.output).toBeCloseTo(1.2, 6);
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
    expect(rates.net.money).toBeCloseTo(1.2, 6);
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
    expect(res.gains.money).toBeCloseTo(3.0 * 3600, 0);
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

describe('building generation and upgrade precision', () => {
  it('every building generates at its exact per-level rate with no drift', () => {
    for (const def of GAME_CONFIG.buildings) {
      for (const level of [1, 5]) {
        const s = newPlayer();
        s.resources.money = 1e9;
        s.resources.energy = 1e9;
        s.resources.research = 1e9;
        s.unlocked[def.id] = true;
        s.buildings[def.id] = level;
        if (def.id !== 'collector') s.buildings.collector = 20;

        const rates = solveRates(s, GAME_CONFIG);
        const expectedRate = def.baseRate + def.perLevelRate * (level - 1);
        expect(rates.perBuilding[def.id]).toBeTruthy();
        const pr = rates.perBuilding[def.id]!;
        expect(pr.mult).toBeCloseTo(1, 8);
        expect(pr.scale).toBeCloseTo(1, 6);
        expect(pr.output).toBeCloseTo(expectedRate, 8);
        expect(rates.gross[def.output]).toBeGreaterThan(0);

        const startEnergy = 1e6;
        const startResearch = 1e6;
        const ticked = simulate(
          { ...s, resources: { ...s.resources, energy: startEnergy, research: startResearch } },
          GAME_CONFIG,
          4000,
        );
        const gainEnergy = (ticked.resources.energy ?? 0) - startEnergy;
        const gainResearch = (ticked.resources.research ?? 0) - startResearch;
        const gainMoney = (ticked.resources.money ?? 0) - (s.resources.money ?? 0);
        expect(Math.abs(gainEnergy - (rates.net.energy ?? 0) * 4)).toBeLessThan(0.02);
        expect(Math.abs(gainMoney - (rates.net.money ?? 0) * 4)).toBeLessThan(0.02);
        expect(Math.abs(gainResearch - (rates.net.research ?? 0) * 4)).toBeLessThan(0.02);
      }
    }
  });

  it('global output multiplier applies exactly to every unit', () => {
    const s = rich();
    s.unlocked.refinery = true;
    s.buildings.refinery = 1;
    const before = solveRates(s, GAME_CONFIG).net.money ?? 0;
    s.techs.grid_boost = true;
    const after = solveRates(s, GAME_CONFIG).net.money ?? 0;
    expect(after).toBeCloseTo(before * 1.5, 8);
  });

  it('building tech multipliers compound exactly on output', () => {
    const s = rich();
    s.unlocked.refinery = true;
    s.buildings.refinery = 1;
    s.techs.metallurgy = true;
    s.techs.automation = true;
    s.techs.logistics = true;
    const pr = solveRates(s, GAME_CONFIG).perBuilding['refinery']!;
    expect(pr.mult).toBeCloseTo(4, 8);
    expect(pr.output).toBeCloseTo(1.2 * 4, 8);
  });
});

describe('exchange', () => {
  const REF_ENR = 1.8 / 0.6;
  const REF_RES = REF_ENR * (1 / 0.5);

  it('derives rates from the live production conversion, never 1:1', () => {
    const s = newPlayer();
    // energy ref = refinery per-level CRD per ENR (1.8 × mult / 0.6), sell at 25%
    expect(exchangeRateFor(s, GAME_CONFIG, 'energy', 'money')).toBeCloseTo(REF_ENR * 0.25, 6);
    // buy: 1 CRD buys back 1 / (ref × 1.6) energy
    expect(exchangeRateFor(s, GAME_CONFIG, 'money', 'energy')).toBeCloseTo(1 / (REF_ENR * 1.6), 6);
    // research ref = energy ref × (1 ENR / 0.5 RES)
    expect(exchangeRateFor(s, GAME_CONFIG, 'research', 'money')).toBeCloseTo(REF_RES * 0.25, 6);
    expect(exchangeRateFor(s, GAME_CONFIG, 'money', 'research')).toBeCloseTo(1 / (REF_RES * 1.6), 6);
    expect(exchangeRateFor(s, GAME_CONFIG, 'energy', 'research')).toBeNull();
  });

  it('re-evaluates the scale as refinery tech improves energy value', () => {
    const s = newPlayer();
    s.techs.automation = true;
    expect(exchangeRateFor(s, GAME_CONFIG, 'energy', 'money')).toBeCloseTo((REF_ENR * 2) * 0.25, 6);
    expect(exchangeRateFor(s, GAME_CONFIG, 'money', 'energy')).toBeCloseTo(1 / ((REF_ENR * 2) * 1.6), 6);
  });

  it('sells energy to escape the early credit softlock', () => {
    const s = newPlayer();
    s.resources.money = 0;
    s.resources.energy = 50;
    const r = exchange(s, GAME_CONFIG, 'energy', 'money', 30);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.resources.money).toBe(Math.floor(30 * REF_ENR * 0.25));
    expect(r.state.resources.energy).toBe(20);
    expect(r.state.stats.earned['money']).toBe(Math.floor(30 * REF_ENR * 0.25));
  });

  it('buys energy and research with credits', () => {
    const s = rich();
    const e = exchange(s, GAME_CONFIG, 'money', 'energy', 30);
    if (!e.ok) throw new Error(e.error);
    expect(e.state.resources.energy ?? 0).toBe(1e9 + Math.floor(30 * (1 / (REF_ENR * 1.6))));
    const r = exchange(e.state, GAME_CONFIG, 'money', 'research', 30);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.resources.research ?? 0).toBe(1e9 + Math.floor(30 * (1 / (REF_RES * 1.6))));
  });

  it('round-tripping is lossy so it cannot be farmed', () => {
    const s = rich();
    s.resources.energy = 0;
    const before = s.resources.money ?? 0;
    const buy = exchange(s, GAME_CONFIG, 'money', 'energy', 30);
    if (!buy.ok) throw new Error(buy.error);
    const held = buy.state.resources.energy ?? 0;
    const sell = exchange(buy.state, GAME_CONFIG, 'energy', 'money', held);
    if (!sell.ok) throw new Error(sell.error);
    expect(sell.state.resources.money ?? 0).toBeLessThan(before);
    expect(sell.state.resources.energy ?? 0).toBe(0);
  });

  it('enforces listed routes, stock and minimum trade size', () => {
    const s = newPlayer();
    expect(exchange(s, GAME_CONFIG, 'energy', 'research', 5).ok).toBe(false);
    expect(exchange(s, GAME_CONFIG, 'energy', 'money', 500).ok).toBe(false);
    expect(exchange(s, GAME_CONFIG, 'money', 'energy', 1).ok).toBe(false);
  });

  it('reports max affordable whole trades', () => {
    const s = rich();
    expect(maxExchange(s, GAME_CONFIG, 'energy', 'money')).toBe(Math.floor(s.resources.energy ?? 0));
    const unit = Math.ceil(1 / (1 / (REF_ENR * 1.6)));
    expect(maxExchange(s, GAME_CONFIG, 'money', 'energy')).toBe(Math.floor((s.resources.money ?? 0) / unit) * unit);
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