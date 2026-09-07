import { describe, expect, it } from "vitest";
import { isSafeExternalUrl, sanitizeProposalInput } from "../src/domain/security.js";

describe("security helpers", () => {
  it("allows normal web URLs and rejects dangerous schemes", () => {
    expect(isSafeExternalUrl("https://example.com/job")).toBe(true);
    expect(isSafeExternalUrl("http://example.com/job")).toBe(true);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("not-a-url")).toBe(false);
  });

  it("removes control characters and caps proposal input", () => {
    expect(sanitizeProposalInput(" hello\u0000\nworld ")).toBe("hello\nworld");
    expect(sanitizeProposalInput("x".repeat(10), 5)).toBe("xxxxx");
  });
});
