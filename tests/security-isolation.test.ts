import { describe, expect, it } from "vitest";
import { InMemoryPersistence } from "../src/domain/persistence.js";
import { assertUserOwnership, isSafeExternalUrl, sanitizeErrorForClient, sanitizeProfilePayload } from "../src/domain/security.js";
import type { DocumentRecord } from "../src/domain/document.js";

describe("Security & Multi-Tenant Data Isolation", () => {
  it("enforces strict user isolation in persistence store between User A and User B", () => {
    const userAPersistence = new InMemoryPersistence("user-A-id");
    const userBPersistence = new InMemoryPersistence("user-B-id");

    const docA: DocumentRecord = {
      id: "doc-1",
      userId: "user-A-id",
      title: "User A Developer Resume",
      documentType: "developer",
      fileName: "cv.pdf",
      fileType: "pdf",
      fileSizeBytes: 1024,
      contentText: "TypeScript React Node.js experience",
      skills: ["TypeScript", "React"],
      version: "1.0",
      status: "active",
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    userAPersistence.saveDocument(docA);

    // User A can access their document
    expect(userAPersistence.getDocument("doc-1")?.title).toBe("User A Developer Resume");
    expect(userAPersistence.listDocuments()).toHaveLength(1);

    // User B cannot access User A's document or see it in list
    expect(userBPersistence.getDocument("doc-1")).toBeUndefined();
    expect(userBPersistence.listDocuments()).toHaveLength(0);

    // User B attempting to save User A's doc with User A's ID throws ownership error
    expect(() => userBPersistence.saveDocument(docA)).toThrow("Access denied");
  });

  it("asserts user ownership boundary correctly", () => {
    expect(() => assertUserOwnership("user-123", "user-123")).not.toThrow();
    expect(() => assertUserOwnership("user-123", "user-456")).toThrow("Access denied");
    expect(() => assertUserOwnership("", "user-123")).toThrow("Access denied");
  });

  it("validates safe vs unsafe external URLs", () => {
    expect(isSafeExternalUrl("https://example.com/job/123")).toBe(true);
    expect(isSafeExternalUrl("http://remoteok.com/job/456")).toBe(true);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeExternalUrl("file:///C:/passwords.txt")).toBe(false);
  });

  it("sanitizes error messages avoiding token or internal credential leaks", () => {
    expect(sanitizeErrorForClient(new Error("Database failure on SUPABASE_ANON_KEY"))).toBe("An internal system error occurred");
    expect(sanitizeErrorForClient(new Error("Bearer eyJhbGciOi... expired"))).toBe("An internal system error occurred");
    expect(sanitizeErrorForClient(new Error("Invalid proposal format"))).toBe("Invalid proposal format");
  });

  it("sanitizes profile payloads removing any accidentally passed sensitive credentials", () => {
    const rawPayload = {
      displayName: "Vibhav",
      headline: "Engineer",
      password: "secretpassword123",
      apiKey: "sk-12345",
      secretKey: "supersecret",
    };
    const sanitized = sanitizeProfilePayload(rawPayload);
    expect(sanitized.displayName).toBe("Vibhav");
    expect(sanitized.password).toBeUndefined();
    expect(sanitized.apiKey).toBeUndefined();
    expect(sanitized.secretKey).toBeUndefined();
  });
});
