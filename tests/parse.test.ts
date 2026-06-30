import { describe, it, expect, vi, beforeEach } from "vitest";
import { LLMIntegrationService } from "../src/services/LLMIntegrationService";
import { AuditResult } from "../src/services/types";

function parse(content: string): AuditResult {
  const service = new LLMIntegrationService("gemini-key", "groq-key");
  return (service as unknown as {
    parseJSONSafely(c: string): AuditResult;
  }).parseJSONSafely(content);
}

describe("parseJSONSafely", () => {
  beforeEach(() => {
    // Silence the expected fallback warnings.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("parses a well-formed AuditResult", () => {
    const result = parse(
      JSON.stringify({
        requires_docs_update: true,
        criticidade: "Crítica",
        gaps: ["gap1", "gap2"],
        justificativa: "Mudança de segurança sem doc.",
      })
    );
    expect(result.requires_docs_update).toBe(true);
    expect(result.criticidade).toBe("Crítica");
    expect(result.gaps).toHaveLength(2);
  });

  it("fail-closed: returns conservative fallback on malformed JSON", () => {
    const result = parse("not json at all {");
    expect(result.requires_docs_update).toBe(true);
    expect(result.criticidade).toBe("Crítica");
    expect(result.gaps[0]).toMatch(/^Análise inconclusiva — resposta da LLM/);
    expect(result.justificativa).toContain("Falha de parsing");
  });

  it("fail-closed when JSON is valid but criticidade is invalid", () => {
    const result = parse(
      JSON.stringify({
        requires_docs_update: true,
        criticidade: "Catastrófica", // not in the allowed enum
        gaps: [],
        justificativa: "x",
      })
    );
    expect(result.requires_docs_update).toBe(true);
    expect(result.criticidade).toBe("Crítica"); // conservative floor
  });

  it("fail-closed when a required field has the wrong type", () => {
    const result = parse(
      JSON.stringify({
        requires_docs_update: "yes", // should be boolean
        criticidade: "Baixa",
        gaps: [],
        justificativa: "x",
      })
    );
    expect(result.requires_docs_update).toBe(true);
    expect(result.criticidade).toBe("Crítica");
    expect(result.gaps[0]).toMatch(/^Análise inconclusiva — resposta da LLM/);
  });
});
