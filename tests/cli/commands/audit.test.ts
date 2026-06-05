// tests/cli/commands/audit.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runAudit } from "../../../src/cli/commands/audit.js";

vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
  writeFileSync: vi.fn().mockImplementation(() => {}),
}));

vi.mock("../../../src/services/LLMIntegrationService.js", () => ({
  LLMIntegrationService: vi.fn().mockImplementation(function(this: any) {
    this.analyzePR = vi.fn().mockResolvedValue({
      repository: "acme/widget",
      pullRequest: {
        id: "123",
        title: "Test PR",
        author: "dev",
        url: "https://github.com/acme/widget/pull/123",
      },
      analysis: {
        status: "Atenção necessária",
        criticality: "Alta",
        requiresDocsUpdate: true,
        detectedChanges: ["src/a.ts (modified)"],
        documentationGaps: ["Gap 1"],
        justification: "Justificativa",
        recommendations: ["Rec 1"],
      },
      llm: {
        provider: "groq",
        model: "llama",
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0,
      },
      routing: { reason: "Standard" },
      createdAt: "2026-01-01T00:00:00Z",
    });
  }),
}));

vi.mock("../../../src/services/ReportGenerator.js", () => ({
  ReportGenerator: vi.fn().mockImplementation(function(this: any) {
    this.generate = vi.fn().mockReturnValue("# Markdown report");
  }),
}));

vi.mock("../../../src/services/persistence/AnalysisRepository.js", () => ({
  AnalysisRepository: vi.fn().mockImplementation(function(this: any) {
    this.save = vi.fn().mockResolvedValue("647a2f...e1b3");
  }),
}));

vi.mock("../../../src/services/config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({
    geminiApiKey: "gemini-key",
    groqApiKey: "groq-key",
  }),
  getMongoUri: vi.fn().mockReturnValue("mongodb://localhost:27017/test"),
}));

describe("runAudit", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("completes audit and prints summary", async () => {
    await runAudit({ diff: "/tmp/corpus.json", docs: "/tmp/docs" });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[Status] Atenção necessária | Criticidade: Alta")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[Gaps] 1 gaps encontrados")
    );
  });

  it("saves markdown file when --output is provided", async () => {
    await runAudit({
      diff: "/tmp/corpus.json",
      docs: "/tmp/docs",
      output: "/tmp/report.md",
    });

    const fs = await import("fs");
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/tmp/report.md",
      "# Markdown report",
      "utf-8"
    );
    expect(console.log).toHaveBeenCalledWith(
      "[Arquivo] Relatório salvo em /tmp/report.md"
    );
  });

  it("persists to MongoDB when MONGODB_URI is set", async () => {
    await runAudit({ diff: "/tmp/corpus.json", docs: "/tmp/docs" });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[MongoDB] Registro salvo com id:")
    );
  });

  it("exits with error when diff file does not exist", async () => {
    const fs = await import("fs");
    const existsSpy = vi.spyOn(fs, "existsSync").mockImplementation((p: string) => p !== "/tmp/corpus.json");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    await runAudit({ diff: "/tmp/corpus.json", docs: "/tmp/docs" });

    expect(console.error).toHaveBeenCalledWith(
      "Arquivo não encontrado: /tmp/corpus.json"
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    existsSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("exits with error when docs directory does not exist", async () => {
    const fs = await import("fs");
    const existsSpy = vi.spyOn(fs, "existsSync").mockImplementation((p: string) => p !== "/tmp/docs");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    await runAudit({ diff: "/tmp/corpus.json", docs: "/tmp/docs" });

    expect(console.error).toHaveBeenCalledWith(
      "Diretório não encontrado: /tmp/docs"
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    existsSpy.mockRestore();
    exitSpy.mockRestore();
  });
});