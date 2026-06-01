import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { LLMIntegrationService } from "../src/services/LLMIntegrationService";
import { makeCorpus, file, VALID_AUDIT_JSON } from "./fixtures";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pr-record-"));
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function writeCorpus(files: Parameters<typeof makeCorpus>[0]) {
  const p = path.join(tmpDir, "corpus.json");
  fs.writeFileSync(p, JSON.stringify(makeCorpus(files)));
  fs.mkdirSync(path.join(tmpDir, "docs"));
  fs.writeFileSync(path.join(tmpDir, "docs", "README.md"), "# README");
  return { corpusPath: p, docsPath: path.join(tmpDir, "docs") };
}

function mockProviders() {
  const fn = vi.fn((url: string) => {
    if (url.includes("groq.com")) {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: VALID_AUDIT_JSON } }],
          usage: { prompt_tokens: 1200, completion_tokens: 300 },
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: VALID_AUDIT_JSON }] } }],
        usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 400 },
      }),
    };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("analyzePR -> AnalysisRecord (TL-1 contract)", () => {
  it("assembles a §5.6-aligned record for a standard (Groq) PR", async () => {
    mockProviders();
    const { corpusPath, docsPath } = writeCorpus([file("src/feature.ts"), file("README.md", 3)]);

    const service = new LLMIntegrationService("gemini-key", "groq-key");
    const record = await service.analyzePR(corpusPath, docsPath);

    expect(record.repository).toBe("acme/widget");
    expect(record.pullRequest.id).toBe("123");
    expect(record.pullRequest.url).toContain("github.com");

    expect(record.analysis.status).toBe("Atenção necessária");
    expect(record.analysis.criticality).toBe("Alta");
    expect(record.analysis.documentationGaps).toEqual(["Novo endpoint não documentado"]);
    expect(record.analysis.detectedChanges).toContain("src/feature.ts (modified)");
    expect(record.analysis.recommendations.length).toBeGreaterThan(0);

    expect(record.llm.provider).toBe("groq");
    expect(record.llm.model).toBe("llama-3.3-70b-versatile");
    expect(record.llm.inputTokens).toBe(1200);
    expect(record.llm.outputTokens).toBe(300);
    expect(record.llm.estimatedCost).toBe(0);

    expect(record.routing.reason).toMatch(/standard/i);
    expect(() => new Date(record.createdAt).toISOString()).not.toThrow();
  });

  it("routes sensitive PRs through Gemini and records its usageMetadata", async () => {
    mockProviders();
    const envFile: import("../src/services/types").FileMetadata = {
      path: ".env",
      status: "modified",
      additions: 3,
      deletions: 0,
      language: "YAML",
      isPublicAPI: false,
      isTest: false,
      isDocumentation: false,
      isConfig: true,
      changeSummary: "Env changes",
      diff: "+DATABASE_URL=postgres://host/db",
    };
    const { corpusPath, docsPath } = writeCorpus([envFile, file("src/x.ts")]);

    const service = new LLMIntegrationService("gemini-key", "groq-key");
    const record = await service.analyzePR(corpusPath, docsPath);

    expect(record.llm.provider).toBe("gemini");
    expect(record.llm.model).toBe("gemini-2.5-flash");
    expect(record.llm.inputTokens).toBe(1500);
    expect(record.llm.outputTokens).toBe(400);
  });

  it("defaults token usage to 0 when the provider omits usage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: VALID_AUDIT_JSON } }] }),
      }))
    );
    const { corpusPath, docsPath } = writeCorpus([file("src/a.ts")]);

    const service = new LLMIntegrationService("gemini-key", "groq-key");
    const record = await service.analyzePR(corpusPath, docsPath);

    expect(record.llm.inputTokens).toBe(0);
    expect(record.llm.outputTokens).toBe(0);
  });
});