# Ads monetization — Adsterra Native Banners

## Decision

Start with **Adsterra Native Banners** as the first non-AdSense network. The application does not enable ads by default. Adsterra advertises publisher website moderation in minutes and no minimum traffic threshold, but approval is not guaranteed and revenue depends on real human traffic, visitor geography, ad viewability, advertiser demand, and seasonality.

Official publisher signup: https://adsterra.com/
Publisher setup guide: https://adsterra.com/blog/set-up-publishers-dashboard/
Native banner guide: https://adsterra.com/blog/turn-a-profit-with-native-banners/

## User-experience policy

- Native banners only for the initial rollout.
- No popunders, forced redirects, interstitials, auto-opening tabs, notification prompts, or sticky overlays.
- At most two ad placements on the Command Center view: one after the workspace navigation and one after the opportunity list.
- No ads on sign-in, proposal/approval modals, or inside forms and user workflows.
- Ad slots are omitted entirely unless explicitly enabled and a valid publisher snippet is configured.
- Label all placements as "Sponsored".
- Review advertiser categories and block unsuitable categories in the publisher dashboard.
- Never ask users to click ads, and never incentivize ad clicks or impressions.

## Configuration

1. Register as an Adsterra **Publisher** and verify the email.
2. Add the actual public website domain in the publisher dashboard.
3. Select **Native Banners** only. Do not enable Boost CPM if it allows formats the product intentionally excludes.
4. Create separate Native Banner ad units for the workspace-top and opportunity-feed-bottom placements.
5. Copy each exact publisher embed snippet. Base64-encode the snippet and set these public Vite build variables:
   - `VITE_ADS_ENABLED=true`
   - `VITE_ADSTERRA_NATIVE_BANNER_TOP_CODE_BASE64=<base64 of top native banner snippet>`
   - `VITE_ADSTERRA_NATIVE_BANNER_FEED_CODE_BASE64=<base64 of feed native banner snippet>`
6. Rebuild and deploy the application. These are public ad tags, not API secrets. Do not put publisher account passwords or payment credentials in environment variables.

The snippet runs inside a sandboxed iframe so legacy ad scripts that use document.write do not replace the application document. Validate rendering and click-through behavior in a real browser after adding the approved snippets.

## Revenue expectations

No network can promise "high" income from a low-traffic site. Revenue is driven primarily by qualified human traffic, visitor GEO, viewability, advertiser demand, and the allowed ad formats. Native banners are intentionally chosen over more intrusive formats to protect retention. Measure RPM, fill rate, viewability, bounce rate, and returning-user rate before increasing density.

Adsterra's published payout information varies by payment method and country. Confirm the currently available India payout method and threshold inside the publisher dashboard before relying on a payout forecast.

## Privacy and compliance

Before enabling ads for production:
- Publish an accurate privacy policy that identifies the ad provider and explains third-party cookies/device identifiers and data sharing based on the provider's current documentation.
- Provide any consent-management flow required for visitors' jurisdictions (including EEA/UK/Switzerland where applicable).
- Add the final public privacy-policy URL in the footer and the publisher account.
- Verify that the site has a working public domain and is reachable without authentication before submitting it for approval.
- Do not claim legal compliance until the policy and consent implementation have been reviewed.

## Rollout checklist

- [ ] Public domain deployed and accessible
- [ ] Publisher account and email verified
- [ ] Website approved by Adsterra
- [ ] Two Native Banner units generated
- [ ] Privacy disclosure and required consent flow live
- [ ] Ad tags added to deployment environment
- [ ] Mobile and desktop rendering tested
- [ ] Revenue, RPM, fill rate, and retention reviewed for at least 7 days
