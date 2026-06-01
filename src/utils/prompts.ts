import { PRCorpus, FileMetadata, GROQ_DIFF_CHAR_LIMIT, GEMINI_DIFF_CHAR_LIMIT } from "../services/types.js";

export interface TruncatedDiff {
  path: string;
  status: string;
  flags: string;
  diff: string;
  truncated: boolean;
  originalLength: number;
}

export interface TruncationResult {
  diffs: TruncatedDiff[];
  truncated: boolean;
  omittedCount: number;
  omittedFiles: string[];
  totalOriginalChars: number;
}

const SECURITY_PATTERNS = [
  /\.env/i,
  /secret/i,
  /password/i,
  /api[_-]?key/i,
  /token/i,
  /credential/i,
  /auth/i,
  /security/i,
  /\.github[/\\]workflows/i,
  /dockerfile/i,
  /docker-compose/i,
  /kubernetes|k8s/i,
  /terraform/i,
  /cloudformation/i,
  /infra/i,
  /infrastructure/i,
  /aws|gcp|azure/i,
  /ssl|tls|certificate|crypto/i,
];

function isSecuritySensitive(f: FileMetadata): boolean {
  return SECURITY_PATTERNS.some((p) => p.test(f.path));
}

const PRIORITY_ORDER: Record<string, number> = {
  isPublicAPI: 0,
  isDocumentation: 1,
  isConfig: 2,
  isTest: 3,
};

function filePriority(f: FileMetadata): number {
  if (isSecuritySensitive(f)) return -1;
  for (const [key, val] of Object.entries(PRIORITY_ORDER)) {
    if ((f as any)[key]) return val;
  }
  return 1;
}

export function truncateDiffs(
  files: FileMetadata[],
  charLimit: number,
): TruncationResult {
  const securityFiles = files.filter(f => isSecuritySensitive(f));
  const nonSecurityFiles = files.filter(f => !isSecuritySensitive(f));

  const sorted = [...nonSecurityFiles].sort((a, b) => filePriority(a) - filePriority(b));

  const diffs: TruncatedDiff[] = [];
  let usedChars = 0;
  let omittedCount = 0;
  const omittedFiles: string[] = [];
  const totalOriginalChars = files.reduce((s, f) => s + f.diff.length, 0);

  for (const f of securityFiles) {
    diffs.push({
      path: f.path,
      status: f.status,
      flags: buildFileFlags(f),
      diff: f.diff,
      truncated: false,
      originalLength: f.diff.length,
    });
    usedChars += f.diff.length;
  }

  for (const f of sorted) {
    if (f.isTest) {
      omittedCount++;
      omittedFiles.push(f.path);
    } else if (f.diff.length <= charLimit - usedChars) {
      diffs.push({
        path: f.path,
        status: f.status,
        flags: buildFileFlags(f),
        diff: f.diff,
        truncated: false,
        originalLength: f.diff.length,
      });
      usedChars += f.diff.length;
    } else {
      omittedCount++;
      omittedFiles.push(f.path);
    }
  }

  return {
    diffs,
    truncated: omittedCount > 0 || diffs.some((d) => d.truncated),
    omittedCount,
    omittedFiles,
    totalOriginalChars,
  };
}

function buildFileFlags(f: FileMetadata): string {
  const flags: string[] = [];
  if (f.isPublicAPI) flags.push("public API");
  if (f.isTest) flags.push("test");
  if (f.isDocumentation) flags.push("docs");
  if (f.isConfig) flags.push("config");
  if (isSecuritySensitive(f)) flags.push("SECURITY");
  return flags.join(", ") || "internal";
}

export function buildAuditPrompt(
  corpus: PRCorpus,
  docsContent: string,
  provider: "groq" | "gemini" = "groq",
): string {
  const charLimit = provider === "gemini" ? GEMINI_DIFF_CHAR_LIMIT : GROQ_DIFF_CHAR_LIMIT;
  const truncation = truncateDiffs(corpus.files, charLimit);

  const filesList = corpus.files
    .map(
      (f) =>
        `- ${f.path} (${f.status}, ${f.language}${f.isPublicAPI ? ", public API" : ""}${f.isTest ? ", test" : ""}${f.isDocumentation ? ", docs" : ""}${f.isConfig ? ", config" : ""}) +${f.additions}/-${f.deletions}`
    )
    .join("\n");

  const diffsSection = truncation.diffs
    .map((d) => {
      const header = `--- ${d.path} (${d.status}${d.flags ? ", " + d.flags : ""}) ---`;
      return `${header}\n${d.diff}`;
    })
    .join("\n\n");

  const truncationNotice = truncation.truncated
    ? `\n\n[... ${truncation.omittedCount} file(s) omitted due to size: ${truncation.omittedFiles.join(", ")}]`
    : "";

  const totalAdditions = corpus.files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = corpus.files.reduce((s, f) => s + f.deletions, 0);

  return `You are a technical documentation auditor. Analyze this PR to determine if documentation needs updates.

## PR Context
Repository: ${corpus.pr.repository}
PR #${corpus.pr.number}: ${corpus.pr.title}
Author: ${corpus.pr.author}
${corpus.pr.description ? `Description: ${corpus.pr.description}` : ""}
Changes: ${totalAdditions} additions, ${totalDeletions} deletions across ${corpus.files.length} file(s)

## Files Changed
${filesList}

## Diffs
${diffsSection}${truncationNotice}

## Current Documentation
\`\`\`
${docsContent}
\`\`\`

## Analysis Tasks
1. Identify what code/infrastructure changed semantically (new APIs, logic, security, infra) — ignore style/refactor
2. Compare against the provided documentation
3. List gaps (what should be documented but isn't)
4. Assign criticality:
   - Baixa: Cosmetic or minor changes
   - Média: Useful but not urgent
   - Alta: Important changes that should be documented
   - Crítica: Security, authentication, infrastructure, breaking changes ALWAYS CRITICAL
5. Provide brief justification in Portuguese

## Response Format
Return ONLY valid JSON (no markdown, no extra text):
{
  "requires_docs_update": boolean,
  "criticidade": "Baixa" | "Média" | "Alta" | "Crítica",
  "gaps": ["gap1", "gap2", ...],
  "justificativa": "Brief explanation in Portuguese"
}`;
}

export const PROMPT_CATALOG = {
  extractChanges: (diff: string): string => {
    return `You are a technical analyst focused on code diff metadata extraction.

Analyze this PR diff and extract ONLY semantic/structural changes (ignore style/refactor):

\`\`\`
${diff}
\`\`\`

Identify:
1. New resources (endpoints, classes, public methods)
2. Business logic changes
3. Infrastructure or configuration changes

Output: Bullet list of technical impact.`;
  },

  detectGaps: (
    changesSummary: string,
    currentDocs: string
  ): string => {
    return `You are a documentation auditor. Your mission: ensure documentation reflects code reality.

Code Changes:
${changesSummary}

Current Documentation:
\`\`\`
${currentDocs}
\`\`\`

Which code changes do NOT have corresponding documentation? List each gap with justification.`;
  },

  classifyCriticality: (gap: string): string => {
    return `You are a security and compliance expert.

For this documentation gap:
"${gap}"

Classify criticality: Baixa, Média, Alta, or Crítica.

RULE: Changes to authentication, security, or infrastructure without documentation = ALWAYS CRÍTICA.

Respond with ONLY the classification word.`;
  },
};