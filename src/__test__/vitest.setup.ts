import { beforeAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function ensureDockerRunning() {
  try {
    await execAsync('docker info');
  } catch (error) {
    console.log('Starting Docker daemon...');
    await execAsync('open -a Docker');
    // Wait for Docker to start
    await new Promise(resolve => setTimeout(resolve, 20000));
  }
}

beforeAll(async () => {
  // Set global timeout
  globalThis.testTimeout = 120000; // 2 minutes
  
  // Ensure Docker is running
  await ensureDockerRunning();
}, 30000); // Give the setup plenty of time 