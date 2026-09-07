const TOKEN_KEY = "client-acquisition.access-token";

export interface AuthConfig {
  authentication: "development" | "supabase";
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const response = await fetch("/api/config", { cache: "no-store" });
  if (!response.ok) throw new Error(`Configuration request failed (${response.status})`);
  return await response.json() as AuthConfig;
}

export function getAccessToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function clearAccessToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* unavailable storage */ }
}

export async function signInWithPassword(config: AuthConfig, email: string, password: string): Promise<void> {
  if (config.authentication !== "supabase" || !config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Supabase authentication is not configured");
  }
  const response = await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: config.supabaseAnonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Sign-in failed (${response.status})`);
  }
  const value = await response.json() as { access_token?: unknown };
  if (typeof value.access_token !== "string" || !value.access_token) throw new Error("Supabase did not return an access token");
  localStorage.setItem(TOKEN_KEY, value.access_token);
}

export function authHeaders(): HeadersInit {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
