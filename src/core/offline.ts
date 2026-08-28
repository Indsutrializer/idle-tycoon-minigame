import type { GameConfig, OfflineGains, PlayerState } from './types';
import {
  buildingRate,
  cloneState,
  globalMultiplier,
  offlineCapMs,
  techBuildingMultiplier,
  zeroMap,
} from './engine';

function flows(state: PlayerState, config: GameConfig, scale: Map<string, number>) {
  const P = zeroMap(config);
  const C = zeroMap(config);
  const global = globalMultiplier(state, config);
  for (const b of config.buildings) {
    const level = state.buildings[b.id] ?? 0;
    if (level <= 0) continue;
    const s = scale.get(b.id) ?? 1;
    const out = buildingRate(b, level) * techBuildingMultiplier(state, config, b.id) * global * s;
    P[b.output] += out;
    if (b.input) C[b.input.resource] += b.input.perLevel * level * s;
  }
  return { P, C };
}

export function simulate(state: PlayerState, config: GameConfig, dtMs: number): PlayerState {
  const next = cloneState(state);
  const stock = next.resources;
  const scale = new Map<string, number>();
  let remaining = dtMs;
  let guard = 0;

  while (remaining > 0.5 && guard++ < 64) {
    const { P, C } = flows(state, config, scale);
    let tEvent: number | null = null;
    for (const r of config.resources) {
      const p = P[r.id] ?? 0;
      const c = C[r.id] ?? 0;
      if (c <= p + 1e-12) continue;
      const s = stock[r.id] ?? 0;
      const tStar = s <= 0 ? 0 : s / (c - p);
      if (tEvent === null || tStar < tEvent) tEvent = tStar;
    }

    if (tEvent === null) {
      for (const r of config.resources) {
        stock[r.id] = (stock[r.id] ?? 0) + ((P[r.id] ?? 0) - (C[r.id] ?? 0)) * (remaining / 1000);
      }
      remaining = 0;
      break;
    }

    const dt = Math.min(remaining, Math.max(0, tEvent));
    for (const r of config.resources) {
      stock[r.id] = (stock[r.id] ?? 0) + ((P[r.id] ?? 0) - (C[r.id] ?? 0)) * (dt / 1000);
    }
    remaining -= dt;

    for (const r of config.resources) {
      const p = P[r.id] ?? 0;
      const c = C[r.id] ?? 0;
      if (c <= p + 1e-12) continue;
      const s = stock[r.id] ?? 0;
      const tStar = s <= 0 ? 0 : s / (c - p);
      if (Math.abs(tStar - dt) <= 1e-9 && c > 0) {
        const ratio = Math.min(1, p / c);
        for (const b of config.buildings) {
          if (b.input && b.input.resource === r.id) {
            scale.set(b.id, (scale.get(b.id) ?? 1) * ratio);
          }
        }
      }
    }
  }

  return next;
}

export function combineGains(base: Record<string, number>, delta: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(base)) out[k] = (base[k] ?? 0) + (delta[k] ?? 0);
  return out;
}

export function applyOffline(state: PlayerState, config: GameConfig, dtMs: number): OfflineGains {
  const cap = offlineCapMs(state, config);
  const capped = dtMs > cap;
  const appliedMs = Math.min(dtMs, cap);
  const g0 = { ...state.resources };
  const simulated = simulate(state, config, appliedMs);
  const eff = config.offline.efficiency;

  const gains: Record<string, number> = {};
  for (const r of config.resources) {
    const raw = (simulated.resources[r.id] ?? 0) - (g0[r.id] ?? 0);
    const g = Math.max(0, Math.floor(raw * eff));
    gains[r.id] = g;
    simulated.resources[r.id] = Math.max(0, Math.floor((g0[r.id] ?? 0) + raw * eff));
  }
  for (const r of config.resources) {
    const gain = gains[r.id] ?? 0;
    if (gain <= 0) continue;
    simulated.stats.earned[r.id] = (simulated.stats.earned[r.id] ?? 0) + gain;
  }
  return { state: simulated, appliedMs, capped, gains };
}