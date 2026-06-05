// tests/services/ReportGenerator.test.ts
import { describe, it, expect } from "vitest";
import { ReportGenerator } from "../../src/services/ReportGenerator.js";
import { AnalysisRecord } from "../../src/services/types.js";

describe("ReportGenerator", () => {
  const mockRecord: AnalysisRecord = {
    repository: "acme/widget",
    pullRequest: {
      id: "42",
      title: "Add auth flow",
      author: "dev",
      url: "https://github.com/acme/widget/pull/42",
    },
    analysis: {
      status: "Atenção necessária",
      criticality: "Alta",
      requiresDocsUpdate: true,
      detectedChanges: [
        "src/auth/middleware.ts (modified)",
        "src/routes/login.ts (added)",
      ],
      documentationGaps: [
        "Novo endpoint de autenticação não documentado",
        "Mudanças no middleware de sessão ausentes do README",
      ],
      justification:
        "O PR modifica o middleware de autenticação e introduz mudanças de API que quebram compatibilidade, mas a documentação não reflete essas atualizações críticas.",
      recommendations: [
        "Atualizar a documentação antes de aprovar o PR.",
        "Revisar itens de segurança impactados com o time responsável.",
      ],
    },
    llm: {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      inputTokens: 1234,
      outputTokens: 567,
      estimatedCost: 0,
    },
    routing: {
      reason: "Standard path: fast & cost-effective",
    },
    createdAt: "2026-06-05T14:32:01Z",
  };

  it("generates markdown with all 5 required RF-005 sections", () => {
    const generator = new ReportGenerator();
    const md = generator.generate(mockRecord);

    expect(md).toContain("# Status");
    expect(md).toContain("## Criticidade");
    expect(md).toContain("## Mudanças Identificadas");
    expect(md).toContain("## Gaps Documentais Encontrados");
    expect(md).toContain("## Recomendação");
  });

  it("includes the analysis values in the correct sections", () => {
    const generator = new ReportGenerator();
    const md = generator.generate(mockRecord);

    expect(md).toContain("Atenção necessária");
    expect(md).toContain("Alta");
    expect(md).toContain("src/auth/middleware.ts (modified)");
    expect(md).toContain("1. Novo endpoint de autenticação não documentado");
    expect(md).toContain("2. Mudanças no middleware de sessão ausentes do README");
    expect(md).toContain("Atualizar a documentação antes de aprovar o PR.");
    expect(md).toContain("Revisar itens de segurança impactados com o time responsável.");
  });

  it("includes the justification paragraph", () => {
    const generator = new ReportGenerator();
    const md = generator.generate(mockRecord);

    expect(md).toContain(mockRecord.analysis.justification);
  });

  it("includes footer with provider, model and token metadata", () => {
    const generator = new ReportGenerator();
    const md = generator.generate(mockRecord);

    expect(md).toContain("Provedor: groq");
    expect(md).toContain("Modelo: llama-3.3-70b-versatile");
    expect(md).toContain("Tokens: 1234 in / 567 out");
    expect(md).toContain("Repositório: acme/widget");
    expect(md).toContain("PR: #42 - Add auth flow");
  });

  it("renders OK status when no update is required", () => {
    const okRecord: AnalysisRecord = {
      ...mockRecord,
      analysis: {
        ...mockRecord.analysis,
        status: "OK",
        criticality: "Baixa",
        requiresDocsUpdate: false,
        documentationGaps: [],
        recommendations: ["Documentação parece adequada; nenhuma ação documental necessária."],
      },
    };

    const generator = new ReportGenerator();
    const md = generator.generate(okRecord);

    expect(md).toContain("OK");
    expect(md).toContain("Baixa");
  });
});
