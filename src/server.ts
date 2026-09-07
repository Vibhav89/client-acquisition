import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { DefaultApprovalService } from "./application/approval-service.js";
import { runClientRadar } from "./application/client-radar.js";
import { defaultCandidateProfile } from "./domain/profile.js";
import { InMemoryPersistence } from "./domain/persistence.js";
import { createDefaultPublicSources } from "./integrations/public-sources.js";

const port = Number(process.env.PORT ?? 8787);
const root = fileURLToPath(new URL("../dist", import.meta.url));
const persistence = new InMemoryPersistence();
const sources = createDefaultPublicSources();
const approvalService = new DefaultApprovalService(persistence);

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
};

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/health" && req.method === "GET") {
        sendJson(res, 200, { ok: true, service: "client-acquisition" });
        return;
      }

      if (url.pathname === "/api/radar" && req.method === "GET") {
        const run = await runClientRadar(sources, defaultCandidateProfile, persistence);
        sendJson(res, 200, run);
        return;
      }

      const approvalMatch = url.pathname.match(/^\/api\/approvals\/([^/]+)\/(approve|reject)$/);
      if (approvalMatch && req.method === "POST") {
        const id = decodeURIComponent(approvalMatch[1] ?? "");
        const action = approvalMatch[2];
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
