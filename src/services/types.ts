// Result interface for LLM audit response
export interface AuditResult {
  requires_docs_update: boolean;
  criticidade: "Baixa" | "Média" | "Alta" | "Crítica";
  gaps: string[];
  justificativa: string;
}

// PR Corpus types (from poc-diff-reader)
export interface FileMetadata {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions?: number;
  deletions?: number;
  language?: string;
  isPublicAPI?: boolean;
  isTest?: boolean;
  isDocumentation?: boolean;
  isConfig?: boolean;
}

export interface PRCorpusStats {
  files_changed: number;
  additions: number;
  deletions: number;
  commits?: number;
  comments?: number;
  review_comments?: number;
}

export interface PRCorpus {
  pr: {
    number: string;
    repository: string;
    title: string;
    description?: string | null;
    author: string;
    state: string;
    merged: boolean;
    labels: string[];
    stats: PRCorpusStats;
    html_url: string;
  };
  files: FileMetadata[];
  manifest?: {
    total_hunks: number;
    files_with_hunks: number;
    public_api_files: number;
    test_files: number;
    documentation_files: number;
  };
}

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
