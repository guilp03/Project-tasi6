import { describe, it, expect } from "vitest";
import { buildAuditPrompt, PROMPT_CATALOG, truncateDiffs } from "../src/utils/prompts";
import { makeCorpus, file } from "./fixtures";
import { FileMetadata } from "../src/services/types";

describe("buildAuditPrompt", () => {
  const corpus = makeCorpus(
    [file("src/auth/login.ts", 30, 2, "modified", "+import { verifyToken } from './jwt';\n-export function handleRequest(req, res) {\n+export function handleRequest(req, res, next) {")],
    { title: "Add JWT login", repository: "acme/api" }
  );
  const prompt = buildAuditPrompt(corpus, "# API Docs\nExisting documentation.");

  it("embeds PR identity (repository, number, title, author)", () => {
    expect(prompt).toContain("acme/api");
    expect(prompt).toContain("PR #123");
    expect(prompt).toContain("Add JWT login");
    expect(prompt).toContain("dev");
  });

  it("includes the diff content for changed files", () => {
    expect(prompt).toContain("src/auth/login.ts");
    expect(prompt).toContain("verifyToken");
  });

  it("includes the provided documentation", () => {
    expect(prompt).toContain("Existing documentation.");
  });

  it("specifies the required JSON output contract", () => {
    expect(prompt).toContain("requires_docs_update");
    expect(prompt).toContain("criticidade");
    expect(prompt).toContain("gaps");
    expect(prompt).toContain("justificativa");
  });

  it("shows change summary for each file", () => {
    expect(prompt).toContain("+30/-2");
  });
});

describe("truncateDiffs", () => {
  it("includes all files when total diff is under the limit", () => {
    const files = [
      file("src/a.ts", 10, 2, "modified", "diff content a"),
      file("src/b.ts", 5, 1, "modified", "diff content b"),
    ];
    const result = truncateDiffs(files, 10000);
    expect(result.diffs).toHaveLength(2);
    expect(result.truncated).toBe(false);
  });

  it("removes test files first when truncating", () => {
    const longDiff = "x".repeat(5000);
    const files = [
      file("src/api.ts", 5, 0, "modified", longDiff),
      file("src/api.test.ts", 500, 0, "modified", "test diff content"),
    ];
    const result = truncateDiffs(files, 6000);
    expect(result.diffs.some(d => d.path === "src/api.ts")).toBe(true);
    expect(result.diffs.some(d => d.path === "src/api.test.ts")).toBe(false);
    expect(result.truncated).toBe(true);
  });

  it("never truncates security-sensitive files", () => {
    const longDiff = "x".repeat(10000);
    const authFile: FileMetadata = {
      path: "src/auth/middleware.ts",
      status: "modified",
      additions: 100,
      deletions: 10,
      language: "TypeScript",
      isPublicAPI: true,
      isTest: false,
      isDocumentation: false,
      isConfig: false,
      changeSummary: "Auth changes",
      diff: longDiff,
    };
    const files = [authFile];
    const result = truncateDiffs(files, 6000);
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0].truncated).toBe(false);
  });

  it("indicates which files were omitted", () => {
    const a = "a".repeat(3000);
    const b = "b".repeat(4000);
    const files = [
      file("src/a.ts", 5, 0, "modified", a),
      file("src/b.ts", 5, 0, "modified", b),
    ];
    const result = truncateDiffs(files, 5000);
    expect(result.truncated).toBe(true);
    expect(result.omittedCount).toBeGreaterThanOrEqual(1);
  });
});

describe("PROMPT_CATALOG helpers", () => {
  it("extractChanges embeds the diff", () => {
    expect(PROMPT_CATALOG.extractChanges("diff --git a/x")).toContain("diff --git a/x");
  });

  it("classifyCriticality enforces the security = Crítica rule", () => {
    const p = PROMPT_CATALOG.classifyCriticality("removed auth check");
    expect(p).toContain("removed auth check");
    expect(p).toMatch(/CR[ÍI]TICA/);
  });
});