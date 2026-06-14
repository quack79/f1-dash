#!/usr/bin/bash
# dev.sh — Starts realtime, api and dashboard in parallel
# Usage: ./dev.sh [--simulator <replay-file>]
# With --simulator, it also starts the F1 simulator with replay data and points realtime to it
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS=()
PID_NAMES=()
CLEANING_UP=false

# Colors to distinguish the output of each service
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
RESET='\033[0m'

USE_SIMULATOR=false
SIMULATOR_REPLAY_PATH=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --simulator)
      USE_SIMULATOR=true
      shift
      if [[ $# -eq 0 || "$1" == --* ]]; then
        echo "Usage: ./dev.sh [--simulator <replay-file>]" >&2
        exit 1
      fi
      SIMULATOR_REPLAY_PATH="$1"
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: ./dev.sh [--simulator <replay-file>]" >&2
      exit 1
      ;;
  esac
  shift
done

if [[ -n "$SIMULATOR_REPLAY_PATH" && "$SIMULATOR_REPLAY_PATH" != /* ]]; then
  SIMULATOR_REPLAY_PATH="$PWD/$SIMULATOR_REPLAY_PATH"
fi

# ── Prefixes each line of stdout/stderr from a process with its colored label
prefix_output() {
  local label="$1" color="$2"
  while IFS= read -r line; do
    echo -e "${color}${BOLD}[${label}]${RESET} ${line}"
  done
}

normalize_env() {
  if [[ -n "${ADDRESS-}" ]]; then export ADDRESS="${ADDRESS//$'\r'/}"; fi
  if [[ -n "${ORIGIN-}" ]]; then export ORIGIN="${ORIGIN//$'\r'/}"; fi
  if [[ -n "${F1_DEV_URL-}" ]]; then export F1_DEV_URL="${F1_DEV_URL//$'\r'/}"; fi
  if [[ -n "${RUST_LOG-}" ]]; then export RUST_LOG="${RUST_LOG//$'\r'/}"; fi
}

debug_port() {
  local port="$1"

  echo -e "${YELLOW}${BOLD}[dev]${RESET} Checking port ${port}"
  if command -v fuser &>/dev/null; then
    if fuser "${port}/tcp" 2>/dev/null; then
      echo -e "${YELLOW}${BOLD}[dev]${RESET} Port ${port} is still in use according to fuser"
    else
      echo -e "${YELLOW}${BOLD}[dev]${RESET} Port ${port} is free according to fuser"
    fi
  elif command -v lsof &>/dev/null; then
    if lsof -nP -i "tcp:${port}" 2>/dev/null; then
      echo -e "${YELLOW}${BOLD}[dev]${RESET} Port ${port} is still in use according to lsof"
    else
      echo -e "${YELLOW}${BOLD}[dev]${RESET} Port ${port} is free according to lsof"
    fi
  else
    if (: < "/dev/tcp/127.0.0.1/${port}") >/dev/null 2>&1; then
      echo -e "${YELLOW}${BOLD}[dev]${RESET} Port ${port} is accepting connections on 127.0.0.1"
      echo -e "${YELLOW}${BOLD}[dev]${RESET} Cannot identify the owning process; neither fuser nor lsof is installed"
    else
      echo -e "${YELLOW}${BOLD}[dev]${RESET} Port ${port} is not accepting connections on 127.0.0.1"
    fi
  fi
}

kill_dashboard_dev_processes() {
  local signal="$1"
  local signal_name="$2"
  local pid args cwd

  while read -r pid args; do
    [[ -z "${pid-}" ]] && continue

    cwd="$(readlink "/proc/${pid}/cwd" 2>/dev/null || true)"
    if [[ "$cwd" == "$ROOT/dashboard" ||
      "$args" == *"$ROOT/dashboard/node_modules/next/dist/bin/next dev"* ||
      "$args" == *"$ROOT/dashboard/.next/dev/"* ]]; then
      if kill -0 "$pid" 2>/dev/null; then
        echo -e "${YELLOW}${BOLD}[dev]${RESET} Sending ${signal_name} to stale dashboard process pid ${pid}: ${args}"
        kill "-$signal" "$pid" 2>/dev/null || true
      fi
    fi
  done < <(ps -eo pid=,args= | grep -E 'yarn dev|next dev|next-server|dashboard/\.next/dev' || true)
}

record_pid() {
  PIDS+=("$1")
  PID_NAMES+=("$2")
}

start_service() {
  local name="$1"
  local color="$2"
  shift 2

  (
    "$@"
  ) > >(prefix_output "$name" "$color") 2>&1 &
  record_pid "$!" "$name"
}

run_simulator() {
  set -a; source "$ROOT/simulator/.env" 2>/dev/null || true; set +a
  normalize_env
  export RUST_BACKTRACE=1
  if [[ -z "${RUST_LOG-}" ]]; then export RUST_LOG=simulator=debug; fi
  echo "[simulator-env] ADDRESS=${ADDRESS-<unset>}"
  echo "[simulator-env] RUST_LOG=${RUST_LOG-<unset>}"
  echo "[simulator-env] replay=${SIMULATOR_REPLAY_PATH}"
  exec "$ROOT/target/debug/simulator" replay "$SIMULATOR_REPLAY_PATH"
}

run_realtime() {
  set -a
  source "$ROOT/realtime/.env" 2>/dev/null || true
  if $USE_SIMULATOR; then export F1_DEV_URL="ws://127.0.0.1:8000/ws"; fi
  set +a
  normalize_env
  exec "$ROOT/target/debug/realtime"
}

run_api() {
  set -a; source "$ROOT/api/.env" 2>/dev/null || true; set +a
  normalize_env
  exec "$ROOT/target/debug/api"
}

run_dashboard() {
  cd "$ROOT/dashboard"
  exec yarn dev
}

pid_name() {
  local pid="$1"
  local i
  for i in "${!PIDS[@]}"; do
    if [[ "${PIDS[$i]}" == "$pid" ]]; then
      echo "${PID_NAMES[$i]}"
      return
    fi
  done
  echo "unknown"
}

terminate_pids() {
  local signal="$1"
  local signal_name="$2"
  local pid
  local i

  for i in "${!PIDS[@]}"; do
    pid="${PIDS[$i]}"
    if kill -0 "$pid" 2>/dev/null; then
      echo -e "${YELLOW}${BOLD}[dev]${RESET} Sending ${signal_name} to ${PID_NAMES[$i]} pid ${pid}"
      kill "-$signal" "$pid" 2>/dev/null || true
    else
      echo -e "${YELLOW}${BOLD}[dev]${RESET} ${PID_NAMES[$i]} pid ${pid} is already stopped"
    fi
  done
}

wait_for_shutdown() {
  local timeout_seconds="$1"
  local deadline=$((SECONDS + timeout_seconds))
  local pid
  local i
  local last_reported_second=-1

  while (( SECONDS < deadline )); do
    local running=false
    local running_services=()
    for pid in "${PIDS[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then
        running=true
        running_services+=("$(pid_name "$pid") pid ${pid}")
      fi
    done

    if ! $running; then
      for i in "${!PIDS[@]}"; do
        echo -e "${YELLOW}${BOLD}[dev]${RESET} ${PID_NAMES[$i]} pid ${PIDS[$i]} has stopped"
      done
      return 0
    fi

    if (( SECONDS != last_reported_second )); then
      echo -e "${YELLOW}${BOLD}[dev]${RESET} Waiting for: ${running_services[*]}"
      last_reported_second=$SECONDS
    fi

    sleep 0.2
  done

  echo -e "${YELLOW}${BOLD}[dev]${RESET} Still running after ${timeout_seconds}s:"
  for i in "${!PIDS[@]}"; do
    pid="${PIDS[$i]}"
    if kill -0 "$pid" 2>/dev/null; then
      echo -e "${YELLOW}${BOLD}[dev]${RESET}   ${PID_NAMES[$i]} pid ${pid}"
    else
      echo -e "${YELLOW}${BOLD}[dev]${RESET}   ${PID_NAMES[$i]} pid ${pid} stopped"
    fi
  done

  return 1
}

print_pid_snapshot() {
  local title="$1"
  local pid
  local i

  echo -e "${YELLOW}${BOLD}[dev]${RESET} ${title}"
  for i in "${!PIDS[@]}"; do
    pid="${PIDS[$i]}"
    if kill -0 "$pid" 2>/dev/null; then
      echo -e "${YELLOW}${BOLD}[dev]${RESET}   ${PID_NAMES[$i]} pid ${pid}: running"
    else
      echo -e "${YELLOW}${BOLD}[dev]${RESET}   ${PID_NAMES[$i]} pid ${pid}: stopped"
    fi
  done
}

# ── Cleanup on exit (Ctrl+C or error)
cleanup() {
  $CLEANING_UP && exit 0
  CLEANING_UP=true
  trap - EXIT INT TERM

  echo -e "\n${YELLOW}${BOLD}[dev]${RESET} Stopping services..."

  if ((${#PIDS[@]} > 0)); then
    print_pid_snapshot "Cleanup target snapshot:"
    terminate_pids TERM TERM

    if ! wait_for_shutdown 5; then
      echo -e "${YELLOW}${BOLD}[dev]${RESET} Some services did not stop after 5s; forcing shutdown..."
      terminate_pids KILL KILL
      wait_for_shutdown 2 || true
    fi

    print_pid_snapshot "Final cleanup snapshot:"
    echo -e "${YELLOW}${BOLD}[dev]${RESET} Cleanup complete."
  fi

  echo -e "${YELLOW}${BOLD}[dev]${RESET} Done."
}
trap cleanup EXIT INT TERM

# ── Kills processes already using the ports and clears Next.js locks
free_ports() {
  local ports=(4000 4001 3000)
  $USE_SIMULATOR && ports+=(8000)

  # fuser handles IPv4 and IPv6 correctly; lsof as a fallback
  for port in "${ports[@]}"; do
    if command -v fuser &>/dev/null; then
      fuser -k "${port}/tcp" 2>/dev/null || true
    else
      local pid
      pid=$(lsof -ti "tcp:${port}" 2>/dev/null || true)
      [[ -n "$pid" ]] && kill $pid 2>/dev/null || true
    fi
  done

  # Next.js maintains its own internal lock — we clear it to avoid
  # the "Another next dev server is already running" error
  rm -rf "$ROOT/dashboard/.next/dev" 2>/dev/null || true

  # Kill by name any binaries that might have been orphaned
  pkill -f "target/debug/realtime" 2>/dev/null || true
  pkill -f "target/debug/api"      2>/dev/null || true
  pkill -f "target/debug/simulator" 2>/dev/null || true
  kill_dashboard_dev_processes TERM TERM
  sleep 0.5
  kill_dashboard_dev_processes KILL KILL

  sleep 0.5
}
free_ports

# ── Compiles Rust binaries if they do not exist or are outdated
echo -e "${BOLD}[dev]${RESET} Compiling Rust services..."
CARGO_PACKAGES=(-p realtime -p api)
$USE_SIMULATOR && CARGO_PACKAGES+=(-p simulator)
cargo build "${CARGO_PACKAGES[@]}" --quiet 2>&1 \
  | prefix_output "cargo" "$MAGENTA"

# ── Starts the simulator (optional)
if $USE_SIMULATOR; then
  echo -e "${MAGENTA}${BOLD}[dev]${RESET} Starting simulator on :8000 with ${SIMULATOR_REPLAY_PATH}"
  if [[ -r "$SIMULATOR_REPLAY_PATH" ]]; then
    echo -e "${MAGENTA}${BOLD}[dev]${RESET} Replay file is readable: ${SIMULATOR_REPLAY_PATH}"
    echo -e "${MAGENTA}${BOLD}[dev]${RESET} Replay file lines: $(wc -l < "$SIMULATOR_REPLAY_PATH")"
  else
    echo -e "${RED}${BOLD}[dev]${RESET} Replay file is not readable: ${SIMULATOR_REPLAY_PATH}"
  fi
  debug_port 8000
  start_service "simulator" "$MAGENTA" run_simulator
  sleep 1 # give the simulator time to start
fi

# ── Starts realtime
echo -e "${CYAN}${BOLD}[dev]${RESET} Starting realtime on :4000"
start_service "realtime" "$CYAN" run_realtime

# ── Starts api
echo -e "${GREEN}${BOLD}[dev]${RESET} Starting api on :4001"
start_service "api" "$GREEN" run_api

# ── Starts the Next.js dashboard
echo -e "${YELLOW}${BOLD}[dev]${RESET} Starting dashboard on :3000"
start_service "dashboard" "$YELLOW" run_dashboard

echo -e "\n${BOLD}Services running:${RESET}"
echo -e "  ${CYAN}● realtime${RESET}   http://localhost:4000/api/health"
echo -e "  ${GREEN}● api${RESET}        http://localhost:4001"
echo -e "  ${YELLOW}● dashboard${RESET}  http://localhost:3000"
$USE_SIMULATOR && echo -e "  ${MAGENTA}● simulator${RESET}  ws://localhost:8000/ws"
echo -e "\n${BOLD}Ctrl+C to stop all services.${RESET}\n"

# Waits for any child process to exit (indicates an error)
EXITED_PID=""
EXIT_STATUS=0
wait -n -p EXITED_PID "${PIDS[@]}" 2>/dev/null || EXIT_STATUS=$?
if [[ -z "${EXITED_PID-}" ]]; then
  exit "$EXIT_STATUS"
fi
EXITED_SERVICE="$(pid_name "$EXITED_PID")"
echo -e "\n${RED}${BOLD}[dev]${RESET} ${EXITED_SERVICE} terminated unexpectedly with exit code ${EXIT_STATUS}. Stopping the rest..."
exit "$EXIT_STATUS"
