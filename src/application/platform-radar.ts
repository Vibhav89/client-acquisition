import { buildDashboardModel, type DashboardModel } from "./dashboard.js";
import { DefaultApprovalService } from "./approval-service.js";
import { runRadar, type RadarResult } from "../domain/radar.js";
import type { CandidateProfile, Opportunity } from "../domain/opportunity.js";
import type { PersistencePort } from "../domain/persistence.js";
import type { BrowserPlatformConfig, BrowserSessionPort } from "../integrations/browser-session.js";
import type { PlatformSession } from "../domain/platform.js";
import { createBrowserOpportunitySource } from "../domain/platform.js";
import { createPlatformRegistry } from "../domain/platform-registry.js";
import { createGenericPlatformConnector } from "../integrations/generic-platform-connector.js";
import { createDefaultPlatformConnectors } from "../integrations/platform-connectors.js";
import { getPlatformDefinitions } from "../integrations/platform-config.js";

export interface PlatformRadarRun {
  dashboard: DashboardModel;
  radar: RadarResult;
  sessions: PlatformSession[];
  opportunities: Opportunity[];
  approvals: Awaited<ReturnType<DefaultApprovalService["createForRadar"]>>;
}

export async function runPlatformRadar(
  configs: readonly BrowserPlatformConfig[],
  browser: BrowserSessionPort,
  profile: CandidateProfile,
  persistence: PersistencePort,
  now = new Date().toISOString(),
): Promise<PlatformRadarRun> {
  const definitions = getPlatformDefinitions();
  const registry = createPlatformRegistry(
    definitions,
    [
      ...createDefaultPlatformConnectors(definitions),
      ...definitions.filter((definition) => !["linkedin", "upwork", "fiverr", "outlier"].includes(definition.platform)).map(createGenericPlatformConnector),
    ],
  );
  const pages = [];
  const sessions: PlatformSession[] = [];

  for (const config of configs) {
    try {
      const result = await browser.inspect(config);
      sessions.push(result.session);
      if (result.session.loggedIn && result.page) pages.push(result.page);
    } catch {
      sessions.push({ platform: config.platform, loggedIn: false, checkedAt: now });
    }
  }

  const source = createBrowserOpportunitySource(registry.connectors);
  const discovered = await source.discoverFromPages(pages);
  const radar = runRadar(discovered, profile);
  for (const ranked of radar.ranked) await persistence.saveOpportunity(ranked.opportunity);

  const approvalService = new DefaultApprovalService(persistence);
  const approvals = await approvalService.createForRadar(radar, profile, now);

  return {
    dashboard: buildDashboardModel(radar),
    radar,
    sessions,
    opportunities: radar.ranked.map((item) => item.opportunity),
    approvals,
  };
}
