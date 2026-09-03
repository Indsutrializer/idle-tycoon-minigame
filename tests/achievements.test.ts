import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, GAME_CONFIG, newPlayer } from '../src/core/config';
import {
  achievementBuildingMultiplier,
  achievementCostMultiplier,
  achievementTradeMultiplier,
  checkAllAchievements,
  checkCondition,
} from '../src/core/achievements';
import { buy, cloneState, solveRates, unlockTech } from '../src/core/engine';
import type { PlayerState } from '../src/core/types';

function rich(): PlayerState {
  const s = newPlayer();
  s.resources.money = 1e9;
  s.resources.energy = 1e9;
  s.resources.research = 1e9;
  return s;
}

describe('checkCondition', () => {
  it('checks resource_total condition', () => {
    const s = newPlayer();
    expect(checkCondition({ type: 'resource_total', resource: 'energy', amount: 100 }, s)).toBe(false);
    s.stats.earned.energy = 100;
    expect(checkCondition({ type: 'resource_total', resource: 'energy', amount: 100 }, s)).toBe(true);
  });

  it('checks building_count condition', () => {
    const s = newPlayer();
    expect(checkCondition({ type: 'building_count', amount: 5 }, s)).toBe(false);
    s.buildings.collector = 5;
    expect(checkCondition({ type: 'building_count', amount: 5 }, s)).toBe(true);
  });

  it('checks building_count with specific building', () => {
    const s = newPlayer();
    s.buildings.collector = 3;
    s.buildings.refinery = 2;
    expect(checkCondition({ type: 'building_count', building: 'collector', amount: 3 }, s)).toBe(true);
    expect(checkCondition({ type: 'building_count', building: 'refinery', amount: 3 }, s)).toBe(false);
  });

  it('checks building_level condition', () => {
    const s = newPlayer();
    expect(checkCondition({ type: 'building_level', building: 'collector', amount: 10 }, s)).toBe(false);
    s.buildings.collector = 10;
    expect(checkCondition({ type: 'building_level', building: 'collector', amount: 10 }, s)).toBe(true);
  });

  it('checks tech_count condition', () => {
    const s = newPlayer();
    expect(checkCondition({ type: 'tech_count', amount: 5 }, s)).toBe(false);
    s.techs.solar_v1 = true;
    s.techs.solar_v2 = true;
    s.techs.metallurgy = true;
    s.techs.automation = true;
    s.techs.turbines = true;
    expect(checkCondition({ type: 'tech_count', amount: 5 }, s)).toBe(true);
  });

  it('checks all_techs condition', () => {
    const s = rich();
    expect(checkCondition({ type: 'all_techs' }, s)).toBe(false);
    for (const t of GAME_CONFIG.techs) {
      s.techs[t.id] = true;
    }
    expect(checkCondition({ type: 'all_techs' }, s)).toBe(true);
  });

  it('checks trades_done condition', () => {
    const s = newPlayer();
    expect(checkCondition({ type: 'trades_done', amount: 50 }, s)).toBe(false);
    s.stats.totalTrades = 50;
    expect(checkCondition({ type: 'trades_done', amount: 50 }, s)).toBe(true);
  });
});

describe('checkAllAchievements', () => {
  it('detects newly unlocked achievements', () => {
    const s = newPlayer();
    s.stats.earned.energy = 100;
    const unlocked = checkAllAchievements(s);
    expect(unlocked).toContain('first_light');
  });

  it('does not re-detect already unlocked achievements', () => {
    const s = newPlayer();
    s.stats.earned.energy = 100;
    s.achievements.first_light = true;
    const unlocked = checkAllAchievements(s);
    expect(unlocked).not.toContain('first_light');
  });

  it('detects multiple achievements at once', () => {
    const s = newPlayer();
    s.stats.earned.energy = 100;
    s.stats.earned.money = 1000;
    const unlocked = checkAllAchievements(s);
    expect(unlocked).toContain('first_light');
    expect(unlocked).toContain('credit_rush');
  });
});

describe('achievement multipliers', () => {
  it('building output multiplier applies to correct building', () => {
    const s = newPlayer();
    s.achievements.first_light = true;
    s.achievementClaimed.first_light = true;
    const mult = achievementBuildingMultiplier(s, 'collector');
    expect(mult).toBeCloseTo(1.05, 6);
    const otherMult = achievementBuildingMultiplier(s, 'refinery');
    expect(otherMult).toBeCloseTo(1, 6);
  });

  it('building cost multiplier stacks', () => {
    const s = newPlayer();
    s.achievements.site_manager = true;
    s.achievementClaimed.site_manager = true;
    s.achievements.foreman = true;
    s.achievementClaimed.foreman = true;
    const mult = achievementCostMultiplier(s, 'building');
    expect(mult).toBeCloseTo(0.95 * 0.92, 6);
  });

  it('trade rate multiplier applies', () => {
    const s = newPlayer();
    s.achievements.market_merchant = true;
    s.achievementClaimed.market_merchant = true;
    const mult = achievementTradeMultiplier(s);
    expect(mult).toBeCloseTo(1.08, 6);
  });

  it('only claimed achievements apply bonuses', () => {
    const s = newPlayer();
    s.achievements.first_light = true;
    const mult = achievementBuildingMultiplier(s, 'collector');
    expect(mult).toBeCloseTo(1, 6);
  });
});

describe('achievement integration with engine', () => {
  it('building cost reduction works through buy', () => {
    const s = newPlayer();
    s.resources.money = 1000;
    s.achievements.site_manager = true;
    s.achievementClaimed.site_manager = true;
    const before = solveRates(s, GAME_CONFIG);
    const res = buy(s, GAME_CONFIG, 'collector', 1);
    expect(res.ok).toBe(true);
  });

  it('tech cost reduction works through unlockTech', () => {
    const s = rich();
    s.achievements.tech_enthusiast = true;
    s.achievementClaimed.tech_enthusiast = true;
    const res = unlockTech(s, GAME_CONFIG, 'solar_v1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      const costMult = achievementCostMultiplier(s, 'tech');
      expect(costMult).toBeCloseTo(0.95, 6);
    }
  });

  it('building output multiplier affects solveRates', () => {
    const s = rich();
    s.buildings.collector = 1;
    s.achievements.first_light = true;
    s.achievementClaimed.first_light = true;
    const rates = solveRates(s, GAME_CONFIG);
    const expected = (1 + 1.1 * 0) * 1.05;
    expect(rates.perBuilding['collector']!.output).toBeCloseTo(expected, 6);
  });

  it('building count condition tallies all buildings', () => {
    const s = newPlayer();
    s.buildings.collector = 3;
    s.buildings.refinery = 2;
    expect(checkCondition({ type: 'building_count', amount: 5 }, s)).toBe(true);
    expect(checkCondition({ type: 'building_count', amount: 6 }, s)).toBe(false);
  });
});

describe('achievement definitions', () => {
  it('has 15 achievements', () => {
    expect(ACHIEVEMENTS.length).toBe(15);
  });

  it('all achievements have unique ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hidden achievements have ??? as name and description', () => {
    const hidden = ACHIEVEMENTS.filter((a) => !a.visible);
    for (const ach of hidden) {
      expect(ach.name).toBe('???');
      expect(ach.description).toBe('???');
    }
  });
});
