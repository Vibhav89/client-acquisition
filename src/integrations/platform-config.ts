import type { BrowserPlatformConfig } from "./browser-session.js";
import type { PlatformName } from "../domain/platform.js";

interface PlatformDefinition {
  readonly platform: Exclude<PlatformName, "generic">;
  readonly displayName: string;
  readonly startUrl: string;
  readonly envDirectory: string;
}

const definitions: readonly PlatformDefinition[] = [
  { platform: "linkedin", displayName: "LinkedIn", startUrl: "https://www.linkedin.com/jobs/", envDirectory: "LINKEDIN" },
  { platform: "upwork", displayName: "Upwork", startUrl: "https://www.upwork.com/nx/find-work/", envDirectory: "UPWORK" },
  { platform: "fiverr", displayName: "Fiverr", startUrl: "https://www.fiverr.com/", envDirectory: "FIVERR" },
  { platform: "outlier", displayName: "Outlier", startUrl: "https://app.outlier.ai/", envDirectory: "OUTLIER" },
];

export function createDefaultPlatformConfigs(profileRoot = process.env.CLIENT_RADAR_BROWSER_PROFILES ?? ".client-radar/profiles"): BrowserPlatformConfig[] {
  return definitions.map((definition) => ({
    platform: definition.platform,
    displayName: definition.displayName,
    startUrl: definition.startUrl,
    profileDirectory: `${profileRoot}/${definition.envDirectory.toLowerCase()}`,
  }));
}
