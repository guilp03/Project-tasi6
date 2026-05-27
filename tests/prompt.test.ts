import { describe, it, expect } from "vitest";
import { buildAuditPrompt, PROMPT_CATALOG } from "../src/utils/prompts";
import { makeCorpus, file } from "./fixtures";

describe("buildAuditPrompt", () => {
  const corpus = makeCorpus([file("src/auth/login.ts", 30, 2)], {
    title: "Add JWT login",
    repository: "acme/api",
  });
  const prompt = buildAuditPrompt(corpus, "# API Docs\nExisting documentation.");

  it("embeds PR identity (repository, number, title, author)", () => {
    expect(prompt).toContain("acme/api");
    expect(prompt).toContain("PR #123");
    expect(prompt).toContain("Add JWT login");
    expect(prompt).toContain("dev");
  });

  it("lists the changed files", () => {
    expect(prompt).toContain("src/auth/login.ts");
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
