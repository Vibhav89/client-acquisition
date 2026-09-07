import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import "./styles.css";

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
type ApiData = {
  dashboard: { summary: { discovered: number; qualified: number; review: number; skipped: number } };
  opportunities: Opportunity[];
  approvals: Approval[];
};

function budgetLabel(budget?: Opportunity["budget"]): string {
  if (!budget) return "Budget not listed";
  const currency = budget.currency.toUpperCase();
  const min = budget.min ?? budget.max;
  const max = budget.max ?? budget.min;
  if (budget.unit === "hourly") return `${currency} ${min ?? "?"}${max && max !== min ? `–${max}` : ""}/hr`;
  return `${currency} ${min ?? "?"}${max && max !== min ? `–${max}` : ""} fixed`;
}

export function App() {
  const [data, setData] = useState<ApiData | null>(null);
  const [filter, setFilter] = useState<"all" | "low" | "qualified">("all");
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyApproval, setBusyApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/radar", { cache: "no-store" });
      if (!response.ok) throw new Error(`Radar request failed (${response.status})`);
      setData(await response.json() as ApiData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load radar");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const jobs = useMemo(() => {
    const all = data?.opportunities ?? [];
    if (filter === "low") return all.filter((job) => job.analysis?.risk.level === "low");
    if (filter === "qualified") return all.filter((job) => job.analysis?.recommendation === "apply");
    return all;
  }, [data, filter]);

  const summary = data?.dashboard.summary;
  const approvalFor = (job: Opportunity) => data?.approvals.find((approval) => approval.opportunityId === job.id && approval.state === "pending");

  async function decide(job: Opportunity, action: "approve" | "reject"): Promise<void> {
    const approval = approvalFor(job);
    if (!approval) return;
    setBusyApproval(true);
    setError(null);
    try {
      const response = await fetch(`/api/approvals/${encodeURIComponent(approval.id)}/${action}`, { method: "POST" });
      if (!response.ok) throw new Error(`Approval request failed (${response.status})`);
      setSelected(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save approval");
    } finally {
      setBusyApproval(false);
    }
  }

  return <div className="app-shell">
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
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="source">{selected.source}</span><h2>{selected.title}</h2></div><button className="close" onClick={() => setSelected(null)}>×</button></div><div className="proposal"><p className="eyebrow">PROPOSAL / ANALYSIS</p><p>{approvalFor(selected)?.proposal ?? selected.analysis?.match.fitReasons.join(" ") ?? selected.description}</p></div><div className="modal-actions"><button onClick={() => setSelected(null)}>Keep pending</button>{approvalFor(selected) && <><button onClick={() => void decide(selected, "reject")} disabled={busyApproval}>Reject</button><button className="approve" onClick={() => void decide(selected, "approve")} disabled={busyApproval}>{busyApproval ? "Saving…" : "Approve for next step"}</button></>}</div><small className="modal-safe">Approval only. This action does not submit an application or send a message.</small></section></div>}
  </div>;
}

function Stat({label, value, accent=false}: {label:string; value:string; accent?:boolean}) { return <div className="stat"><span>{label}</span><strong className={accent ? "accent" : ""}>{value}</strong></div>; }

createRoot(document.getElementById("root")!).render(<App />);
