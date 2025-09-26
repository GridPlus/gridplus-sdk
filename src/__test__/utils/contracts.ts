import { exec } from 'node:child_process';
import * as dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

dotenv.config();
const ETH_PROVIDER_URL = 'http://localhost:8545';
const WALLET_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const execAsync = promisify(exec);
const here = dirname(fileURLToPath(import.meta.url));

export async function deployContract(contractName: string): Promise<string> {
  const forgeLocation = resolve(here, '../../../forge/src');
  console.log('Building the contract...');
  await execAsync(`cd ${forgeLocation} && forge build`);

  console.log('Deploying the contract...');
  const createResult = await execAsync(
    `cd ${forgeLocation} && forge create src/${contractName}.sol:${contractName} --rpc-url ${ETH_PROVIDER_URL} --private-key ${WALLET_PRIVATE_KEY} --json`,
  );

  const output = JSON.parse(createResult.stdout);
  console.log('Contract deployed at address:', output.deployedTo);
  return output.deployedTo;
}
