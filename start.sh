#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

# ── Docker path (preferred — solves WSL2 → Windows MetaMask networking) ──────
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  echo "Starting Hardhat node via Docker..."
  echo "MetaMask RPC URL: http://localhost:8545  |  Chain ID: 31337"
  echo ""
  # --build rebuilds only when Dockerfile/contracts change (cached otherwise)
  docker compose up --build
  exit 0
fi

# ── Fallback: native Hardhat (no Docker) ─────────────────────────────────────
echo "Docker not found — using native Hardhat."
echo "NOTE: if MetaMask can't reach the node, install Docker Desktop."
echo ""

if lsof -ti:8545 &>/dev/null; then
  echo "Stopping existing node on :8545..."
  kill "$(lsof -ti:8545)" 2>/dev/null || true
  sleep 1
fi

npx hardhat node --hostname 0.0.0.0 > /tmp/hh-node.log 2>&1 &
HH_PID=$!

for i in $(seq 1 20); do
  grep -q "Started HTTP" /tmp/hh-node.log 2>/dev/null && break
  sleep 0.5
done

npx hardhat run scripts/deploy.js --network localhost

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MetaMask RPC URL : http://localhost:8545"
echo "  Chain ID         : 31337"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $HH_PID 2>/dev/null; echo 'Node stopped.'" EXIT
wait $HH_PID
