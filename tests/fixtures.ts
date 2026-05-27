import { PRCorpus, FileMetadata } from "../src/services/types";

/**
 * Build a minimal-but-valid PRCorpus for tests.
 * Override `files` to exercise the ADR-005 routing logic.
 */
export function makeCorpus(
  files: FileMetadata[],
  overrides: Partial<PRCorpus["pr"]> = {}
): PRCorpus {
  const additions = files.reduce((s, f) => s + (f.additions ?? 0), 0);
  const deletions = files.reduce((s, f) => s + (f.deletions ?? 0), 0);

  return {
    pr: {
      number: "123",
      repository: "acme/widget",
      title: "Add feature",
      description: "A test PR",
      author: "dev",
      state: "open",
      merged: false,
      labels: [],
      stats: {
        files_changed: files.length,
        additions,
        deletions,
      },
      html_url: "https://github.com/acme/widget/pull/123",
      ...overrides,
    },
    files,
  };
}

export function file(
  path: string,
  additions = 5,
  deletions = 0,
  status: FileMetadata["status"] = "modified"
): FileMetadata {
  return { path, status, additions, deletions };
}

/** A well-formed AuditResult as the LLM would return it (stringified JSON). */
export const VALID_AUDIT_JSON = JSON.stringify({
  requires_docs_update: true,
  criticidade: "Alta",
  gaps: ["Novo endpoint não documentado"],
  justificativa: "Mudança relevante sem documentação correspondente.",
});
