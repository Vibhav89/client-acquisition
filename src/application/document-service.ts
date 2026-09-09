import type { DocumentFileType, DocumentRecord, DocumentType } from "../domain/document.js";
import type { Opportunity } from "../domain/opportunity.js";
import type { PersistencePort } from "../domain/persistence.js";
import { isSafeExternalUrl, MAX_DOCUMENT_SIZE_BYTES } from "../domain/security.js";
import { parseResumeContent } from "./resume-parser.js";

export interface UploadDocumentInput {
  title: string;
  documentType: DocumentType;
  fileName: string;
  fileType: DocumentFileType;
  contentText: string;
  targetRole?: string | undefined;
  version?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface DocumentMatchResult {
  bestDocument?: DocumentRecord | undefined;
  matchScore: number;
  matchedSkills: string[];
  rationale: string;
}

export class DocumentService {
  constructor(private readonly persistence: PersistencePort) {}

  async uploadDocument(userId: string, input: UploadDocumentInput): Promise<DocumentRecord> {
    const sizeBytes = Buffer.byteLength(input.contentText, "utf8");
    if (sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new Error(`File size exceeds maximum allowed limit of ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)}MB`);
    }

    const validFileTypes: DocumentFileType[] = ["pdf", "docx", "txt", "md"];
    if (!validFileTypes.includes(input.fileType)) {
      throw new Error(`Unsupported document file type: ${input.fileType}. Allowed: ${validFileTypes.join(", ")}`);
    }

    const extracted = parseResumeContent(input.contentText, input.fileName);
    const now = new Date().toISOString();
    const docId = `doc:${now}:${Math.random().toString(36).slice(2, 7)}`;

    const doc: DocumentRecord = {
      id: docId,
      userId,
      title: input.title.trim() || input.fileName,
      documentType: input.documentType,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSizeBytes: sizeBytes,
      contentText: input.contentText,
      skills: extracted.skills,
      targetRole: input.targetRole,
      version: input.version ?? "1.0",
      status: "active",
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    if (this.persistence.saveDocument) {
      await this.persistence.saveDocument(doc);
    }
    return doc;
  }

  async listDocuments(): Promise<DocumentRecord[]> {
    if (this.persistence.listDocuments) {
      return await this.persistence.listDocuments();
    }
    return [];
  }

  async getDocument(id: string): Promise<DocumentRecord | undefined> {
    if (this.persistence.getDocument) {
      return await this.persistence.getDocument(id);
    }
    return undefined;
  }

  async deleteDocument(id: string): Promise<void> {
    if (this.persistence.deleteDocument) {
      await this.persistence.deleteDocument(id);
    }
  }

  selectBestDocumentForOpportunity(documents: readonly DocumentRecord[], opportunity: Opportunity): DocumentMatchResult {
    const activeDocs = documents.filter((d) => d.status === "active");
    if (activeDocs.length === 0) {
      return { matchScore: 0, matchedSkills: [], rationale: "No active documents available in vault" };
    }

    const wantedSkills = new Set(opportunity.skills.map((s) => s.toLowerCase()));
    let bestDoc: DocumentRecord | undefined = undefined;
    let highestScore = -1;
    let bestMatched: string[] = [];

    for (const doc of activeDocs) {
      const docSkillsLower = new Set(doc.skills.map((s) => s.toLowerCase()));
      const matched = [...wantedSkills].filter((s) => docSkillsLower.has(s));
      const score = matched.length;

      if (score > highestScore) {
        highestScore = score;
        bestDoc = doc;
        bestMatched = matched;
      }
    }

    const topDoc = bestDoc ?? activeDocs[0]!;
    return {
      bestDocument: topDoc,
      matchScore: highestScore >= 0 ? highestScore : 0,
      matchedSkills: bestMatched,
      rationale: `Selected "${topDoc.title}" (${topDoc.documentType}) matching ${bestMatched.length} requested skill(s).`,
    };
  }
}
