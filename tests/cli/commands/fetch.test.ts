// tests/cli/commands/fetch.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runFetch } from "../../../src/cli/commands/fetch.js";

vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("../../../src/services/GitHubExtractorService.js", () => {
  return {
    GitHubExtractorService: function () {
      return {
        extract: vi.fn().mockResolvedValue({
          pr: {
            number: "42",
            repository: "acme/widget",
            title: "Add feature",
            description: "A test PR",
            author: "dev",
            labels: [],
            html_url: "https://github.com/acme/widget/pull/42",
          },
          files: [
            {
              path: "src/index.ts",
              status: "modified",
              additions: 10,
              deletions: 2,
              language: "TypeScript",
              isPublicAPI: true,
              isTest: false,
              isDocumentation: false,
              isConfig: false,
              changeSummary: "Mudanças em: funções/métodos (+10/-2)",
              diff: "+new code",
            },
          ],
        }),
      };
    },
  };
});

describe("runFetch", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.GITHUB_TOKEN = "test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts PR and saves corpus JSON to the output path", async () => {
    const fs = await import("fs");

    await runFetch("acme", "widget", "42", { output: "/tmp/pr-corpus.json" });

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/tmp/pr-corpus.json",
      expect.stringContaining('"repository": "acme/widget"'),
      "utf-8"
    );
    expect(console.log).toHaveBeenCalledWith(
      "[OK] Corpus salvo em: /tmp/pr-corpus.json"
    );
  });

  it("exits with error when GITHUB_TOKEN is missing", async () => {
    delete (process.env as any).GITHUB_TOKEN;
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});

    await runFetch("acme", "widget", "42", { output: "/tmp/pr-corpus.json" });

    expect(console.error).toHaveBeenCalledWith(
      "GITHUB_TOKEN não configurado. Configure a variável de ambiente."
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});