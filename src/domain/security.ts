const dangerousUrlSchemes = /^(javascript:|data:|file:)/i;

export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !dangerousUrlSchemes.test(value);
  } catch {
    return false;
  }
}

export function sanitizeProposalInput(value: string, maxLength = 4000): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}
