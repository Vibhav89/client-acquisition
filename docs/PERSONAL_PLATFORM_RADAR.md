# Personal Platform Radar

This feature is for personal use. It uses local persistent Playwright browser profiles so the user can sign in to platforms once and let the radar read opportunity pages later.

## Platform architecture

The radar is **registry-driven**, not locked to a fixed list of websites. Every platform is normalized into the same opportunity pipeline:

`platform definition -> browser session -> connector -> normalized opportunity -> deduplication -> match/risk analysis -> ranking -> proposal -> approval`

The built-in platforms currently have first-class connectors for LinkedIn, Upwork, Fiverr, and Outlier. Additional platforms can use the generic read-only connector immediately.

## Add another platform without changing core code

Set `CLIENT_RADAR_CUSTOM_PLATFORMS` to a JSON array. Example:

```json
[
  {
    "id": "freelancer",
    "displayName": "Freelancer",
    "hosts": ["freelancer.com"],
    "startUrl": "https://www.freelancer.com/jobs/"
  },
  {
    "id": "toptal",
    "displayName": "Toptal",
    "hosts": ["toptal.com"],
    "startUrl": "https://www.toptal.com/talent/apply"
  }
]
```

The ID is used for the persistent browser profile directory and opportunity source. `hosts` prevents the connector from treating unrelated sites as belonging to the platform. `startUrl` must be an HTTP(S) URL.

If a site needs better extraction than the generic connector can provide, add a platform-specific connector that implements the same `PlatformConnector` contract. The radar, matching, risk, ranking, approval, persistence, and dashboard layers do not need to be rewritten.

## Local setup

```bash
npm install
npm run browser:install
```

Enable the browser route only for local use:

```bash
CLIENT_RADAR_BROWSER_ENABLED=true npm run server
```

The first scan opens visible browser contexts. Sign in manually when prompted. Session data is stored under `.client-radar/profiles/` and is ignored by git. Credentials are not stored by the application.

## Daily workflow

1. Start the local server.
2. Click **Scan my platforms**.
3. Complete any required login or verification manually.
4. Review ranked opportunities.
5. Let the system prepare the appropriate approach/proposal context.
6. Perform or explicitly approve consequential external actions according to the platform's permitted workflow.
7. Continue the client conversation from the tracked opportunity/client record.
8. When a client is ready to close, review the final deal summary and make the final commitment yourself.

## Safety boundary

The browser radar is read-only discovery. It does not bypass CAPTCHAs/security controls or silently commit to purchases, payments, contracts, or other binding actions. Platform terms and permitted APIs/actions must be respected.

## Future expansion

The same registry can support additional job boards, freelance marketplaces, professional networks, direct client lead sources, and specialized task platforms. Platform-specific extraction can progressively replace generic extraction where richer budget, client, proposal, or conversation fields are available.
