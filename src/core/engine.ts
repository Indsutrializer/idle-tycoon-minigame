import type {
  BuildingDef,
  Effect,
  GameConfig,
  PlayerState,
  Rates,
  ResourceId,
} from './types';

export function cloneState(s: PlayerState): PlayerState {
  return {
    ...s,
    resources: { ...s.resources },
    buildings: { ...s.buildings },
    unlocked: { ...s.unlocked },
    techs: { ...s.techs },
    stats: { ...s.stats, earned: { ...s.stats.earned } },
  };
}

export function zeroMap(config: GameConfig): Record<ResourceId, number> {
  const m: Record<string, number> = {};
  for (const r of config.resources) m[r.id] = 0;
  return m;
}

export function techBuildingMultiplier(state: PlayerState, config: GameConfig, building: string): number {
  let m = 1;
  for (const t of config.techs) {
    if (!state.techs[t.id]) continue;
    for (const e of t.effects) {
      if (e.t === 'multiply_building_output' && e.building === building) m *= e.multiplier;
    }
  }
  return m;
}

export function globalMultiplier(state: PlayerState, config: GameConfig): number {
  let m = 1;
  for (const t of config.techs) {
    if (!state.techs[t.id]) continue;
    for (const e of t.effects) {
      if (e.t === 'add_global_output') m *= e.multiplier;
    }
  }
  return m;
}

export function offlineCapMs(state: PlayerState, config: GameConfig): number {
  let h = config.offline.maxHours;
  for (const t of config.techs) {
    if (!state.techs[t.id]) continue;
    for (const e of t.effects) {
      if (e.t === 'offline_cap') h *= e.multiplier;
    }
  }
  return h * 3_600_000;
}

export function buildingRate(def: BuildingDef, level: number): number {
  return def.baseRate + def.perLevelRate * (level - 1);
}

export function buildingCost(def: BuildingDef, level: number): number {
  return def.costBase * Math.pow(def.costGrowth, level);
}

export function bulkCost(def: BuildingDef, level: number, qty: number): number {
  let total = 0;
  for (let i = 0; i < qty; i++) total += buildingCost(def, level + i);
  return total;
}

export function maxAffordable(def: BuildingDef, level: number, budget: number): number {
  let total = 0;
  let qty = 0;
  for (let i = 0; i < 512; i++) {
    const c = buildingCost(def, level + qty);
    if (total + c > budget + 1e-9) break;
    total += c;
    qty++;
  }
  return qty;
}

export function isUnlocked(state: PlayerState, buildingId: string): boolean {
  return state.unlocked[buildingId] === true;
}

export function canBuy(state: PlayerState, config: GameConfig, buildingId: string, qty = 1): boolean {
  const def = config.buildings.find((b) => b.id === buildingId);
  if (!def) return false;
  if (!isUnlocked(state, buildingId)) return false;
  const level = state.buildings[buildingId] ?? 0;
  const cost = bulkCost(def, level, qty);
  return Math.floor(state.resources.money ?? 0) >= cost;
}

export function buy(state: PlayerState, config: GameConfig, buildingId: string, qty = 1): { ok: true; state: PlayerState } | { ok: false; error: string } {
  const def = config.buildings.find((b) => b.id === buildingId);
  if (!def) return { ok: false, error: 'UNKNOWN_BUILDING' };
  if (!isUnlocked(state, buildingId)) return { ok: false, error: 'LOCKED' };
  const level = state.buildings[buildingId] ?? 0;
  const cost = bulkCost(def, level, qty);
  if (Math.floor(state.resources.money ?? 0) < cost) return { ok: false, error: 'INSUFFICIENT_FUNDS' };
  const next = cloneState(state);
  let cash = Math.floor(next.resources.money ?? 0);
  let lvl = level;
  for (let i = 0; i < qty; i++) {
    cash = Math.max(0, Math.floor(cash) - buildingCost(def, lvl));
    lvl++;
  }
  next.resources.money = cash;
  next.buildings[buildingId] = lvl;
  return { ok: true, state: next };
}

export function canUnlock(state: PlayerState, config: GameConfig, techId: string): boolean {
  return checkUnlock(state, config, techId) === null;
}

export function checkUnlock(state: PlayerState, config: GameConfig, techId: string): string | null {
  const t = config.techs.find((x) => x.id === techId);
  if (!t) return 'UNKNOWN_TECH';
  if (state.techs[techId]) return 'ALREADY_UNLOCKED';
  for (const r of t.requires) {
    if (!state.techs[r]) return 'MISSING_PREREQUISITES';
  }
  const have = Math.floor(state.resources[t.cost.resource] ?? 0);
  if (have < t.cost.amount) return 'INSUFFICIENT_COST';
  return null;
}

export function unlockTech(state: PlayerState, config: GameConfig, techId: string): { ok: true; state: PlayerState } | { ok: false; error: string } {
  const err = checkUnlock(state, config, techId);
  if (err) return { ok: false, error: err };
  const t = config.techs.find((x) => x.id === techId)!;
  const next = cloneState(state);
  next.resources[t.cost.resource] = Math.floor(next.resources[t.cost.resource] ?? 0) - t.cost.amount;
  next.techs[t.id] = true;
  for (const e of t.effects) {
    if (e.t === 'unlock_building') {
      next.unlocked[e.building] = true;
      next.buildings[e.building] = next.buildings[e.building] ?? 0;
    }
  }
  return { ok: true, state: next };
}

export function marketReference(state: PlayerState, config: GameConfig, res: ResourceId): number {
  const refinery = config.buildings.find((b) => b.id === 'refinery');
  const lab = config.buildings.find((b) => b.id === 'lab');
  if (res === 'energy') {
    if (!refinery?.input) return 0;
    const mult = techBuildingMultiplier(state, config, refinery.id);
    return (refinery.perLevelRate * mult) / refinery.input.perLevel;
  }
  if (res === 'research') {
    if (!lab?.input) return 0;
    const enr = marketReference(state, config, 'energy');
    const mult = techBuildingMultiplier(state, config, lab.id);
    return enr * (lab.input.perLevel / (lab.perLevelRate * mult));
  }
  return 0;
}

export function exchangeRateFor(state: PlayerState, config: GameConfig, from: ResourceId, to: ResourceId): number | null {
  const e = config.exchange.find((x) => x.from === from && x.to === to);
  if (!e) return null;
  if (to === 'money') {
    const ref = marketReference(state, config, from);
    return ref * e.factor;
  }
  if (from === 'money') {
    const ref = marketReference(state, config, to);
    return ref > 0 ? 1 / (ref * e.factor) : null;
  }
  return null;
}

export function exchangeUnit(state: PlayerState, config: GameConfig, from: ResourceId, to: ResourceId): number {
  const rate = exchangeRateFor(state, config, from, to);
  if (rate == null || rate <= 0) return 0;
  return Math.max(1, Math.ceil(1 / rate));
}

export function maxExchange(state: PlayerState, config: GameConfig, from: ResourceId, to: ResourceId): number {
  const unit = exchangeUnit(state, config, from, to);
  if (unit <= 0) return 0;
  return Math.floor(Math.floor(state.resources[from] ?? 0) / unit) * unit;
}

export function checkExchange(state: PlayerState, config: GameConfig, from: ResourceId, to: ResourceId, amount: number): string | null {
  if (amount < 1) return 'BAD_AMOUNT';
  const rate = exchangeRateFor(state, config, from, to);
  if (rate == null || rate <= 0) return 'NO_RATE';
  if (Math.floor(amount * rate) < 1) return 'TOO_SMALL';
  if (Math.floor(state.resources[from] ?? 0) < amount) return 'INSUFFICIENT_STOCK';
  return null;
}

export function exchange(state: PlayerState, config: GameConfig, from: ResourceId, to: ResourceId, amount: number): { ok: true; state: PlayerState } | { ok: false; error: string } {
  const err = checkExchange(state, config, from, to, amount);
  if (err) return { ok: false, error: err };
  const rate = exchangeRateFor(state, config, from, to)!;
  const received = Math.floor(amount * rate);
  const next = cloneState(state);
  next.resources[from] = Math.floor(next.resources[from] ?? 0) - amount;
  next.resources[to] = (next.resources[to] ?? 0) + received;
  next.stats.earned[to] = (next.stats.earned[to] ?? 0) + received;
  return { ok: true, state: next };
}

export function solveRates(state: PlayerState, config: GameConfig): Rates {
  const net = zeroMap(config);
  const gross = zeroMap(config);
  const consumption = zeroMap(config);
  const perBuilding: Record<string, { mult: number; scale: number; output: number; inputUsed: number }> = {};
  const global = globalMultiplier(state, config);

  const raw = new Map<string, { def: BuildingDef; level: number; rate: number; demand: number }>();
  for (const b of config.buildings) {
    const level = state.buildings[b.id] ?? 0;
    if (level <= 0) continue;
    const mult = techBuildingMultiplier(state, config, b.id);
    const rate = buildingRate(b, level) * mult * global;
    const demand = b.input ? b.input.perLevel * level : 0;
    raw.set(b.id, { def: b, level, rate, demand });
    gross[b.output] += rate;
    if (b.input) consumption[b.input.resource] += demand;
  }

  const ratio: Record<ResourceId, number> = {} as Record<ResourceId, number>;
  for (const r of config.resources) {
    const g = gross[r.id] ?? 0;
    const d = consumption[r.id] ?? 0;
    ratio[r.id] = d > 0 && g < d ? g / d : 1;
  }

  for (const b of config.buildings) {
    const e = raw.get(b.id);
    if (!e) continue;
    const sc = b.input ? ratio[b.input.resource] : 1;
    const out = e.rate * sc;
    const used = b.input ? e.demand * ratio[b.input.resource] : 0;
    net[b.output] += out;
    if (b.input) net[b.input.resource] -= used;
    perBuilding[b.id] = { mult: techBuildingMultiplier(state, config, b.id), scale: sc, output: out, inputUsed: used };
  }
  return { net, gross, consumption, perBuilding };
}

export function validateDag(config: GameConfig): string[] {
  const errors: string[] = [];
  const ids = new Set(config.techs.map((t) => t.id));
  const buildingIds = new Set(config.buildings.map((b) => b.id));
  const resourceIds = new Set(config.resources.map((r) => r.id));
  for (const t of config.techs) {
    for (const r of t.requires) {
      if (!ids.has(r)) errors.push(`tech ${t.id}: unknown prerequisite "${r}"`);
    }
    if (!resourceIds.has(t.cost.resource)) errors.push(`tech ${t.id}: cost in unknown resource "${t.cost.resource}"`);
    for (const e of t.effects) {
      if (e.t === 'multiply_building_output' && !buildingIds.has(e.building)) {
        errors.push(`tech ${t.id}: effect targets unknown building "${e.building}"`);
      }
      if (e.t === 'unlock_building' && !buildingIds.has(e.building)) {
        errors.push(`tech ${t.id}: unlocks unknown building "${e.building}"`);
      }
    }
  }
  for (const x of config.exchange) {
    if (x.from === x.to) errors.push(`exchange ${x.id}: self-trade not allowed`);
    if (x.from !== 'money' && x.to !== 'money') errors.push(`exchange ${x.id}: routes must be money-anchored`);
    if (!resourceIds.has(x.from)) errors.push(`exchange ${x.id}: unknown source resource "${x.from}"`);
    if (!resourceIds.has(x.to)) errors.push(`exchange ${x.id}: unknown target resource "${x.to}"`);
    if (!(x.factor > 0)) errors.push(`exchange ${x.id}: factor must be positive`);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visited.has(id)) return true;
    if (visiting.has(id)) return false;
    const t = config.techs.find((x) => x.id === id);
    if (!t) {
      errors.push(`tech referenced by id does not exist: "${id}"`);
      return true;
    }
    visiting.add(id);
    for (const r of t.requires) {
      if (!visit(r)) return false;
    }
    visiting.delete(id);
    visited.add(id);
    return true;
  };
  for (const t of config.techs) {
    if (!visit(t.id)) {
      errors.push(`cycle detected in the technology tree (${t.id})`);
      break;
    }
  }
  return errors;
}

export function effectSummary(effects: Effect[]): string {
  return effects
    .map((e) => {
      switch (e.t) {
        case 'multiply_building_output':
          return `x${e.multiplier} ${e.building}`;
        case 'unlock_building':
          return `+${e.building}`;
        case 'add_global_output':
          return `global x${e.multiplier}`;
        case 'offline_cap':
          return `offline x${e.multiplier}`;
      }
    })
    .join(' · ');
}