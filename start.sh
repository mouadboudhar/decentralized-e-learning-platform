#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Kill any existing node on 8545
if lsof -ti:8545 &>/dev/null; then
  echo "Stopping existing node on :8545..."
  kill "$(lsof -ti:8545)" 2>/dev/null || true
  sleep 1
fi

echo "Starting Hardhat node..."
npx hardhat node > /tmp/hh-node.log 2>&1 &
HH_PID=$!

# Wait until the node is ready
for i in $(seq 1 20); do
  if grep -q "Started HTTP" /tmp/hh-node.log 2>/dev/null; then
    break
  fi
  sleep 0.5
done

echo "Deploying contracts..."
npx hardhat run scripts/deploy.js --network localhost

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Hardhat node : http://127.0.0.1:8545"
echo "  Node PID     : $HH_PID"
echo ""
echo "  Next: open a new terminal and run"
echo "    cd frontend && npm run dev"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop the node."

# Keep script alive so Ctrl+C kills the node cleanly
trap "kill $HH_PID 2>/dev/null; echo 'Node stopped.'" EXIT
wait $HH_PID
