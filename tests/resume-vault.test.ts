import { describe, expect, it } from "vitest";
import { DocumentService } from "../src/application/document-service.js";
import { buildProfileDraftFromExtraction, parseResumeContent } from "../src/application/resume-parser.js";
import { InMemoryPersistence } from "../src/domain/persistence.js";
import type { Opportunity } from "../src/domain/opportunity.js";

describe("Resume Intelligence & Multi-Resume Document Vault", () => {
  it("parses resume text content without hallucinating unmentioned skills", () => {
    const resumeText = `
    Vibhav
    Senior TypeScript Engineer
    Summary: Experienced building full-stack web applications with React and Node.js.
    Experience: Developed microservices with Supabase and REST APIs.
    `;

    const extracted = parseResumeContent(resumeText, "vibhav_cv.txt");
    expect(extracted.displayName).toBe("Vibhav");
    expect(extracted.headline).toBe("Senior TypeScript Engineer");
    expect(extracted.skills).toContain("TypeScript");
    expect(extracted.skills).toContain("React");
    expect(extracted.skills).toContain("Node.js");
    expect(extracted.skills).toContain("Supabase");
    expect(extracted.skills).not.toContain("Golang"); // Not in text
    expect(extracted.evidence.length).toBeGreaterThan(0);
  });

  it("builds a reviewable master profile draft from extracted resume data", () => {
    const extracted = parseResumeContent("Vibhav\nFull Stack Developer\nReact Node.js Python", "cv.txt");
    const profileDraft = buildProfileDraftFromExtraction(extracted);

    expect(profileDraft.displayName).toBe("Vibhav");
    expect(profileDraft.headline).toBe("Full Stack Developer");
    expect(profileDraft.skills).toEqual(expect.arrayContaining(["React", "Node.js", "Python"]));
    expect(profileDraft.negotiation.requireFinalApproval).toBe(true);
  });

  it("manages user documents in vault and selects the optimal resume for an opportunity brief", async () => {
    const persistence = new InMemoryPersistence("user-dev-1");
    const service = new DocumentService(persistence);

    const devCv = await service.uploadDocument("user-dev-1", {
      title: "Full-Stack Developer Resume",
      documentType: "developer",
      fileName: "dev_cv.txt",
      fileType: "txt",
      contentText: "TypeScript React Node.js REST APIs Supabase CSS",
    });

    const aiCv = await service.uploadDocument("user-dev-1", {
      title: "AI Systems Engineer Resume",
      documentType: "ai_llm",
      fileName: "ai_cv.txt",
      fileType: "txt",
      contentText: "Python AI LLM Integration PyTorch TensorFlow TypeScript",
    });

    const docs = await service.listDocuments();
    expect(docs).toHaveLength(2);

    const aiJob: Opportunity = {
      id: "job-ai-1",
      source: "upwork",
      sourceUrl: "https://example.com/ai",
      title: "Senior AI Engineer",
      description: "Build LLM applications using Python and AI tool calling",
      skills: ["Python", "AI", "LLM Integration"],
      workMode: "remote",
      status: "new",
      discoveredAt: new Date().toISOString(),
    };

    const match = service.selectBestDocumentForOpportunity(docs, aiJob);
    expect(match.bestDocument?.id).toBe(aiCv.id);
    expect(match.bestDocument?.title).toBe("AI Systems Engineer Resume");
    expect(match.matchedSkills).toEqual(expect.arrayContaining(["python", "ai"]));
  });
});
