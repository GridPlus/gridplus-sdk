# GridPlus SDK Scripts

## Device Pairing Script

The `pair-device.ts` script provides a simple CLI interface for pairing your GridPlus Lattice device with the SDK.

### Usage

#### Option 1: Using npm script (recommended)
```bash
npm run pair-device
```

#### Option 2: Direct execution
```bash
npx tsx scripts/pair-device.ts
```

### Configuration

The script can be configured using environment variables or interactive prompts:

#### Environment Variables
Create a `.env` file in the project root with:
```env
DEVICE_ID=your_device_id
PASSWORD=your_password
APP_NAME=your_app_name
```

#### Interactive Mode
If environment variables are not set, the script will prompt you for:
- Device ID
- Password (defaults to "password")
- App Name (defaults to "CLI Pairing Tool")

### Pairing Process

1. The script attempts to connect to your device
2. If already paired, it confirms the connection
3. If not paired, it prompts for the pairing secret displayed on your Lattice device
4. Upon successful pairing, client state is saved to `./client.temp`

### Notes

- The client state is saved locally in `./client.temp` for future use
- Make sure your Lattice device is connected and accessible
- The pairing secret is case-insensitive (automatically converted to uppercase)
- If pairing fails, check your device connection and try again 