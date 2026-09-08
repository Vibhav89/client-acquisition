import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { DefaultApprovalService } from "./application/approval-service.js";
import { runClientRadar } from "./application/client-radar.js";
import { runPlatformRadar } from "./application/platform-radar.js";
import { saveMasterProfile } from "./application/profile-service.js";
import { defaultCandidateProfile } from "./domain/profile.js";
import { InMemoryPersistence } from "./domain/persistence.js";
import { InMemoryProfilePersistence } from "./domain/profile-persistence.js";
import { createDefaultPublicSources } from "./integrations/public-sources.js";
import { PlaywrightBrowserSession } from "./integrations/browser-session.js";
import { createDefaultPlatformConfigs } from "./integrations/platform-config.js";
import { SupabasePersistence } from "./integrations/supabase-repository.js";
import { SupabaseProfilePersistence } from "./integrations/supabase-profile-repository.js";
import { getSupabaseAuthUser, SupabaseRestClient } from "./integrations/supabase-rest-client.js";
import type { CandidateProfile } from "./domain/opportunity.js";
import type { PersistencePort } from "./domain/persistence.js";
import type { ProfilePersistencePort } from "./domain/profile-persistence.js";
import type { PersonalAgentProfile } from "./domain/master-profile.js";
import { toCandidateProfile } from "./domain/master-profile.js";

const port = Number(process.env.PORT ?? 8787);
const root = fileURLToPath(new URL("../dist", import.meta.url));
const developmentPersistence = new InMemoryPersistence();
const developmentProfilePersistence = new InMemoryProfilePersistence();
const sources = createDefaultPublicSources();
const browserEnabled = process.env.CLIENT_RADAR_BROWSER_ENABLED === "true";
const browserSession = new PlaywrightBrowserSession();
const platformConfigs = createDefaultPlatformConfigs();
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
const hasSupabaseUrl = Boolean(supabaseUrl);
const hasSupabaseKey = Boolean(supabaseAnonKey);
const supabaseConfigured = hasSupabaseUrl && hasSupabaseKey;
const partialSupabaseConfig = hasSupabaseUrl !== hasSupabaseKey;
const productionMode = process.env.NODE_ENV === "production";
const MAX_PROFILE_BODY_BYTES = 1024 * 1024;
if (partialSupabaseConfig || (productionMode && !supabaseConfigured)) {
  throw new Error("Production requires both SUPABASE_URL and SUPABASE_ANON_KEY; partial configuration is not allowed.");
}

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
};

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

function bearerToken(req: IncomingMessage): string | undefined {
  const value = req.headers.authorization;
  if (!value?.startsWith("Bearer ")) return undefined;
  const token = value.slice("Bearer ".length).trim();
  return token || undefined;
}

async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error("Request body too large");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error("Request body too large");
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) throw new Error("Request body is required");
  try { return JSON.parse(text); } catch { throw new Error("Request body must be valid JSON"); }
}

interface RequestContext {
  persistence: PersistencePort;
  profilePersistence: ProfilePersistencePort;
}

async function requestContext(req: IncomingMessage): Promise<RequestContext | undefined> {
  if (!supabaseConfigured) return { persistence: developmentPersistence, profilePersistence: developmentProfilePersistence };
  const token = bearerToken(req);
  if (!token) return undefined;
  const user = await getSupabaseAuthUser(supabaseUrl!, supabaseAnonKey!, token);
  if (!user) return undefined;
  const client = new SupabaseRestClient(supabaseUrl!, supabaseAnonKey!, token);
  return {
    persistence: new SupabasePersistence(client, user.id),
    profilePersistence: new SupabaseProfilePersistence(client, user.id),
  };
}

async function loadProfile(profilePersistence: ProfilePersistencePort): Promise<CandidateProfile> {
  const saved = await profilePersistence.getProfile();
  if (saved) return toCandidateProfile(saved);
  return defaultCandidateProfile;
}

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/health" && req.method === "GET") {
        sendJson(res, 200, { ok: true, service: "client-acquisition", authentication: supabaseConfigured ? "supabase" : "development", browserRadar: browserEnabled });
        return;
      }
      if (url.pathname === "/api/config" && req.method === "GET") {
        sendJson(res, 200, { authentication: supabaseConfigured ? "supabase" : "development", browserRadar: browserEnabled, platforms: platformConfigs.map(({ platform, displayName }) => ({ platform, displayName })) });
        return;
      }

      const context = await requestContext(req);
      if (!context) {
        sendJson(res, 401, { error: "Authentication required" });
        return;
      }

      if (url.pathname === "/api/profile" && req.method === "GET") {
        const profile = await context.profilePersistence.getProfile();
        sendJson(res, 200, { configured: Boolean(profile), profile: profile ?? null });
        return;
      }

      if (url.pathname === "/api/profile" && req.method === "POST") {
        try {
          const body = await readJsonBody(req, MAX_PROFILE_BODY_BYTES);
          if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Profile payload must be a JSON object");
          const profile = await saveMasterProfile(context.profilePersistence, body as PersonalAgentProfile);
          sendJson(res, 200, { configured: true, profile });
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid profile payload" });
        }
        return;
      }

      if (url.pathname === "/api/radar" && req.method === "GET") {
        const profile = await loadProfile(context.profilePersistence);
        const run = await runClientRadar(sources, profile, context.persistence);
        sendJson(res, 200, run);
        return;
      }

      if (url.pathname === "/api/platform-radar" && req.method === "GET") {
        if (!browserEnabled) {
          sendJson(res, 409, { error: "Browser radar is disabled. Set CLIENT_RADAR_BROWSER_ENABLED=true for local use." });
          return;
        }
        const profile = await loadProfile(context.profilePersistence);
        const run = await runPlatformRadar(platformConfigs, browserSession, profile, context.persistence);
        sendJson(res, 200, run);
        return;
      }

      const approvalMatch = url.pathname.match(/^\/api\/approvals\/([^/]+)\/(approve|reject)$/);
      if (approvalMatch && req.method === "POST") {
        const id = decodeURIComponent(approvalMatch[1] ?? "");
        const action = approvalMatch[2];
        const approvalService = new DefaultApprovalService(context.persistence);
        const request = action === "approve" ? await approvalService.approve(id) : await approvalService.reject(id);
        sendJson(res, 200, request);
        return;
      }

      sendJson(res, 404, { error: "API route not found" });
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const requested = url.pathname === "/" ? "/index.html" : url.pathname;
    const normalized = normalize(requested).replace(/^([.][.][\\/])+/, "");
    const safePath = normalized.replace(/^[/\\]+/, "");
    const filePath = join(root, safePath);
    try {
      const data = await readFile(filePath);
      res.writeHead(200, { "content-type": mime[extname(filePath)] ?? "application/octet-stream" });
      res.end(data);
    } catch {
      const data = await readFile(join(root, "index.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(data);
    }
  } catch (error) {
    if (!res.headersSent) sendJson(res, 500, { error: error instanceof Error ? error.message : "Internal server error" });
  }
}

export function createAppServer() {
  return createServer((req, res) => void handleRequest(req, res));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createAppServer().listen(port, () => console.log(`Client Radar running at http://localhost:${port}`));
}
