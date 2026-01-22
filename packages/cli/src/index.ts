import { Command } from 'commander';
import {
  addressCommand,
  blsChangeCommand,
  connectCommand,
  depositDataCommand,
  pairCommand,
  pubkeyCommand,
  setupCommand,
  signCommand,
  signMessageCommand,
  simulatorCommand,
} from './commands/index.js';

export const program = new Command()
  .name('gridplus')
  .description('CLI for GridPlus SDK - interact with Lattice hardware wallets')
  .version('0.1.0');

// Register device management commands
program.addCommand(setupCommand);
program.addCommand(connectCommand);
program.addCommand(pairCommand);
program.addCommand(simulatorCommand);

// Register address/key commands
program.addCommand(addressCommand);
program.addCommand(pubkeyCommand);

// Register signing commands
program.addCommand(signCommand);
program.addCommand(signMessageCommand);

// Register ETH2 commands as a subcommand group
const eth2 = new Command('eth2').description('Ethereum 2.0 staking commands');
eth2.addCommand(depositDataCommand);
eth2.addCommand(blsChangeCommand);
program.addCommand(eth2);
