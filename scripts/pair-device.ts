#!/usr/bin/env tsx

import * as fs from 'fs';
import { question } from 'readline-sync';
import { setup, pair, getClient } from '../src/api';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Storage functions for client state
const getStoredClient = async (): Promise<string> => {
  try {
    return fs.readFileSync('./client.temp', 'utf8');
  } catch (err) {
    return '';
  }
};

const setStoredClient = async (data: string | null): Promise<void> => {
  try {
    if (data) {
      fs.writeFileSync('./client.temp', data);
    }
  } catch (err) {
    console.error('Failed to store client data:', err);
  }
};

async function main() {
  console.log('GridPlus SDK Device Pairing Tool\n');

  try {
    // Get device configuration
    const deviceId = process.env.DEVICE_ID || question('Enter Device ID: ');
    const password =
      process.env.PASSWORD ||
      question('Enter Password (default: password): ', {
        defaultInput: 'password',
      });
    const name =
      process.env.APP_NAME ||
      question('Enter App Name (default: CLI Pairing Tool): ', {
        defaultInput: 'CLI Pairing Tool',
      });

    console.log('\nAttempting to connect to device...');

    // Setup the client
    const isPaired = await setup({
      deviceId,
      password,
      name,
      getStoredClient,
      setStoredClient,
    });

    if (isPaired) {
      console.log('✅ Device is already paired!');
      const client = await getClient();
      console.log(`Connected to device: ${client?.getDeviceId()}`);
    } else {
      console.log('⚠️  Device is not paired. Starting pairing process...');
      console.log('Please check your Lattice device for the pairing secret.');

      const secret = question('Enter the pairing secret from your device: ');

      console.log('Pairing with device...');
      const pairResult = await pair(secret.toUpperCase());

      if (pairResult) {
        console.log('✅ Device paired successfully!');
        const client = await getClient();
        console.log(`Connected to device: ${client?.getDeviceId()}`);
      } else {
        console.log('❌ Pairing failed. Please try again.');
        process.exit(1);
      }
    }

    console.log('\n🎉 Pairing process completed successfully!');
    console.log('Client state has been saved to ./client.temp');
    console.log('You can now use the SDK with this device.');
  } catch (error) {
    console.error('❌ Error during pairing process:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
