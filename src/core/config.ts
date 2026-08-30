import type {
  BuildingDef,
  ExchangeRate,
  GameConfig,
  PlayerState,
  ResourceId,
  ResourceDef,
  TechDef,
} from './types';

export const RESOURCES: ResourceDef[] = [
  { id: 'money', name: 'Credits', icon: 'coin' },
  { id: 'energy', name: 'Energy', icon: 'bolt' },
  { id: 'research', name: 'Research', icon: 'flask' },
];

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'collector',
    name: 'Solar Collector',
    short: 'COL',
    icon: 'solar',
    plot: 'A',
    description: 'Converts irradiance into grid energy.',
    costBase: 10,
    costGrowth: 1.15,
    baseRate: 1,
    perLevelRate: 1.1,
    output: 'energy',
  },
  {
    id: 'refinery',
    name: 'Refinery',
    short: 'REF',
    icon: 'refinery',
    plot: 'B',
    description: 'Refines energy into export credits.',
    costBase: 30,
    costGrowth: 1.18,
    baseRate: 1.2,
    perLevelRate: 1.8,
    output: 'money',
    input: { resource: 'energy', perLevel: 0.6 },
  },
  {
    id: 'wind_turbine',
    name: 'Wind Turbine',
    short: 'TUR',
    icon: 'wind',
    plot: 'C',
    description: 'Reinforces the power supply with wind.',
    costBase: 80,
    costGrowth: 1.2,
    baseRate: 1.6,
    perLevelRate: 1.5,
    output: 'energy',
  },
  {
    id: 'lab',
    name: 'Laboratory',
    short: 'LAB',
    icon: 'lab',
    plot: 'D',
    description: 'Consumes energy to produce research.',
    costBase: 200,
    costGrowth: 1.22,
    baseRate: 0.5,
    perLevelRate: 0.5,
    output: 'research',
    input: { resource: 'energy', perLevel: 1 },
  },
];

export const TECHS: TechDef[] = [
  {
    id: 'solar_v1',
    name: 'Cell Reinforcement',
    description: 'Solar collector: output x2.',
    tree: 'Energy',
    tileX: 0,
    tileY: 0,
    requires: [],
    cost: { resource: 'money', amount: 30 },
    effects: [{ t: 'multiply_building_output', building: 'collector', multiplier: 2 }],
  },
  {
    id: 'solar_v2',
    name: 'Tandem Cells',
    description: 'Solar collector: output x2.',
    tree: 'Energy',
    tileX: 0,
    tileY: 1,
    requires: ['solar_v1'],
    cost: { resource: 'money', amount: 120 },
    effects: [{ t: 'multiply_building_output', building: 'collector', multiplier: 2 }],
  },
  {
    id: 'turbines',
    name: 'Wind Farm',
    description: 'Unlocks the wind turbine.',
    tree: 'Energy',
    tileX: 0,
    tileY: 2,
    requires: ['solar_v2'],
    cost: { resource: 'money', amount: 400 },
    effects: [{ t: 'unlock_building', building: 'wind_turbine' }],
  },
  {
    id: 'solar_v3',
    name: 'Photonics',
    description: 'Solar and wind: output x2.',
    tree: 'Energy',
    tileX: 0,
    tileY: 3,
    requires: ['solar_v2', 'lab_blueprint'],
    cost: { resource: 'research', amount: 40 },
    effects: [
      { t: 'multiply_building_output', building: 'collector', multiplier: 2 },
      { t: 'multiply_building_output', building: 'wind_turbine', multiplier: 2 },
    ],
  },
  {
    id: 'metallurgy',
    name: 'Metallurgy',
    description: 'Unlocks the refinery.',
    tree: 'Production',
    tileX: 1,
    tileY: 0,
    requires: [],
    cost: { resource: 'money', amount: 50 },
    effects: [{ t: 'unlock_building', building: 'refinery' }],
  },
  {
    id: 'automation',
    name: 'Automation',
    description: 'Refinery: output x2.',
    tree: 'Production',
    tileX: 1,
    tileY: 1,
    requires: ['metallurgy'],
    cost: { resource: 'money', amount: 300 },
    effects: [{ t: 'multiply_building_output', building: 'refinery', multiplier: 2 }],
  },
  {
    id: 'logistics',
    name: 'Logistics',
    description: 'Refinery x2 and collector x1.5.',
    tree: 'Production',
    tileX: 1,
    tileY: 2.5,
    requires: ['automation', 'lab_blueprint'],
    cost: { resource: 'research', amount: 25 },
    effects: [
      { t: 'multiply_building_output', building: 'refinery', multiplier: 2 },
      { t: 'multiply_building_output', building: 'collector', multiplier: 1.5 },
    ],
  },
  {
    id: 'lab_blueprint',
    name: 'Laboratory Blueprint',
    description: 'Unlocks the laboratory.',
    tree: 'Expansion',
    tileX: 2,
    tileY: 1.5,
    requires: ['solar_v2', 'metallurgy'],
    cost: { resource: 'money', amount: 600 },
    effects: [{ t: 'unlock_building', building: 'lab' }],
  },
  {
    id: 'grid_boost',
    name: 'Trunk Grid',
    description: 'All site output x1.5.',
    tree: 'Expansion',
    tileX: 2,
    tileY: 3,
    requires: ['solar_v3', 'logistics'],
    cost: { resource: 'research', amount: 60 },
    effects: [{ t: 'add_global_output', multiplier: 1.5 }],
  },
  {
    id: 'quantum_core',
    name: 'Quantum Core',
    description: 'Global output x2 and more offline time.',
    tree: 'Expansion',
    tileX: 3,
    tileY: 4,
    requires: ['grid_boost'],
    cost: { resource: 'research', amount: 150 },
    effects: [
      { t: 'add_global_output', multiplier: 2 },
      { t: 'offline_cap', multiplier: 2 },
    ],
  },
];

export const EXCHANGE: ExchangeRate[] = [
  { id: 'sell_energy', from: 'energy', to: 'money', factor: 0.25 },
  { id: 'buy_energy', from: 'money', to: 'energy', factor: 1.6 },
  { id: 'sell_research', from: 'research', to: 'money', factor: 0.25 },
  { id: 'buy_research', from: 'money', to: 'research', factor: 1.6 },
];

export const GAME_CONFIG: GameConfig = {
  version: 1,
  resources: RESOURCES,
  buildings: BUILDINGS,
  techs: TECHS,
  exchange: EXCHANGE,
  offline: { maxHours: 48, efficiency: 1 },
};

export function newPlayer(): PlayerState {
  const resources: Record<string, number> = {};
  for (const r of RESOURCES) resources[r.id] = 0;
  return {
    version: GAME_CONFIG.version,
    resources: { ...resources, money: 60 },
    buildings: { collector: 1 },
    unlocked: { collector: true },
    techs: {},
    stats: { earned: { ...resources } },
  };
}

export function resourceDef(config: GameConfig, id: ResourceId): ResourceDef {
  const def = config.resources.find((r) => r.id === id);
  if (!def) throw new Error(`unknown resource: ${id}`);
  return def;
}