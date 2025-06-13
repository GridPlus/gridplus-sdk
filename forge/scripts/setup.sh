#!/bin/bash
set -e

# Kill any running anvil processes
pkill -f anvil || true
sleep 1

# Function to download using available method
download_file() {
    local url="$1"
    local output="${2:--}" # Default to stdout if no output specified
    
    if command -v curl &> /dev/null; then
        if [ "$output" = "-" ]; then
            curl -L "$url"
        else
            curl -L "$url" -o "$output"
        fi
    elif command -v wget &> /dev/null; then
        if [ "$output" = "-" ]; then
            wget -qO- "$url"
        else
            wget -q -O "$output" "$url"
        fi
    elif command -v python3 &> /dev/null; then
        python3 -c "import urllib.request; print(urllib.request.urlopen('$url').read().decode())"
    elif command -v python &> /dev/null; then
        python -c "import urllib2; print urllib2.urlopen('$url').read()"
    else
        echo "Error: Neither curl, wget, nor python is available. Please install one of them to continue."
        exit 1
    fi
}

# Check if forge is installed
if ! command -v forge &> /dev/null; then
    echo "Installing Foundry..."
    download_file "https://foundry.paradigm.xyz" | bash
    # Load new PATH to include foundryup
    source ~/.bashrc
    # Install latest forge
    foundryup
fi

# Handle directory change safely
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
if [[ "$SCRIPT_DIR" == */forge/scripts ]]; then
    cd "$(dirname "$(dirname "$SCRIPT_DIR")")/forge"
elif [[ "$SCRIPT_DIR" == */scripts ]]; then
    cd ..
else
    echo "Error: Script must be run from either the project root or the forge directory"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Install forge dependencies
echo "Installing forge dependencies..."
forge install

# Clean the build artifacts first
echo "Cleaning build artifacts..."
forge clean

# Build contracts with standard build (more general approach)
echo "Building contracts..."
forge build

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