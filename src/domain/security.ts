const dangerousUrlSchemes = /^(javascript:|data:|file:|vbscript:)/i;

export const MAX_REQUEST_BODY_BYTES = 1024 * 1024; // 1MB
export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !dangerousUrlSchemes.test(value.trim());
  } catch {
    return false;
  }
}

export function validateExternalUrl(value: string): string {
  if (!isSafeExternalUrl(value)) {
    throw new Error("Invalid or unsafe external URL");
  }
  return value.trim();
}

export function sanitizeProposalInput(value: string, maxLength = 4000): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

export function sanitizeErrorForClient(error: unknown): string {
  if (error instanceof Error) {
    // Redact database connection strings, tokens, and file paths
    const msg = error.message;
    if (msg.includes("SUPABASE_ANON_KEY") || msg.includes("postgres://") || msg.includes("Bearer ")) {
      return "An internal system error occurred";
    }
    return msg;
  }
  return "An unexpected error occurred";
}

export function assertUserOwnership(resourceUserId: string, authenticatedUserId: string): void {
  if (!resourceUserId || !authenticatedUserId || resourceUserId !== authenticatedUserId) {
    throw new Error("Access denied: You do not own this resource");
  }
}

export function sanitizeProfilePayload<T extends Record<string, any>>(payload: T): T {
  const sanitized = { ...payload };
  delete sanitized.password;
  delete sanitized.apiKey;
  delete sanitized.secretKey;
  delete sanitized.token;
  delete sanitized.accessToken;
  return sanitized;
}
