import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const demo = [
  { title: "React / TypeScript Developer", source: "Remotive", score: 92, risk: "low", budget: "$25-40/hour", skills: ["React", "TypeScript", "API integration"] },
  { title: "Next.js + Supabase MVP", source: "Remote OK", score: 84, risk: "low", budget: "$500-900 fixed", skills: ["Next.js", "Supabase", "PostgreSQL"] },
  { title: "AI automation prototype", source: "Remotive", score: 71, risk: "medium", budget: "Budget not specified", skills: ["AI", "LLM", "Node.js"] },
];

function App() {
  return <div className="app">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">CR</span><div><strong>Client Radar</strong><small>Acquisition Engine</small></div></div><nav><a className="active">Radar</a><a>Approvals <b>2</b></a><a>Applications</a><a>Clients</a><a>Settings</a></nav><div className="safe"><span>●</span><div><strong>Approval-first</strong><small>No automatic submissions</small></div></div></aside>
    <main><header><div><p className="eyebrow">TODAY'S OPPORTUNITIES</p><h1>Client Radar</h1><p className="muted">High-fit remote opportunities, ranked by fit and safety.</p></div><button className="refresh">↻ Refresh radar</button></header>
      <section className="stats"><Stat label="Discovered" value="24" /><Stat label="Qualified" value="7" accent /><Stat label="Review" value="5" /><Stat label="Skipped" value="12" /></section>
      <section className="panel"><div className="panel-head"><div><h2>Top opportunities</h2><p className="muted">Sorted by match score · risk checked</p></div><div className="filters"><button className="selected">All</button><button>Low risk</button><button>Qualified</button></div></div>
        <div className="jobs">{demo.map((job) => <article className="job" key={job.title}><div className="job-main"><div className="source">{job.source}</div><h3>{job.title}</h3><div className="tags">{job.skills.map(s => <span key={s}>{s}</span>)}</div><div className="meta"><span>◷ Remote</span><span>◆ {job.budget}</span><span className={job.risk === "low" ? "risk low" : "risk medium"}>● {job.risk} risk</span></div></div><div className="score"><strong>{job.score}</strong><small>MATCH</small></div><div className="actions"><button className="review">Review proposal</button><button className="open">Open job ↗</button></div></article>)}</div>
      </section>
    </main>
  </div>;
}
function Stat({label, value, accent=false}: {label:string; value:string; accent?:boolean}) { return <div className="stat"><span>{label}</span><strong className={accent ? "accent" : ""}>{value}</strong></div>; }

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
