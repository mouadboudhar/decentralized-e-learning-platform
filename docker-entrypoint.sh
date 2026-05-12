#!/bin/sh
set -e

echo "Starting Hardhat node..."
npx hardhat node --hostname 0.0.0.0 > /tmp/hh.log 2>&1 &
NODE_PID=$!

# Wait until node is ready
i=0
while [ $i -lt 40 ]; do
  grep -q "Started HTTP" /tmp/hh.log 2>/dev/null && break
  sleep 0.5
  i=$((i+1))
done

if ! grep -q "Started HTTP" /tmp/hh.log 2>/dev/null; then
  echo "ERROR: Hardhat node failed to start"
  cat /tmp/hh.log
  exit 1
fi

echo "Deploying contracts..."
npx hardhat run scripts/deploy.js --network localhost

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Hardhat node ready"
echo "  MetaMask RPC URL : http://localhost:8545"
echo "  Chain ID         : 31337"
echo "  CourseRegistry   : 0x5FbDB2315678afecb367f032d93F642f64180aa3"
echo "  CertificateNFT   : 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

wait $NODE_PID
