import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { LLMIntegrationService } from "../src/services/LLMIntegrationService";
import {
  makeCorpus,
  file,
  VALID_AUDIT_JSON,
} from "./fixtures";
import {
  PRCorpus,
  RoutingDecision,
  AuditResult,
  TokenUsage,
  AnalysisRecord,
  FileMetadata,
} from "../src/services/types";

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
    expect(record.analysis.documentationGaps).toEqual(["feature.ts: novo endpoint não documentado"]);
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

// ---------------------------------------------------------------------------
// Contenção de alucinação — testes diretos de assembleRecord (#3 → #2 → #1)
// ---------------------------------------------------------------------------

function callAssembleRecord(
  files: FileMetadata[],
  routing: RoutingDecision,
  result: AuditResult
): AnalysisRecord {
  const service = new LLMIntegrationService("gemini-key", "groq-key") as unknown as {
    assembleRecord: (
      c: PRCorpus,
      r: RoutingDecision,
      a: AuditResult,
      u: TokenUsage,
      m: string
    ) => AnalysisRecord;
  };
  const usage: TokenUsage = { inputTokens: 1, outputTokens: 1 };
  return service.assembleRecord(makeCorpus(files), routing, result, usage, "model-x");
}

function routingStandard(): RoutingDecision {
  return {
    provider: "groq",
    reason: "Standard path: fast & cost-effective",
    context: {
      hasSecurityChanges: false,
      hasCICDChanges: false,
      hasAuthChanges: false,
      hasEnvChanges: false,
      totalDiffSize: 100,
    },
  };
}

function routingSecurity(): RoutingDecision {
  return {
    provider: "gemini",
    reason: "Security-sensitive files detected",
    context: {
      hasSecurityChanges: true,
      hasCICDChanges: false,
      hasAuthChanges: true,
      hasEnvChanges: false,
      totalDiffSize: 100,
    },
  };
}

describe("assembleRecord — contenção de alucinação (3 camadas)", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("caminho feliz: parseFailure false, status/criticidade preservados", () => {
    const record = callAssembleRecord(
      [file("src/utils/foo.ts")],
      routingStandard(),
      {
        requires_docs_update: true,
        criticidade: "Alta",
        gaps: ["foo.ts carece de docs"],
        justificativa: "ok",
      }
    );
    expect(record.analysis.status).toBe("Atenção necessária");
    expect(record.analysis.criticality).toBe("Alta");
    expect(record.analysis.parseFailure).toBe(false);
    expect(record.analysis.documentationGaps).toEqual(["foo.ts carece de docs"]);
    expect(record.analysis.justification).toBe("ok");
  });

  it("#1 floor: PR auth/ com LLM dizendo Média → força Crítica e injeta gap [DETERMINÍSTICO]", () => {
    const record = callAssembleRecord(
      [file("src/auth/middleware.ts")],
      routingSecurity(),
      {
        requires_docs_update: false,
        criticidade: "Média",
        gaps: ["middleware.tsblahblah"],
        justificativa: "LLM disse tudo ok",
      }
    );
    expect(record.analysis.status).toBe("Atenção necessária");
    expect(record.analysis.criticality).toBe("Crítica");
    expect(record.analysis.requiresDocsUpdate).toBe(true);
    expect(
      record.analysis.documentationGaps.some((g) =>
        g.startsWith("[DETERMINÍSTICO]")
      )
    ).toBe(true);
    expect(record.analysis.justification).toContain(
      "floor determinístico (RNF-003)"
    );
    expect(record.analysis.justification).toContain("LLM disse tudo ok");
  });

  it("(sem ancoragem): gap que não cita arquivo do PR vai direto para documentationGaps, status segue LLM", () => {
    // Camada #2 (grounding) foi removida — gaps da LLM são preservados como
    // produzidos, sem selo [NÃO ANCORADO] e sem forçar Inconclusiva. O PMO
    // lê a análise da LLM crua; o fail-closed Inconclusiva só cobra
    // parseFailure (#3).
    const record = callAssembleRecord(
      [file("src/utils/foo.ts")],
      routingStandard(),
      {
        requires_docs_update: true,
        criticidade: "Alta",
        gaps: ["endpoint /api/login não documentado"],
        justificativa: "x",
      }
    );
    expect(record.analysis.status).toBe("Atenção necessária");
    expect(record.analysis.criticality).toBe("Alta");
    expect(record.analysis.requiresDocsUpdate).toBe(true);
    expect(record.analysis.documentationGaps).toEqual([
      "endpoint /api/login não documentado",
    ]);
    expect(record.analysis.parseFailure).toBe(false);
  });

  it("#3 fail-closed: parseFailure propaga para AnalysisRecord", () => {
    const record = callAssembleRecord(
      [file("src/foo.ts")],
      routingStandard(),
      {
        requires_docs_update: true,
        criticidade: "Crítica",
        gaps: [
          "Análise inconclusiva — resposta da LLM não pôde ser interpretada. Revisão humana obrigatória.",
        ],
        justificativa: "Falha de parsing",
      }
    );
    expect(record.analysis.parseFailure).toBe(true);
    expect(record.analysis.status).toBe("Inconclusiva");
    expect(record.analysis.criticality).toBe("Crítica");
    expect(record.analysis.requiresDocsUpdate).toBe(true);
    expect(record.analysis.recommendations).toContain(
      "Rejeitar auto-aprovação: resultados inconclusivos demandam revisão humana."
    );
  });

  it("#1 floor (refinado): PR só-doc sensível (.mdx) NÃO força Crítica — segue análise LLM", () => {
    const docFile: FileMetadata = {
      path: "docs/guides/refresh-token-rotation.mdx",
      status: "modified",
      additions: 3,
      deletions: 1,
      language: "Markdown",
      isPublicAPI: false,
      isTest: false,
      isDocumentation: true,
      isConfig: false,
      changeSummary: "Fix TypeScript type in refresh token rotation example",
      diff: "-const token = ...\n+const token: string = ...",
    };
    const record = callAssembleRecord(
      [docFile],
      routingSecurity(),
      {
        requires_docs_update: false,
        criticidade: "Média",
        gaps: ["refresh-token-rotation.mdx carece de review de exemplo"],
        justificativa: "PR corrige tipo em exemplo de docs — fora de escopo do D3",
      }
    );
    expect(record.analysis.status).toBe("OK");
    expect(record.analysis.criticality).toBe("Média");
    expect(record.analysis.requiresDocsUpdate).toBe(false);
    expect(
      record.analysis.documentationGaps.some((g) =>
        g.startsWith("[DETERMINÍSTICO]")
      )
    ).toBe(false);
    expect(
      record.analysis.justification.includes("floor determinístico (RNF-003)")
    ).toBe(false);
    });

  it("#1 floor (refinado): PR misto (docs/auth.md + src/auth/middleware.ts) dispara floor pelo código", () => {
    const docFile: FileMetadata = {
      path: "docs/auth.md",
      status: "modified",
      additions: 5,
      deletions: 1,
      language: "Markdown",
      isPublicAPI: false,
      isTest: false,
      isDocumentation: true,
      isConfig: false,
      changeSummary: "Atualiza doc de auth",
      diff: "+descrição de token rotation",
    };
    const codeFile: FileMetadata = {
      path: "src/auth/middleware.ts",
      status: "modified",
      additions: 10,
      deletions: 2,
      language: "TypeScript",
      isPublicAPI: true,
      isTest: false,
      isDocumentation: false,
      isConfig: false,
      changeSummary: "Modifica middleware de auth",
      diff: "+export function verifyToken() { ... }",
    };
    const record = callAssembleRecord(
      [docFile, codeFile],
      routingSecurity(),
      {
        requires_docs_update: false,
        criticidade: "Média",
        gaps: ["middleware.ts carece de docs"],
        justificativa: "LLM disse ok",
      }
    );
    expect(record.analysis.status).toBe("Atenção necessária");
    expect(record.analysis.criticality).toBe("Crítica");
    expect(record.analysis.requiresDocsUpdate).toBe(true);
    const detGap = record.analysis.documentationGaps.find((g) =>
      g.startsWith("[DETERMINÍSTICO]")
    );
    expect(detGap).toBeDefined();
    expect(detGap!).toContain("src/auth/middleware.ts");
    expect(detGap!).not.toContain("docs/auth.md");
  });

  it("(sem ancoragem): reproduz chalk #642 — gaps por paráfrase vão diretos para documentationGaps (sem selo, sem Inconclusiva)", () => {
    // Camada #2 (grounding) removida: a LLM tem voz. Gap que não cita o
    // basename do arquivo do PR é preservado como produzido no relatório,
    // sem selo [NÃO ANCORADO] e sem forçar status Inconclusiva. Falha
    // hoje (codigo atual ancora/descarta) → passa após remoção.
    const record = callAssembleRecord(
      [file("source/vendor/supports-color/browser.js")],
      routingStandard(),
      {
        requires_docs_update: true,
        criticidade: "Alta",
        gaps: [
          "a mudança do navigator pode afetar compatibilidade em diferentes ambientes de execução",
        ],
        justificativa:
          "A mudança introduzida para resolver o problema do `navigator` não definido pode afetar a compatibilidade",
      }
    );
    expect(record.analysis.status).toBe("Atenção necessária");
    expect(record.analysis.criticality).toBe("Alta");
    expect(record.analysis.requiresDocsUpdate).toBe(true);
    expect(record.analysis.documentationGaps).toEqual([
      "a mudança do navigator pode afetar compatibilidade em diferentes ambientes de execução",
    ]);
    expect(record.analysis.parseFailure).toBe(false);
  });

  it("PR limpo sem arquivo sensível de código: LLM retorna 0 gaps + requires_docs_update false → OK (não Inconclusiva)", () => {
    const docFile: FileMetadata = {
      path: "docs/guides/refresh-token-rotation.mdx",
      status: "modified",
      additions: 3,
      deletions: 1,
      language: "Markdown",
      isPublicAPI: false,
      isTest: false,
      isDocumentation: true,
      isConfig: false,
      changeSummary: "Fix TypeScript type in refresh token rotation example",
      diff: "-const token = ...\n+const token: string = ...",
    };
    const record = callAssembleRecord(
      [docFile],
      routingStandard(),
      {
        requires_docs_update: false,
        criticidade: "Média",
        gaps: [],
        justificativa: "PR corrige tipo em exemplo de docs — fora de escopo do D3",
      }
    );
    expect(record.analysis.status).toBe("OK");
    expect(record.analysis.criticality).toBe("Média");
    expect(record.analysis.requiresDocsUpdate).toBe(false);
    expect(record.analysis.documentationGaps).toEqual([]);
    expect(record.analysis.parseFailure).toBe(false);
  });

  it("PR limpo sem arquivo sensível de código: LLM retorna 0 gaps + requires_docs_update true → Atenção necessária (não Inconclusiva)", () => {
    const record = callAssembleRecord(
      [file("src/utils/format.ts")],
      routingStandard(),
      {
        requires_docs_update: true,
        criticidade: "Alta",
        gaps: [],
        justificativa: "Mudança pode afetar consumidores",
      }
    );
    expect(record.analysis.status).toBe("Atenção necessária");
    expect(record.analysis.criticality).toBe("Alta");
    expect(record.analysis.requiresDocsUpdate).toBe(true);
    expect(record.analysis.documentationGaps).toEqual([]);
  });
});