import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import { authHeaders, clearAccessToken, getAccessToken, getAuthConfig, signInWithPassword, type AuthConfig } from "./auth.js";
import "./styles.css";

type Opportunity = {
  id: string; source: string; sourceUrl: string; title: string; description: string; skills: string[];
  workMode: string; location: string; budget?: { currency: string; unit: string; min?: number; max?: number };
  analysis?: { match: { score: number; matchedSkills: string[]; fitReasons: string[] }; risk: { level: "low" | "medium" | "high" }; recommendation: "apply" | "review" | "skip" };
};
type Approval = { id: string; opportunityId: string; proposal: string; state: string };
type Session = { platform: string; loggedIn: boolean; checkedAt: string };
type ApiData = { dashboard: { summary: { discovered: number; qualified: number; review: number; skipped: number } }; opportunities: Opportunity[]; approvals: Approval[]; sessions?: Session[] };

function budgetLabel(budget?: Opportunity["budget"]): string {
  if (!budget) return "Budget not listed";
  const currency = budget.currency.toUpperCase();
  const min = budget.min ?? budget.max;
  const max = budget.max ?? budget.min;
  if (budget.unit === "hourly") return `${currency} ${min ?? "?"}${max && max !== min ? `–${max}` : ""}/hr`;
  return `${currency} ${min ?? "?"}${max && max !== min ? `–${max}` : ""} fixed`;
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="stat"><span>{label}</span><strong className={accent ? "accent" : ""}>{value}</strong></div>;
}

export function App() {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<ApiData | null>(null);
  const [filter, setFilter] = useState<"all" | "low" | "qualified">("all");
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scanningPlatforms, setScanningPlatforms] = useState(false);
  const [busyApproval, setBusyApproval] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAuthConfig().then(setConfig).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load configuration"));
  }, []);

  async function refresh(): Promise<void> {
    setRefreshing(true); setError(null);
    try {
      const response = await fetch("/api/radar", { cache: "no-store", headers: authHeaders() });
      if (response.status === 401) { clearAccessToken(); throw new Error("Please sign in to load your radar."); }
      if (!response.ok) throw new Error(`Radar request failed (${response.status})`);
      setData(await response.json() as ApiData);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load radar"); }
    finally { setRefreshing(false); }
  }

  async function scanPlatforms(): Promise<void> {
    setScanningPlatforms(true); setError(null);
    try {
      const response = await fetch("/api/platform-radar", { cache: "no-store", headers: authHeaders() });
      if (response.status === 401) { clearAccessToken(); throw new Error("Please sign in to scan your platform sessions."); }
      if (response.status === 409) throw new Error("Browser radar is disabled. Enable it with CLIENT_RADAR_BROWSER_ENABLED=true.");
      if (!response.ok) throw new Error(`Platform radar failed (${response.status})`);
      setData(await response.json() as ApiData);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to scan platforms"); }
    finally { setScanningPlatforms(false); }
  }

  useEffect(() => {
    if (config?.authentication === "development" || getAccessToken()) void refresh();
  }, [config]);

  async function signIn(): Promise<void> {
    if (!config) return;
    setAuthBusy(true); setError(null);
    try { await signInWithPassword(config, email.trim(), password); setPassword(""); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in"); }
    finally { setAuthBusy(false); }
  }

  function signOut(): void { clearAccessToken(); setData(null); setError(null); }

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
    const approval = approvalFor(job); if (!approval) return;
    setBusyApproval(true); setError(null);
    try {
      const response = await fetch(`/api/approvals/${encodeURIComponent(approval.id)}/${action}`, { method: "POST", headers: authHeaders() });
      if (response.status === 401) { signOut(); throw new Error("Your session expired. Please sign in again."); }
      if (!response.ok) throw new Error(`Approval request failed (${response.status})`);
      setSelected(null); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save approval"); }
    finally { setBusyApproval(false); }
  }

  if (!config) return <div className="app-shell"><main><div className="empty">Loading configuration…</div></main></div>;

  if (config.authentication === "supabase" && !getAccessToken()) {
    return (
      <div className="app-shell"><main><section className="panel auth-panel">
        <p className="eyebrow">CLIENT RADAR</p><h1>Sign in</h1>
        <p className="muted">Sign in to keep your opportunities, profile and approvals isolated to your account.</p>
        {error && <div className="error">{error}</div>}
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
        <button className="approve auth-submit" onClick={() => void signIn()} disabled={authBusy || !email || !password}>{authBusy ? "Signing in…" : "Sign in"}</button>
      </section></main></div>
    );
  }

  return (
    <div className="app-shell"><main>
      <header>
        <div><p className="eyebrow">TODAY'S OPPORTUNITIES</p><h1>Client Radar</h1><p className="muted">Public feeds + your logged-in platform sessions, ranked by fit and safety.</p></div>
        <div className="header-actions">
          {config.browserRadar && <button className="approve" onClick={() => void scanPlatforms()} disabled={scanningPlatforms}>{scanningPlatforms ? "Scanning platforms…" : "⌕ Scan my platforms"}</button>}
          <button className="refresh" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "Refreshing…" : "↻ Refresh radar"}</button>{config.authentication === "supabase" && <button className="refresh" onClick={signOut}>Sign out</button>}
        </div>
      </header>
      {config.browserRadar && <div className="demo-note">Browser radar is read-only: it opens your local saved browser sessions and reads opportunity pages. It never submits applications or sends messages.</div>}
      {connectedPlatforms.length > 0 && <div className="demo-note">Connected in last scan: {connectedPlatforms.join(" · ")}</div>}
      {error && <div className="error">{error}</div>}
      <section className="stats"><Stat label="Discovered" value={summary ? String(summary.discovered) : "—"} /><Stat label="Qualified" value={summary ? String(summary.qualified) : "—"} accent /><Stat label="Review" value={summary ? String(summary.review) : "—"} /><Stat label="Skipped" value={summary ? String(summary.skipped) : "—"} /></section>
      <section className="panel">
        <div className="panel-head"><div><h2>Top opportunities</h2><p className="muted">Sorted by match score · risk checked</p></div><div className="filters">{(["all", "low", "qualified"] as const).map((value) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "low" ? "Low risk" : "Qualified"}</button>)}</div></div>
        <div className="jobs">
          {jobs.map((job) => {
            const score = job.analysis?.match.score ?? 0;
            const risk = job.analysis?.risk.level ?? "medium";
            const approval = approvalFor(job);
            return <article className="job" key={job.id}>
              <div className="job-main"><div className="source">{job.source}</div><h3>{job.title}</h3><div className="tags">{job.skills.slice(0, 5).map((skill) => <span key={skill}>{skill}</span>)}</div><div className="meta"><span>◷ {job.workMode}</span><span>◆ {budgetLabel(job.budget)}</span><span className={`risk ${risk}`}>● {risk} risk</span></div></div>
              <div className="score"><strong>{score}</strong><small>MATCH</small></div>
              <div className="actions"><button className="review" onClick={() => setSelected(job)}>{approval ? "Review proposal" : job.analysis?.recommendation === "skip" ? "View details" : "Reviewed"}</button><button className="open" onClick={() => window.open(job.sourceUrl, "_blank", "noopener,noreferrer")}>Open job ↗</button></div>
            </article>;
          })}
        </div>
        {!data && !error && <div className="empty">Loading live opportunities…</div>}
        {data && jobs.length === 0 && <div className="empty">No opportunities match this filter.</div>}
      </section>
      <p className="demo-note">Approval is always explicit. Approving a proposal does not submit an application or send a message.</p>
    </main>
    {selected && (
      <div className="modal-backdrop" onClick={() => setSelected(null)}>
        <section className="modal" onClick={(event) => event.stopPropagation()}>
          <div className="modal-head"><div><span className="source">{selected.source}</span><h2>{selected.title}</h2></div><button className="close" onClick={() => setSelected(null)}>×</button></div>
          <div className="proposal"><p className="eyebrow">PROPOSAL / ANALYSIS</p><p>{approvalFor(selected)?.proposal ?? selected.analysis?.match.fitReasons.join(" ") ?? selected.description}</p></div>
          <div className="modal-actions"><button onClick={() => setSelected(null)}>Keep pending</button>{approvalFor(selected) && <><button onClick={() => void decide(selected, "reject")} disabled={busyApproval}>Reject</button><button className="approve" onClick={() => void decide(selected, "approve")} disabled={busyApproval}>{busyApproval ? "Saving…" : "Approve for next step"}</button></>}</div>
          <small className="modal-safe">Approval only. This action does not submit an application or send a message.</small>
        </section>
      </div>
    )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);