import type { PlatformConnector, PlatformDefinition } from "./platform.js";

export interface PlatformRegistry {
  readonly definitions: readonly PlatformDefinition[];
  readonly connectors: readonly PlatformConnector[];
  getDefinition(platform: string): PlatformDefinition | undefined;
  getConnector(platform: string): PlatformConnector | undefined;
}

export function createPlatformRegistry(
  definitions: readonly PlatformDefinition[],
  connectors: readonly PlatformConnector[],
): PlatformRegistry {
  const definitionMap = new Map(definitions.map((definition) => [definition.platform, definition]));
  const connectorMap = new Map(connectors.map((connector) => [connector.platform, connector]));

  return {
    definitions,
    connectors,
    getDefinition: (platform) => definitionMap.get(platform),
    getConnector: (platform) => connectorMap.get(platform),
  };
}
