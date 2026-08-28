import { GAME_CONFIG } from './core/config';
import { buy as engineBuy, maxAffordable, solveRates, unlockTech } from './core/engine';
import { applyOffline, simulate } from './core/offline';
import type { OfflineGains, PlayerState, Rates } from './core/types';
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
  maxBuyQty(buildingId: string): number;
  canUnlock(techId: string): boolean;
  persist(): void;
  reset(): void;
  subscribe(fn: GameListener): () => void;
  notify(): void;
}

function newPlayerState(): PlayerState {
  return {
    version: GAME_CONFIG.version,
    resources: { money: 60, energy: 0, research: 0 },
    buildings: { collector: 1 },
    unlocked: { collector: true },
    techs: {},
    stats: { earned: { money: 0, energy: 0, research: 0 } },
  };
}

export function createStore(): Store {
  const config = GAME_CONFIG;
  let state: PlayerState;
  let report: OfflineGains | null = null;
  let lastTick = Date.now();
  let gen = 0;
  const listeners = new Set<GameListener>();

  const notify = () => {
    for (const fn of listeners) fn();
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
      if (dt > 0) {
        state = simulate(state, config, dt);
        notify();
      }
    },
    buy(buildingId, qty) {
      const res = engineBuy(state, config, buildingId, qty);
      if (!res.ok) return res.error;
      state = res.state;
      gen++;
      notify();
      return null;
    },
    unlock(techId) {
      const res = unlockTech(state, config, techId);
      if (!res.ok) return res.error;
      state = res.state;
      gen++;
      notify();
      return null;
    },
    maxBuyQty(buildingId) {
      const def = config.buildings.find((b) => b.id === buildingId);
      if (!def || !state.unlocked[buildingId]) return 0;
      return maxAffordable(def, state.buildings[buildingId] ?? 0, Math.floor(state.resources.money ?? 0));
    },
    canUnlock(techId) {
      const t = config.techs.find((x) => x.id === techId);
      if (!t || state.techs[techId]) return false;
      for (const r of t.requires) if (!state.techs[r]) return false;
      return Math.floor(state.resources[t.cost.resource] ?? 0) >= t.cost.amount;
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
    notify,
  };

  store.persist();
  return store;
}