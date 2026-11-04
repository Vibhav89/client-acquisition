type AdPlacement = "workspace-top" | "opportunity-feed-bottom";

const adCodeByPlacement: Record<AdPlacement, string | undefined> = {
  "workspace-top": import.meta.env.VITE_ADSTERRA_NATIVE_BANNER_TOP_CODE_BASE64,
  "opportunity-feed-bottom": import.meta.env.VITE_ADSTERRA_NATIVE_BANNER_FEED_CODE_BASE64,
};

function decodeAdCode(encoded?: string): string | undefined {
  if (!encoded?.trim()) return undefined;
  try {
    const binary = atob(encoded.trim());
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

/**
 * Third-party publisher code is isolated in a sandboxed iframe.
 * The component stays invisible until ads are explicitly enabled and a
 * publisher-provided Native Banner snippet is configured for this slot.
 */
export function isAdsConfigured(): boolean {
  return import.meta.env.VITE_ADS_ENABLED === "true" && Object.values(adCodeByPlacement).some((code) => Boolean(code?.trim()));
}

export function AdSlot({ placement, consentGranted }: { placement: AdPlacement; consentGranted: boolean }) {
  if (!consentGranted || import.meta.env.VITE_ADS_ENABLED !== "true") return null;
  const code = decodeAdCode(adCodeByPlacement[placement]);
  if (!code) return null;

  const documentHtml = [
    "<!doctype html><html><head><meta charset=\"utf-8\">",
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    "<style>html,body{margin:0;padding:0;width:100%;min-height:250px;overflow:hidden;background:transparent}body{display:flex;justify-content:center;align-items:flex-start}</style>",
    "</head><body>",
    code,
    "</body></html>",
  ].join("");

  return (
    <aside className={`ad-slot ${placement === "opportunity-feed-bottom" ? "ad-slot-feed" : ""}`} aria-label="Sponsored content">
      <span className="ad-slot-label">Sponsored</span>
      <iframe
        title="Sponsored advertisement"
        loading="lazy"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="strict-origin-when-cross-origin"
        srcDoc={documentHtml}
      />
    </aside>
  );
}
