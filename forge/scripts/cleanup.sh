#!/bin/bash

# Kill any running anvil processes
pkill -f anvil || true

# Clean up log files
rm -f anvil.log deployment.json

echo "Cleanup complete!" 