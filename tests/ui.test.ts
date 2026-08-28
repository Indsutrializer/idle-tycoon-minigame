import { beforeEach, describe, expect, it } from 'vitest';
import { GAME_CONFIG, newPlayer } from '../src/core/config';
import { createStore } from '../src/store';
import { saveGame } from '../src/storage';
import type { SavedGame } from '../src/core/types';
import { mountHud } from '../src/ui/hud';
import { mountMap } from '../src/ui/map';
import { mountPanel } from '../src/ui/panel';
import { mountTechTree } from '../src/ui/techTree';

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length(): number {
    return this.m.size;
  }
  clear(): void {
    this.m.clear();
  }
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemStorage(),
    configurable: true,
  });
});

describe('ui smoke', () => {
  it('mounts the views and responds to actions', () => {
    const store = createStore();
    const hud = mountHud(store);
    const panel = mountPanel(store);
    const map = mountMap(store);
    const tech = mountTechTree(store);
    document.body.append(hud, panel, map, tech);

    expect(panel.innerHTML).toContain('Solar Collector');
    expect(panel.innerHTML).toContain('data-action="buy"');
    expect(tech.innerHTML).toContain('tnode');
    expect(map.innerHTML).toContain('plot');

    const err = store.buy('collector', 1);
    expect(err).toBeNull();
    expect(store.state.buildings['collector']).toBe(2);
    expect(store.gen).toBe(1);

    expect(store.canUnlock('solar_v1')).toBe(true);
    expect(store.unlock('solar_v1')).toBeNull();
    expect(store.state.techs['solar_v1']).toBe(true);
    expect(store.canUnlock('solar_v2')).toBe(false);

    store.tick(Date.now() + 1000);
    expect(hud.querySelectorAll('.res').length).toBe(3);
  });

  it('picks up a save with pending offline progress', () => {
    const base = newPlayer();
    base.resources.energy = 10;
    const saved: SavedGame = { state: base, lastSeenAt: Date.now() - 3_600_000 };
    saveGame(saved);
    const store = createStore();
    expect(store.report).not.toBeNull();
    expect((store.report?.appliedMs ?? 0)).toBeGreaterThan(0);
    expect((store.state.resources.energy ?? 0)).toBeGreaterThan(10);
    expect(GAME_CONFIG.techs.length).toBeGreaterThan(0);
  });
});