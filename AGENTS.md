# AGENTS.md

Idle Tycoon — a single-page idle/mining tycoon game. Local-first MVP: no server, no auth, no sync (deferred). Progress persists to `localStorage`; offline progress is computed from a `lastSeenAt` watermark.

## Commands

- `pnpm dev` — Vite dev server
- `pnpm test` — vitest (happy-dom environment)
- `pnpm test:watch` — vitest watch mode
- `pnpm run typecheck` — `tsc -p tsconfig.json` (typechecks src + tests)
- `pnpm build` — typecheck + `vite build`

Run `pnpm run typecheck && pnpm test && pnpm build` before finishing a change.

## Architecture

- `src/core/` — pure, deterministic game engine. **Never** touch DOM, timers, `Date`, or storage here. This layer must stay env-agnostic so it can be shared/reused later (e.g. server-side solve for sync).
  - `config.ts` — resources, buildings, tech DAG, `GAME_CONFIG`, `newPlayer()`
  - `engine.ts` — rates, multipliers, costs, buy/unlock, `solveRates`, `validateDag`
  - `offline.ts` — `simulate()` (live ticks) and `applyOffline()` (event-based offline solve)
  - `types.ts` — shared types
- `src/store.ts` — reactive store (pub/sub) bridging core and UI; `gen` counter avoids redundant renders; `persist`/`reset`/`tick`.
- `src/storage.ts` — `localStorage` persistence with versioned migrations (`globalThis.localStorage`, since happy-dom lacks `window.localStorage`).
- `src/ui/` — DOM/SVG views (hud, panel, techTree, map, toast, dom helpers, icons). Blueprint monochrome aesthetic (`#74c8ff` on `#0a0e13`).
- `tests/` — vitest; `core.test.ts` covers engine/offline determinism, `ui.test.ts` mounts views (uses a `MemStorage` polyfill).

## Conventions

- **Only Comments to Doc Functions.** Do not add extra comments.
- TypeScript strict + `noUncheckedIndexedAccess`; handle `undefined` from index access.
- **Core stays pure**: pass `state`/`config` explicitly, return new states (immutable transitions). No side effects.
- Game content and UI text are in **English** (currency codes: `CRD`/`ENR`/`RES`). Error codes are `SCREAMING_SNAKE_CASE` strings matched by `fmtErr` in `src/ui/dom.ts`.
- Balance/numbers live in `GAME_CONFIG` (data-driven), not hardcoded in logic.
- pnpm enforces build approvals via `pnpm-workspace.yaml` (`onlyBuiltDependencies: esbuild`); if installing new native deps, add them there.
- Don't commit unless asked.
