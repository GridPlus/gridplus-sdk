---
id: 'cli'
title: '🖥️ CLI Reference'
sidebar_position: 3
---

# GridPlus CLI

The GridPlus CLI (`@gridplus/cli`) is a command-line tool for interacting with Lattice hardware wallets. It supports both real Lattice1 devices and the lattice-simulator for local development and CI testing.

## Installation

```bash
# Using npm
npm install -g @gridplus/cli

# Using yarn
yarn global add @gridplus/cli

# Using pnpm
pnpm add -g @gridplus/cli
```

After installation, the `gridplus` command is available globally.

## Quick Start

### Using with Lattice Simulator (Recommended for Development)

The fastest way to get started is with the [lattice-simulator](https://github.com/GridPlus/lattice-simulator), which provides a local mock device:

```bash
# 1. Start the simulator
docker run -p 3000:3000 -e LATTICE_AUTO_APPROVE=true gridplus/lattice-simulator

# 2. One-shot setup and pair
gridplus simulator setup

# 3. Get addresses
gridplus address
```

:::tip
Set the `LATTICE_AUTO_APPROVE=true` environment variable when running the simulator to automatically approve requests without manual intervention.
:::

### Using with a Real Lattice Device

```bash
# 1. Configure your device connection
gridplus setup

# 2. When prompted, enter:
#    - Device ID (6-character ID from Settings on your Lattice)
#    - Password (for local encryption, not sent to device)
#    - App name (shown on device during pairing)

# 3. Pair with your device
gridplus pair
# Enter the 6-digit code displayed on your Lattice

# 4. Ready to use!
gridplus address
```

## Commands

### Device Management

#### `gridplus setup`

Interactive device setup - configure connection to your Lattice.

```bash
# Interactive setup (prompts for all values)
gridplus setup

# With options
gridplus setup --device-id ABC123 --password mypass --name "My App"

# For simulator (uses localhost:3000, SD0001, etc.)
gridplus setup --simulator
```

| Option | Description |
|--------|-------------|
| `-d, --device-id <id>` | Device ID (skip prompt) |
| `-p, --password <password>` | Device password (skip prompt) |
| `-n, --name <name>` | App name shown on device |
| `--base-url <url>` | Custom base URL for Lattice relay |
| `-s, --simulator` | Use simulator defaults |

#### `gridplus connect`

Reconnect to a previously configured device.

```bash
gridplus connect
```

#### `gridplus pair [code]`

Pair with a Lattice device using a pairing code.

```bash
# Interactive (prompts for code)
gridplus pair

# With code directly
gridplus pair 123456

# Auto-pair with simulator
gridplus pair --simulator
```

| Option | Description |
|--------|-------------|
| `-s, --simulator` | Use simulator pairing secret (auto-pair) |

---

### Simulator Commands

#### `gridplus simulator setup`

One-shot setup and pair with lattice-simulator. Combines `setup --simulator` and `pair --simulator` into a single command.

```bash
gridplus simulator setup
```

#### `gridplus simulator info`

Display simulator default configuration.

```bash
gridplus simulator info
```

Output:
```
Lattice Simulator Defaults:
  URL:            http://127.0.0.1:3000
  Device ID:      SD0001
  Password:       12345678
  Pairing Secret: 12345678
```

:::info Simulator Alias
You can use `gridplus sim` as a shorthand for `gridplus simulator`.
:::

---

### Address Commands

#### `gridplus address`

Get addresses from your Lattice device.

```bash
# Default: single Ethereum address
gridplus address

# Multiple addresses
gridplus address --count 5

# Different address types
gridplus address --type btc-legacy
gridplus address --type btc-segwit
gridplus address --type btc-wrapped-segwit
gridplus address --type solana

# Specific starting index
gridplus address --index 10 --count 3

# Custom derivation path
gridplus address "m/44'/60'/0'/0/5"

# JSON output for scripting
gridplus address --json
```

| Option | Description |
|--------|-------------|
| `-t, --type <type>` | Address type: `eth`, `btc-legacy`, `btc-segwit`, `btc-wrapped-segwit`, `solana` |
| `-n, --count <n>` | Number of addresses to fetch (default: 1) |
| `-i, --index <n>` | Starting index (default: 0) |
| `-j, --json` | Output in JSON format |

**Address Types:**

| Type | Description | Example |
|------|-------------|---------|
| `eth` (default) | Ethereum address (m/44'/60'/0'/0/x) | `0x1234...` |
| `btc-legacy` | Bitcoin P2PKH (m/44'/0'/0'/0/x) | `1A1zP1...` |
| `btc-segwit` | Bitcoin Native SegWit P2WPKH (m/84'/0'/0'/0/x) | `bc1q...` |
| `btc-wrapped-segwit` | Bitcoin Wrapped SegWit P2SH-P2WPKH (m/49'/0'/0'/0/x) | `3J98t1...` |
| `solana` | Solana address (m/44'/501'/0'/0') | `4fYNw3...` |

---

### Public Key Commands

#### `gridplus pubkey`

Get public keys from your Lattice device.

```bash
# Default: secp256k1 public key
gridplus pubkey

# Ed25519 (for Solana)
gridplus pubkey --type ed25519

# BLS (for Ethereum staking)
gridplus pubkey --type bls12_381_g1

# Custom derivation path
gridplus pubkey "m/44'/60'/0'/0/0" --type secp256k1

# Multiple keys
gridplus pubkey --count 3

# JSON output
gridplus pubkey --json
```

| Option | Description |
|--------|-------------|
| `-t, --type <type>` | Key type: `secp256k1`, `ed25519`, `bls12_381_g1` |
| `-n, --count <n>` | Number of keys to fetch (default: 1) |
| `-i, --index <n>` | Starting index (default: 0) |
| `-j, --json` | Output in JSON format |

**Key Types and Default Paths:**

| Type | Curve | Default Path |
|------|-------|--------------|
| `secp256k1` | ECDSA | m/44'/60'/0'/0/0 |
| `ed25519` | Ed25519 | m/44'/501'/0'/0' |
| `bls12_381_g1` | BLS | m/12381/3600/0/0/0 |

---

### Signing Commands

#### `gridplus sign <tx>`

Sign a transaction.

```bash
# Sign a serialized transaction
gridplus sign "0x02f87001..."

# JSON output
gridplus sign "0x02f87001..." --json
```

:::warning
Transaction signing requires the transaction to be pre-serialized. For a better developer experience, consider using the SDK directly for transaction construction.
:::

#### `gridplus sign-message <message>`

Sign a message using personal_sign or EIP-712 typed data.

```bash
# Personal sign (plain text message)
gridplus sign-message "Hello, Lattice!"

# Sign hex data
gridplus sign-message "0xdeadbeef"

# EIP-712 typed data (JSON string)
gridplus sign-message '{"types":...,"domain":...,"primaryType":"...","message":...}' --typed

# Read message from file
gridplus sign-message ./message.txt --file

# Read EIP-712 from file
gridplus sign-message ./typed-data.json --file --typed

# JSON output
gridplus sign-message "Hello" --json
```

| Option | Description |
|--------|-------------|
| `--typed` | Sign EIP-712 typed data (expects JSON) |
| `--file` | Read message from file |
| `-j, --json` | Output signature in JSON format |

---

### Ethereum 2.0 Commands

#### `gridplus eth2 deposit-data`

Generate ETH2 validator deposit data.

```bash
gridplus eth2 deposit-data
```

#### `gridplus eth2 bls-change`

Generate BLS credentials change message for validator withdrawal address updates.

```bash
gridplus eth2 bls-change
```

---

## JSON Output

All commands support `-j, --json` for machine-readable output, useful for scripting and CI pipelines.

```bash
# Example: Get address as JSON
gridplus address --json

# Output:
# {"type":"eth","count":1,"addresses":["0x..."]}

# Parse with jq
gridplus address --json | jq -r '.addresses[0]'
```

---

## Session Management

The CLI stores session data in `~/.gridplus/session.json`. This includes:

- Device ID
- Base URL
- App name
- Encrypted app secret
- Simulator flag

To clear your session and start fresh:

```bash
rm -rf ~/.gridplus
```

---

## CI Integration

The CLI is designed to work well in CI environments with the lattice-simulator.

### GitHub Actions Example

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      lattice-simulator:
        image: gridplus/lattice-simulator
        env:
          LATTICE_AUTO_APPROVE: "true"
        ports:
          - 3000:3000

    steps:
      - uses: actions/checkout@v4

      - name: Setup CLI
        run: npm install -g @gridplus/cli

      - name: Configure simulator
        run: gridplus simulator setup

      - name: Verify connection
        run: |
          # Get ETH address
          gridplus address --json

          # Get BTC address
          gridplus address --type btc-segwit --json

          # Get public key
          gridplus pubkey --json
```

### Environment Variables

The CLI respects the following environment variables:

| Variable | Description |
|----------|-------------|
| `LATTICE_AUTO_APPROVE` | Set to `true` on the simulator to auto-approve requests |
| `LATTICE_MNEMONIC` | Set custom mnemonic on simulator for deterministic testing |

---

## Troubleshooting

### "No device configured"

Run `gridplus setup` first to configure your device connection.

### Connection Timeout

- **Real device**: Ensure your Lattice is connected to the internet and reachable
- **Simulator**: Ensure the simulator is running: `docker run -p 3000:3000 gridplus/lattice-simulator`

### Pairing Failed

- **Real device**: Check that you entered the correct 6-digit code from the device screen
- **Simulator**: Use `gridplus pair --simulator` to auto-pair

### "Setup failed: Request failed"

The device may not be reachable. Check:
- The Device ID is correct
- The base URL is correct (default: `https://signing.gridpl.us` for real devices)
- Network connectivity

---

## See Also

- [Getting Started](/) - SDK overview and concepts
- [Addresses](./addresses) - Address derivation in depth
- [Signing](./signing) - Transaction and message signing
- [Testing](./testing) - Testing with the SDK
