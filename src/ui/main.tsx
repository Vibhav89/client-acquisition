import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Risk = "low" | "medium";
type Filter = "all" | "low" | "qualified";

const demo = [
  { id: "remotive-react", title: "React / TypeScript Developer", source: "Remotive", score: 92, risk: "low" as Risk, budget: "$25-40/hour", skills: ["React", "TypeScript", "API integration"], proposal: "Hi, I can help build and ship the React/TypeScript work with a focus on clean API integration and small reviewable increments." },
  { id: "remoteok-supabase", title: "Next.js + Supabase MVP", source: "Remote OK", score: 84, risk: "low" as Risk, budget: "$500-900 fixed", skills: ["Next.js", "Supabase", "PostgreSQL"], proposal: "Hi, I can help deliver the Next.js + Supabase MVP and keep the implementation incremental so you can review progress early." },
  { id: "remotive-ai", title: "AI automation prototype", source: "Remotive", score: 71, risk: "medium" as Risk, budget: "Budget not specified", skills: ["AI", "LLM", "Node.js"], proposal: "Hi, I can help prototype the AI/LLM workflow in Node.js, starting with a small testable slice before expanding it." },
];

function App() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<typeof demo[number] | null>(null);
  const [approved, setApproved] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const jobs = useMemo(() => demo.filter((job) => {
    if (filter === "low") return job.risk === "low";
    if (filter === "qualified") return job.score >= 75 && job.risk === "low";
    return true;
  }), [filter]);

  const approve = (id: string) => {
    setApproved((current) => current.includes(id) ? current : [...current, id]);
    setSelected(null);
  };

  const refresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 650);
  };

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">CR</span><div><strong>Client Radar</strong><small>Acquisition Engine</small></div></div>
      <nav><a className="active">Radar</a><a>Approvals <b>{approved.length + 2}</b></a><a>Applications</a><a>Clients</a><a>Settings</a></nav>
      <div className="safe"><span>●</span><div><strong>Approval-first</strong><small>No automatic submissions</small></div></div>
    </aside>
    <main>
      <header><div><p className="eyebrow">TODAY'S OPPORTUNITIES</p><h1>Client Radar</h1><p className="muted">High-fit remote opportunities, ranked by fit and safety.</p></div><button className="refresh" onClick={refresh}>{refreshing ? "Refreshing…" : "↻ Refresh radar"}</button></header>
      <section className="stats"><Stat label="Discovered" value="24" /><Stat label="Qualified" value="7" accent /><Stat label="Review" value="5" /><Stat label="Skipped" value="12" /></section>
      <section className="panel"><div className="panel-head"><div><h2>Top opportunities</h2><p className="muted">Sorted by match score · risk checked</p></div><div className="filters">{(["all", "low", "qualified"] as const).map((value) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "low" ? "Low risk" : "Qualified"}</button>)}</div></div>
        <div className="jobs">{jobs.map((job) => <article className="job" key={job.id}><div className="job-main"><div className="source">{job.source}</div><h3>{job.title}</h3><div className="tags">{job.skills.map(s => <span key={s}>{s}</span>)}</div><div className="meta"><span>◷ Remote</span><span>◆ {job.budget}</span><span className={job.risk === "low" ? "risk low" : "risk medium"}>● {job.risk} risk</span></div></div><div className="score"><strong>{job.score}</strong><small>MATCH</small></div><div className="actions"><button className="review" onClick={() => setSelected(job)}>{approved.includes(job.id) ? "Approved" : "Review proposal"}</button><button className="open" onClick={() => window.open("https://remoteok.com", "_blank", "noopener,noreferrer")}>Open job ↗</button></div></article>)}</div>
        {jobs.length === 0 && <div className="empty">No opportunities match this filter.</div>}
      </section>
      <p className="demo-note">Dashboard preview · live source/API wiring remains behind the application boundary. No message is sent from this screen.</p>
    </main>
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="source">{selected.source}</span><h2>{selected.title}</h2></div><button className="close" onClick={() => setSelected(null)}>×</button></div><div className="proposal"><p className="eyebrow">PROPOSAL DRAFT</p><p>{selected.proposal}</p><p>Best,<br />Vibhav</p></div><div className="modal-actions"><button onClick={() => setSelected(null)}>Keep pending</button><button className="approve" onClick={() => approve(selected.id)}>Approve for next step</button></div><small className="modal-safe">Approval only. This action does not submit an application or send a message.</small></section></div>}
  </div>;
}

function Stat({label, value, accent=false}: {label:string; value:string; accent?:boolean}) { return <div className="stat"><span>{label}</span><strong className={accent ? "accent" : ""}>{value}</strong></div>; }

createRoot(document.getElementById("root")!).render(<App />);
