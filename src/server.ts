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
import { buildCommandCenterSnapshot } from "./application/command-center.js";
import { transitionApplication } from "./domain/application-tracking.js";
import { transitionDealApproval } from "./domain/deal.js";
import { prepareConversationDecision } from "./domain/conversation.js";
import { summarizeLearning } from "./domain/learning.js";
import { createHistoryEvent } from "./domain/event-history.js";
import { DocumentService } from "./application/document-service.js";

const port = Number(process.env.PORT ?? 8787); const root = fileURLToPath(new URL("../dist", import.meta.url)); const developmentPersistence = new InMemoryPersistence(); const developmentProfilePersistence = new InMemoryProfilePersistence(); const sources = createDefaultPublicSources(); const browserEnabled = process.env.CLIENT_RADAR_BROWSER_ENABLED === "true"; const browserSession = new PlaywrightBrowserSession(); const platformConfigs = createDefaultPlatformConfigs(); const supabaseUrl = process.env.SUPABASE_URL?.trim(); const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim(); const hasSupabaseUrl = Boolean(supabaseUrl); const hasSupabaseKey = Boolean(supabaseAnonKey); const supabaseConfigured = hasSupabaseUrl && hasSupabaseKey; const partialSupabaseConfig = hasSupabaseUrl !== hasSupabaseKey; const productionMode = process.env.NODE_ENV === "production"; const MAX_PROFILE_BODY_BYTES = 1024 * 1024;
if (partialSupabaseConfig || (productionMode && !supabaseConfigured)) throw new Error("Production requires both SUPABASE_URL and SUPABASE_ANON_KEY; partial configuration is not allowed.");
const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
function sendJson(res: ServerResponse, status: number, value: unknown): void { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(value)); }
function bearerToken(req: IncomingMessage): string | undefined { const value = req.headers.authorization; if (!value?.startsWith("Bearer ")) return undefined; const token = value.slice("Bearer ".length).trim(); return token || undefined; }
async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> { const declaredLength = Number(req.headers["content-length"] ?? 0); if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error("Request body too large"); const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += buffer.length; if (size > maxBytes) throw new Error("Request body too large"); chunks.push(buffer); } const text = Buffer.concat(chunks).toString("utf8"); if (!text.trim()) throw new Error("Request body is required"); try { return JSON.parse(text); } catch { throw new Error("Request body must be valid JSON"); } }
interface RequestContext { persistence: PersistencePort; profilePersistence: ProfilePersistencePort; }
async function requestContext(req: IncomingMessage): Promise<RequestContext | undefined> { if (!supabaseConfigured) return { persistence: developmentPersistence, profilePersistence: developmentProfilePersistence }; const token = bearerToken(req); if (!token) return undefined; const user = await getSupabaseAuthUser(supabaseUrl!, supabaseAnonKey!, token); if (!user) return undefined; const client = new SupabaseRestClient(supabaseUrl!, supabaseAnonKey!, token); return { persistence: new SupabasePersistence(client, user.id), profilePersistence: new SupabaseProfilePersistence(client, user.id) }; }
async function loadProfile(profilePersistence: ProfilePersistencePort): Promise<CandidateProfile | PersonalAgentProfile> { const saved = await profilePersistence.getProfile(); if (saved) return saved; return defaultCandidateProfile; }
async function loadCandidateProfile(profilePersistence: ProfilePersistencePort): Promise<CandidateProfile> { const profile = await loadProfile(profilePersistence); return "negotiation" in profile ? toCandidateProfile(profile) : profile; }

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> { try { const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`); if (url.pathname.startsWith("/api/")) { if (url.pathname === "/api/health" && req.method === "GET") { sendJson(res, 200, { ok: true, service: "client-acquisition", authentication: supabaseConfigured ? "supabase" : "development", browserRadar: browserEnabled }); return; } if (url.pathname === "/api/config" && req.method === "GET") { sendJson(res, 200, { authentication: supabaseConfigured ? "supabase" : "development", browserRadar: browserEnabled, platforms: platformConfigs.map(({ platform, displayName }) => ({ platform, displayName })) }); return; } const context = await requestContext(req); if (!context) { sendJson(res, 401, { error: "Authentication required" }); return; }

if (url.pathname === "/api/documents" && req.method === "GET") { const docs = context.persistence.listDocuments ? await context.persistence.listDocuments() : []; sendJson(res, 200, { documents: docs }); return; }
if (url.pathname === "/api/documents" && req.method === "POST") { try { const body = (await readJsonBody(req, MAX_PROFILE_BODY_BYTES)) as any; const docService = new DocumentService(context.persistence); const userId = (context.persistence as any).userId ?? "dev-user"; const doc = await docService.uploadDocument(userId, body); sendJson(res, 200, { document: doc }); } catch (error) { sendJson(res, 400, { error: error instanceof Error ? error.message : "Document upload failed" }); } return; }
if (url.pathname === "/api/profile" && req.method === "GET") { const profile = await context.profilePersistence.getProfile(); sendJson(res, 200, { configured: Boolean(profile), profile: profile ?? null }); return; }
if (url.pathname === "/api/profile" && req.method === "POST") { try { const body = await readJsonBody(req, MAX_PROFILE_BODY_BYTES); if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Profile payload must be a JSON object"); const profile = await saveMasterProfile(context.profilePersistence, body as PersonalAgentProfile); sendJson(res, 200, { configured: true, profile }); } catch (error) { sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid profile payload" }); } return; }
if (url.pathname === "/api/radar" && req.method === "GET") { const profile = await loadProfile(context.profilePersistence); const run = await runClientRadar(sources, profile, context.persistence); sendJson(res, 200, run); return; }
if (url.pathname === "/api/platform-radar" && req.method === "GET") { if (!browserEnabled) { sendJson(res, 409, { error: "Browser radar is disabled. Set CLIENT_RADAR_BROWSER_ENABLED=true for local use." }); return; } const profile = await loadCandidateProfile(context.profilePersistence); const run = await runPlatformRadar(platformConfigs, browserSession, profile, context.persistence); sendJson(res, 200, run); return; }
if (url.pathname === "/api/command-center" && req.method === "GET") {
  const profile = await loadProfile(context.profilePersistence);
  const opportunities = await context.persistence.listOpportunities();
  const approvals = await context.persistence.listPendingApprovals();
  const clients = context.persistence.listClients ? await context.persistence.listClients() : [];
  const applications = context.persistence.listApplications ? await context.persistence.listApplications() : [];
  const deals = context.persistence.listDeals ? await context.persistence.listDeals() : [];
  const earningsList = context.persistence.listEarnings ? await context.persistence.listEarnings() : [];

  const rankedOpportunities = opportunities.map((opp) => ({
    opportunity: opp,
    analysis: {
      match: { opportunityId: opp.id, score: 80, matchedSkills: opp.skills, missingSkills: [], evidenceScore: 20, budgetScore: 20, fitReasons: [] },
      risk: { level: "low" as const, score: 0, signals: [] },
      recommendation: "apply" as const,
    },
    rankScore: 80,
  }));

  const commandCenter = buildCommandCenterSnapshot({
    clients,
    opportunities: rankedOpportunities,
    approvals,
    now: new Date().toISOString(),
  });

  const byCurrency: Record<string, number> = {};
  for (const item of earningsList) byCurrency[item.currency] = (byCurrency[item.currency] ?? 0) + item.amount;
  const earningsSummary = { totalReceived: Object.values(byCurrency).reduce((a, b) => a + b, 0), byCurrency, payments: earningsList.length };

  sendJson(res, 200, {
    ...commandCenter,
    applications,
    deals,
    earnings: earningsSummary,
    profileConfigured: "negotiation" in profile,
  });
  return;
}

if (url.pathname === "/api/approvals" && req.method === "GET") {
  const approvals = await context.persistence.listPendingApprovals();
  sendJson(res, 200, approvals);
  return;
}

if (url.pathname === "/api/clients" && req.method === "GET") {
  const clients = context.persistence.listClients ? await context.persistence.listClients() : [];
  sendJson(res, 200, clients);
  return;
}

const clientDetailMatch = url.pathname.match(/^\/api\/clients\/([^/]+)$/);
if (clientDetailMatch && req.method === "GET") {
  const clientId = decodeURIComponent(clientDetailMatch[1] ?? "");
  const client = context.persistence.getClient ? await context.persistence.getClient(clientId) : undefined;
  if (!client) { sendJson(res, 404, { error: "Client not found" }); return; }
  sendJson(res, 200, client);
  return;
}

if (url.pathname === "/api/clients" && req.method === "POST") {
  try {
    const body = await readJsonBody(req, MAX_PROFILE_BODY_BYTES) as any;
    if (!body || typeof body !== "object" || !body.id) throw new Error("Client payload must include id");
    if (context.persistence.saveClient) await context.persistence.saveClient(body);
    sendJson(res, 200, body);
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid client payload" });
  }
  return;
}

if (url.pathname === "/api/conversations" && req.method === "GET") {
  const clientId = url.searchParams.get("clientId");
  if (!clientId) { sendJson(res, 400, { error: "clientId search parameter is required" }); return; }
  const messages = context.persistence.listMessages ? await context.persistence.listMessages(clientId) : [];
  sendJson(res, 200, messages);
  return;
}

if (url.pathname === "/api/conversations" && req.method === "POST") {
  try {
    const body = await readJsonBody(req, MAX_PROFILE_BODY_BYTES) as any;
    if (!body || typeof body !== "object" || !body.clientId || !body.body) throw new Error("Message payload must include clientId and body");
    const now = new Date().toISOString();
    const message = {
      id: body.id ?? `message:${body.clientId}:${now}`,
      clientId: body.clientId,
      direction: body.direction ?? "inbound",
      body: body.body,
      timestamp: body.timestamp ?? now,
      channel: body.channel,
    };
    if (context.persistence.saveMessage) await context.persistence.saveMessage(message);

    const client = context.persistence.getClient ? await context.persistence.getClient(body.clientId) : undefined;
    const profile = await loadProfile(context.profilePersistence);
    let decision = undefined;
    if (client && "negotiation" in profile && client.opportunityIds.length > 0) {
      const opportunity = await context.persistence.getOpportunity(client.opportunityIds[0]!);
      if (opportunity) {
        decision = prepareConversationDecision(message, client, opportunity, profile);
      }
    }

    sendJson(res, 200, { message, decision, requiresUserApproval: true });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid message payload" });
  }
  return;
}

if (url.pathname === "/api/conversations/assess" && req.method === "POST") {
  try {
    const body = await readJsonBody(req, MAX_PROFILE_BODY_BYTES) as any;
    if (!body || typeof body !== "object" || !body.clientId || !body.messageText) {
      throw new Error("Assessment payload must include clientId and messageText");
    }
    const client = context.persistence.getClient ? await context.persistence.getClient(body.clientId) : undefined;
    if (!client) { sendJson(res, 404, { error: "Client not found" }); return; }
    const profile = await loadProfile(context.profilePersistence);
    const opportunity = client.opportunityIds.length > 0 ? await context.persistence.getOpportunity(client.opportunityIds[0]!) : undefined;
    const dummyMessage = { id: `assess:${body.clientId}`, clientId: body.clientId, direction: "inbound" as const, body: body.messageText, timestamp: new Date().toISOString() };
    const decision = "negotiation" in profile && opportunity ? prepareConversationDecision(dummyMessage, client, opportunity, profile) : undefined;
    sendJson(res, 200, { clientId: body.clientId, decision, requiresUserApproval: true });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid conversation assessment payload" });
  }
  return;
}

if (url.pathname === "/api/deals" && req.method === "GET") {
  const deals = context.persistence.listDeals ? await context.persistence.listDeals() : [];
  sendJson(res, 200, deals);
  return;
}

if (url.pathname === "/api/deals" && req.method === "POST") {
  try {
    const body = await readJsonBody(req, MAX_PROFILE_BODY_BYTES) as any;
    if (!body || typeof body !== "object" || !body.clientId || !body.terms) throw new Error("Deal payload must include clientId and terms");
    const now = new Date().toISOString();
    const deal = {
      id: body.id ?? `deal:${body.clientId}:${now}`,
      clientId: body.clientId,
      state: "pending_final_approval" as const,
      terms: body.terms,
      rationale: body.rationale ?? ["Deal terms prepared for user final approval."],
      createdAt: body.createdAt ?? now,
    };
    if (context.persistence.saveDeal) await context.persistence.saveDeal(deal);
    sendJson(res, 200, deal);
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid deal payload" });
  }
  return;
}

const dealTransitionMatch = url.pathname.match(/^\/api\/deals\/([^/]+)\/(approve|reject|win|lose)$/);
if (dealTransitionMatch && req.method === "POST") {
  const id = decodeURIComponent(dealTransitionMatch[1] ?? "");
  const action = dealTransitionMatch[2];
  const deal = context.persistence.getDeal ? await context.persistence.getDeal(id) : undefined;
  if (!deal) { sendJson(res, 404, { error: "Deal not found" }); return; }
  const nextState = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "win" ? "won" : "lost";
  const updated = transitionDealApproval(deal, nextState);
  if (context.persistence.saveDeal) await context.persistence.saveDeal(updated);
  sendJson(res, 200, updated);
  return;
}

if (url.pathname === "/api/applications" && req.method === "GET") {
  const applications = context.persistence.listApplications ? await context.persistence.listApplications() : [];
  sendJson(res, 200, applications);
  return;
}

if (url.pathname === "/api/applications" && req.method === "POST") {
  try {
    const body = await readJsonBody(req, MAX_PROFILE_BODY_BYTES) as any;
    if (!body || typeof body !== "object" || !body.opportunityId) throw new Error("Application payload must include opportunityId");
    const now = new Date().toISOString();
    const opportunity = await context.persistence.getOpportunity(body.opportunityId);
    const application = {
      id: body.id ?? `application:${body.opportunityId}`,
      clientId: body.clientId,
      opportunityId: body.opportunityId,
      source: body.source ?? opportunity?.source ?? "unknown",
      sourceUrl: body.sourceUrl ?? opportunity?.sourceUrl ?? "https://example.com",
      status: "draft" as const,
      notes: body.notes,
      createdAt: now,
      updatedAt: now,
    };
    if (context.persistence.saveApplication) await context.persistence.saveApplication(application);
    sendJson(res, 200, application);
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid application payload" });
  }
  return;
}

const appTransitionMatch = url.pathname.match(/^\/api\/applications\/([^/]+)\/(approve|apply|interview|win|lose)$/);
if (appTransitionMatch && req.method === "POST") {
  const id = decodeURIComponent(appTransitionMatch[1] ?? "");
  const action = appTransitionMatch[2];
  const app = context.persistence.getApplication ? await context.persistence.getApplication(id) : undefined;
  if (!app) { sendJson(res, 404, { error: "Application not found" }); return; }
  const nextStatus = action === "approve" ? "approved" : action === "apply" ? "applied" : action === "interview" ? "interview" : action === "win" ? "won" : "lost";
  const updated = transitionApplication(app, nextStatus);
  if (context.persistence.saveApplication) await context.persistence.saveApplication(updated);
  sendJson(res, 200, updated);
  return;
}

if (url.pathname === "/api/earnings" && req.method === "GET") {
  const earningsList = context.persistence.listEarnings ? await context.persistence.listEarnings() : [];
  const byCurrency: Record<string, number> = {};
  for (const item of earningsList) byCurrency[item.currency] = (byCurrency[item.currency] ?? 0) + item.amount;
  sendJson(res, 200, {
    totalReceived: Object.values(byCurrency).reduce((a, b) => a + b, 0),
    byCurrency,
    payments: earningsList.length,
    records: earningsList,
  });
  return;
}

if (url.pathname === "/api/earnings" && req.method === "POST") {
  try {
    const body = await readJsonBody(req, MAX_PROFILE_BODY_BYTES) as any;
    if (!body || typeof body !== "object" || !body.projectTitle || typeof body.amount !== "number" || body.amount <= 0) {
      throw new Error("Earnings amount must be greater than zero and include projectTitle");
    }
    const now = new Date().toISOString();
    const record = {
      id: body.id ?? `earnings:${now}:${Math.random().toString(36).slice(2, 7)}`,
      clientId: body.clientId,
      applicationId: body.applicationId,
      projectTitle: body.projectTitle,
      amount: body.amount,
      currency: (body.currency ?? "USD").toUpperCase(),
      receivedAt: body.receivedAt ?? now,
      notes: body.notes,
    };
    if (context.persistence.saveEarnings) await context.persistence.saveEarnings(record);
    sendJson(res, 200, record);
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid earnings payload" });
  }
  return;
}

if (url.pathname === "/api/history" && req.method === "GET") {
  const type = url.searchParams.get("type") ?? undefined;
  const entityType = url.searchParams.get("entityType") ?? undefined;
  const entityId = url.searchParams.get("entityId") ?? undefined;
  const events = context.persistence.listHistoryEvents ? await context.persistence.listHistoryEvents({ type, entityType, entityId }) : [];
  sendJson(res, 200, events);
  return;
}

if (url.pathname === "/api/history" && req.method === "POST") {
  try {
    const body = await readJsonBody(req, MAX_PROFILE_BODY_BYTES) as any;
    if (!body || typeof body !== "object" || !body.type || !body.entityType || !body.entityId || !body.summary) {
      throw new Error("History event must include type, entityType, entityId, and summary");
    }
    const now = new Date().toISOString();
    const event = createHistoryEvent({
      id: body.id,
      type: body.type,
      timestamp: body.timestamp ?? now,
      entityType: body.entityType,
      entityId: body.entityId,
      source: body.source,
      summary: body.summary,
      metadata: body.metadata,
      requiresUserApproval: body.requiresUserApproval ?? false,
    });
    if (context.persistence.saveHistoryEvent) await context.persistence.saveHistoryEvent(event);
    sendJson(res, 200, event);
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid history payload" });
  }
  return;
}

if (url.pathname === "/api/learning" && req.method === "GET") {
  const source = url.searchParams.get("source") ?? undefined;
  const events = context.persistence.listLearningEvents ? await context.persistence.listLearningEvents() : [];
  const summary = summarizeLearning(events, source);
  sendJson(res, 200, { summary, events });
  return;
}

if (url.pathname === "/api/learning" && req.method === "POST") {
  try {
    const body = await readJsonBody(req, MAX_PROFILE_BODY_BYTES) as any;
    if (!body || typeof body !== "object" || !body.outcome || !["won", "lost", "rejected", "ignored"].includes(body.outcome)) {
      throw new Error("Learning event payload must include valid outcome (won, lost, rejected, ignored)");
    }
    const now = new Date().toISOString();
    const event = {
      id: body.id ?? `learning:${now}:${Math.random().toString(36).slice(2, 7)}`,
      clientId: body.clientId,
      opportunityId: body.opportunityId,
      source: body.source,
      outcome: body.outcome,
      stage: body.stage,
      reason: body.reason,
      matchScore: body.matchScore,
      riskScore: body.riskScore,
      createdAt: body.createdAt ?? now,
    };
    if (context.persistence.saveLearningEvent) await context.persistence.saveLearningEvent(event);
    sendJson(res, 200, event);
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : "Invalid learning payload" });
  }
  return;
}

const approvalMatch = url.pathname.match(/^\/api\/approvals\/([^/]+)\/(approve|reject)$/); if (approvalMatch && req.method === "POST") { const id = decodeURIComponent(approvalMatch[1] ?? ""); const action = approvalMatch[2]; const approvalService = new DefaultApprovalService(context.persistence); const request = action === "approve" ? await approvalService.approve(id) : await approvalService.reject(id); sendJson(res, 200, request); return; }
sendJson(res, 404, { error: "API route not found" }); return; }
if (req.method !== "GET") { sendJson(res, 405, { error: "Method not allowed" }); return; } const requested = url.pathname === "/" ? "/index.html" : url.pathname; const normalized = normalize(requested).replace(/^([.][.][\\/])+/, ""); const safePath = normalized.replace(/^[/\\]+/, ""); const filePath = join(root, safePath); try { const data = await readFile(filePath); res.writeHead(200, { "content-type": mime[extname(filePath)] ?? "application/octet-stream" }); res.end(data); } catch { try { const data = await readFile(join(root, "index.html")); res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(data); } catch { const fallbackPath = fileURLToPath(new URL("../index.html", import.meta.url)); try { const data = await readFile(fallbackPath); res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(data); } catch { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end("<!DOCTYPE html><html><body>Client Acquisition Agent</body></html>"); } } } } catch (error) {
  if (!res.headersSent) sendJson(res, 500, { error: "Internal server error" });
} }
export function createAppServer() { return createServer((req, res) => void handleRequest(req, res)); }
if (process.argv[1] === fileURLToPath(import.meta.url)) createAppServer().listen(port, () => console.log(`Client Radar running at http://localhost:${port}`));
