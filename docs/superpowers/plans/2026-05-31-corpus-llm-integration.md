# Corpus Enxuto + Diff Inline para LLM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplificar o corpus para 1 arquivo com diff inline e integrar o diff real no prompt da LLM com truncamento inteligente.

**Architecture:** O POCDiffReader gera um único corpus.json com `diff` (patch bruto) em cada arquivo. O prompt builder inclui o diff inline com truncamento priorizado. O roteamento usa tamanho real do diff. A leitura de docs agrega múltiplos .md.

**Tech Stack:** TypeScript, Node.js, Vitest, GitHub API (fetch nativo)

---

### Task 1: Atualizar types.ts — Simplificar PRCorpus e FileMetadata

**Files:**
- Modify: `src/services/types.ts`

- [ ] **Step 1: Substituir PRCorpus e FileMetadata pelos novos tipos**

Em `src/services/types.ts`, substituir as interfaces existentes `FileMetadata`, `PRCorpusStats`, `PRCorpus` e adicionar a constante de truncamento:

```typescript
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
```

Manter `AuditResult`, `RoutingDecision`, `TokenUsage`, `AnalysisRecord` e seus imports inalterados. Atualizar `RoutingDecision.context.totalDiffSize` para usar `number` (já é).

- [ ] **Step 2: Rodar testes para confirmar que os tipos quebram (esperado)**

Run: `npx vitest run 2>&1 | head -40`
Expected: Type errors em fixtures.ts e outros arquivos que usam o formato antigo.

- [ ] **Step 3: Commit**

```bash
git add src/services/types.ts
git commit -m "refactor: simplify PRCorpus and FileMetadata types with inline diff"
```

---

### Task 2: Atualizar fixtures.ts para o novo formato

**Files:**
- Modify: `tests/fixtures.ts`

- [ ] **Step 1: Reescrever fixtures para o novo PRCorpus**

Em `tests/fixtures.ts`, substituir o conteúdo por:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add tests/fixtures.ts
git commit -m "refactor: update test fixtures for simplified PRCorpus format"
```

---

### Task 3: Atualizar prompt tests e buildAuditPrompt com diff inline + truncamento

**Files:**
- Modify: `src/utils/prompts.ts`
- Modify: `tests/prompt.test.ts`

- [ ] **Step 1: Escrever testes para o novo buildAuditPrompt (incluindo diff e truncamento)**

Em `tests/prompt.test.ts`, substituir todo o conteúdo por:

```typescript
import { describe, it, expect } from "vitest";
import { buildAuditPrompt, PROMPT_CATALOG, truncateDiffs } from "../src/utils/prompts";
import { makeCorpus, file } from "./fixtures";

describe("buildAuditPrompt", () => {
  const corpus = makeCorpus(
    [file("src/auth/login.ts", 30, 2, "modified", "+import { verifyToken } from './jwt';\n-export function handleRequest(req, res) {\n+export function handleRequest(req, res, next) {")],
    { title: "Add JWT login", repository: "acme/api" }
  );
  const prompt = buildAuditPrompt(corpus, "# API Docs\nExisting documentation.");

  it("embeds PR identity (repository, number, title, author)", () => {
    expect(prompt).toContain("acme/api");
    expect(prompt).toContain("PR #123");
    expect(prompt).toContain("Add JWT login");
    expect(prompt).toContain("dev");
  });

  it("includes the diff content for changed files", () => {
    expect(prompt).toContain("src/auth/login.ts");
    expect(prompt).toContain("verifyToken");
  });

  it("includes the provided documentation", () => {
    expect(prompt).toContain("Existing documentation.");
  });

  it("specifies the required JSON output contract", () => {
    expect(prompt).toContain("requires_docs_update");
    expect(prompt).toContain("criticidade");
    expect(prompt).toContain("gaps");
    expect(prompt).toContain("justificativa");
  });

  it("shows change summary for each file", () => {
    expect(prompt).toContain("+30/-2");
  });
});

describe("truncateDiffs", () => {
  it("includes all files when total diff is under the limit", () => {
    const files = [
      file("src/a.ts", 10, 2, "modified", "diff content a"),
      file("src/b.ts", 5, 1, "modified", "diff content b"),
    ];
    const result = truncateDiffs(files, 10000);
    expect(result.diffs).toHaveLength(2);
    expect(result.truncated).toBe(false);
  });

  it("removes test files first when truncating", () => {
    const longDiff = "x".repeat(5000);
    const files = [
      file("src/api.ts", 5, 0, "modified", longDiff),
      file("src/api.test.ts", 500, 0, "modified", "test diff content"),
    ];
    const result = truncateDiffs(files, 6000);
    expect(result.diffs.some(d => d.path === "src/api.ts")).toBe(true);
    expect(result.diffs.some(d => d.path === "src/api.test.ts")).toBe(false);
    expect(result.truncated).toBe(true);
  });

  it("never truncates security-sensitive files", () => {
    const longDiff = "x".repeat(10000);
    const authFile: import("../src/services/types").FileMetadata = {
      path: "src/auth/middleware.ts",
      status: "modified",
      additions: 100,
      deletions: 10,
      language: "TypeScript",
      isPublicAPI: true,
      isTest: false,
      isDocumentation: false,
      isConfig: false,
      changeSummary: "Auth changes",
      diff: longDiff,
    };
    const files = [authFile];
    const result = truncateDiffs(files, 6000);
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0].truncated).toBe(false);
  });

  it("indicates which files were omitted", () => {
    const a = "a".repeat(3000);
    const b = "b".repeat(4000);
    const files = [
      file("src/a.ts", 5, 0, "modified", a),
      file("src/b.ts", 5, 0, "modified", b),
    ];
    const result = truncateDiffs(files, 5000);
    expect(result.truncated).toBe(true);
    expect(result.omittedCount).toBeGreaterThanOrEqual(1);
  });
});

describe("PROMPT_CATALOG helpers", () => {
  it("extractChanges embeds the diff", () => {
    expect(PROMPT_CATALOG.extractChanges("diff --git a/x")).toContain("diff --git a/x");
  });

  it("classifyCriticality enforces the security = Crítica rule", () => {
    const p = PROMPT_CATALOG.classifyCriticality("removed auth check");
    expect(p).toContain("removed auth check");
    expect(p).toMatch(/CR[ÍI]TICA/);
  });
});
```

- [ ] **Step 2: Rodar testes — devem falhar (truncateDiffs não existe)**

Run: `npx vitest run tests/prompt.test.ts 2>&1 | tail -20`
Expected: FAIL — `truncateDiffs` is not exported from `prompts.ts`.

- [ ] **Step 3: Implementar buildAuditPrompt com diff inline e truncateDiffs**

Em `src/utils/prompts.ts`, substituir todo o conteúdo por:

```typescript
import { PRCorpus, FileMetadata, GROQ_DIFF_CHAR_LIMIT, GEMINI_DIFF_CHAR_LIMIT } from "../services/types";

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
  const sorted = [...files].sort((a, b) => filePriority(a) - filePriority(b));
  const diffs: TruncatedDiff[] = [];
  let usedChars = 0;
  let omittedCount = 0;
  const omittedFiles: string[] = [];
  const totalOriginalChars = files.reduce((s, f) => s + f.diff.length, 0);

  for (const f of sorted) {
    const securityOverride = isSecuritySensitive(f);
    const available = charLimit - usedChars;

    if (f.diff.length <= available || securityOverride) {
      const truncated = f.diff.length > available && !securityOverride;
      const diffContent = truncated ? f.diff.slice(0, available - 50) + "\n... [truncated]" : f.diff;
      usedChars += diffContent.length;
      diffs.push({
        path: f.path,
        status: f.status,
        flags: buildFileFlags(f),
        diff: diffContent,
        truncated,
        originalLength: f.diff.length,
      });
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

  const stats = corpus.files;
  const totalAdditions = stats.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = stats.reduce((s, f) => s + f.deletions, 0);

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
```

- [ ] **Step 4: Rodar testes do prompt — devem passar**

Run: `npx vitest run tests/prompt.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/prompts.ts tests/prompt.test.ts
git commit -m "feat: add diff inline to buildAuditPrompt with intelligent truncation"
```

---

### Task 4: Atualizar LLMIntegrationService — roteamento por tamanho do diff e leitura de múltiplos docs

**Files:**
- Modify: `src/services/LLMIntegrationService.ts`
- Modify: `tests/routing.test.ts`
- Modify: `tests/integration.test.ts`
- Modify: `tests/record.test.ts`

- [ ] **Step 1: Atualizar routing tests para usar diff real em vez de additions+deletions**

Em `tests/routing.test.ts`, substituir todo o conteúdo por:

```typescript
import { describe, it, expect } from "vitest";
import { LLMIntegrationService } from "../src/services/LLMIntegrationService";
import { RoutingDecision, FileMetadata } from "../src/services/types";
import { makeCorpus, file } from "./fixtures";

function route(files: FileMetadata[], overrides?: Partial<ReturnType<typeof makeCorpus>["pr"]>): RoutingDecision {
  const corpus = makeCorpus(files, overrides);
  const service = new LLMIntegrationService("gemini-key", "groq-key");
  return (service as unknown as {
    calculateRoutingDecision(c: typeof corpus): RoutingDecision;
  }).calculateRoutingDecision(corpus);
}

describe("ADR-005 routing (calculateRoutingDecision)", () => {
  it("routes standard application code to Groq (happy path)", () => {
    const d = route([file("src/services/widget.ts"), file("tests/widget.test.ts")]);
    expect(d.provider).toBe("groq");
    expect(d.context.hasSecurityChanges).toBe(false);
  });

  it("routes .env changes to Gemini and flags hasEnvChanges", () => {
    const d = route([file(".env.production")]);
    expect(d.provider).toBe("gemini");
    expect(d.context.hasEnvChanges).toBe(true);
    expect(d.context.hasSecurityChanges).toBe(true);
  });

  it("routes auth files to Gemini and flags hasAuthChanges", () => {
    const d = route([file("src/auth/login.ts")]);
    expect(d.provider).toBe("gemini");
    expect(d.context.hasAuthChanges).toBe(true);
  });

  it("routes CI/CD workflow files to Gemini and flags hasCICDChanges", () => {
    const d = route([file(".github/workflows/deploy.yml")]);
    expect(d.provider).toBe("gemini");
    expect(d.context.hasCICDChanges).toBe(true);
  });

  it("routes infrastructure files (Dockerfile, terraform, k8s) to Gemini", () => {
    expect(route([file("Dockerfile")]).provider).toBe("gemini");
    expect(route([file("infra/main.tf")]).provider).toBe("gemini");
    expect(route([file("k8s/deployment.yaml")]).provider).toBe("gemini");
  });

  it("routes large diffs (>30k chars) to Gemini even without sensitive files", () => {
    const longDiff = "x".repeat(35000);
    const d = route([file("src/generated/data.ts", 20000, 11000, "modified", longDiff)]);
    expect(d.provider).toBe("gemini");
    expect(d.context.hasSecurityChanges).toBe(false);
    expect(d.context.totalDiffSize).toBeGreaterThanOrEqual(30000);
    expect(d.reason).toMatch(/large diff/i);
  });

  it("keeps a small, non-sensitive multi-file PR on Groq", () => {
    const d = route([file("README.md", 10), file("src/utils/format.ts", 40, 5)]);
    expect(d.provider).toBe("groq");
    expect(d.context.totalDiffSize).toBeLessThanOrEqual(30000);
  });

  it("calculates totalDiffSize from diff content length, not additions+deletions", () => {
    const diff200 = "a".repeat(200);
    const d = route([file("src/a.ts", 5, 2, "modified", diff200)]);
    expect(d.context.totalDiffSize).toBe(200);
  });
});
```

- [ ] **Step 2: Atualizar LLMIntegrationService**

Em `src/services/LLMIntegrationService.ts`, fazer as seguintes mudanças:

1. Atualizar import de tipos:
```typescript
import {
  AuditResult,
  PRCorpus,
  RoutingDecision,
  FileMetadata,
  TokenUsage,
  AnalysisRecord,
  DIFF_SIZE_THRESHOLD,
} from "./types";
```

2. Substituir `calculateRoutingDecision` para usar tamanho real do diff:

```typescript
private calculateRoutingDecision(corpus: PRCorpus): RoutingDecision {
  const decision: RoutingDecision = {
    provider: "groq",
    reason: "",
    context: {
      hasSecurityChanges: false,
      hasCICDChanges: false,
      hasAuthChanges: false,
      hasEnvChanges: false,
      totalDiffSize: 0,
    },
  };

  const totalDiffSize = corpus.files.reduce(
    (sum, f) => sum + (f.diff?.length || 0),
    0
  );
  decision.context.totalDiffSize = totalDiffSize;

  const securityPatterns = [
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

  corpus.files.forEach((file) => {
    const filePath = file.path.toLowerCase();

    if (filePath.includes(".env")) {
      decision.context.hasEnvChanges = true;
    } else if (filePath.includes("auth")) {
      decision.context.hasAuthChanges = true;
    } else if (filePath.includes(".github/workflows")) {
      decision.context.hasCICDChanges = true;
    }

    securityPatterns.forEach((pattern) => {
      if (pattern.test(filePath)) {
        decision.context.hasSecurityChanges = true;
      }
    });
  });

  if (decision.context.hasSecurityChanges) {
    decision.provider = "gemini";
    decision.reason =
      "Security-sensitive files detected (auth, env, secrets, infra, CI/CD)";
  } else if (totalDiffSize > DIFF_SIZE_THRESHOLD) {
    decision.provider = "gemini";
    decision.reason = `Large diff (${totalDiffSize} chars) requires Gemini's larger context`;
  } else {
    decision.provider = "groq";
    decision.reason = "Standard path: fast & cost-effective";
  }

  return decision;
}
```

3. Atualizar `analyzePR` para passar `provider` ao `buildAuditPrompt`:

No método `analyzePR`, trocar:
```typescript
const prompt = buildAuditPrompt(corpus, docsContent);
```
por:
```typescript
const prompt = buildAuditPrompt(corpus, docsContent, routing.provider);
```

4. Atualizar `readDocsDirectory` para ler múltiplos .md:

```typescript
private async readDocsDirectory(docsPath: string): Promise<string> {
  const absolutePath = path.resolve(docsPath);
  const DOCS_CHAR_LIMIT = 8000;

  const priorityFiles = ["README.md", "readme.md", "API.md", "DOCUMENTATION.md"];

  for (const file of priorityFiles) {
    const filePath = path.join(absolutePath, file);
    if (fs.existsSync(filePath)) {
      try {
        return fs.readFileSync(filePath, "utf-8").slice(0, DOCS_CHAR_LIMIT);
      } catch {
        // Continue to next file
      }
    }
  }

  try {
    const files = fs.readdirSync(absolutePath).filter((f) => f.endsWith(".md"));
    if (files.length === 1) {
      const filePath = path.join(absolutePath, files[0]);
      return fs.readFileSync(filePath, "utf-8").slice(0, DOCS_CHAR_LIMIT);
    }
    if (files.length > 1) {
      let combined = "";
      for (const f of files.sort()) {
        const filePath = path.join(absolutePath, f);
        const content = fs.readFileSync(filePath, "utf-8");
        const entry = `\n--- ${f} ---\n${content}\n`;
        if (combined.length + entry.length > DOCS_CHAR_LIMIT) {
          combined += `\n--- ${f} ---\n${content.slice(0, DOCS_CHAR_LIMIT - combined.length)}\n[truncated]`;
          break;
        }
        combined += entry;
      }
      return combined || "[No documentation found]";
    }
  } catch {
    // Ignore
  }

  return "[No documentation found]";
}
```

- [ ] **Step 3: Rodar routing tests — devem passar**

Run: `npx vitest run tests/routing.test.ts`
Expected: PASS

- [ ] **Step 4: Atualizar integration.test.ts — adicionar diff nos fixtures de corpus**

Em `tests/integration.test.ts`, atualizar a função `writeCorpus` para criar arquivos `.md` com conteúdo que o `readDocsDirectory` consiga ler, e ajustar testes relevantes. Adicionar `diff` aos fixtures onde `file()` é usado. A maior mudança: os `file()` calls que antes tinham apenas path agora podem precisar de diff para testar que o prompt inclui o diff.

Substituir o conteúdo de `tests/integration.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { LLMIntegrationService } from "../src/services/LLMIntegrationService";
import { makeCorpus, file, VALID_AUDIT_JSON } from "./fixtures";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pr-audit-"));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function writeCorpus(name: string, files: Parameters<typeof makeCorpus>[0]) {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, JSON.stringify(makeCorpus(files)));
  return p;
}

function writeDocs(content = "# README\nProject docs.") {
  const docsDir = path.join(tmpDir, "docs");
  fs.mkdirSync(docsDir);
  fs.writeFileSync(path.join(docsDir, "README.md"), content);
  return docsDir;
}

function mockBothProviders() {
  const fn = vi.fn((url: string) => {
    if (url.includes("groq.com")) {
      return { ok: true, json: async () => ({ choices: [{ message: { content: VALID_AUDIT_JSON } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }) };
    }
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: VALID_AUDIT_JSON }] } }], usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 60 } }),
    };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("readCorpusFile / readDocsDirectory", () => {
  const service = new LLMIntegrationService("g", "q");

  it("reads and parses a corpus JSON file", async () => {
    const p = writeCorpus("corpus.json", [file("src/a.ts")]);
    const corpus = await (service as any).readCorpusFile(p);
    expect(corpus.pr.repository).toBe("acme/widget");
    expect(corpus.files).toHaveLength(1);
  });

  it("throws a clear error when the corpus file is missing", async () => {
    await expect((service as any).readCorpusFile("/no/such/file.json")).rejects.toThrow(
      /Failed to read corpus file/
    );
  });

  it("reads README.md from the docs directory", async () => {
    const docsDir = writeDocs("# README\nHello docs.");
    const content = await (service as any).readDocsDirectory(docsDir);
    expect(content).toContain("Hello docs.");
  });

  it("reads multiple .md files when no priority file exists", async () => {
    const docsDir = path.join(tmpDir, "multi-docs");
    fs.mkdirSync(docsDir);
    fs.writeFileSync(path.join(docsDir, "guide.md"), "# Guide\nHow to use.");
    fs.writeFileSync(path.join(docsDir, "api.md"), "# API\nEndpoints.");

    const content = await (service as any).readDocsDirectory(docsDir);
    expect(content).toContain("Endpoints.");
    expect(content).toContain("How to use.");
  });

  it("returns a placeholder when no documentation is found", async () => {
    const empty = path.join(tmpDir, "empty");
    fs.mkdirSync(empty);
    const content = await (service as any).readDocsDirectory(empty);
    expect(content).toBe("[No documentation found]");
  });
});

describe("analyzeDiff end-to-end (mocked LLMs)", () => {
  it("runs the happy path through Groq for non-sensitive PRs", async () => {
    const fetchFn = mockBothProviders();
    const corpusPath = writeCorpus("c.json", [file("src/feature.ts", 20, 0, "modified", "+export function newFeature() {\n+  return true;\n+}")]);
    const docsDir = writeDocs();

    const service = new LLMIntegrationService("gemini-key", "groq-key");
    const result = await service.analyzeDiff(corpusPath, docsDir);

    expect(result.criticidade).toBe("Alta");
    expect(fetchFn.mock.calls[0][0]).toContain("groq.com");
  });

  it("routes sensitive PRs (.env) through Gemini", async () => {
    const fetchFn = mockBothProviders();
    const envFile: import("../src/services/types").FileMetadata = {
      path: ".env",
      status: "modified",
      additions: 3,
      deletions: 0,
      language: "YAML",
      isPublicAPI: false,
      isTest: false,
      isDocumentation: false,
      isConfig: true,
      changeSummary: "Env variable changes",
      diff: "+DATABASE_URL=postgres://prod-host/db",
    };
    const corpusPath = writeCorpus("c.json", [envFile, file("src/x.ts")]);
    const docsDir = writeDocs();

    const service = new LLMIntegrationService("gemini-key", "groq-key");
    const result = await service.analyzeDiff(corpusPath, docsDir);

    expect(result.requires_docs_update).toBe(true);
    expect(fetchFn.mock.calls[0][0]).toContain("generativelanguage.googleapis.com");
  });
});
```

- [ ] **Step 5: Atualizar record.test.ts com diffs nos fixtures**

Em `tests/record.test.ts`, atualizar os `file()` calls para incluir `diff` e ajustar assertions:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { LLMIntegrationService } from "../src/services/LLMIntegrationService";
import { makeCorpus, file, VALID_AUDIT_JSON } from "./fixtures";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pr-record-"));
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function writeCorpus(files: Parameters<typeof makeCorpus>[0]) {
  const p = path.join(tmpDir, "corpus.json");
  fs.writeFileSync(p, JSON.stringify(makeCorpus(files)));
  fs.mkdirSync(path.join(tmpDir, "docs"));
  fs.writeFileSync(path.join(tmpDir, "docs", "README.md"), "# README");
  return { corpusPath: p, docsPath: path.join(tmpDir, "docs") };
}

function mockProviders() {
  const fn = vi.fn((url: string) => {
    if (url.includes("groq.com")) {
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: VALID_AUDIT_JSON } }],
          usage: { prompt_tokens: 1200, completion_tokens: 300 },
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: VALID_AUDIT_JSON }] } }],
        usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 400 },
      }),
    };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("analyzePR -> AnalysisRecord (TL-1 contract)", () => {
  it("assembles a §5.6-aligned record for a standard (Groq) PR", async () => {
    mockProviders();
    const { corpusPath, docsPath } = writeCorpus([file("src/feature.ts"), file("README.md", 3)]);

    const service = new LLMIntegrationService("gemini-key", "groq-key");
    const record = await service.analyzePR(corpusPath, docsPath);

    expect(record.repository).toBe("acme/widget");
    expect(record.pullRequest.id).toBe("123");
    expect(record.pullRequest.url).toContain("github.com");

    expect(record.analysis.status).toBe("Atenção necessária");
    expect(record.analysis.criticality).toBe("Alta");
    expect(record.analysis.documentationGaps).toEqual(["Novo endpoint não documentado"]);
    expect(record.analysis.detectedChanges).toContain("src/feature.ts (modified)");
    expect(record.analysis.recommendations.length).toBeGreaterThan(0);

    expect(record.llm.provider).toBe("groq");
    expect(record.llm.model).toBe("llama-3.3-70b-versatile");
    expect(record.llm.inputTokens).toBe(1200);
    expect(record.llm.outputTokens).toBe(300);
    expect(record.llm.estimatedCost).toBe(0);

    expect(record.routing.reason).toMatch(/standard/i);
    expect(() => new Date(record.createdAt).toISOString()).not.toThrow();
  });

  it("routes sensitive PRs through Gemini and records its usageMetadata", async () => {
    mockProviders();
    const envFile: import("../src/services/types").FileMetadata = {
      path: ".env",
      status: "modified",
      additions: 3,
      deletions: 0,
      language: "YAML",
      isPublicAPI: false,
      isTest: false,
      isDocumentation: false,
      isConfig: true,
      changeSummary: "Env changes",
      diff: "+DATABASE_URL=postgres://host/db",
    };
    const { corpusPath, docsPath } = writeCorpus([envFile, file("src/x.ts")]);

    const service = new LLMIntegrationService("gemini-key", "groq-key");
    const record = await service.analyzePR(corpusPath, docsPath);

    expect(record.llm.provider).toBe("gemini");
    expect(record.llm.model).toBe("gemini-1.5-flash");
    expect(record.llm.inputTokens).toBe(1500);
    expect(record.llm.outputTokens).toBe(400);
  });

  it("defaults token usage to 0 when the provider omits usage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: VALID_AUDIT_JSON } }] }),
      }))
    );
    const { corpusPath, docsPath } = writeCorpus([file("src/a.ts")]);

    const service = new LLMIntegrationService("gemini-key", "groq-key");
    const record = await service.analyzePR(corpusPath, docsPath);

    expect(record.llm.inputTokens).toBe(0);
    expect(record.llm.outputTokens).toBe(0);
  });
});
```

- [ ] **Step 6: Rodar todos os testes**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/LLMIntegrationService.ts tests/routing.test.ts tests/integration.test.ts tests/record.test.ts
git commit -m "feat: route by diff size, read multiple docs, update all tests"
```

---

### Task 5: Simplificar poc-diff-reader para gerar corpus único com diff inline

**Files:**
- Modify: `apps/poc-diff-reader/poc-diff-reader.ts`

- [ ] **Step 1: Reescrever poc-diff-reader.ts**

Substituir todo o conteúdo de `apps/poc-diff-reader/poc-diff-reader.ts` por:

```typescript
/**
 * POC: GitHub PR Diff Reader - Simplificado para análise de documentação
 *
 * Gera um único corpus.json com diffs inline para consumo por LLM agents.
 * Uso: npx ts-node poc-diff-reader.ts <owner> <repo> <pr_number>
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config();

interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  previous_filename?: string;
}

interface GitHubPR {
  title: string;
  body: string | null;
  user: { login: string; html_url: string };
  labels: Array<{ name: string }>;
  html_url: string;
}

interface FileOutput {
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

interface CorpusOutput {
  pr: {
    number: string;
    repository: string;
    title: string;
    description: string | null;
    author: string;
    labels: string[];
    html_url: string;
  };
  files: FileOutput[];
}

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript (JSX)',
    js: 'JavaScript', jsx: 'JavaScript (JSX)',
    py: 'Python', rb: 'Ruby', go: 'Go',
    java: 'Java', kt: 'Kotlin',
    rs: 'Rust', c: 'C', cpp: 'C++', h: 'C Header',
    cs: 'C#', vb: 'Visual Basic',
    php: 'PHP', swift: 'Swift',
    md: 'Markdown', rst: 'reStructuredText',
    json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', toml: 'TOML',
    css: 'CSS', scss: 'SCSS', less: 'Less',
    html: 'HTML', svg: 'SVG',
    sh: 'Shell', bash: 'Bash', zsh: 'Zsh',
    sql: 'SQL', graphql: 'GraphQL',
    dockerfile: 'Dockerfile',
  };
  return ext ? langMap[ext] || ext : 'unknown';
}

function classifyFile(filename: string): {
  isTest: boolean;
  isDocumentation: boolean;
  isConfig: boolean;
  isPublicAPI: boolean;
} {
  const parts = filename.split('/');
  const basename = parts[parts.length - 1];
  const ext = basename.split('.').pop()?.toLowerCase();

  const isTest =
    basename.includes('.test.') ||
    basename.includes('.spec.') ||
    basename.includes('-test.') ||
    parts.includes('__tests__') ||
    parts.includes('tests') ||
    parts.includes('test') ||
    basename.startsWith('test_');

  const isDocumentation =
    ext === 'md' || ext === 'mdx' || ext === 'rst' ||
    parts.includes('docs') || parts.includes('documentation') ||
    basename.includes('README') || basename.includes('CHANGELOG') ||
    basename.includes('CONTRIBUTING');

  const isConfig =
    basename === 'package.json' || basename === 'tsconfig.json' ||
    basename === '.eslintrc' || basename === '.prettierrc' ||
    basename === 'webpack.config.js' || basename === 'vite.config.ts' ||
    basename.startsWith('.') || ext === 'yaml' || ext === 'yml' ||
    ext === 'toml' || basename === 'Dockerfile' ||
    parts.includes('config') || parts.includes('configuration');

  const isPublicAPI =
    !isTest && !isDocumentation && !isConfig &&
    !parts.includes('internal') &&
    !parts.includes('__tests__') &&
    !parts.includes('node_modules');

  return { isTest, isDocumentation, isConfig, isPublicAPI };
}

function generateChangeSummary(filename: string, status: string, additions: number, deletions: number, patch: string): string {
  if (status === 'added') return `Novo arquivo adicionado (+${additions} linhas)`;
  if (status === 'deleted') return `Arquivo removido (-${deletions} linhas)`;
  if (status === 'renamed') return `Arquivo renomeado`;

  const hasTypeChanges = patch.includes('type ') || patch.includes('interface ') || patch.includes('class ');
  const hasFunctionChanges = patch.includes('function ') || patch.includes('def ') || patch.includes('const ');
  const hasImportChanges = patch.includes('\n+import ') || patch.includes('\n-import ');
  const hasExportChanges = patch.includes('\n+export ') || patch.includes('\n-export ');

  const changes: string[] = [];
  if (hasTypeChanges) changes.push('tipos/interfaces');
  if (hasFunctionChanges) changes.push('funções/métodos');
  if (hasImportChanges) changes.push('imports');
  if (hasExportChanges) changes.push('exports');

  return changes.length > 0
    ? `Mudanças em: ${changes.join(', ')} (+${additions}/-${deletions})`
    : `Modificações diversas (+${additions}/-${deletions})`;
}

async function fetchPRMetadata(owner: string, repo: string, prNumber: number, token: string): Promise<GitHubPR> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
  const response = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

async function fetchPRFiles(owner: string, repo: string, prNumber: number, token: string): Promise<GitHubFile[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
  const response = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN env var não definida");
  }

  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log("Uso: npx ts-node poc-diff-reader.ts <owner> <repo> <pr_number>");
    console.log("\nExemplo:");
    console.log("  npx ts-node poc-diff-reader.ts facebook react 27534");
    process.exit(1);
  }

  const [owner, repo, prNumber] = args;

  try {
    console.log(`\n🔍 Buscando PR #${prNumber} em ${owner}/${repo}...`);

    console.log("📋 Buscando metadados da PR...");
    const prMetadata = await fetchPRMetadata(owner, repo, parseInt(prNumber), token);
    console.log(`✅ PR: "${prMetadata.title}" por @${prMetadata.user.login}`);

    console.log("📁 Buscando arquivos alterados...");
    const files = await fetchPRFiles(owner, repo, parseInt(prNumber), token);
    console.log(`✅ ${files.length} arquivos encontrados\n`);

    const fileOutputs: FileOutput[] = files.map((file) => {
      const classification = classifyFile(file.filename);
      const status = file.status === 'renamed' ? 'renamed' : file.status as FileOutput["status"];

      return {
        path: file.filename,
        status,
        additions: file.additions,
        deletions: file.deletions,
        language: detectLanguage(file.filename),
        ...classification,
        changeSummary: generateChangeSummary(file.filename, file.status, file.additions, file.deletions, file.patch || ""),
        diff: file.patch || "",
      };
    });

    const corpus: CorpusOutput = {
      pr: {
        number: prNumber,
        repository: `${owner}/${repo}`,
        title: prMetadata.title,
        description: prMetadata.body,
        author: prMetadata.user.login,
        labels: prMetadata.labels.map(l => l.name),
        html_url: prMetadata.html_url,
      },
      files: fileOutputs,
    };

    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const corpusFile = path.join(outputDir, `pr-${prNumber}-${owner}-${repo}-corpus.json`);
    fs.writeFileSync(corpusFile, JSON.stringify(corpus, null, 2), 'utf-8');

    const totalAdditions = fileOutputs.reduce((s, f) => s + f.additions, 0);
    const totalDeletions = fileOutputs.reduce((s, f) => s + f.deletions, 0);
    const publicApiFiles = fileOutputs.filter(f => f.isPublicAPI).length;
    const testFiles = fileOutputs.filter(f => f.isTest).length;
    const docFiles = fileOutputs.filter(f => f.isDocumentation).length;

    console.log(`✅ Output salvo em: ${corpusFile}`);
    console.log(`📄 ${fileOutputs.length} arquivos`);
    console.log(`🌐 ${publicApiFiles} públicos | 🧪 ${testFiles} testes | 📚 ${docFiles} docs`);
    console.log(`➕ +${totalAdditions} | ➖ -${totalDeletions}\n`);

  } catch (error) {
    console.error("❌ Erro:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Commit**

```bash
git add apps/poc-diff-reader/poc-diff-reader.ts
git commit -m "refactor: simplify poc-diff-reader to generate single corpus with inline diff"
```

---

### Task 6: Atualizar api.test.ts e verificar todos os testes passando

**Files:**
- Modify: `tests/api.test.ts`

- [ ] **Step 1: Atualizar api.test.ts — usar `callGroqRaw`/`callGeminiRaw` que agora retornam `{result, usage}`**

Os testes de `api.test.ts` atualmente chamam `callGroq` e `callGemini` (thin wrappers). Verificar se ainda funcionam, ou se precisam ser adaptados para `callGroqRaw`/`callGeminiRaw`. Manter os testes existentes que testam os wrappers, mas adicionar asserts de token usage nos raw methods.

Em `tests/api.test.ts`, atualizar para testar os métodos raw que retornam `{result, usage}`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LLMIntegrationService } from "../src/services/LLMIntegrationService";
import { VALID_AUDIT_JSON } from "./fixtures";

const service = new LLMIntegrationService("gemini-key", "groq-key");

function callGroqRaw(prompt: string) {
  return (service as unknown as {
    callGroqRaw(p: string): Promise<{ result: import("../src/services/types").AuditResult; usage: import("../src/services/types").TokenUsage }>;
  }).callGroqRaw(prompt);
}
function callGeminiRaw(prompt: string) {
  return (service as unknown as {
    callGeminiRaw(p: string): Promise<{ result: import("../src/services/types").AuditResult; usage: import("../src/services/types").TokenUsage }>;
  }).callGeminiRaw(prompt);
}

function mockFetch(impl: (url: string, init: RequestInit) => unknown) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("callGroqRaw", () => {
  it("sends the active free-tier model with json_object mode and returns result + usage", async () => {
    const fetchFn = mockFetch(() => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: VALID_AUDIT_JSON } }],
        usage: { prompt_tokens: 1200, completion_tokens: 300 },
      }),
    }));

    const { result, usage } = await callGroqRaw("audit this");

    expect(result.criticidade).toBe("Alta");
    expect(usage.inputTokens).toBe(1200);
    expect(usage.outputTokens).toBe(300);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain("api.groq.com");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer groq-key",
    });
  });

  it("throws on HTTP error responses", async () => {
    mockFetch(() => ({ ok: false, status: 400, statusText: "Bad Request" }));
    await expect(callGroqRaw("x")).rejects.toThrow(/Groq API error: 400/);
  });

  it("throws when the response has no content", async () => {
    mockFetch(() => ({ ok: true, json: async () => ({ choices: [] }) }));
    await expect(callGroqRaw("x")).rejects.toThrow(/empty content/i);
  });
});

describe("callGeminiRaw", () => {
  it("forces JSON via responseMimeType and returns result + usage", async () => {
    const fetchFn = mockFetch(() => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: VALID_AUDIT_JSON }] } }],
        usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 400 },
      }),
    }));

    const { result, usage } = await callGeminiRaw("audit this");

    expect(result.requires_docs_update).toBe(true);
    expect(usage.inputTokens).toBe(1500);
    expect(usage.outputTokens).toBe(400);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain("generativelanguage.googleapis.com");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("throws on HTTP error responses", async () => {
    mockFetch(() => ({ ok: false, status: 503, statusText: "Service Unavailable" }));
    await expect(callGeminiRaw("x")).rejects.toThrow(/Gemini API error: 503/);
  });
});
```

- [ ] **Step 2: Rodar todos os testes**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/api.test.ts
git commit -m "test: update api tests for raw methods with token usage"
```

---

### Task 7: Verificação final — rodar todos os testes + typecheck

**Files:** Nenhum (verificação apenas)

- [ ] **Step 1: Rodar vitest completo**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Se tudo passou, commit final (se houver alterações pendentes)**

```bash
git add -A
git commit -m "chore: final cleanup for corpus-llm-integration"
```