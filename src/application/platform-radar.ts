import { buildDashboardModel, type DashboardModel } from "./dashboard.js";
import { DefaultApprovalService } from "./approval-service.js";
import { runRadar, type RadarResult } from "../domain/radar.js";
import type { CandidateProfile, Opportunity } from "../domain/opportunity.js";
import type { PersistencePort } from "../domain/persistence.js";
import type { BrowserPlatformConfig, BrowserSessionPort } from "../integrations/browser-session.js";
import type { PlatformSession } from "../domain/platform.js";
import { createBrowserOpportunitySource } from "../domain/platform.js";
import { defaultPlatformConnectors } from "../integrations/platforms.js";

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

  const source = createBrowserOpportunitySource(defaultPlatformConnectors);
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
