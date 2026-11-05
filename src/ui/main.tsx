import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import { authHeaders, clearAccessToken, getAccessToken, getAuthConfig, signInWithPassword, type AuthConfig } from "./auth.js";
import "./styles.css";
import { AdSlot, isAdsConfigured } from "./ads.js";

type Opportunity = {
  id: string;
  source: string;
  sourceUrl: string;
  title: string;
  description: string;
  skills: string[];
  workMode: string;
  location: string;
  budget?: { currency: string; unit: string; min?: number; max?: number };
  analysis?: {
    match: { score: number; matchedSkills: string[]; fitReasons: string[] };
    risk: { level: "low" | "medium" | "high" };
    recommendation: "apply" | "review" | "skip";
  };
};

type Approval = { id: string; opportunityId: string; proposal: string; state: string };
type Session = { platform: string; loggedIn: boolean; checkedAt: string };
type ApiData = {
  dashboard: { summary: { discovered: number; qualified: number; review: number; skipped: number } };
  opportunities: Opportunity[];
  approvals: Approval[];
  sessions?: Session[];
};

type Profile = {
  id: string;
  displayName: string;
  headline: string;
  bio: string;
  location?: string;
  timezone?: string;
  industries?: string[];
  languages?: string[];
  availabilityHoursPerWeek?: number;
  skills: string[];
  evidence: { skill: string; evidence: string; strength: number }[];
  preferredWorkModes: string[];
  portfolio: { title: string; url?: string; description: string; skills: string[] }[];
  services: { name: string; description: string; minimumUsd?: number; deliveryDays?: number }[];
  platformAccounts: { platform: string; profileUrl?: string; username?: string; enabled: boolean }[];
  communicationStyle: "concise" | "professional" | "friendly" | "technical";
  negotiation: {
    minimumHourlyUsd?: number;
    minimumFixedUsd?: number;
    preferredHourlyUsd?: number;
    preferredFixedUsd?: number;
    maxDiscountPercent: number;
    requireScopeConfirmation: boolean;
    requireFinalApproval: boolean;
  };
  redFlags: string[];
  lastUpdatedAt: string;
};

type DocumentItem = {
  id: string;
  title: string;
  documentType: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  skills: string[];
  status: string;
  createdAt: string;
};

const emptyProfile = (): Profile => ({
  id: crypto.randomUUID(),
  displayName: "",
  headline: "",
  bio: "",
  skills: [],
  evidence: [],
  preferredWorkModes: ["remote"],
  portfolio: [],
  services: [],
  platformAccounts: [],
  communicationStyle: "professional",
  negotiation: {
    minimumHourlyUsd: 30,
    minimumFixedUsd: 150,
    preferredHourlyUsd: 60,
    preferredFixedUsd: 500,
    maxDiscountPercent: 10,
    requireScopeConfirmation: true,
    requireFinalApproval: true,
  },
  redFlags: ["registration fee", "crypto payment", "gift card"],
  lastUpdatedAt: new Date().toISOString(),
});

function budgetLabel(budget?: Opportunity["budget"]): string {
  if (!budget) return "Budget not listed";
  const currency = budget.currency.toUpperCase();
  const min = budget.min ?? budget.max;
  const max = budget.max ?? budget.min;
  if (budget.unit === "hourly") return `${currency} ${min ?? "?"}${max && max !== min ? `–${max}` : ""}/hr`;
  return `${currency} ${min ?? "?"}${max && max !== min ? `–${max}` : ""} fixed`;
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong className={accent ? "accent" : ""}>{value}</strong>
    </div>
  );
}

function ProfilePanel({ profile, onSaved }: { profile: Profile | null; onSaved: (profile: Profile) => void }) {
  const [form, setForm] = useState<Profile>(profile ?? emptyProfile());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const set = (key: keyof Profile, value: unknown) => setForm((current) => ({ ...current, [key]: value }));
  const setNegotiation = (key: keyof Profile["negotiation"], value: unknown) =>
    setForm((current) => ({ ...current, negotiation: { ...current.negotiation, [key]: value } }));

  async function save(): Promise<void> {
    setSaving(true);
    setMessage(null);
    try {
      const evidence = form.skills.map(
        (skill) => form.evidence.find((item) => item.skill === skill) ?? { skill, evidence: "", strength: 1 }
      );
      const payload = { ...form, evidence, lastUpdatedAt: new Date().toISOString() };
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { ...authHeaders(), "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Profile save failed (${response.status})`);
      }
      const body = (await response.json()) as { profile: Profile };
      onSaved(body.profile);
      setMessage("Profile saved. Radar matching and proposals now use it.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unable to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel profile-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">PROFESSIONAL IDENTITY</p>
          <h2>Master Profile & Positioning Settings</h2>
          <p className="muted">Configure your real skills, positioning, and price floor once. Never add passwords or secret keys here.</p>
        </div>
        <button className="approve" onClick={() => void save()} disabled={saving || !form.displayName.trim() || !form.headline.trim() || !form.bio.trim()}>
          {saving ? "Saving…" : "Save Master Profile"}
        </button>
      </div>
      <div className="profile-grid">
        <label>Display Name<input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} /></label>
        <label>Headline<input value={form.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Senior TypeScript / React / AI Software Engineer" /></label>
        <label>Location<input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="India (Remote)" /></label>
        <label>Timezone<input value={form.timezone ?? ""} onChange={(e) => set("timezone", e.target.value)} placeholder="UTC+05:30" /></label>
        <label className="wide">Bio & Positioning<textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={3} /></label>
        <label className="wide">Skills<input value={form.skills.join(", ")} onChange={(e) => set("skills", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} placeholder="TypeScript, React, Node.js, Python, Supabase, AI" /></label>
        <label>Minimum Hourly USD<input type="number" min="0" value={form.negotiation.minimumHourlyUsd ?? ""} onChange={(e) => setNegotiation("minimumHourlyUsd", Number(e.target.value))} /></label>
        <label>Preferred Hourly USD<input type="number" min="0" value={form.negotiation.preferredHourlyUsd ?? ""} onChange={(e) => setNegotiation("preferredHourlyUsd", Number(e.target.value))} /></label>
        <label>Minimum Fixed USD<input type="number" min="0" value={form.negotiation.minimumFixedUsd ?? ""} onChange={(e) => setNegotiation("minimumFixedUsd", Number(e.target.value))} /></label>
        <label>Preferred Fixed USD<input type="number" min="0" value={form.negotiation.preferredFixedUsd ?? ""} onChange={(e) => setNegotiation("preferredFixedUsd", Number(e.target.value))} /></label>
        <label>Max Discount %<input type="number" min="0" max="100" value={form.negotiation.maxDiscountPercent} onChange={(e) => setNegotiation("maxDiscountPercent", Number(e.target.value))} /></label>
        <label>Communication Style<select value={form.communicationStyle} onChange={(e) => set("communicationStyle", e.target.value)}><option value="professional">Professional</option><option value="concise">Concise</option><option value="friendly">Friendly</option><option value="technical">Technical</option></select></label>
      </div>
      <div className="profile-options">
        <label><input type="checkbox" checked={form.negotiation.requireScopeConfirmation} onChange={(e) => setNegotiation("requireScopeConfirmation", e.target.checked)} /> Require scope confirmation</label>
        <label><input type="checkbox" checked={form.negotiation.requireFinalApproval} onChange={(e) => setNegotiation("requireFinalApproval", e.target.checked)} /> Require final deal approval</label>
      </div>
      {message && <div className={message.startsWith("Profile saved") ? "success" : "error"}>{message}</div>}
    </section>
  );
}

function DocumentVaultPanel() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("developer");
  const [contentText, setContentText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadVault(): Promise<void> {
    try {
      const res = await fetch("/api/documents", { headers: authHeaders() });
      if (res.ok) {
        const body = (await res.json()) as { documents: DocumentItem[] };
        setDocuments(body.documents ?? []);
      }
    } catch {
      // document vault endpoint fallback
    }
  }

  useEffect(() => {
    void loadVault();
  }, []);

  async function upload(): Promise<void> {
    if (!contentText.trim()) return;
    setUploading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { ...authHeaders(), "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || `${docType.toUpperCase()} Resume`,
          documentType: docType,
          fileName: `${docType}_resume.txt`,
          fileType: "txt",
          contentText: contentText.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to upload document");
      setMessage("Resume added to vault. Agent will select optimal document per job brief.");
      setTitle("");
      setContentText("");
      await loadVault();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="panel profile-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">MULTI-RESUME VAULT</p>
          <h2>Professional Documents & CV Vault</h2>
          <p className="muted">Upload your targeted resumes (Developer, AI, Research). The agent matches the best resume per job brief.</p>
        </div>
      </div>
      <div className="profile-grid">
        <label>Document Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Full-Stack Developer Resume 2026" /></label>
        <label>Document Target Role<select value={docType} onChange={(e) => setDocType(e.target.value)}><option value="developer">Developer CV</option><option value="ai_llm">AI / LLM CV</option><option value="research">Research CV</option><option value="general">General CV</option><option value="portfolio">Portfolio</option></select></label>
        <label className="wide">Resume Plain Text / Markdown Content<textarea value={contentText} onChange={(e) => setContentText(e.target.value)} rows={4} placeholder="Paste resume text or markdown here..." /></label>
      </div>
      <div style={{ padding: "0 22px 18px" }}>
        <button className="approve" onClick={() => void upload()} disabled={uploading || !contentText.trim()}>
          {uploading ? "Uploading…" : "Add Resume to Vault"}
        </button>
      </div>
      {message && <div className={message.includes("added") ? "success" : "error"}>{message}</div>}

      <div style={{ padding: "0 22px 22px" }}>
        <h3>Stored Documents ({documents.length})</h3>
        {documents.length === 0 ? (
          <p className="muted">No resumes uploaded yet. Default master profile skills are being used for matching.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {documents.map((doc) => (
              <div key={doc.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{doc.title}</strong> <small>({doc.documentType})</small>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Skills: {doc.skills.join(", ") || "General"}</div>
                </div>
                <span className="source" style={{ background: "#e2e8f0", padding: "4px 8px", borderRadius: 4 }}>{doc.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}


type CrmClient = { id: string; name?: string; source: string; sourceUrl: string; stage: string; opportunityIds: string[]; summary: string };
type CrmDeal = { id: string; clientId: string; state: string; terms: { scope: string; priceUsd: number; deliveryDays: number } };
type CrmApplication = { id: string; clientId?: string; opportunityId: string; status: string; source: string };
type CrmEarning = { id: string; projectTitle: string; amount: number; currency: string; receivedAt: string };

function ClientWorkflowPanel({ opportunities }: { opportunities: Opportunity[] }) {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [applications, setApplications] = useState<CrmApplication[]>([]);
  const [earnings, setEarnings] = useState<CrmEarning[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [learning, setLearning] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] = useState("");
  const [clientName, setClientName] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [dealScope, setDealScope] = useState("");
  const [dealPrice, setDealPrice] = useState("150");
  const [dealDays, setDealDays] = useState("7");
  const [earningTitle, setEarningTitle] = useState("");
  const [earningAmount, setEarningAmount] = useState("");
  const [earningCurrency, setEarningCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");

  async function request(path: string, init?: RequestInit): Promise<any> {
    const response = await fetch(path, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) { clearAccessToken(); throw new Error("Session expired. Sign in again."); }
    if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
    return body;
  }

  async function load(): Promise<void> {
    const [c, d, a, e, h, l] = await Promise.all([
      request("/api/clients"), request("/api/deals"), request("/api/applications"),
      request("/api/earnings"), request("/api/history"), request("/api/learning")
    ]);
    setClients(c ?? []); setDeals(d ?? []); setApplications(a ?? []);
    setEarnings(e.records ?? []); setHistory(h ?? []); setLearning(l.events ?? []);
    const first = (c ?? [])[0]?.id ?? "";
    setSelectedClient((current) => current && (c ?? []).some((item: CrmClient) => item.id === current) ? current : first);
    if (!selectedOpportunity && opportunities[0]) setSelectedOpportunity(opportunities[0].id);
    if (first) {
      const conversation = await request(`/api/conversations?clientId=${encodeURIComponent(selectedClient || first)}`);
      setMessages(conversation ?? []);
    } else setMessages([]);
  }

  useEffect(() => { void load().catch((e) => setFailure(e instanceof Error ? e.message : "Unable to load client workflows")); }, []);

  async function perform(action: () => Promise<void>, success: string): Promise<void> {
    setBusy(true); setFailure(""); setNotice("");
    try { await action(); await load(); setNotice(success); }
    catch (e) { setFailure(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  }

  const selected = clients.find((client) => client.id === selectedClient);
  const selectedJob = opportunities.find((job) => job.id === selectedOpportunity);

  return <section className="panel profile-panel">
    <div className="panel-head"><div><p className="eyebrow">CLIENT RELATIONSHIP WORKSPACE</p><h2>Client & Revenue Workflows</h2><p className="muted">Track clients, conversations, deal approvals, applications, received payments and learning history. Nothing is sent to an external platform.</p></div><button className="refresh" disabled={busy} onClick={() => void load()}>↻ Refresh records</button></div>
    {notice && <div className="success" role="status">{notice}</div>}{failure && <div className="error" role="alert">{failure}</div>}
    <div className="command-grid">
      <div className="command-card"><h3>Clients</h3><strong>{clients.length}</strong></div>
      <div className="command-card"><h3>Deals</h3><strong>{deals.length}</strong></div>
      <div className="command-card"><h3>Applications</h3><strong>{applications.length}</strong></div>
      <div className="command-card"><h3>Payment records</h3><strong>{earnings.length}</strong></div>
    </div>
    <div className="profile-grid">
      <label>Opportunity for new client
        <select value={selectedOpportunity} onChange={(e) => setSelectedOpportunity(e.target.value)}>
          <option value="">Select opportunity</option>{opportunities.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
        </select>
      </label>
      <label>Client / contact name<input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client or company name" /></label>
    </div>
    <div style={{padding:"0 22px 18px"}}><button className="approve" disabled={busy || !selectedJob || !clientName.trim()} onClick={() => void perform(async () => {
      const now = new Date().toISOString();
      await request("/api/clients", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({
        id: `client:${crypto.randomUUID()}`, opportunityIds:[selectedJob!.id], source:selectedJob!.source, sourceUrl:selectedJob!.sourceUrl,
        name:clientName.trim(), stage:"discovered", fitScore:selectedJob!.analysis?.match.score ?? 0,
        legitimacyScore:50, priorityScore:selectedJob!.analysis?.match.score ?? 0,
        summary:`Client tracked from opportunity: ${selectedJob!.title}`, needs:[], objections:[], approachAngle:"Review opportunity and confirm scope.",
        nextAction:"Review client and decide whether to approach.", createdAt:now, updatedAt:now
      })});
      setClientName("");
    }, "Client added to your private pipeline.")}>Add client to pipeline</button></div>

    <div className="profile-grid">
      <label>Selected client<select value={selectedClient} onChange={async (e) => { const id=e.target.value; setSelectedClient(id); if(id) { try { setMessages(await request(`/api/conversations?clientId=${encodeURIComponent(id)}`)); } catch(err) { setFailure(err instanceof Error ? err.message : "Unable to load messages"); } } else setMessages([]); }}>
        <option value="">Select client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name || c.id} — {c.stage}</option>)}
      </select></label>
      <label>Conversation note / message<textarea rows={3} value={messageBody} onChange={(e) => setMessageBody(e.target.value)} placeholder="Record an inbound message or draft an outbound reply..." /></label>
    </div>
    <div style={{padding:"0 22px 18px",display:"flex",gap:8,flexWrap:"wrap"}}>
      <button disabled={busy || !selectedClient || !messageBody.trim()} onClick={() => void perform(async () => {
        await request("/api/conversations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId:selectedClient,direction:"inbound",body:messageBody.trim(),channel:"manual-note"})});
        setMessageBody("");
      },"Conversation record saved.")}>Save inbound note</button>
      <button disabled={busy || !selectedClient || !messageBody.trim()} onClick={() => void perform(async () => {
        await request("/api/conversations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId:selectedClient,direction:"outbound",body:messageBody.trim(),channel:"draft-only"})});
        setMessageBody("");
      },"Outbound draft saved internally; it was not sent.")}>Save outbound draft</button>
    </div>
    {selected && <div style={{padding:"0 22px 18px"}}><strong>Conversation history — {selected.name || selected.id}</strong>{messages.length ? messages.map((m:any)=><div key={m.id} className="command-card" style={{marginTop:8}}><small>{m.direction} · {m.timestamp}</small><p>{m.body}</p></div>) : <p className="muted">No conversation records yet.</p>}</div>}

    <div className="profile-grid">
      <label>Deal scope<input value={dealScope} onChange={(e)=>setDealScope(e.target.value)} placeholder="Deliverables and acceptance criteria" /></label>
      <label>Deal price (USD)<input type="number" min="0" value={dealPrice} onChange={(e)=>setDealPrice(e.target.value)} /></label>
      <label>Delivery days<input type="number" min="1" value={dealDays} onChange={(e)=>setDealDays(e.target.value)} /></label>
    </div>
    <div style={{padding:"0 22px 18px"}}><button disabled={busy || !selectedClient || !dealScope.trim() || Number(dealPrice)<=0 || Number(dealDays)<=0} onClick={()=>void perform(async()=>{
      await request("/api/deals",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({clientId:selectedClient,terms:{scope:dealScope.trim(),priceUsd:Number(dealPrice),deliveryDays:Number(dealDays),deliverables:[dealScope.trim()],assumptions:[],risks:[]}})});
      setDealScope("");
    },"Deal submitted to your final-approval queue.")}>Create deal for approval</button></div>
    <h3 style={{padding:"0 22px"}}>Deal approval queue</h3>
    <div style={{padding:"0 22px 18px",display:"grid",gap:8}}>{deals.length===0?<p className="muted">No deals recorded.</p>:deals.map((deal)=><div className="command-card" key={deal.id}><strong>{deal.terms.scope}</strong><p>USD {deal.terms.priceUsd} · {deal.terms.deliveryDays} days · {deal.state}</p><div className="filters">{deal.state==="pending_final_approval" && <><button disabled={busy} onClick={()=>void perform(async()=>{await request(`/api/deals/${encodeURIComponent(deal.id)}/approve`,{method:"POST"});},"Deal approved internally.")}>Approve terms</button><button disabled={busy} onClick={()=>void perform(async()=>{await request(`/api/deals/${encodeURIComponent(deal.id)}/reject`,{method:"POST"});},"Deal rejected.")}>Reject</button></>}</div></div>)}</div>

    <div className="profile-grid">
      <label>Application opportunity<select value={selectedOpportunity} onChange={(e)=>setSelectedOpportunity(e.target.value)}><option value="">Select opportunity</option>{opportunities.map((job)=><option key={job.id} value={job.id}>{job.title}</option>)}</select></label>
      <label>Link client (optional)<select value={selectedClient} onChange={(e)=>setSelectedClient(e.target.value)}><option value="">No client link</option>{clients.map((c)=><option key={c.id} value={c.id}>{c.name || c.id}</option>)}</select></label>
    </div>
    <div style={{padding:"0 22px 18px"}}><button disabled={busy || !selectedOpportunity} onClick={()=>void perform(async()=>{
      await request("/api/applications",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({opportunityId:selectedOpportunity,...(selectedClient?{clientId:selectedClient}:{})})});
    },"Draft application created. No external application was submitted.")}>Create draft application</button></div>
    <h3 style={{padding:"0 22px"}}>Applications</h3>
    <div style={{padding:"0 22px 18px",display:"grid",gap:8}}>{applications.length===0?<p className="muted">No applications recorded.</p>:applications.map((app)=><div className="command-card" key={app.id}><strong>{opportunities.find((job)=>job.id===app.opportunityId)?.title || app.opportunityId}</strong><p>{app.source} · {app.status}</p></div>)}</div>

    <div className="profile-grid">
      <label>Payment project title<input value={earningTitle} onChange={(e)=>setEarningTitle(e.target.value)} placeholder="Project / client payment" /></label>
      <label>Amount received<input type="number" min="0.01" step="0.01" value={earningAmount} onChange={(e)=>setEarningAmount(e.target.value)} /></label>
      <label>Currency<select value={earningCurrency} onChange={(e)=>setEarningCurrency(e.target.value)}><option>USD</option><option>INR</option><option>EUR</option><option>GBP</option></select></label>
    </div>
    <div style={{padding:"0 22px 18px"}}><button disabled={busy || !earningTitle.trim() || Number(earningAmount)<=0} onClick={()=>void perform(async()=>{
      await request("/api/earnings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectTitle:earningTitle.trim(),amount:Number(earningAmount),currency:earningCurrency,...(selectedClient?{clientId:selectedClient}:{})})});
      setEarningTitle("");setEarningAmount("");
    },"Payment record saved.")}>Record received payment</button></div>
    <h3 style={{padding:"0 22px"}}>Earnings ledger</h3>
    <div style={{padding:"0 22px 18px",display:"grid",gap:8}}>{earnings.length===0?<p className="muted">No payment records yet.</p>:earnings.map((item)=><div className="command-card" key={item.id}><strong>{item.projectTitle}</strong><p>{item.currency} {item.amount} · {item.receivedAt}</p></div>)}</div>

    <h3 style={{padding:"0 22px"}}>Activity & learning records</h3>
    <div style={{padding:"0 22px 22px"}}><p className="muted">History events: {history.length} · Learning outcomes: {learning.length}</p>
      {[...history.slice(0,8)].map((event:any)=><div key={event.id} className="command-card" style={{marginBottom:8}}><small>{event.type} · {event.timestamp}</small><p>{event.summary}</p></div>)}
    </div>
  </section>;
}

export function SiteLegalFooter({ onAdPreferences }: { onAdPreferences: () => void }) {
  return (
    <footer className="legal-footer">
      <a href="/privacy.html">Privacy Policy</a>
      {isAdsConfigured() && <button type="button" onClick={onAdPreferences}>Ad preferences</button>}
    </footer>
  );
}

function AdConsentNotice({ onChoice }: { onChoice: (choice: "accepted" | "rejected") => void }) {
  if (!isAdsConfigured()) return null;
  return (
    <section className="ad-consent" role="dialog" aria-label="Advertising preferences">
      <div>
        <strong>Advertising preferences</strong>
        <p>We use Adsterra Native Banner ads to support this free service. If you accept, the ad provider may use cookies or similar technologies and receive device and browser information. Read our <a href="/privacy.html">Privacy Policy</a>.</p>
      </div>
      <div className="ad-consent-actions">
        <button type="button" onClick={() => onChoice("rejected")}>Reject optional ads</button>
        <button type="button" className="approve" onClick={() => onChoice("accepted")}>Accept optional ads</button>
      </div>
    </section>
  );
}

function App() {
  const [adConsent, setAdConsent] = useState<"accepted" | "rejected" | null>(() => {
    const saved = window.localStorage.getItem("client-radar-ad-consent");
    return saved === "accepted" || saved === "rejected" ? saved : null;
  });
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileConfigured, setProfileConfigured] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<ApiData | null>(null);
  const [activeTab, setActiveTab] = useState<"command_center" | "vault" | "profile">("command_center");
  const [filter, setFilter] = useState<"all" | "low" | "qualified">("all");
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scanningPlatforms, setScanningPlatforms] = useState(false);
  const [busyApproval, setBusyApproval] = useState(false);
  const [busyAiProposal, setBusyAiProposal] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseAdConsent(choice: "accepted" | "rejected"): void {
    window.localStorage.setItem("client-radar-ad-consent", choice);
    setAdConsent(choice);
  }

  function reopenAdPreferences(): void {
    window.localStorage.removeItem("client-radar-ad-consent");
    setAdConsent(null);
  }

  useEffect(() => {
    void getAuthConfig()
      .then(setConfig)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load configuration"));
  }, []);

  async function loadProfile(): Promise<void> {
    const response = await fetch("/api/profile", { cache: "no-store", headers: authHeaders() });
    if (response.status === 401) {
      clearAccessToken();
      throw new Error("Please sign in to load your profile.");
    }
    if (!response.ok) throw new Error(`Profile request failed (${response.status})`);
    const body = (await response.json()) as { configured: boolean; profile: Profile | null };
    setProfileConfigured(body.configured);
    setProfile(body.profile);
  }

  async function refresh(): Promise<void> {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/radar", { cache: "no-store", headers: authHeaders() });
      if (response.status === 401) {
        clearAccessToken();
        throw new Error("Please sign in to load your radar.");
      }
      if (!response.ok) throw new Error(`Radar request failed (${response.status})`);
      setData((await response.json()) as ApiData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load radar");
    } finally {
      setRefreshing(false);
    }
  }

  async function scanPlatforms(): Promise<void> {
    setScanningPlatforms(true);
    setError(null);
    try {
      const response = await fetch("/api/platform-radar", { cache: "no-store", headers: authHeaders() });
      if (response.status === 401) {
        clearAccessToken();
        throw new Error("Please sign in to scan your platform sessions.");
      }
      if (response.status === 409) throw new Error("Browser radar is disabled. Enable it with CLIENT_RADAR_BROWSER_ENABLED=true.");
      if (!response.ok) throw new Error(`Platform radar failed (${response.status})`);
      setData((await response.json()) as ApiData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to scan platforms");
    } finally {
      setScanningPlatforms(false);
    }
  }

  useEffect(() => {
    if (config?.authentication === "development" || getAccessToken()) {
      void loadProfile().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load profile"));
      void refresh();
    }
  }, [config]);

  async function signIn(): Promise<void> {
    if (!config) return;
    setAuthBusy(true);
    setError(null);
    try {
      await signInWithPassword(config, email.trim(), password);
      setPassword("");
      await loadProfile();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setAuthBusy(false);
    }
  }

  function signOut(): void {
    clearAccessToken();
    setData(null);
    setProfile(null);
    setProfileConfigured(false);
    setError(null);
  }

  const jobs = useMemo(() => {
    const all = data?.opportunities ?? [];
    if (filter === "low") return all.filter((job) => job.analysis?.risk.level === "low");
    if (filter === "qualified") return all.filter((job) => job.analysis?.recommendation === "apply");
    return all;
  }, [data, filter]);

  const summary = data?.dashboard.summary;
  const approvalFor = (job: Opportunity) => data?.approvals.find((approval) => approval.opportunityId === job.id && approval.state === "pending");
  const connectedPlatforms = data?.sessions?.filter((session) => session.loggedIn).map((session) => session.platform) ?? [];

  async function decide(job: Opportunity, action: "approve" | "reject"): Promise<void> {
    const approval = approvalFor(job);
    if (!approval) return;
    setBusyApproval(true);
    setError(null);
    try {
      const response = await fetch(`/api/approvals/${encodeURIComponent(approval.id)}/${action}`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (response.status === 401) {
        signOut();
        throw new Error("Your session expired. Please sign in again.");
      }
      if (!response.ok) throw new Error(`Approval request failed (${response.status})`);
      setSelected(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save approval");
    } finally {
      setBusyApproval(false);
    }
  }

  async function generateAiDraft(job: Opportunity): Promise<void> {
    if (!approvalFor(job)) return;
    setBusyAiProposal(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai/proposals/${encodeURIComponent(job.id)}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const body = await response.json() as { error?: string };
      if (response.status === 401) {
        signOut();
        throw new Error("Your session expired. Please sign in again.");
      }
      if (!response.ok) throw new Error(body.error ?? `AI proposal failed (${response.status})`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to generate AI proposal");
    } finally {
      setBusyAiProposal(false);
    }
  }

  if (!config) {
    return (
      <div className="app-shell">
        <main>
          {error ? <div className="error" style={{ margin: "2rem auto", maxWidth: 600 }}>{error}</div> : <div className="empty">Loading configuration…</div>}
        </main>
        <SiteLegalFooter onAdPreferences={reopenAdPreferences} />
        {adConsent === null && <AdConsentNotice onChoice={chooseAdConsent} />}
      </div>
    );
  }

  if (config.authentication === "supabase" && !getAccessToken()) {
    return (
      <div className="app-shell">
        <main>
          <section className="panel auth-panel">
            <p className="eyebrow">CLIENT RADAR</p>
            <h1>Sign in</h1>
            <p className="muted">Sign in to keep your opportunities, profile, and approvals isolated to your account.</p>
            {error && <div className="error">{error}</div>}
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
            <button className="approve auth-submit" onClick={() => void signIn()} disabled={authBusy || !email || !password}>
              {authBusy ? "Signing in…" : "Sign in"}
            </button>
          </section>
        </main>
        <SiteLegalFooter onAdPreferences={reopenAdPreferences} />
        {adConsent === null && <AdConsentNotice onChoice={chooseAdConsent} />}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <main>
        <header>
          <div>
            <p className="eyebrow">PERSONAL CLIENT ACQUISITION</p>
            <h1>Client Radar & Command Center</h1>
            <p className="muted">Discover → qualify → prepare → approve. External applications and messages remain explicit user actions.</p>
          </div>
          <div className="header-actions">
            {config.browserRadar && (
              <button className="approve" onClick={() => void scanPlatforms()} disabled={scanningPlatforms}>
                {scanningPlatforms ? "Scanning platforms…" : "⌕ Scan my platforms"}
              </button>
            )}
            <button className="refresh" onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "↻ Refresh radar"}
            </button>
            {config.authentication === "supabase" && (
              <button className="refresh" onClick={signOut}>Sign out</button>
            )}
          </div>
        </header>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button className={`refresh ${activeTab === "command_center" ? "selected" : ""}`} style={{ background: activeTab === "command_center" ? "#172033" : "#fff", color: activeTab === "command_center" ? "#fff" : "#39445a" }} onClick={() => setActiveTab("command_center")}>
            ⌘ Command Center
          </button>
          <button className={`refresh ${activeTab === "vault" ? "selected" : ""}`} style={{ background: activeTab === "vault" ? "#172033" : "#fff", color: activeTab === "vault" ? "#fff" : "#39445a" }} onClick={() => setActiveTab("vault")}>
            🗂 Resume Vault
          </button>
          <button className={`refresh ${activeTab === "profile" ? "selected" : ""}`} style={{ background: activeTab === "profile" ? "#172033" : "#fff", color: activeTab === "profile" ? "#fff" : "#39445a" }} onClick={() => setActiveTab("profile")}>
            ⚙ Master Profile
          </button>
        </div>

        <AdSlot placement="workspace-top" consentGranted={adConsent === "accepted"} />

        {!profileConfigured && (
          <div className="demo-note">Set up your master profile or upload a resume. Matching, proposals, pricing guardrails and future client conversations will use it.</div>
        )}
        {config.browserRadar && (
          <div className="demo-note">Browser radar is read-only: it opens local saved browser sessions and never submits applications or sends messages.</div>
        )}
        {connectedPlatforms.length > 0 && (
          <div className="demo-note">Connected in last scan: {connectedPlatforms.join(" · ")}</div>
        )}
        {error && <div className="error">{error}</div>}

        {activeTab === "vault" && <DocumentVaultPanel />}

        {activeTab === "profile" && (
          <ProfilePanel
            profile={profile}
            onSaved={(saved) => {
              setProfile(saved);
              setProfileConfigured(true);
              void refresh();
            }}
          />
        )}

        {activeTab === "command_center" && (
          <>
            <section className="stats">
              <Stat label="Discovered" value={summary ? String(summary.discovered) : "—"} />
              <Stat label="Qualified" value={summary ? String(summary.qualified) : "—"} accent />
              <Stat label="Review" value={summary ? String(summary.review) : "—"} />
              <Stat label="Skipped" value={summary ? String(summary.skipped) : "—"} />
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">COMMAND CENTER — WHAT NEEDS ATTENTION</p>
                  <h2>Priority Actions & Safety Guardrails</h2>
                  <p className="muted">All external replies, deal commitments, and job submissions require explicit approval.</p>
                </div>
              </div>
              <div className="command-grid">
                <div className="command-card">
                  <h3>Urgent Approvals</h3>
                  <strong className="accent">{data?.approvals.length ?? 0} pending</strong>
                  <p className="muted">Proposals waiting for your review</p>
                </div>
                <div className="command-card">
                  <h3>Active Pipeline</h3>
                  <strong>{summary ? String(summary.qualified) : "0"} qualified</strong>
                  <p className="muted">Opportunities ready for strategy</p>
                </div>
                <div className="command-card">
                  <h3>Client Guardrails</h3>
                  <strong className="accent">100% manual</strong>
                  <p className="muted">Zero automatic external messages</p>
                </div>
              </div>
            </section>

            <section className="panel" style={{ marginTop: 22 }}>
              <div className="panel-head">
                <div>
                  <h2>Top Opportunities</h2>
                  <p className="muted">Sorted by match score · risk checked</p>
                </div>
                <div className="filters">
                  {(["all", "low", "qualified"] as const).map((value) => (
                    <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>
                      {value === "all" ? "All" : value === "low" ? "Low risk" : "Qualified"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="jobs">
                {jobs.map((job) => {
                  const score = job.analysis?.match.score ?? 0;
                  const risk = job.analysis?.risk.level ?? "medium";
                  const approval = approvalFor(job);
                  return (
                    <article className="job" key={job.id}>
                      <div className="job-main">
                        <div className="source">{job.source}</div>
                        <h3>{job.title}</h3>
                        <div className="tags">
                          {job.skills.slice(0, 5).map((skill) => (
                            <span key={skill}>{skill}</span>
                          ))}
                        </div>
                        <div className="meta">
                          <span>◷ {job.workMode}</span>
                          <span>◆ {budgetLabel(job.budget)}</span>
                          <span className={`risk ${risk}`}>● {risk} risk</span>
                        </div>
                      </div>
                      <div className="score">
                        <strong>{score}</strong>
                        <small>MATCH</small>
                      </div>
                      <div className="actions">
                        <button className="review" onClick={() => setSelected(job)}>
                          {approval ? "Review proposal" : job.analysis?.recommendation === "skip" ? "View details" : "Reviewed"}
                        </button>
                        <button className="open" onClick={() => window.open(job.sourceUrl, "_blank", "noopener,noreferrer")}>
                          Open job ↗
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!data && !error && <div className="empty">Loading live opportunities…</div>}
              {data && jobs.length === 0 && <div className="empty">No opportunities match this filter.</div>}
            </section>
            <AdSlot placement="opportunity-feed-bottom" consentGranted={adConsent === "accepted"} />
            <p className="demo-note">Approval is always explicit. Approving a proposal does not submit an application or send a message.</p>
          </>
        )}
      </main>
      <SiteLegalFooter onAdPreferences={reopenAdPreferences} />
      {adConsent === null && <AdConsentNotice onChoice={chooseAdConsent} />}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="source">{selected.source}</span>
                <h2>{selected.title}</h2>
              </div>
              <button className="close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="proposal">
              <p className="eyebrow">PROPOSAL / ANALYSIS</p>
              <p>{approvalFor(selected)?.proposal ?? selected.analysis?.match.fitReasons.join(" ") ?? selected.description}</p>
            </div>
            <div className="modal-actions">
              {approvalFor(selected) && <button onClick={() => void generateAiDraft(selected)} disabled={busyAiProposal || busyApproval}>{busyAiProposal ? "Generating…" : "Improve with AI"}</button>}
              <button onClick={() => setSelected(null)}>Keep pending</button>
              {approvalFor(selected) && (
                <>
                  <button onClick={() => void decide(selected, "reject")} disabled={busyApproval}>Reject</button>
                  <button className="approve" onClick={() => void decide(selected, "approve")} disabled={busyApproval}>
                    {busyApproval ? "Saving…" : "Approve for next step"}
                  </button>
                </>
              )}
            </div>
            <small className="modal-safe">Approval only. This action does not submit an application or send a message.</small>
          </section>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
