// tests/cli/commands/history.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runHistory } from "../../../src/cli/commands/history.js";

vi.mock("../../../src/services/persistence/AnalysisRepository.js", () => {
  return {
    AnalysisRepository: class {
      findRecent = vi.fn().mockResolvedValue([
        {
          id: "647a2f8e1b3c4d5e6f7a8b9c",
          repository: "acme/widget",
          pullRequest: {
            id: "42",
            title: "Add auth",
            author: "dev",
            url: "https://github.com/acme/widget/pull/42",
          },
          analysis: {
            status: "Atenção necessária",
            criticality: "Alta",
            requiresDocsUpdate: true,
            detectedChanges: ["src/auth.ts (modified)"],
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
          createdAt: "2026-06-05T14:32:01Z",
        },
        {
          id: "647a2f8e1b3c4d5e6f7a8b9d",
          repository: "acme/widget",
          pullRequest: {
            id: "38",
            title: "Fix typo",
            author: "dev",
            url: "https://github.com/acme/widget/pull/38",
          },
          analysis: {
            status: "OK",
            criticality: "Baixa",
            requiresDocsUpdate: false,
            detectedChanges: ["src/utils.ts (modified)"],
            documentationGaps: [],
            justification: "Justificativa",
            recommendations: ["Nenhuma ação necessária."],
          },
          llm: {
            provider: "gemini",
            model: "gemini-2.5-flash",
            inputTokens: 200,
            outputTokens: 30,
            estimatedCost: 0,
          },
          routing: { reason: "Security" },
          createdAt: "2026-06-04T09:15:22Z",
        },
      ]);
    },
  };
});

vi.mock("../../../src/services/config.js", () => ({
  getMongoUri: vi.fn().mockReturnValue("mongodb://localhost:27017/test"),
}));

describe("runHistory", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints a table with recent audit records", async () => {
    await runHistory({ limit: "10" });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("ID")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("647a2f8e1b3c4d5e6f7a8b9c")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Alta")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Baixa")
    );
  });

  it("exits with error when MONGODB_URI is not configured", async () => {
    const configModule = await import("../../../src/services/config.js");
    vi.spyOn(configModule, "getMongoUri").mockReturnValueOnce(undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    await runHistory({ limit: "10" });

    expect(console.error).toHaveBeenCalledWith(
      "MONGODB_URI não configurado. Configure para usar --history."
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});