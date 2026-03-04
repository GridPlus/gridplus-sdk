import {
  compareFirmwareVersions,
  createSigningComponentRegistry,
  toChainKey,
  type ChainPlugin,
  type DeviceId,
  type FirmwareVersionTuple,
  type SigningComponentDefinition,
  type SigningComponentRequirement,
} from '@gridplus/chain-core';
import { EXTERNAL } from '../constants';

const registry = createSigningComponentRegistry();
let seeded = false;
const pluginDefinitionsByKey = new Map<string, SigningComponentDefinition[]>();

const getBuiltinSigningComponentDefinitions =
  (): SigningComponentDefinition[] => {
    const definitions: SigningComponentDefinition[] = [];

    Object.entries(EXTERNAL.SIGNING.HASHES).forEach(([name, code]) => {
      definitions.push({ kind: 'hash', name, code });
    });
    Object.entries(EXTERNAL.SIGNING.CURVES).forEach(([name, code]) => {
      definitions.push({ kind: 'curve', name, code });
    });
    Object.entries(EXTERNAL.SIGNING.ENCODINGS).forEach(([name, code]) => {
      definitions.push({ kind: 'encoding', name, code });
    });

    return definitions;
  };

const cloneDefinitions = (
  definitions: SigningComponentDefinition[],
): SigningComponentDefinition[] =>
  definitions.map((definition) => ({
    kind: definition.kind,
    name: definition.name,
    code: definition.code,
  }));

const toPluginSigningComponentKey = (
  chainId: string,
  device: DeviceId,
): string => toChainKey(chainId, device);

const rebuildRegistryFromTrackedComponents = (): void => {
  registry.reset();
  seeded = false;
  ensureSigningComponentsSeeded();

  const sortedKeys = [...pluginDefinitionsByKey.keys()].sort();
  sortedKeys.forEach((key) => {
    const definitions = pluginDefinitionsByKey.get(key);
    if (!definitions || definitions.length === 0) return;
    registry.register(definitions);
  });
};

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

const isSigningComponentRequirement = (
  requirement: unknown,
): requirement is SigningComponentRequirement => {
  if (!requirement || typeof requirement !== 'object') return false;
  const req = requirement as SigningComponentRequirement;
  const kind =
    req.kind === 'hash' || req.kind === 'curve' || req.kind === 'encoding';
  return (
    kind &&
    typeof req.name === 'string' &&
    req.name.trim().length > 0 &&
    isFirmwareVersionTuple(req.minFirmware)
  );
};

const getPluginSigningComponentDefinitions = (
  plugin: ChainPlugin<any>,
): SigningComponentDefinition[] => {
  const definitions = plugin.signingSuite?.definitions;
  if (!definitions || !Array.isArray(definitions)) return [];
  return definitions;
};

const getPluginSigningComponentRequirements = (
  plugin: ChainPlugin<any>,
): SigningComponentRequirement[] => {
  const requirements = plugin.signingSuite?.requirements;
  if (!requirements || !Array.isArray(requirements)) return [];
  return requirements as SigningComponentRequirement[];
};

const validatePluginRequirementShape = (plugin: ChainPlugin<any>): void => {
  const requirements = plugin.signingSuite?.requirements;
  if (!requirements) return;
  if (!Array.isArray(requirements)) {
    throw new Error(
      `Chain "${plugin.chainId}" has invalid signing component requirements: expected an array.`,
    );
  }
  requirements.forEach((requirement, index) => {
    if (!isSigningComponentRequirement(requirement)) {
      throw new Error(
        `Chain "${plugin.chainId}" has invalid signing component requirement at index ${index}.`,
      );
    }
  });
};

export function getSigningComponentRegistry() {
  return registry;
}

export function ensureSigningComponentsSeeded(): void {
  if (seeded) return;
  registry.register(getBuiltinSigningComponentDefinitions());
  seeded = true;
}

export function preflightPluginSigningComponents(
  plugin: ChainPlugin<any>,
): void {
  validatePluginRequirementShape(plugin);
  ensureSigningComponentsSeeded();

  const definitions = getPluginSigningComponentDefinitions(plugin);
  if (definitions.length === 0) return;
  registry.preflight(definitions);
}

export function registerPluginSigningComponents(
  plugin: ChainPlugin<any>,
): void {
  validatePluginRequirementShape(plugin);
  ensureSigningComponentsSeeded();

  const definitions = getPluginSigningComponentDefinitions(plugin);
  const pluginKey = toPluginSigningComponentKey(plugin.chainId, plugin.device);
  if (definitions.length === 0) {
    pluginDefinitionsByKey.delete(pluginKey);
    return;
  }
  registry.register(definitions);
  pluginDefinitionsByKey.set(pluginKey, cloneDefinitions(definitions));
}

export function unregisterPluginSigningComponents(
  chainId: string,
  device?: DeviceId,
): void {
  if (!seeded) return;

  const keysToDelete = device
    ? [toPluginSigningComponentKey(chainId, device)]
    : [...pluginDefinitionsByKey.keys()].filter((key) =>
        key.startsWith(`${chainId}:`),
      );

  if (keysToDelete.length === 0) return;

  keysToDelete.forEach((key) => pluginDefinitionsByKey.delete(key));
  rebuildRegistryFromTrackedComponents();
}

export function validatePluginSigningRequirements(
  plugin: ChainPlugin<any>,
  fwVersion: FirmwareVersionTuple,
): void {
  validatePluginRequirementShape(plugin);
  ensureSigningComponentsSeeded();

  const requirements = getPluginSigningComponentRequirements(plugin);
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

export function resetSigningComponentRegistry(): void {
  registry.reset();
  pluginDefinitionsByKey.clear();
  seeded = false;
}
