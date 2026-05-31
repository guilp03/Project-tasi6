import { PRCorpus, FileMetadata } from "../src/services/types";

export function makeCorpus(
  files: FileMetadata[],
  overrides: Partial<PRCorpus["pr"]> = {}
): PRCorpus {
  return {
    pr: {
      number: "123",
      repository: "acme/widget",
      title: "Add feature",
      description: "A test PR",
      author: "dev",
      labels: [],
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
  status: FileMetadata["status"] = "modified",
  diff = ""
): FileMetadata {
  return {
    path,
    status,
    additions,
    deletions,
    language: "TypeScript",
    isPublicAPI: !path.includes(".test.") && !path.includes("__tests__"),
    isTest: path.includes(".test.") || path.includes("__tests__"),
    isDocumentation: path.endsWith(".md"),
    isConfig: path.includes("config") || path.startsWith("."),
    changeSummary: `Changes in ${path} (+${additions}/-${deletions})`,
    diff,
  };
}

export const VALID_AUDIT_JSON = JSON.stringify({
  requires_docs_update: true,
  criticidade: "Alta",
  gaps: ["Novo endpoint não documentado"],
  justificativa: "Mudança relevante sem documentação correspondente.",
});