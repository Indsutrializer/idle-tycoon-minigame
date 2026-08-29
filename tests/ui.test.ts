import { beforeEach, describe, expect, it } from 'vitest';
import { GAME_CONFIG, newPlayer } from '../src/core/config';
import { createStore } from '../src/store';
import { saveGame } from '../src/storage';
import type { SavedGame } from '../src/core/types';
import { mountHud } from '../src/ui/hud';
import { mountMap } from '../src/ui/map';
import { mountPanel } from '../src/ui/panel';
import { setupPanZoom } from '../src/ui/panzoom';
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

describe('panzoom', () => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  it('zooms in/out and fits, updating the viewBox', () => {
    const host = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    host.append(svg);
    const pan = setupPanZoom({ svg, host, baseW: 1000, baseH: 600 });
    pan.apply();
    expect(svg.getAttribute('viewBox')).toBe('0 0 1000 600');

    pan.zoomBy(2);
    expect(svg.getAttribute('viewBox')).toBe('250 150 500 300');

    pan.zoomBy(0.5);
    expect(svg.getAttribute('viewBox')).toBe('0 0 1000 600');

    pan.reset();
    expect(svg.getAttribute('viewBox')).toBe('0 0 1000 600');
  });

  it('clamps magnifier and exposure limits', () => {
    const host = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    host.append(svg);
    const pan = setupPanZoom({ svg, host, baseW: 100, baseH: 100, maxScale: 4 });
    pan.zoomBy(10_000);
    expect(svg.getAttribute('viewBox')).toBe('37.5 37.5 25 25');
    pan.reset();
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
  });

  it('renders visible zoom controls', () => {
    const host = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    host.append(svg);
    setupPanZoom({ svg, host, baseW: 100, baseH: 100 });
    expect(host.querySelector('.zoomc')).toBeTruthy();
    expect(host.querySelectorAll('.zoomc-btn').length).toBe(3);
  });

  it('updates the zoom label when zoomed', () => {
    const host = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    host.append(svg);
    const pan = setupPanZoom({ svg, host, baseW: 100, baseH: 100 });
    pan.zoomBy(2);
    expect(host.querySelector('.zoomc-val')?.textContent).toBe('200%');
  });

  it('preserves fits through a re-render that replaces board content', () => {
    const host = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    host.append(svg);
    const pan = setupPanZoom({ svg, host, baseW: 500, baseH: 500 });
    pan.zoomBy(2);
    const zoomed = svg.getAttribute('viewBox');
    svg.innerHTML = '<rect width="10" height="10"/>';
    pan.apply();
    expect(svg.getAttribute('viewBox')).toBe(zoomed);
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
    expect(hud.querySelector('.res')?.getAttribute('data-tip')).toBeTruthy();
    expect(hud.querySelector('.hud-brand')?.getAttribute('data-tip')).toBeTruthy();
    expect(tech.innerHTML).toContain('data-tip');
    expect(map.innerHTML).toContain('data-tip');
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