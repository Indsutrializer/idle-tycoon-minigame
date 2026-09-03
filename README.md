# Idle Tycoon

A single-page idle/construction tycoon game (SPA). Local-first MVP: you build buildings, manage resources (`CRD`/`ENR`/`RES`) and unlock technologies in a tree. No server, no auth, no sync (deferred). Progress persists to `localStorage`; offline progress is computed from a `lastSeenAt` watermark.

## Getting Started

Requirements: Node.js + pnpm.

```bash
pnpm install
pnpm dev        # Vite dev server
```

Open the URL shown by Vite in your browser.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm test` | Run vitest (happy-dom environment) |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm run typecheck` | Typecheck (`tsc -p tsconfig.json`) of src + tests |
| `pnpm run build` | Typecheck + `vite build` |
| `pnpm preview` | Preview the production build |

Before finishing a change: `pnpm run typecheck && pnpm test && pnpm build`.

## Features

- **Local-first SPA**: no backend dependency; all state lives on the client.
- **Persistence**: progress is saved to `localStorage` with versioned migrations.
- **Offline progress**: on return, `applyOffline()` computes gains accumulated while away.
- **Technology tree (DAG)**: unlocks are validated by `validateDag`.
- **Achievements**: 15 milestones (12 visible, 3 hidden) with claimable bonuses affecting production, costs, and trade rates.
- **Blueprint monochrome aesthetic** (`#74c8ff` on `#0a0e13`).

## Architecture

- `src/core/` — pure, deterministic game engine. **Never** touches DOM, timers, `Date` or storage. Environment-agnostic layer so it can be reused (e.g. server-side solving for sync).
  - `config.ts` — resources, buildings, tech DAG, achievements, `GAME_CONFIG`, `newPlayer()`
  - `engine.ts` — rates, multipliers, costs, buy/unlock, `solveRates`, `validateDag`
  - `achievements.ts` — achievement condition checking, multipliers, unlock detection
  - `offline.ts` — `simulate()` (live ticks) and `applyOffline()` (event-based offline solve)
  - `types.ts` — shared types
- `src/store.ts` — reactive store (pub/sub) bridging core and UI; `gen` counter avoids redundant renders; `persist`/`reset`/`tick`.
- `src/storage.ts` — `localStorage` persistence with versioned migrations.
- `src/ui/` — DOM/SVG views (hud, panel, techTree, achievements, map, toast, dom helpers, icons).
- `tests/` — vitest; `core.test.ts` covers engine/offline determinism, `achievements.test.ts` covers achievement logic, `ui.test.ts` mounts views (uses a `MemStorage` polyfill).

## Conventions

- TypeScript strict + `noUncheckedIndexedAccess`.
- The core stays pure: pass `state`/`config` explicitly and return new states (immutable transitions). No side effects.
- Game content and UI text are in **English**. Error codes are `SCREAMING_SNAKE_CASE` and resolved via `fmtErr` in `src/ui/dom.ts`.
- Balance/numbers live in `GAME_CONFIG` (data-driven), not hardcoded in logic.
