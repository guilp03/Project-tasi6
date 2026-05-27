import { PRCorpus } from "./types";

/**
 * Build the comprehensive audit prompt for LLM analysis
 * Instructs model to return JSON with AuditResult structure
 */
export function buildAuditPrompt(
  corpus: PRCorpus,
  docsContent: string
): string {
  const filesList = corpus.files
    .map((f) => `- ${f.path} (${f.status}, ${f.language || "unknown"})`)
    .join("\n");

  const stats = corpus.pr.stats;
  const totalChanges = (stats.additions || 0) + (stats.deletions || 0);

  return `You are a technical documentation auditor. Analyze this PR to determine if documentation needs updates.

## PR Context
Repository: ${corpus.pr.repository}
PR #${corpus.pr.number}: ${corpus.pr.title}
Author: ${corpus.pr.author}
Changes: ${stats.additions} additions, ${stats.deletions} deletions (total: ${totalChanges})
URL: ${corpus.pr.html_url}

## Files Modified
${filesList}

## Current Documentation
\`\`\`
${docsContent}
\`\`\`

## Analysis Tasks
1. Identify what code/infrastructure changed semantically (new APIs, logic, security, infra)
2. Compare against provided documentation
3. List gaps (what should be documented but isn't)
4. Assign criticality:
   - Baixa: Cosmetic or minor changes
   - Média: Useful but not urgent
   - Alta: Important changes that should be documented
   - Crítica: Security, authentication, infrastructure, breaking changes ALWAYS CRITICAL
5. Provide brief justification

## Response Format
Return ONLY valid JSON (no markdown, no extra text):
{
  "requires_docs_update": boolean,
  "criticidade": "Baixa" | "Média" | "Alta" | "Crítica",
  "gaps": ["gap1", "gap2", ...],
  "justificativa": "Brief explanation in Portuguese"
}`;
}

/**
 * Catalog of available prompts for different analysis stages
 */
export const PROMPT_CATALOG = {
  /**
   * PROMPT-001: Extract semantic changes from PR diff
   * Used to reduce token costs in subsequent stages
   */
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

  /**
   * PROMPT-002: Detect documentation gaps
   * Compare code changes with existing documentation
   */
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

  /**
   * PROMPT-003: Classify criticality of gaps
   * Focus on security and compliance
   */
  classifyCriticality: (gap: string): string => {
    return `You are a security and compliance expert.

For this documentation gap:
"${gap}"

Classify criticality: Baixa, Média, Alta, or Crítica.

RULE: Changes to authentication, security, or infrastructure without documentation = ALWAYS CRÍTICA.

Respond with ONLY the classification word.`;
  },
};
