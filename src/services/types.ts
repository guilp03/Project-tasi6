// Result interface for LLM audit response
export interface AuditResult {
  requires_docs_update: boolean;
  criticidade: "Baixa" | "Média" | "Alta" | "Crítica";
  gaps: string[];
  justificativa: string;
}

// PR Corpus types (simplified with inline diff)
export interface FileMetadata {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  language: string;
  isPublicAPI: boolean;
  isTest: boolean;
  isDocumentation: boolean;
  isConfig: boolean;
  changeSummary: string;
  diff: string;
}

export interface PRCorpus {
  pr: {
    number: string;
    repository: string;
    title: string;
    description: string | null;
    author: string;
    labels: string[];
    html_url: string;
  };
  files: FileMetadata[];
}

export const DIFF_SIZE_THRESHOLD = 30000;
export const GROQ_DIFF_CHAR_LIMIT = 6000;
export const GEMINI_DIFF_CHAR_LIMIT = 120000;
export const DOCS_CHAR_LIMIT = 8000;

export interface RoutingDecision {
  provider: "gemini" | "groq";
  reason: string;
  context: {
    hasSecurityChanges: boolean;
    hasCICDChanges: boolean;
    hasAuthChanges: boolean;
    hasEnvChanges: boolean;
    totalDiffSize: number;
  };
}

// Token usage surfaced from the LLM response (Groq `usage` / Gemini `usageMetadata`).
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Full analysis record (TL-1 contract).
 * The `analysis` block is aligned to ESCOPO_MVP_ATUALIZADO §5.6 so it can be
 * persisted to MongoDB (Reilson) and rendered to Markdown (Stela) without
 * either side re-deriving status/recommendations.
 */
export interface AnalysisRecord {
  id?: string;
  repository: string;
  pullRequest: {
    id: string;
    title: string;
    author: string;
    url: string;
  };
  analysis: {
    status: "Atenção necessária" | "OK";
    criticality: AuditResult["criticidade"];
    requiresDocsUpdate: boolean;
    detectedChanges: string[]; // derivado dos arquivos do PR
    documentationGaps: string[]; // = AuditResult.gaps
    justification: string; // = AuditResult.justificativa
    recommendations: string[]; // derivado da criticidade
  };
  llm: {
    provider: "groq" | "gemini";
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number; // USD — 0 no free tier, campo mantido p/ futuro
  };
  routing: {
    reason: string;
  };
  createdAt: string; // ISO timestamp
}
