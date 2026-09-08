import { chromium, type BrowserContext, type Page } from "playwright";
import type { BrowserPage, PlatformName, PlatformSession } from "../domain/platform.js";

export interface BrowserPlatformConfig {
  readonly platform: PlatformName;
  readonly displayName: string;
  readonly startUrl: string;
  readonly profileDirectory: string;
}

export interface BrowserSessionPort {
  inspect(config: BrowserPlatformConfig): Promise<{ session: PlatformSession; page?: BrowserPage }>;
  close(): Promise<void>;
}

function isLikelyLoggedIn(url: string, text: string): boolean {
  const lower = `${url}\n${text}`.toLowerCase();
  if (/login|sign[ -]?in|authenticate|join now/.test(lower)) return false;
  return /log out|sign out|profile|dashboard|my jobs|messages|account/.test(lower);
}

export class PlaywrightBrowserSession implements BrowserSessionPort {
  private contexts = new Map<PlatformName, BrowserContext>();

  async inspect(config: BrowserPlatformConfig): Promise<{ session: PlatformSession; page?: BrowserPage }> {
    let context = this.contexts.get(config.platform);
    if (!context) {
      context = await chromium.launchPersistentContext(config.profileDirectory, {
        headless: false,
        viewport: { width: 1440, height: 1000 },
      });
      this.contexts.set(config.platform, context);
    }

    const page: Page = context.pages()[0] ?? await context.newPage();
    await page.goto(config.startUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(750);
    const text = await page.locator("body").innerText().catch(() => "");
    const loggedIn = isLikelyLoggedIn(page.url(), text);

    return {
      session: {
        platform: config.platform,
        loggedIn,
        checkedAt: new Date().toISOString(),
      },
      page: {
        url: page.url(),
        title: await page.title().catch(() => undefined),
        text: text.slice(0, 80_000),
      },
    };
  }

  async close(): Promise<void> {
    await Promise.all([...this.contexts.values()].map((context) => context.close()));
    this.contexts.clear();
  }
}
