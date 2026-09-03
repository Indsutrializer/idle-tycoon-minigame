export type ResourceId = 'money' | 'energy' | 'research';

export interface ResourceDef {
  id: ResourceId;
  name: string;
  icon: string;
}

export type Effect =
  | { t: 'multiply_building_output'; building: string; multiplier: number }
  | { t: 'unlock_building'; building: string }
  | { t: 'add_global_output'; multiplier: number }
  | { t: 'offline_cap'; multiplier: number };

export type AchievementEffect =
  | { t: 'building_output'; building?: string; multiplier: number }
  | { t: 'building_cost'; multiplier: number }
  | { t: 'tech_cost'; multiplier: number }
  | { t: 'trade_rate'; multiplier: number }
  | { t: 'global_output'; multiplier: number };

export type AchievementCondition =
  | { type: 'resource_total'; resource: ResourceId; amount: number }
  | { type: 'building_count'; building?: string; amount: number }
  | { type: 'building_level'; building: string; amount: number }
  | { type: 'tech_count'; amount: number }
  | { type: 'all_techs' }
  | { type: 'trades_done'; amount: number };

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  condition: AchievementCondition;
  reward: AchievementEffect;
  visible: boolean;
}

export interface BuildingDef {
  id: string;
  name: string;
  short: string;
  icon: string;
  plot: string;
  description: string;
  costBase: number;
  costGrowth: number;
  baseRate: number;
  perLevelRate: number;
  output: ResourceId;
  input?: { resource: ResourceId; perLevel: number };
}

export interface TechDef {
  id: string;
  name: string;
  description: string;
  tree: string;
  tileX: number;
  tileY: number;
  requires: string[];
  cost: { resource: ResourceId; amount: number };
  effects: Effect[];
}

export interface OfflineConfig {
  maxHours: number;
  efficiency: number;
}

export interface ExchangeRate {
  id: string;
  from: ResourceId;
  to: ResourceId;
  factor: number;
}

export interface GameConfig {
  version: number;
  resources: ResourceDef[];
  buildings: BuildingDef[];
  techs: TechDef[];
  achievements: AchievementDef[];
  exchange: ExchangeRate[];
  offline: OfflineConfig;
}

export interface PlayerStats {
  earned: Record<string, number>;
  totalTrades: number;
}

export interface PlayerState {
  version: number;
  resources: Record<string, number>;
  buildings: Record<string, number>;
  unlocked: Record<string, boolean>;
  techs: Record<string, boolean>;
  stats: PlayerStats;
  achievements: Record<string, boolean>;
  achievementClaimed: Record<string, boolean>;
}

export interface SavedGame {
  state: PlayerState;
  lastSeenAt: number;
}

export interface BuildingRates {
  mult: number;
  scale: number;
  output: number;
  inputUsed: number;
}

export interface Rates {
  net: Record<string, number>;
  gross: Record<string, number>;
  consumption: Record<string, number>;
  perBuilding: Record<string, BuildingRates>;
}

export interface OfflineGains {
  state: PlayerState;
  appliedMs: number;
  capped: boolean;
  gains: Record<string, number>;
}