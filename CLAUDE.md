# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

f1-dash is a real-time F1 telemetry dashboard. It is a monorepo with a Rust workspace (5 crates) and a Next.js frontend.

**Rust crates** (workspace root `Cargo.toml`):
- `realtime` — connects to F1 live timing via SignalR, merges incremental state, serves SSE at `:4000`
- `api` — REST service for race schedule/session data at `:4001`
- `simulator` — replays recorded `.data.txt` telemetry files at `:8000` for offline dev
- `signalr` — internal SignalR client library (used by `realtime`)
- `shared` — shared tracing setup and utilities

**Frontend**: `dashboard/` — Next.js 16 / React 19 / Tailwind 4 / Zustand / TypeScript

## Development Commands

### All services at once
```bash
# Build Rust binaries, then start realtime + api + dashboard in parallel
./dev.sh

# Same but with the simulator instead of live F1 data
./dev.sh --simulator spain-2025.data.txt
```

Each service reads its own `.env` file. Copy the examples before first run (required — the Rust services use `env::var()?` with no fallback for some variables):
```bash
cp api/.env.example api/.env
cp realtime/.env.example realtime/.env
cp simulator/.env.example simulator/.env
cp dashboard/.env.example dashboard/.env
```

### Individual services
```bash
cargo r -p realtime          # live timing backend
cargo r -p api               # schedule backend
cargo r -p simulator replay path/to/file.data.txt  # replay simulator

cd dashboard && yarn dev     # Next.js frontend
```

### Dashboard checks (run before opening a PR)
```bash
cd dashboard
yarn build       # must succeed before merging
yarn lint        # ESLint
yarn run prettier  # Prettier (formats files in src/)
```

### Rust tests
```bash
cargo test                    # all crates
cargo test -p realtime        # specific crate
```

### Recording new telemetry
```bash
cargo r -p simulator save year-circuit.data.txt
```
Files ending in `.data.txt` are gitignored.

## Architecture: Data Flow

```
F1 SignalR API
      │ (signalr crate)
      ▼
  realtime service
  ├── StateService (Arc<RwLock<Value>>) — merged full state in memory
  └── broadcast channel (String) — raw JSON update payloads
      │
      ▼  SSE at /api/realtime
  dashboard (browser)
  └── useSocket  →  useDataEngine  →  Zustand stores
```

**SSE protocol**: `realtime` sends two event types:
- `initial` — full current state snapshot as JSON
- `update` — incremental patch (same schema as `CarData.z` / `Position.z` keys)

**State merging** happens identically in both layers:
- Rust (`realtime/src/services/state_service.rs`): `merge(&mut Value, Value)` — objects merge recursively, arrays patch by numeric key
- TypeScript (`dashboard/src/lib/merge.ts`): same algorithm — handles `Object + Object`, `Array + Object` (numeric keys), scalar replace

Compressed topics (`CarData.z`, `Position.z`) arrive as base64 + zlib-deflate. The dashboard inflates them with pako (`dashboard/src/lib/inflate.ts`).

## Architecture: Delay / Time-Travel

The dashboard supports replaying data with a configurable delay (so viewers can sync with a TV broadcast). This is implemented entirely in the frontend:

- `useBuffer<T>` — ring buffer of `{data, timestamp}` frames; `delayed(t)` binary-searches for the frame at wall-clock time `t`
- `useStatefulBuffer<T>` — wraps `useBuffer`, applies the `merge` function on each push so the buffer holds full snapshots rather than diffs
- `useDataEngine` — wires SSE messages into per-topic `useStatefulBuffer` instances and two raw `useBuffer` instances for `CarsData` and `Positions`; on a 200ms tick it reads `buffer.delayed(now - delayMs)` and writes to Zustand

The settings delay is stored in `useSettingsStore` (persisted to localStorage). `useDataEngine` subscribes with `fireImmediately` to avoid a re-render cycle.

## Architecture: Dashboard Frontend

`dashboard/src/app/` uses the Next.js App Router:
- `(nav)/` — public pages (schedule, help, etc.) with a shared nav layout
- `dashboard/` — the live race view; `DashboardClientLayout.tsx` is the top-level client component that wires `useSocket` + `useDataEngine` and renders the sidebar, session bar, and delay UI

Global state lives in three Zustand stores:
- `useDataStore` — `state`, `carsData`, `positions`
- `useSettingsStore` — user preferences (delay, OLED mode, etc.), persisted
- `useSidebarStore` / `useHeadToHeadStore` — UI state

## Conventions

**Branching**: git-flow style off `develop`.
- `feature/name` for new features
- `bugfix/name` for fixes and refactors
- PRs target `develop`, not `main`

**Commits**: [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) — `feat`, `fix`, `refactor`, `perf`, `chore`

**Formatting**: Prettier with `prettier-plugin-tailwindcss`. Run `yarn run prettier` before committing frontend changes.

## Ports (default dev)

| Service   | Port |
|-----------|------|
| dashboard | 3000 |
| realtime  | 4000 |
| api       | 4001 |
| simulator | 8000 |
