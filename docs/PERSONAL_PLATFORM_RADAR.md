# Personal Platform Radar

This feature is for personal use. It uses local persistent Playwright browser profiles so the user can sign in to supported platforms once and let the radar read opportunity pages later.

## Current platforms

- LinkedIn
- Upwork
- Fiverr
- Outlier

## Safety boundary

The browser radar is **read-only discovery**. It does not automate application submission, proposals/messages, purchases, payments, CAPTCHA solving, or security-control bypasses. The existing approval state machine remains the gate for proposal decisions.

## First local setup

```bash
npm install
npm run browser:install
```

Enable the browser route only for local use:

```bash
CLIENT_RADAR_BROWSER_ENABLED=true npm run server
```

The first scan opens one visible browser context per platform. Sign in manually when prompted. Session data is stored under `.client-radar/profiles/` and is ignored by git.

## Daily workflow

1. Start the local server.
2. Click **Scan my platforms**.
3. Complete any required login or verification manually.
4. Review the ranked opportunities in the dashboard.
5. Open the original platform URL yourself.
6. Apply manually on the platform.
7. Keep approval and external communication under explicit user control.

## Planned next layer

The next iteration should replace the initial generic link extractor with platform-specific, read-only parsers that capture title, description, budget, client signals, skills, location, and source URL from each supported opportunity. The normalized records will then flow through the existing match, risk, ranking, proposal, and learning pipeline.
