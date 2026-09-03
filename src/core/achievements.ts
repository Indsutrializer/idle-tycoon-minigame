import { ACHIEVEMENTS, TECHS } from './config';
import type {
  AchievementCondition,
  PlayerState,
} from './types';

export function checkCondition(condition: AchievementCondition, state: PlayerState): boolean {
  switch (condition.type) {
    case 'resource_total':
      return (state.stats.earned[condition.resource] ?? 0) >= condition.amount;
    case 'building_count': {
      let total = 0;
      for (const id of Object.keys(state.buildings)) {
        if (condition.building && id !== condition.building) continue;
        total += state.buildings[id] ?? 0;
      }
      return total >= condition.amount;
    }
    case 'building_level':
      return (state.buildings[condition.building] ?? 0) >= condition.amount;
    case 'tech_count': {
      let count = 0;
      for (const id of Object.keys(state.techs)) {
        if (state.techs[id]) count++;
      }
      return count >= condition.amount;
    }
    case 'all_techs':
      for (const t of TECHS) {
        if (!state.techs[t.id]) return false;
      }
      return TECHS.length > 0;
    case 'trades_done':
      return (state.stats.totalTrades ?? 0) >= condition.amount;
  }
}

export function checkAllAchievements(state: PlayerState): string[] {
  const newlyUnlocked: string[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (state.achievements[ach.id]) continue;
    if (checkCondition(ach.condition, state)) {
      newlyUnlocked.push(ach.id);
    }
  }
  return newlyUnlocked;
}

export function achievementBuildingMultiplier(state: PlayerState, buildingId: string): number {
  let m = 1;
  for (const ach of ACHIEVEMENTS) {
    if (!state.achievementClaimed[ach.id]) continue;
    const r = ach.reward;
    if (r.t === 'building_output' && (r.building === undefined || r.building === buildingId)) {
      m *= r.multiplier;
    }
    if (r.t === 'global_output') m *= r.multiplier;
  }
  return m;
}

export function achievementCostMultiplier(state: PlayerState, type: 'building' | 'tech'): number {
  let m = 1;
  for (const ach of ACHIEVEMENTS) {
    if (!state.achievementClaimed[ach.id]) continue;
    const r = ach.reward;
    if (type === 'building' && r.t === 'building_cost') m *= r.multiplier;
    if (type === 'tech' && r.t === 'tech_cost') m *= r.multiplier;
  }
  return m;
}

export function achievementTradeMultiplier(state: PlayerState): number {
  let m = 1;
  for (const ach of ACHIEVEMENTS) {
    if (!state.achievementClaimed[ach.id]) continue;
    const r = ach.reward;
    if (r.t === 'trade_rate') m *= r.multiplier;
  }
  return m;
}

export function achievementGlobalMultiplier(state: PlayerState): number {
  let m = 1;
  for (const ach of ACHIEVEMENTS) {
    if (!state.achievementClaimed[ach.id]) continue;
    const r = ach.reward;
    if (r.t === 'global_output') m *= r.multiplier;
  }
  return m;
}
