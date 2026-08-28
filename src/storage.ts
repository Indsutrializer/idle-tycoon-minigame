import { GAME_CONFIG } from './core/config';
import type { PlayerState, SavedGame } from './core/types';

const KEY = 'idle-tycoon-save-v1';

function getStorage(): Storage | null {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadGame(): SavedGame | null {
  try {
    const storage = getStorage();
    if (!storage) return null;
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedGame;
    if (!parsed || typeof parsed.lastSeenAt !== 'number' || !parsed.state) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGame(saved: SavedGame): void {
  try {
    getStorage()?.setItem(KEY, JSON.stringify(saved));
  } catch {
    // storage unavailable; ignored
  }
}

export function clearGame(): void {
  try {
    getStorage()?.removeItem(KEY);
  } catch {
    // storage unavailable; ignored
  }
}

export function migrate(saved: SavedGame): PlayerState {
  if ((saved.state.version ?? 0) < GAME_CONFIG.version) {
    const migrated = { ...saved.state, version: GAME_CONFIG.version };
    const resources: Record<string, number> = {};
    for (const r of GAME_CONFIG.resources) resources[r.id] = migrated.resources[r.id] ?? 0;
    migrated.resources = resources;
    return migrated;
  }
  return saved.state;
}

export function snapshot(state: PlayerState): SavedGame {
  return { state, lastSeenAt: Date.now() };
}