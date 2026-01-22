import chalk from 'chalk';
import { loadConfig } from './config.js';

export type OutputFormat = 'json' | 'human';

/**
 * Outputs data in the specified format
 */
export function output(data: unknown, format?: OutputFormat): void {
  const outputFormat = format ?? loadConfig().outputFormat;

  if (outputFormat === 'json') {
    console.log(JSON.stringify(data, null, 2));
  } else {
    if (typeof data === 'string') {
      console.log(data);
    } else if (Array.isArray(data)) {
      data.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          console.log(chalk.bold(`[${index}]`));
          formatObject(item as Record<string, unknown>, '  ');
        } else {
          console.log(`[${index}] ${String(item)}`);
        }
      });
    } else if (typeof data === 'object' && data !== null) {
      formatObject(data as Record<string, unknown>);
    } else {
      console.log(String(data));
    }
  }
}

/**
 * Formats an object for human-readable output
 */
function formatObject(obj: Record<string, unknown>, indent = ''): void {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      console.log(`${indent}${chalk.cyan(key)}:`);
      formatObject(value as Record<string, unknown>, `${indent}  `);
    } else if (Array.isArray(value)) {
      console.log(`${indent}${chalk.cyan(key)}:`);
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          console.log(`${indent}  [${index}]`);
          formatObject(item as Record<string, unknown>, `${indent}    `);
        } else {
          console.log(`${indent}  [${index}] ${String(item)}`);
        }
      });
    } else {
      console.log(`${indent}${chalk.cyan(key)}: ${chalk.white(String(value))}`);
    }
  }
}

/**
 * Outputs a success message
 */
export function success(message: string): void {
  console.log(`${chalk.green('✓')} ${message}`);
}

/**
 * Outputs an error message
 */
export function error(message: string): void {
  console.error(`${chalk.red('✗')} ${message}`);
}

/**
 * Outputs a warning message
 */
export function warn(message: string): void {
  console.log(`${chalk.yellow('⚠')} ${message}`);
}

/**
 * Outputs an info message
 */
export function info(message: string): void {
  console.log(`${chalk.blue('ℹ')} ${message}`);
}

/**
 * Outputs a debug message (only in verbose mode)
 */
export function debug(message: string): void {
  if (process.env.DEBUG || process.env.VERBOSE) {
    console.log(`${chalk.gray('[debug]')} ${message}`);
  }
}

/**
 * Outputs a table of data
 */
export function table(
  headers: string[],
  rows: string[][],
  format?: OutputFormat,
): void {
  const outputFormat = format ?? loadConfig().outputFormat;

  if (outputFormat === 'json') {
    const data = rows.map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] ?? '';
      });
      return obj;
    });
    console.log(JSON.stringify(data, null, 2));
  } else {
    // Calculate column widths
    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
    );

    // Print header
    const headerRow = headers
      .map((h, i) => chalk.bold(h.padEnd(widths[i] ?? 0)))
      .join('  ');
    console.log(headerRow);
    console.log(widths.map((w) => '-'.repeat(w)).join('  '));

    // Print rows
    for (const row of rows) {
      const rowStr = row
        .map((cell, i) => (cell ?? '').padEnd(widths[i] ?? 0))
        .join('  ');
      console.log(rowStr);
    }
  }
}

/**
 * Outputs an address with optional label
 */
export function address(addr: string, label?: string): void {
  if (label) {
    console.log(`${chalk.cyan(label)}: ${chalk.white(addr)}`);
  } else {
    console.log(chalk.white(addr));
  }
}

/**
 * Outputs a hex value
 */
export function hex(value: string, label?: string): void {
  const formattedValue = value.startsWith('0x') ? value : `0x${value}`;
  if (label) {
    console.log(`${chalk.cyan(label)}: ${chalk.yellow(formattedValue)}`);
  } else {
    console.log(chalk.yellow(formattedValue));
  }
}
