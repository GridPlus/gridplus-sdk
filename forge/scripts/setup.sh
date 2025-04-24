#!/bin/bash
set -e

# Kill any running anvil processes
pkill -f anvil || true
sleep 1

# Check if forge is installed
if ! command -v forge &> /dev/null; then
    echo "Installing Foundry..."
    curl -L https://foundry.paradigm.xyz | bash
    # Load new PATH to include foundryup
    source ~/.bashrc
    # Install latest forge
    foundryup
fi

# Change to forge directory
cd forge

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Install forge dependencies
echo "Installing forge dependencies..."
forge install

# Clean the build artifacts first
echo "Cleaning build artifacts..."
forge clean

# Build all contracts including dependencies
echo "Building contracts with all dependencies..."
FOUNDRY_PROFILE=default forge build --build-info --force --optimize --sizes --via-ir --contracts ./src/Simple7702Account.sol

# Install dependencies if needed
if [ ! -d "lib/openzeppelin-contracts" ]; then
    echo "Installing Foundry dependencies..."
    forge install OpenZeppelin/openzeppelin-contracts --no-commit
fi

if [ ! -d "node_modules/@account-abstraction" ]; then
    echo "Installing npm dependencies..."
    npm install @account-abstraction/contracts
fi

# Start anvil in the background if not running
if ! nc -z localhost 8545 2>/dev/null; then
    echo "Starting Anvil with Prague hardfork..."
    anvil --hardfork prague --block-time 1 > anvil.log 2>&1 &
    sleep 2
fi

echo "Setup complete!"
echo "Anvil logs are being shown below. Press Ctrl+C to stop."

# Keep showing anvil logs
tail -f anvil.log 