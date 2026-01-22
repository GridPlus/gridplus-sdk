import { Command } from 'commander';

export const program = new Command()
  .name('gridplus')
  .description('CLI for GridPlus SDK - interact with Lattice hardware wallets')
  .version('0.1.0');

// Placeholder commands - implementations in future phases
program
  .command('setup')
  .description('Interactive device setup and pairing')
  .action(() => console.log('Not yet implemented'));

program
  .command('address [path]')
  .description('Get ETH address at derivation path')
  .option('-t, --type <type>', 'Address type', 'eth')
  .action(() => console.log('Not yet implemented'));

program
  .command('pubkey [path]')
  .description('Get public key at derivation path')
  .option(
    '-t, --type <type>',
    'Key type: secp256k1|ed25519|bls12_381',
    'secp256k1',
  )
  .action(() => console.log('Not yet implemented'));

const eth2 = program
  .command('eth2')
  .description('Ethereum 2.0 staking commands');

eth2
  .command('deposit-data')
  .description('Export validator deposit data and keystores')
  .action(() => console.log('Not yet implemented'));

eth2
  .command('bls-change')
  .description('Change BLS withdrawal credentials to ETH1 address')
  .action(() => console.log('Not yet implemented'));
