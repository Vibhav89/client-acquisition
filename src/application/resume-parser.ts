import type { ExtractedResumeProfile } from "../domain/document.js";
import type { PersonalAgentProfile } from "../domain/master-profile.js";

const KNOWN_SKILLS = [
  "TypeScript", "JavaScript", "React", "Node.js", "Python", "Golang", "Ruby", "Rails",
  "Java", "C++", "C#", "PHP", "DevOps", "QA", "Data", "AI", "LLM Integration", "AWS", "Docker",
  "Kubernetes", "Supabase", "PostgreSQL", "SQL", "GraphQL", "CSS", "HTML", "Vite", "REST APIs"
];

export function parseResumeContent(contentText: string, fileName = "Resume"): ExtractedResumeProfile {
  const lines = contentText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const textLower = contentText.toLowerCase();

  // Extract skills found in document
  const skillsSet = new Set<string>();
  for (const skill of KNOWN_SKILLS) {
    if (textLower.includes(skill.toLowerCase())) {
      skillsSet.add(skill);
    }
  }

  const skills = [...skillsSet];

  // Extract name/headline from top lines if plausible
  const displayName = lines[0] && lines[0].length < 50 && !lines[0].includes(":") ? lines[0] : undefined;
  const headline = lines[1] && lines[1].length < 100 ? lines[1] : undefined;

  // Build evidence for matched skills grounded directly in content lines
  const evidence = skills.map((skill) => {
    const matchingLine = lines.find((line) => line.toLowerCase().includes(skill.toLowerCase())) ?? `Extracted from ${fileName}`;
    return {
      skill,
      evidence: matchingLine.slice(0, 150),
      strength: 1,
    };
  });

  // Extract experiences heuristically
  const experience: ExtractedResumeProfile["experience"] = [];
  const projects: ExtractedResumeProfile["projects"] = [];
  const education: ExtractedResumeProfile["education"] = [];

  let currentSection: "summary" | "experience" | "projects" | "education" | "none" = "none";
  let bioLines: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("summary") || lower.includes("about")) {
      currentSection = "summary";
      continue;
    } else if (lower.includes("experience") || lower.includes("employment") || lower.includes("work history")) {
      currentSection = "experience";
      continue;
    } else if (lower.includes("projects") || lower.includes("portfolio")) {
      currentSection = "projects";
      continue;
    } else if (lower.includes("education") || lower.includes("academic")) {
      currentSection = "education";
      continue;
    }

    if (currentSection === "summary" && line.length > 20) {
      bioLines.push(line);
    } else if (currentSection === "experience" && line.length > 10) {
      experience.push({
        company: "Work History",
        role: "Software Developer",
        description: line,
      });
    } else if (currentSection === "projects" && line.length > 10) {
      projects.push({
        title: line.slice(0, 40),
        description: line,
        skills: skills.slice(0, 3),
      });
    } else if (currentSection === "education" && line.length > 10) {
      education.push({
        institution: line,
        degree: "Bachelor of Science",
      });
    }
  }

  const bioText = bioLines.join(" ").slice(0, 500);
  return {
    ...(displayName ? { displayName } : {}),
    ...(headline ? { headline } : {}),
    ...(bioText ? { bio: bioText } : {}),
    skills,
    evidence,
    experience: experience.slice(0, 5),
    projects: projects.slice(0, 5),
    education: education.slice(0, 3),
    certifications: [],
    keywords: skills,
  };
}

export function buildProfileDraftFromExtraction(
  extracted: ExtractedResumeProfile,
  existingProfile?: PersonalAgentProfile | undefined
): PersonalAgentProfile {
  const now = new Date().toISOString();
  return {
    displayName: extracted.displayName ?? existingProfile?.displayName ?? "Professional Operator",
    headline: extracted.headline ?? existingProfile?.headline ?? "Software Engineer",
    bio: extracted.bio ?? existingProfile?.bio ?? "Experienced software developer.",
    location: existingProfile?.location ?? "Remote",
    timezone: existingProfile?.timezone ?? "UTC",
    countries: existingProfile?.countries ?? ["United States", "United Kingdom", "Canada"],
    languages: existingProfile?.languages ?? ["English"],
    industries: existingProfile?.industries ?? ["Software Engineering", "AI"],
    availabilityHoursPerWeek: existingProfile?.availabilityHoursPerWeek ?? 40,
    skills: [...new Set([...(existingProfile?.skills ?? []), ...extracted.skills])],
    evidence: [...(existingProfile?.evidence ?? []), ...extracted.evidence],
    experience: extracted.experience,
    education: extracted.education,
    portfolio: extracted.projects.map((p: { title: string; description: string; skills: string[] }) => ({
      title: p.title,
      description: p.description,
      skills: p.skills,
    })),
    services: existingProfile?.services ?? [
      { name: "Full Stack Web App Development", description: "End-to-end web application development", minimumUsd: 200, deliveryDays: 5 }
    ],
    platformAccounts: existingProfile?.platformAccounts ?? [],
    communicationStyle: existingProfile?.communicationStyle ?? "professional",
    preferredWorkModes: existingProfile?.preferredWorkModes ?? ["remote"],
    negotiation: existingProfile?.negotiation ?? {
      minimumHourlyUsd: 30,
      minimumFixedUsd: 150,
      preferredHourlyUsd: 60,
      preferredFixedUsd: 500,
      maxDiscountPercent: 10,
      requireScopeConfirmation: true,
      requireFinalApproval: true,
    },
    redFlags: existingProfile?.redFlags ?? ["registration fee", "crypto payment", "gift card"],
    lastUpdatedAt: now,
  };
}
