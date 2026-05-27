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
