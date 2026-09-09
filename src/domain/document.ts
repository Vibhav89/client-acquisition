export type DocumentType = "developer" | "ai_llm" | "research" | "general" | "portfolio" | "certificate";
export type DocumentFileType = "pdf" | "docx" | "txt" | "md";
export type DocumentStatus = "active" | "archived" | "processing" | "failed";

export interface DocumentRecord {
  id: string;
  userId: string;
  title: string;
  documentType: DocumentType;
  fileName: string;
  fileType: DocumentFileType;
  fileSizeBytes: number;
  contentText: string;
  skills: string[];
  targetRole?: string | undefined;
  version: string;
  status: DocumentStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedResumeProfile {
  displayName?: string | undefined;
  headline?: string | undefined;
  bio?: string | undefined;
  skills: string[];
  evidence: Array<{ skill: string; evidence: string; strength: number }>;
  experience: Array<{ company: string; role: string; description: string; duration?: string | undefined }>;
  projects: Array<{ title: string; description: string; skills: string[] }>;
  education: Array<{ institution: string; degree: string; field?: string | undefined }>;
  certifications: string[];
  keywords: string[];
}
