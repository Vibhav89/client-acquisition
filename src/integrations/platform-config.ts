import type { BrowserPlatformConfig } from "./browser-session.js";
import type { PlatformDefinition } from "../domain/platform.js";
import { isSafeExternalUrl } from "../domain/security.js";

const defaultDefinitions: readonly PlatformDefinition[] = [
  { platform: "linkedin", displayName: "LinkedIn", hosts: ["linkedin.com"], startUrl: "https://www.linkedin.com/jobs/", envDirectory: "linkedin" },
  { platform: "upwork", displayName: "Upwork", hosts: ["upwork.com"], startUrl: "https://www.upwork.com/nx/find-work/", envDirectory: "upwork" },
  { platform: "fiverr", displayName: "Fiverr", hosts: ["fiverr.com"], startUrl: "https://www.fiverr.com/", envDirectory: "fiverr" },
  { platform: "outlier", displayName: "Outlier", hosts: ["outlier.ai", "outlier.com"], startUrl: "https://app.outlier.ai/", envDirectory: "outlier" },
];

export interface CustomPlatformInput {
  readonly id?: unknown;
  readonly platform?: unknown;
  readonly displayName?: unknown;
  readonly hosts?: unknown;
  readonly startUrl?: unknown;
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

function parseCustomDefinitions(raw = process.env.CLIENT_RADAR_CUSTOM_PLATFORMS): PlatformDefinition[] {
  if (!raw?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const definitions: PlatformDefinition[] = [];
    for (const item of parsed as CustomPlatformInput[]) {
      const rawId = typeof item.id === "string" ? item.id : typeof item.platform === "string" ? item.platform : "";
      const platform = normalizeId(rawId);
      const displayName = typeof item.displayName === "string" && item.displayName.trim() ? item.displayName.trim().slice(0, 80) : platform;
      const hosts = Array.isArray(item.hosts)
        ? item.hosts.filter((host): host is string => typeof host === "string").map((host) => host.trim().toLowerCase()).filter(Boolean).slice(0, 20)
        : [];
      const startUrl = typeof item.startUrl === "string" ? item.startUrl.trim() : "";
      if (!platform || !hosts.length || !isSafeExternalUrl(startUrl)) continue;
      if (defaultDefinitions.some((definition) => definition.platform === platform)) continue;
      if (definitions.some((definition) => definition.platform === platform)) continue;
      definitions.push({ platform, displayName, hosts, startUrl, envDirectory: platform });
    }
    return definitions;
  } catch {
    return [];
  }
}

export function getPlatformDefinitions(): readonly PlatformDefinition[] {
  return [...defaultDefinitions, ...parseCustomDefinitions()];
}

export function createDefaultPlatformConfigs(
  profileRoot = process.env.CLIENT_RADAR_BROWSER_PROFILES ?? ".client-radar/profiles",
): BrowserPlatformConfig[] {
  return getPlatformDefinitions().map((definition) => ({
    platform: definition.platform,
    displayName: definition.displayName,
    startUrl: definition.startUrl,
    profileDirectory: `${profileRoot}/${definition.envDirectory}`,
  }));
}
