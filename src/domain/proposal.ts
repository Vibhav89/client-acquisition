import type { CandidateProfile, Opportunity } from "./opportunity.js";

export interface ProposalDraft {
  subject: string;
  body: string;
  personalization: string[];
  claimsUsed: string[];
}

export function draftProposal(opportunity: Opportunity, profile: CandidateProfile): ProposalDraft {
  const matched = opportunity.skills.filter((skill) => profile.skills.some((mine) => mine.toLowerCase() === skill.toLowerCase())).slice(0, 4);
  const evidence = profile.evidence.filter((item) => matched.some((skill) => skill.toLowerCase() === item.skill.toLowerCase())).slice(0, 3);
  const clientName = opportunity.client?.name ? ` ${opportunity.client.name}` : "";
  const personalization = matched.map((skill) => `Relevant skill: ${skill}`);
  const claimsUsed = evidence.map((item) => item.evidence);

  const body = [
    `Hi${clientName},`,
    "",
    `I’m interested in helping with ${opportunity.title}. The requirements line up well with my hands-on work in ${matched.join(", ") || "the technologies in your brief"}.`,
    "",
    evidence.length > 0
      ? `Relevant experience: ${evidence.map((item) => item.evidence).join("; ")}.`
      : "I can work from your existing requirements and provide a focused implementation plan before coding.",
    "",
    "I’d suggest starting by confirming the current codebase, the highest-priority workflow, and the definition of done. From there I can deliver in small, reviewable increments.",
    "",
    "If the project is still open, I’d be happy to discuss the first milestone.",
    "",
    "Best,\nVibhav",
  ].join("\n");

  return {
    subject: `Application: ${opportunity.title}`,
    body,
    personalization,
    claimsUsed,
  };
}
