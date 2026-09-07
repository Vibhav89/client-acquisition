import type { CandidateProfile } from "./opportunity.js";

export const defaultCandidateProfile: CandidateProfile = {
  skills: [
    "TypeScript", "JavaScript", "React", "Next.js", "Node.js", "Supabase",
    "PostgreSQL", "AI", "LLM", "OpenAI", "API integration", "GitHub",
  ],
  evidence: [
    { skill: "TypeScript", evidence: "Production TypeScript application development", strength: 1 },
    { skill: "React", evidence: "Production React frontend development", strength: 1 },
    { skill: "Supabase", evidence: "Supabase-backed application architecture", strength: 0.9 },
    { skill: "AI", evidence: "AI/LLM orchestration and agent workflow development", strength: 0.9 },
    { skill: "API integration", evidence: "Server functions and third-party API integration", strength: 0.9 },
  ],
  preferredWorkModes: ["remote"],
  minimumHourlyUsd: 10,
};
