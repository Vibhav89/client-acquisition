import type { PlatformConnector, PlatformDefinition } from "../domain/platform.js";
import { defaultPlatformConnectors } from "./platforms.js";

/** Keeps existing first-class adapters while allowing arbitrary registered platforms to use the generic adapter. */
export function createDefaultPlatformConnectors(_definitions: readonly PlatformDefinition[]): readonly PlatformConnector[] {
  return defaultPlatformConnectors;
}
