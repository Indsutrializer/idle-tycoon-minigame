import { GAME_CONFIG } from './core/config';
import {
  buy as engineBuy,
  cloneState,
  exchange as engineExchange,
  maxExchange as engineMaxExchange,
  maxAffordable,
  solveRates,
  unlockTech,
} from './core/engine';
import { applyOffline, simulate } from './core/offline';
import type { AchievementDef, OfflineGains, PlayerState, Rates, ResourceId } from './core/types';
import { checkAllAchievements } from './core/achievements';
import { clearGame, loadGame, migrate, saveGame } from './storage';

export type GameListener = () => void;

export interface Store {
  readonly config: typeof GAME_CONFIG;
  gen: number;
  state: PlayerState;
  rates: Rates;
  report: OfflineGains | null;
  tick(now: number): void;
  buy(buildingId: string, qty: number): string | null;
  unlock(techId: string): string | null;
  exchange(from: string, to: string, amount: number): string | null;
  maxExchange(from: string, to: string): number;
  maxBuyQty(buildingId: string): number;
  canUnlock(techId: string): boolean;
  claimAchievement(id: string): string | null;
  pendingAchievements(): AchievementDef[];
  persist(): void;
  reset(): void;
  subscribe(fn: GameListener): () => void;
  subscribeAchievement(fn: AchievementListener): () => void;
  notify(): void;
}

export type AchievementListener = (ids: string[]) => void;

function newPlayerState(): PlayerState {
  return {
    version: GAME_CONFIG.version,
    resources: { money: 60, energy: 0, research: 0 },
    buildings: { collector: 1 },
    unlocked: { collector: true },
    techs: {},
    stats: { earned: { money: 0, energy: 0, research: 0 }, totalTrades: 0 },
    achievements: {},
    achievementClaimed: {},
  };
}

export function createStore(): Store {
  const config = GAME_CONFIG;
  let state: PlayerState;
  let report: OfflineGains | null = null;
  let lastTick = Date.now();
  let gen = 0;
  const listeners = new Set<GameListener>();
  const achListeners = new Set<AchievementListener>();
  let tickCount = 0;

  const notify = () => {
    for (const fn of listeners) fn();
  };

  const notifyAchievements = (ids: string[]) => {
    if (ids.length === 0) return;
    for (const fn of achListeners) fn(ids);
  };

  const checkAndUnlockAchievements = () => {
    const newlyUnlocked = checkAllAchievements(state);
    if (newlyUnlocked.length > 0) {
      state = cloneState(state);
      for (const id of newlyUnlocked) {
        state.achievements[id] = true;
      }
      gen++;
      notifyAchievements(newlyUnlocked);
    }
  };

  const saved = loadGame();
  if (saved) {
    const migrated = migrate(saved);
    const elapsed = Math.max(0, Date.now() - saved.lastSeenAt);
    if (elapsed > 2000) {
      const res = applyOffline(migrated, config, elapsed);
      state = res.state;
      report = res;
    } else {
      state = migrated;
    }
  } else {
    state = newPlayerState();
  }

  const store: Store = {
    config,
    get gen() {
      return gen;
    },
    get state() {
      return state;
    },
    get rates() {
      return solveRates(state, config);
    },
    get report() {
      return report;
    },
    tick(now) {
      lastTick = lastTick || now;
      const dt = Math.min(10_000, Math.max(0, now - lastTick));
      lastTick = now;
      tickCount++;
      if (dt > 0) {
        state = simulate(state, config, dt);
        notify();
      }
      if (tickCount % 60 === 0) {
        checkAndUnlockAchievements();
      }
    },
    buy(buildingId, qty) {
      const res = engineBuy(state, config, buildingId, qty);
      if (!res.ok) return res.error;
      state = res.state;
      gen++;
      notify();
      checkAndUnlockAchievements();
      return null;
    },
    unlock(techId) {
      const res = unlockTech(state, config, techId);
      if (!res.ok) return res.error;
      state = res.state;
      gen++;
      notify();
      checkAndUnlockAchievements();
      return null;
    },
    maxBuyQty(buildingId) {
      const def = config.buildings.find((b) => b.id === buildingId);
      if (!def || !state.unlocked[buildingId]) return 0;
      return maxAffordable(def, state.buildings[buildingId] ?? 0, Math.floor(state.resources.money ?? 0));
    },
    exchange(from, to, amount) {
      const res = engineExchange(state, config, from as ResourceId, to as ResourceId, amount);
      if (!res.ok) return res.error;
      state = cloneState(res.state);
      state.stats.totalTrades = (state.stats.totalTrades ?? 0) + 1;
      gen++;
      notify();
      checkAndUnlockAchievements();
      return null;
    },
    maxExchange(from, to) {
      return engineMaxExchange(state, config, from as ResourceId, to as ResourceId);
    },
    canUnlock(techId) {
      const t = config.techs.find((x) => x.id === techId);
      if (!t || state.techs[techId]) return false;
      for (const r of t.requires) if (!state.techs[r]) return false;
      return Math.floor(state.resources[t.cost.resource] ?? 0) >= t.cost.amount;
    },
    claimAchievement(id) {
      if (!state.achievements[id]) return 'NOT_UNLOCKED';
      if (state.achievementClaimed[id]) return 'ALREADY_CLAIMED';
      state = cloneState(state);
      state.achievementClaimed[id] = true;
      gen++;
      notify();
      return null;
    },
    pendingAchievements() {
      return config.achievements.filter((a) => state.achievements[a.id] && !state.achievementClaimed[a.id]);
    },
    persist() {
      saveGame({ state, lastSeenAt: Date.now() });
    },
    reset() {
      clearGame();
      state = newPlayerState();
      report = null;
      gen++;
      notify();
      store.persist();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    subscribeAchievement(fn) {
      achListeners.add(fn);
      return () => {
        achListeners.delete(fn);
      };
    },
    notify,
  };

  store.persist();
  return store;
}