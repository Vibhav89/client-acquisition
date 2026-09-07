import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Risk = "low" | "medium" | "high";
type Recommendation = "apply" | "review" | "skip";
type Filter = "all" | "low" | "qualified";

type Opportunity = {
  id: string; title: string; source: string; sourceUrl: string; description: string;
  skills: string[]; workMode: string; budget?: { currency: string; min?: number; max?: number; unit: string };
  analysis?: { match: { score: number; matchedSkills: string[]; fitReasons: string[] }; risk: { level: Risk } ; recommendation: Recommendation };
};

type Approval = { id: string; opportunityId: string; proposal: string; state: string };
type RadarResponse = { dashboard: { summary: { discovered: number; qualified: number; review: number; skipped: number; pendingProposalReview: number } }; opportunities: Opportunity[]; approvals: Approval[] };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data === "object" && data && "error" in data ? String((data as { error: unknown }).error) : `Request failed (${response.status})`);
  return data as T;
}

function budgetLabel(budget?: Opportunity["budget"]): string {
  if (!budget) return "Budget not specified";
  const currency = budget.currency.toUpperCase();
  if (budget.min !== undefined && budget.max !== undefined) return `${currency} ${budget.min}-${budget.max}/${budget.unit}`;
  if (budget.max !== undefined) return `Up to ${currency} ${budget.max}/${budget.unit}`;
  if (budget.min !== undefined) return `From ${currency} ${budget.min}/${budget.unit}`;
  return `${currency} (${budget.unit})`;
}

function App() {
  const [data, setData] = useState<RadarResponse | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyApproval, setBusyApproval] = useState(false);

  const refresh = async () => {
    setRefreshing(true); setError(null);
    try { setData(await api<RadarResponse>("/api/radar")); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load radar"); }
    finally { setRefreshing(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const jobs = useMemo(() => (data?.opportunities ?? []).filter((job) => {
    const risk = job.analysis?.risk.level ?? "medium";
    const score = job.analysis?.match.score ?? 0;
    if (filter === "low") return risk === "low";
    if (filter === "qualified") return job.analysis?.recommendation === "apply" || score >= 75;
    return true;
  }), [data, filter]);

  const approvalFor = (job: Opportunity) => data?.approvals.find((item) => item.opportunityId === job.id && item.state === "pending");

  const decide = async (job: Opportunity, action: "approve" | "reject") => {
    const approval = approvalFor(job);
    if (!approval) return;
    setBusyApproval(true); setError(null);
    try {
      await api<Approval>(`/api/approvals/${encodeURIComponent(approval.id)}/${action}`, { method: "POST" });
      setSelected(null); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Approval action failed"); }
    finally { setBusyApproval(false); }
  };

  const summary = data?.dashboard.summary;

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">CR</span><div><strong>Client Radar</strong><small>Acquisition Engine</small></div></div>
      <nav><a className="active">Radar</a><a>Approvals <b>{summary?.pendingProposalReview ?? 0}</b></a><a>Applications</a><a>Clients</a><a>Settings</a></nav>
      <div className="safe"><span>●</span><div><strong>Approval-first</strong><small>No automatic submissions</small></div></div>
    </aside>
    <main>
      <header><div><p className="eyebrow">TODAY'S OPPORTUNITIES</p><h1>Client Radar</h1><p className="muted">Live public opportunities, ranked by fit and safety.</p></div><button className="refresh" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "Refreshing…" : "↻ Refresh radar"}</button></header>
      {error && <div className="error">{error}</div>}
      <section className="stats"><Stat label="Discovered" value={summary ? String(summary.discovered) : "—"} /><Stat label="Qualified" value={summary ? String(summary.qualified) : "—"} accent /><Stat label="Review" value={summary ? String(summary.review) : "—"} /><Stat label="Skipped" value={summary ? String(summary.skipped) : "—"} /></section>
      <section className="panel"><div className="panel-head"><div><h2>Top opportunities</h2><p className="muted">Sorted by match score · risk checked</p></div><div className="filters">{(["all", "low", "qualified"] as const).map((value) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "low" ? "Low risk" : "Qualified"}</button>)}</div></div>
        <div className="jobs">{jobs.map((job) => { const score = job.analysis?.match.score ?? 0; const risk = job.analysis?.risk.level ?? "medium"; const approval = approvalFor(job); return <article className="job" key={job.id}><div className="job-main"><div className="source">{job.source}</div><h3>{job.title}</h3><div className="tags">{job.skills.slice(0, 5).map(s => <span key={s}>{s}</span>)}</div><div className="meta"><span>◷ {job.workMode}</span><span>◆ {budgetLabel(job.budget)}</span><span className={`risk ${risk}`}>● {risk} risk</span></div></div><div className="score"><strong>{score}</strong><small>MATCH</small></div><div className="actions"><button className="review" onClick={() => setSelected(job)}>{approval ? "Review proposal" : job.analysis?.recommendation === "skip" ? "View details" : "Reviewed"}</button><button className="open" onClick={() => window.open(job.sourceUrl, "_blank", "noopener,noreferrer")}>Open job ↗</button></div></article>; })}</div>
        {!data && !error && <div className="empty">Loading live opportunities…</div>}
        {data && jobs.length === 0 && <div className="empty">No opportunities match this filter.</div>}
      </section>
      <p className="demo-note">Live radar API connected · discovery and proposal review run server-side. Approval does not submit an application or send a message.</p>
    </main>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="source">{selected.source}</span><h2>{selected.title}</h2></div><button className="close" onClick={() => setSelected(null)}>×</button></div><div className="proposal"><p className="eyebrow">PROPOSAL / ANALYSIS</p><p>{approvalFor(selected)?.proposal ?? selected.analysis?.fitReasons.join(" ") ?? selected.description}</p></div><div className="modal-actions"><button onClick={() => setSelected(null)}>Keep pending</button>{approvalFor(selected) && <><button onClick={() => void decide(selected, "reject")} disabled={busyApproval}>Reject</button><button className="approve" onClick={() => void decide(selected, "approve")} disabled={busyApproval}>{busyApproval ? "Saving…" : "Approve for next step"}</button></>}</div><small className="modal-safe">Approval only. This action does not submit an application or send a message.</small></section></div>}
  </div>;
}

function Stat({label, value, accent=false}: {label:string; value:string; accent?:boolean}) { return <div className="stat"><span>{label}</span><strong className={accent ? "accent" : ""}>{value}</strong></div>; }

createRoot(document.getElementById("root")!).render(<App />);
