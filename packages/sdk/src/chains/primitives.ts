import {
  compareFirmwareVersions,
  createPrimitiveRegistry,
  type ChainPlugin,
  type FirmwareVersionTuple,
  type PrimitiveDefinition,
  type PrimitiveRequirement,
} from '@gridplus/chain-core';
import { EXTERNAL } from '../constants';

const registry = createPrimitiveRegistry();
let seeded = false;

const isFirmwareVersionTuple = (
  value: unknown,
): value is FirmwareVersionTuple => {
  if (!Array.isArray(value) || value.length !== 3) return false;
  return value.every(
    (part) =>
      typeof part === 'number' &&
      Number.isInteger(part) &&
      Number.isFinite(part) &&
      part >= 0,
  );
};

const isPrimitiveRequirement = (
  requirement: unknown,
): requirement is PrimitiveRequirement => {
  if (!requirement || typeof requirement !== 'object') return false;
  const req = requirement as PrimitiveRequirement;
  const kind =
    req.kind === 'hash' || req.kind === 'curve' || req.kind === 'encoding';
  return (
    kind &&
    typeof req.name === 'string' &&
    req.name.trim().length > 0 &&
    isFirmwareVersionTuple(req.minFirmware)
  );
};

const getPluginPrimitiveDefinitions = (
  plugin: ChainPlugin<any>,
): PrimitiveDefinition[] => {
  const definitions = plugin.primitives?.definitions;
  if (!definitions || !Array.isArray(definitions)) return [];
  return definitions;
};

const getPluginPrimitiveRequirements = (
  plugin: ChainPlugin<any>,
): PrimitiveRequirement[] => {
  const requirements = plugin.primitives?.requirements;
  if (!requirements || !Array.isArray(requirements)) return [];
  return requirements as PrimitiveRequirement[];
};

const validatePluginRequirementShape = (plugin: ChainPlugin<any>): void => {
  const requirements = plugin.primitives?.requirements;
  if (!requirements) return;
  if (!Array.isArray(requirements)) {
    throw new Error(
      `Chain "${plugin.chainId}" has invalid primitive requirements: expected an array.`,
    );
  }
  requirements.forEach((requirement, index) => {
    if (!isPrimitiveRequirement(requirement)) {
      throw new Error(
        `Chain "${plugin.chainId}" has invalid primitive requirement at index ${index}.`,
      );
    }
  });
};

export function getPrimitiveRegistry() {
  return registry;
}

export function ensurePrimitivesSeeded(): void {
  if (seeded) return;
  const definitions: PrimitiveDefinition[] = [];

  Object.entries(EXTERNAL.SIGNING.HASHES).forEach(([name, code]) => {
    definitions.push({ kind: 'hash', name, code });
  });
  Object.entries(EXTERNAL.SIGNING.CURVES).forEach(([name, code]) => {
    definitions.push({ kind: 'curve', name, code });
  });
  Object.entries(EXTERNAL.SIGNING.ENCODINGS).forEach(([name, code]) => {
    definitions.push({ kind: 'encoding', name, code });
  });

  registry.register(definitions);
  seeded = true;
}

export function preflightPluginPrimitives(plugin: ChainPlugin<any>): void {
  validatePluginRequirementShape(plugin);
  ensurePrimitivesSeeded();

  const definitions = getPluginPrimitiveDefinitions(plugin);
  if (definitions.length === 0) return;
  registry.preflight(definitions);
}

export function registerPluginPrimitives(plugin: ChainPlugin<any>): void {
  validatePluginRequirementShape(plugin);
  ensurePrimitivesSeeded();

  const definitions = getPluginPrimitiveDefinitions(plugin);
  if (definitions.length === 0) return;
  registry.register(definitions);
}

export function validatePluginPrimitiveRequirements(
  plugin: ChainPlugin<any>,
  fwVersion: FirmwareVersionTuple,
): void {
  validatePluginRequirementShape(plugin);
  ensurePrimitivesSeeded();

  const requirements = getPluginPrimitiveRequirements(plugin);
  if (requirements.length === 0) return;

  requirements.forEach((requirement) => {
    if (!registry.has(requirement.kind, requirement.name)) {
      throw new Error(
        `Chain "${plugin.chainId}" requires ${requirement.kind}:${requirement.name}, but it is not registered.`,
      );
    }

    if (compareFirmwareVersions(fwVersion, requirement.minFirmware) < 0) {
      throw new Error(
        `Chain "${plugin.chainId}" requires ${requirement.kind}:${requirement.name} (min firmware ${requirement.minFirmware.join(
          '.',
        )}), but device is running ${fwVersion.join('.')}. Please update firmware.`,
      );
    }
  });
}

export function resetPrimitiveRegistry(): void {
  registry.reset();
  seeded = false;
}
