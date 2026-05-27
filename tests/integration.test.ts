import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { LLMIntegrationService } from "../src/services/LLMIntegrationService";
import { makeCorpus, file, VALID_AUDIT_JSON } from "./fixtures";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pr-audit-"));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function writeCorpus(name: string, files: Parameters<typeof makeCorpus>[0]) {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, JSON.stringify(makeCorpus(files)));
  return p;
}

function writeDocs(content = "# README\nProject docs.") {
  const docsDir = path.join(tmpDir, "docs");
  fs.mkdirSync(docsDir);
  fs.writeFileSync(path.join(docsDir, "README.md"), content);
  return docsDir;
}

/** Capture which provider endpoint was hit and return a valid Groq/Gemini body. */
function mockBothProviders() {
  const fn = vi.fn((url: string) => {
    if (url.includes("groq.com")) {
      return { ok: true, json: async () => ({ choices: [{ message: { content: VALID_AUDIT_JSON } }] }) };
    }
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: VALID_AUDIT_JSON }] } }] }),
    };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("readCorpusFile / readDocsDirectory", () => {
  const service = new LLMIntegrationService("g", "q");

  it("reads and parses a corpus JSON file", async () => {
    const p = writeCorpus("corpus.json", [file("src/a.ts")]);
    const corpus = await (service as any).readCorpusFile(p);
    expect(corpus.pr.repository).toBe("acme/widget");
    expect(corpus.files).toHaveLength(1);
  });

  it("throws a clear error when the corpus file is missing", async () => {
    await expect((service as any).readCorpusFile("/no/such/file.json")).rejects.toThrow(
      /Failed to read corpus file/
    );
  });

  it("reads README.md from the docs directory", async () => {
    const docsDir = writeDocs("# README\nHello docs.");
    const content = await (service as any).readDocsDirectory(docsDir);
    expect(content).toContain("Hello docs.");
  });

  it("returns a placeholder when no documentation is found", async () => {
    const empty = path.join(tmpDir, "empty");
    fs.mkdirSync(empty);
    const content = await (service as any).readDocsDirectory(empty);
    expect(content).toBe("[No documentation found]");
  });
});

describe("analyzeDiff end-to-end (mocked LLMs)", () => {
  it("runs the happy path through Groq for non-sensitive PRs", async () => {
    const fetchFn = mockBothProviders();
    const corpusPath = writeCorpus("c.json", [file("src/feature.ts", 20)]);
    const docsDir = writeDocs();

    const service = new LLMIntegrationService("gemini-key", "groq-key");
    const result = await service.analyzeDiff(corpusPath, docsDir);

    expect(result.criticidade).toBe("Alta");
    expect(fetchFn.mock.calls[0][0]).toContain("groq.com");
  });

  it("routes sensitive PRs (.env) through Gemini", async () => {
    const fetchFn = mockBothProviders();
    const corpusPath = writeCorpus("c.json", [file(".env"), file("src/feature.ts")]);
    const docsDir = writeDocs();

    const service = new LLMIntegrationService("gemini-key", "groq-key");
    const result = await service.analyzeDiff(corpusPath, docsDir);

    expect(result.requires_docs_update).toBe(true);
    expect(fetchFn.mock.calls[0][0]).toContain("generativelanguage.googleapis.com");
  });
});
