// src/services/ReportGenerator.ts
import { AnalysisRecord } from "./types.js";

export class ReportGenerator {
  generate(record: AnalysisRecord): string {
    const { analysis, llm, pullRequest, repository, createdAt } = record;

    const lines: string[] = [
      "# Status",
      "",
      analysis.status,
      "",
      "## Criticidade",
      "",
      analysis.criticality,
      "",
      "## Mudanças Identificadas",
      "",
      ...analysis.detectedChanges.map((c) => `- ${c}`),
      "",
      "## Gaps Documentais Encontrados",
      "",
    ];

    if (analysis.documentationGaps.length === 0) {
      lines.push("Nenhum gap documental identificado.");
    } else {
      analysis.documentationGaps.forEach((gap, idx) => {
        lines.push(`${idx + 1}. ${gap}`);
      });
    }

    lines.push(
      "",
      "## Recomendação",
      "",
      ...analysis.recommendations.map((r) => `- ${r}`),
      "",
      "---",
      "",
      `**Justificativa:** ${analysis.justification}`,
      "",
      "---",
      `*Auditoria gerada automaticamente em ${createdAt}*`,
      `*Repositório: ${repository} | PR: #${pullRequest.id} - ${pullRequest.title}*`,
      `*Provedor: ${llm.provider} | Modelo: ${llm.model} | Tokens: ${llm.inputTokens} in / ${llm.outputTokens} out*`
    );

    // Medida #3 — nota visual quando houve falha de parsing (status Inconclusiva
    // por causa de resposta LLM não-confiável). Não utilizar como aprovação automática.
    if (analysis.parseFailure) {
      lines.push(
        "",
        "---",
        "⚠ Esta auditoria foi marcada como inconclusiva por falha de parsing da LLM — não utilizar como aprovação automática."
      );
    }

    return lines.join("\n");
  }
}