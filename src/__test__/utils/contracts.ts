import {
  createPublicClient,
  createWalletClient,
  http,
  Address,
  GetContractReturnType,
  PublicClient,
  WalletClient,
  Account,
  parseEther,
  Chain,
  DeployContractParameters,
} from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { readFileSync } from 'fs';
import { join } from 'path';
dotenv.config();

const ETH_PROVIDER_URL =
  process.env.ETH_PROVIDER_URL || 'http://localhost:8545';
const WALLET_PRIVATE_KEY =
  process.env.WALLET_PRIVATE_KEY ||
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Initialize viem clients
const transport = http('http://127.0.0.1:8545');

const account = privateKeyToAccount(WALLET_PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: foundry,
  transport,
});

const walletClient = createWalletClient({
  account,
  chain: foundry,
  transport,
});

interface ContractArtifact {
  abi: any[];
  bytecode: {
    object: string;
  };
}

/**
 * Deploys a contract using viem
 * @param name - Name of the contract to deploy
 * @param args - Constructor arguments (optional)
 * @returns Deployed contract address
 */
export async function deployContract(
  name: string,
  args: any[] = [],
): Promise<Address> {
  // Read contract artifact
  const artifactPath = join(
    __dirname,
    '../../../forge/out',
    `${name}.sol/${name}.json`,
  );
  const artifact: ContractArtifact = JSON.parse(
    readFileSync(artifactPath, 'utf-8'),
  );

  // Deploy contract with proper typing
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object as `0x${string}`,
    args,
    account,
    chain: foundry,
  });

  // Wait for deployment
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error('Contract deployment failed');
  }

  console.log(`Contract ${name} deployed at: ${receipt.contractAddress}`);
  return receipt.contractAddress;
}

/**
 * Gets a contract instance
 * @param address Contract address
 * @param name Name of the contract
 * @returns Contract instance with viem client
 */
export function getContract(address: Address, name: string) {
  const artifactPath = join(
    __dirname,
    '../../../forge/out',
    `${name}.sol/${name}.json`,
  );
  const artifact: ContractArtifact = JSON.parse(
    readFileSync(artifactPath, 'utf-8'),
  );

  return {
    address,
    abi: artifact.abi,
    publicClient,
    walletClient,
  };
}

// Export clients for reuse
export { publicClient, walletClient, account };
