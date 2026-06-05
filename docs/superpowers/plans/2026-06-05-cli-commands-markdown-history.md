# CLI com Comandos, Relatório Markdown e Histórico Persistido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar RF-005 (relatório Markdown), RF-007 (CLI com flags robustas), RF-008 (consulta de histórico) e promover o `poc-diff-reader` para serviço `GitHubExtractorService`, tudo via arquitetura de subcomandos com `commander`.

**Architecture:** Dispatcher `commander` em `src/index.ts` roteia para 4 comandos (`audit`, `history`, `fetch`, `fetch-and-audit`). Cada comando orquestra serviços existentes (`LLMIntegrationService`, `AnalysisRepository`) ou novos (`ReportGenerator`, `GitHubExtractorService`). Persistência MongoDB e APIs LLM permanecem inalteradas.

**Tech Stack:** Node.js 20, TypeScript 5, Vitest, Commander 12, Mongoose 9, native `fetch`.

---

## File Structure

### Novos arquivos
- `src/services/ReportGenerator.ts` — formata `AnalysisRecord` → Markdown (RF-005)
- `src/services/GitHubExtractorService.ts` — encapsula lógica do POC (extração GitHub → `PRCorpus`)
- `src/cli/parser.ts` — configura instância `commander` e registra comandos
- `src/cli/commands/audit.ts` — comando `audit --diff <path> --docs <dir> [--output <path>]`
- `src/cli/commands/history.ts` — comando `history [--limit N]`
- `src/cli/commands/fetch.ts` — comando `fetch <owner> <repo> <prNumber> [--output <path>]`
- `src/cli/commands/fetch-and-audit.ts` — comando `fetch-and-audit <owner> <repo> <prNumber> --docs <dir> [--output <path>]`
- `tests/services/ReportGenerator.test.ts` — testes unitários do gerador Markdown
- `tests/services/GitHubExtractorService.test.ts` — testes unitários do extrator
- `tests/cli/commands/audit.test.ts` — testes do comando audit
- `tests/cli/commands/history.test.ts` — testes do comando history
- `tests/cli/commands/fetch.test.ts` — testes do comando fetch

### Arquivos modificados
- `src/services/types.ts` — adicionar `id?: string` em `AnalysisRecord`
- `src/services/persistence/AnalysisRepository.ts` — popular campo `id` nos métodos `findRecent`, `findById`
- `src/index.ts` — refatorar para thin dispatcher (`createCLI().parse()`)
- `package.json` — adicionar `commander` às dependências, atualizar scripts, bump versão para `0.2.0`
- `README.MD` — documentar novos comandos e flags

### Arquivos removidos
- `apps/poc-diff-reader/` — diretório completo (funcionalidade migrada para `GitHubExtractorService`)

---

### Task 1: Instalar `commander` e atualizar tipo `AnalysisRecord`

**Files:**
- Modify: `package.json`
- Modify: `src/services/types.ts`
- Modify: `src/services/persistence/AnalysisRepository.ts`

- [ ] **Step 1: Instalar `commander` na versão 12.x**

```bash
npm install commander@^12.0.0
```

Run: `npm list commander`
Expected:
```
pr-documentation-auditor@0.2.0 /home/gl-pereira/Projects/Project-tasi6
└── commander@12.1.0
```

- [ ] **Step 2: Adicionar `id?: string` ao `AnalysisRecord` em `types.ts`**

```typescript
// src/services/types.ts
// Adicionar dentro da interface AnalysisRecord, após o campo repository:
export interface AnalysisRecord {
  id?: string;                          // ← ADICIONAR
  repository: string;
  pullRequest: {
    id: string;
    title: string;
    author: string;
    url: string;
  };
  // ... resto permanece inalterado
}
```

- [ ] **Step 3: Atualizar `AnalysisRepository.findRecent()` para popular `id`**

```typescript
// src/services/persistence/AnalysisRepository.ts
// Substituir o método findRecent

  async findRecent(limit = 10): Promise<AnalysisRecord[]> {
    await this.ensureConnection();
    const AnalysisModel = getModel();
    const docs = await AnalysisModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<any[]>();
    return docs.map((doc) => ({
      ...doc,
      id: (doc._id as mongoose.Types.ObjectId).toString(),
    }));
  }
```

- [ ] **Step 4: Atualizar `AnalysisRepository.findById()` para popular `id`**

```typescript
// src/services/persistence/AnalysisRepository.ts
// Substituir o método findById

  async findById(id: string): Promise<AnalysisRecord | null> {
    await this.ensureConnection();
    const AnalysisModel = getModel();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const doc = await AnalysisModel.findById(id).lean<any>();
    return doc
      ? { ...doc, id: (doc._id as mongoose.Types.ObjectId).toString() }
      : null;
  }
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/services/types.ts src/services/persistence/AnalysisRepository.ts
git commit -m "chore: install commander and add id field to AnalysisRecord"
```

---

### Task 2: Criar `ReportGenerator` (TDD)

**Files:**
- Create: `src/services/ReportGenerator.ts`
- Create: `tests/services/ReportGenerator.test.ts`

- [ ] **Step 1: Escrever o teste falho**

```typescript
// tests/services/ReportGenerator.test.ts
import { describe, it, expect } from "vitest";
import { ReportGenerator } from "../../src/services/ReportGenerator";
import { AnalysisRecord } from "../../src/services/types";

describe("ReportGenerator", () => {
  const mockRecord: AnalysisRecord = {
    repository: "acme/widget",
    pullRequest: {
      id: "42",
      title: "Add auth flow",
      author: "dev",
      url: "https://github.com/acme/widget/pull/42",
    },
    analysis: {
      status: "Atenção necessária",
      criticality: "Alta",
      requiresDocsUpdate: true,
      detectedChanges: [
        "src/auth/middleware.ts (modified)",
        "src/routes/login.ts (added)",
      ],
      documentationGaps: [
        "Novo endpoint de autenticação não documentado",
        "Mudanças no middleware de sessão ausentes do README",
      ],
      justification:
        "O PR modifica o middleware de autenticação e introduz mudanças de API que quebram compatibilidade, mas a documentação não reflete essas atualizações críticas.",
      recommendations: [
        "Atualizar a documentação antes de aprovar o PR.",
        "Revisar itens de segurança impactados com o time responsável.",
      ],
    },
    llm: {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      inputTokens: 1234,
      outputTokens: 567,
      estimatedCost: 0,
    },
    routing: {
      reason: "Standard path: fast & cost-effective",
    },
    createdAt: "2026-06-05T14:32:01Z",
  };

  it("generates markdown with all 5 required RF-005 sections", () => {
    const generator = new ReportGenerator();
    const md = generator.generate(mockRecord);

    expect(md).toContain("# Status");
    expect(md).toContain("## Criticidade");
    expect(md).toContain("## Mudanças Identificadas");
    expect(md).toContain("## Gaps Documentais Encontrados");
    expect(md).toContain("## Recomendação");
  });

  it("includes the analysis values in the correct sections", () => {
    const generator = new ReportGenerator();
    const md = generator.generate(mockRecord);

    expect(md).toContain("Atenção necessária");
    expect(md).toContain("Alta");
    expect(md).toContain("src/auth/middleware.ts (modified)");
    expect(md).toContain("1. Novo endpoint de autenticação não documentado");
    expect(md).toContain("2. Mudanças no middleware de sessão ausentes do README");
    expect(md).toContain("Atualizar a documentação antes de aprovar o PR.");
    expect(md).toContain("Revisar itens de segurança impactados com o time responsável.");
  });

  it("includes the justification paragraph", () => {
    const generator = new ReportGenerator();
    const md = generator.generate(mockRecord);

    expect(md).toContain(mockRecord.analysis.justification);
  });

  it("includes footer with provider, model and token metadata", () => {
    const generator = new ReportGenerator();
    const md = generator.generate(mockRecord);

    expect(md).toContain("Provedor: groq");
    expect(md).toContain("Modelo: llama-3.3-70b-versatile");
    expect(md).toContain("Tokens: 1234 in / 567 out");
    expect(md).toContain("Repositório: acme/widget");
    expect(md).toContain("PR: #42 - Add auth flow");
  });

  it("renders OK status when no update is required", () => {
    const okRecord: AnalysisRecord = {
      ...mockRecord,
      analysis: {
        ...mockRecord.analysis,
        status: "OK",
        criticality: "Baixa",
        requiresDocsUpdate: false,
        documentationGaps: [],
        recommendations: ["Documentação parece adequada; nenhuma ação documental necessária."],
      },
    };

    const generator = new ReportGenerator();
    const md = generator.generate(okRecord);

    expect(md).toContain("OK");
    expect(md).toContain("Baixa");
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
npx vitest run tests/services/ReportGenerator.test.ts
```

Expected: FAIL — module not found (`Cannot find module '../../src/services/ReportGenerator'`)

- [ ] **Step 3: Escrever a implementação mínima**

```typescript
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
      `*Auditoria gerada automaticamente em ${createdAt}*`,
      `*Repositório: ${repository} | PR: #${pullRequest.id} - ${pullRequest.title}*`,
      `*Provedor: ${llm.provider} | Modelo: ${llm.model} | Tokens: ${llm.inputTokens} in / ${llm.outputTokens} out*`
    );

    return lines.join("\n");
  }
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
npx vitest run tests/services/ReportGenerator.test.ts
```

Expected: PASS — 5 tests passando

- [ ] **Step 5: Commit**

```bash
git add tests/services/ReportGenerator.test.ts src/services/ReportGenerator.ts
git commit -m "feat: add ReportGenerator with RF-005 markdown formatting"
```

---

### Task 3: Criar `GitHubExtractorService` (TDD)

**Files:**
- Create: `src/services/GitHubExtractorService.ts`
- Create: `tests/services/GitHubExtractorService.test.ts`

- [ ] **Step 1: Escrever o teste falho**

```typescript
// tests/services/GitHubExtractorService.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubExtractorService } from "../../src/services/GitHubExtractorService";

describe("GitHubExtractorService", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mockFetch() {
    const fn = vi.fn((url: string) => {
      if (url.includes("/pulls/42")) {
        return {
          ok: true,
          json: async () => ({
            title: "Add feature",
            body: "This PR adds a new feature.",
            user: { login: "devuser", html_url: "https://github.com/devuser" },
            labels: [{ name: "enhancement" }, { name: "documentation" }],
            html_url: "https://github.com/acme/widget/pull/42",
          }),
        };
      }
      if (url.includes("/pulls/42/files")) {
        return {
          ok: true,
          json: async () => [
            {
              filename: "src/index.ts",
              status: "modified",
              additions: 10,
              deletions: 2,
              changes: 12,
              patch: "@@ -1,3 +1,5 @@\n+export function newFeature() {\n+  return true;\n+}\n",
            },
            {
              filename: "README.md",
              status: "modified",
              additions: 3,
              deletions: 0,
              changes: 3,
              patch: "+## New Feature",
            },
          ],
        };
      }
      return { ok: false, status: 404, statusText: "Not Found" };
    });
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  it("extracts PR metadata and files into a PRCorpus", async () => {
    mockFetch();
    const service = new GitHubExtractorService("fake-token");
    const corpus = await service.extract("acme", "widget", 42);

    expect(corpus.pr.number).toBe("42");
    expect(corpus.pr.repository).toBe("acme/widget");
    expect(corpus.pr.title).toBe("Add feature");
    expect(corpus.pr.description).toBe("This PR adds a new feature.");
    expect(corpus.pr.author).toBe("devuser");
    expect(corpus.pr.labels).toEqual(["enhancement", "documentation"]);
    expect(corpus.pr.html_url).toBe("https://github.com/acme/widget/pull/42");

    expect(corpus.files).toHaveLength(2);
    expect(corpus.files[0].path).toBe("src/index.ts");
    expect(corpus.files[0].status).toBe("modified");
    expect(corpus.files[0].language).toBe("TypeScript");
    expect(corpus.files[0].isPublicAPI).toBe(true);
    expect(corpus.files[0].isTest).toBe(false);
    expect(corpus.files[0].isDocumentation).toBe(false);
    expect(corpus.files[0].diff).toContain("newFeature");

    expect(corpus.files[1].path).toBe("README.md");
    expect(corpus.files[1].isDocumentation).toBe(true);
  });

  it("classifies test files correctly", async () => {
    const fn = vi.fn((url: string) => {
      if (url.includes("/pulls/1")) {
        return {
          ok: true,
          json: async () => ({
            title: "Tests",
            body: null,
            user: { login: "tester", html_url: "" },
            labels: [],
            html_url: "",
          }),
        };
      }
      if (url.includes("/pulls/1/files")) {
        return {
          ok: true,
          json: async () => [
            {
              filename: "src/index.test.ts",
              status: "added",
              additions: 50,
              deletions: 0,
              changes: 50,
              patch: "+test code",
            },
          ],
        };
      }
      return { ok: false, status: 404 };
    });
    vi.stubGlobal("fetch", fn);

    const service = new GitHubExtractorService("fake-token");
    const corpus = await service.extract("acme", "widget", 1);

    expect(corpus.files[0].isTest).toBe(true);
    expect(corpus.files[0].isPublicAPI).toBe(false);
  });

  it("throws on GitHub API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => ({ ok: false, status: 403, statusText: "Forbidden" }))
    );
    const service = new GitHubExtractorService("fake-token");
    await expect(service.extract("acme", "widget", 99)).rejects.toThrow(
      /GitHub API error/
    );
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
npx vitest run tests/services/GitHubExtractorService.test.ts
```

Expected: FAIL — module not found (`Cannot find module '../../src/services/GitHubExtractorService'`)

- [ ] **Step 3: Escrever a implementação mínima**

```typescript
// src/services/GitHubExtractorService.ts
import { PRCorpus, FileMetadata } from "./types.js";

interface GitHubPR {
  title: string;
  body: string | null;
  user: { login: string; html_url: string };
  labels: Array<{ name: string }>;
  html_url: string;
}

interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  previous_filename?: string;
}

export class GitHubExtractorService {
  constructor(private token: string) {}

  async extract(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PRCorpus> {
    const [prMetadata, files] = await Promise.all([
      this.fetchPRMetadata(owner, repo, prNumber),
      this.fetchPRFiles(owner, repo, prNumber),
    ]);

    const fileOutputs: FileMetadata[] = files.map((file) => {
      const classification = this.classifyFile(file.filename);
      return {
        path: file.filename,
        status: file.status as FileMetadata["status"],
        additions: file.additions,
        deletions: file.deletions,
        language: this.detectLanguage(file.filename),
        ...classification,
        changeSummary: this.generateChangeSummary(
          file.filename,
          file.status,
          file.additions,
          file.deletions,
          file.patch || ""
        ),
        diff: file.patch || "",
      };
    });

    return {
      pr: {
        number: String(prNumber),
        repository: `${owner}/${repo}`,
        title: prMetadata.title,
        description: prMetadata.body,
        author: prMetadata.user.login,
        labels: prMetadata.labels.map((l) => l.name),
        html_url: prMetadata.html_url,
      },
      files: fileOutputs,
    };
  }

  private async fetchPRMetadata(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<GitHubPR> {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${this.token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`
      );
    }
    return (await response.json()) as GitHubPR;
  }

  private async fetchPRFiles(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<GitHubFile[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${this.token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`
      );
    }
    return (await response.json()) as GitHubFile[];
  }

  private detectLanguage(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: "TypeScript",
      tsx: "TypeScript (JSX)",
      js: "JavaScript",
      jsx: "JavaScript (JSX)",
      py: "Python",
      rb: "Ruby",
      go: "Go",
      java: "Java",
      kt: "Kotlin",
      rs: "Rust",
      c: "C",
      cpp: "C++",
      h: "C Header",
      cs: "C#",
      vb: "Visual Basic",
      php: "PHP",
      swift: "Swift",
      md: "Markdown",
      rst: "reStructuredText",
      json: "JSON",
      yaml: "YAML",
      yml: "YAML",
      xml: "XML",
      toml: "TOML",
      css: "CSS",
      scss: "SCSS",
      less: "Less",
      html: "HTML",
      svg: "SVG",
      sh: "Shell",
      bash: "Bash",
      zsh: "Zsh",
      sql: "SQL",
      graphql: "GraphQL",
      dockerfile: "Dockerfile",
    };
    return ext ? langMap[ext] || ext : "unknown";
  }

  private classifyFile(filename: string): {
    isTest: boolean;
    isDocumentation: boolean;
    isConfig: boolean;
    isPublicAPI: boolean;
  } {
    const parts = filename.split("/");
    const basename = parts[parts.length - 1];
    const ext = basename.split(".").pop()?.toLowerCase();

    const isTest =
      basename.includes(".test.") ||
      basename.includes(".spec.") ||
      basename.includes("-test.") ||
      parts.includes("__tests__") ||
      parts.includes("tests") ||
      parts.includes("test") ||
      basename.startsWith("test_");

    const isDocumentation =
      ext === "md" ||
      ext === "mdx" ||
      ext === "rst" ||
      parts.includes("docs") ||
      parts.includes("documentation") ||
      basename.includes("README") ||
      basename.includes("CHANGELOG") ||
      basename.includes("CONTRIBUTING");

    const isConfig =
      basename === "package.json" ||
      basename === "tsconfig.json" ||
      basename === ".eslintrc" ||
      basename === ".prettierrc" ||
      basename === "webpack.config.js" ||
      basename === "vite.config.ts" ||
      basename.startsWith(".") ||
      ext === "yaml" ||
      ext === "yml" ||
      ext === "toml" ||
      basename === "Dockerfile" ||
      parts.includes("config") ||
      parts.includes("configuration");

    const isPublicAPI =
      !isTest && !isDocumentation && !isConfig &&
      !parts.includes("internal") &&
      !parts.includes("__tests__") &&
      !parts.includes("node_modules");

    return { isTest, isDocumentation, isConfig, isPublicAPI };
  }

  private generateChangeSummary(
    filename: string,
    status: string,
    additions: number,
    deletions: number,
    patch: string
  ): string {
    if (status === "added") return `Novo arquivo adicionado (+${additions} linhas)`;
    if (status === "deleted") return `Arquivo removido (-${deletions} linhas)`;
    if (status === "renamed") return `Arquivo renomeado`;

    const hasTypeChanges =
      patch.includes("type ") ||
      patch.includes("interface ") ||
      patch.includes("class ");
    const hasFunctionChanges =
      patch.includes("function ") ||
      patch.includes("def ") ||
      patch.includes("const ");
    const hasImportChanges =
      patch.includes("\n+import ") || patch.includes("\n-import ");
    const hasExportChanges =
      patch.includes("\n+export ") || patch.includes("\n-export ");

    const changes: string[] = [];
    if (hasTypeChanges) changes.push("tipos/interfaces");
    if (hasFunctionChanges) changes.push("funções/métodos");
    if (hasImportChanges) changes.push("imports");
    if (hasExportChanges) changes.push("exports");

    return changes.length > 0
      ? `Mudanças em: ${changes.join(", ")} (+${additions}/-${deletions})`
      : `Modificações diversas (+${additions}/-${deletions})`;
  }
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
npx vitest run tests/services/GitHubExtractorService.test.ts
```

Expected: PASS — 3 tests passando

- [ ] **Step 5: Commit**

```bash
git add tests/services/GitHubExtractorService.test.ts src/services/GitHubExtractorService.ts
git commit -m "feat: add GitHubExtractorService (promoted from poc-diff-reader)"
```

---

### Task 4: Criar comando `audit` (TDD)

**Files:**
- Create: `src/cli/commands/audit.ts`
- Create: `tests/cli/commands/audit.test.ts`

- [ ] **Step 1: Escrever o teste falho**

```typescript
// tests/cli/commands/audit.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runAudit } from "../../../src/cli/commands/audit";
import * as fs from "fs";

vi.mock("../../../src/services/LLMIntegrationService.js", () => ({
  LLMIntegrationService: vi.fn().mockImplementation(() => ({
    analyzePR: vi.fn().mockResolvedValue({
      repository: "acme/widget",
      pullRequest: {
        id: "123",
        title: "Test PR",
        author: "dev",
        url: "https://github.com/acme/widget/pull/123",
      },
      analysis: {
        status: "Atenção necessária",
        criticality: "Alta",
        requiresDocsUpdate: true,
        detectedChanges: ["src/a.ts (modified)"],
        documentationGaps: ["Gap 1"],
        justification: "Justificativa",
        recommendations: ["Rec 1"],
      },
      llm: {
        provider: "groq",
        model: "llama",
        inputTokens: 100,
        outputTokens: 50,
        estimatedCost: 0,
      },
      routing: { reason: "Standard" },
      createdAt: "2026-01-01T00:00:00Z",
    }),
  })),
}));

vi.mock("../../../src/services/ReportGenerator.js", () => ({
  ReportGenerator: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockReturnValue("# Markdown report"),
  })),
}));

vi.mock("../../../src/services/persistence/AnalysisRepository.js", () => ({
  AnalysisRepository: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue("647a2f...e1b3"),
  })),
}));

vi.mock("../../../src/services/config.js", () => ({
  loadConfig: vi.fn().mockReturnValue({
    geminiApiKey: "gemini-key",
    groqApiKey: "groq-key",
  }),
  getMongoUri: vi.fn().mockReturnValue("mongodb://localhost:27017/test"),
}));

describe("runAudit", () => {
  const writeFileSyncSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});

  beforeEach(() => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("completes audit and prints summary", async () => {
    await runAudit({ diff: "/tmp/corpus.json", docs: "/tmp/docs" });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[Status] Atenção necessária | Criticidade: Alta")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[Gaps] 1 gaps encontrados")
    );
  });

  it("saves markdown file when --output is provided", async () => {
    await runAudit({
      diff: "/tmp/corpus.json",
      docs: "/tmp/docs",
      output: "/tmp/report.md",
    });

    expect(writeFileSyncSpy).toHaveBeenCalledWith(
      "/tmp/report.md",
      "# Markdown report",
      "utf-8"
    );
    expect(console.log).toHaveBeenCalledWith(
      "[Arquivo] Relatório salvo em /tmp/report.md"
    );
  });

  it("persists to MongoDB when MONGODB_URI is set", async () => {
    await runAudit({ diff: "/tmp/corpus.json", docs: "/tmp/docs" });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[MongoDB] Registro salvo com id:")
    );
  });

  it("exits with error when diff file does not exist", async () => {
    vi.spyOn(fs, "existsSync").mockImplementation((p) => p !== "/tmp/corpus.json");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    await runAudit({ diff: "/tmp/corpus.json", docs: "/tmp/docs" });

    expect(console.error).toHaveBeenCalledWith(
      "Arquivo não encontrado: /tmp/corpus.json"
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with error when docs directory does not exist", async () => {
    vi.spyOn(fs, "existsSync").mockImplementation((p) => p !== "/tmp/docs");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    await runAudit({ diff: "/tmp/corpus.json", docs: "/tmp/docs" });

    expect(console.error).toHaveBeenCalledWith(
      "Diretório não encontrado: /tmp/docs"
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
npx vitest run tests/cli/commands/audit.test.ts
```

Expected: FAIL — module not found (`Cannot find module '../../../src/cli/commands/audit'`)

- [ ] **Step 3: Escrever a implementação mínima**

```typescript
// src/cli/commands/audit.ts
import { Command } from "commander";
import * as fs from "fs";
import { LLMIntegrationService } from "../../services/LLMIntegrationService.js";
import { ReportGenerator } from "../../services/ReportGenerator.js";
import { AnalysisRepository } from "../../services/persistence/AnalysisRepository.js";
import { loadConfig, getMongoUri } from "../../services/config.js";

export async function runAudit(options: {
  diff: string;
  docs: string;
  output?: string;
}): Promise<void> {
  if (!fs.existsSync(options.diff)) {
    console.error(`Arquivo não encontrado: ${options.diff}`);
    process.exit(1);
  }
  if (!fs.existsSync(options.docs)) {
    console.error(`Diretório não encontrado: ${options.docs}`);
    process.exit(1);
  }

  const config = loadConfig();
  const service = new LLMIntegrationService(
    config.geminiApiKey,
    config.groqApiKey
  );
  const record = await service.analyzePR(options.diff, options.docs);

  const generator = new ReportGenerator();
  const markdown = generator.generate(record);

  if (options.output) {
    fs.writeFileSync(options.output, markdown, "utf-8");
    console.log(`[Arquivo] Relatório salvo em ${options.output}`);
  }

  const mongoUri = getMongoUri();
  if (mongoUri) {
    try {
      const repo = new AnalysisRepository();
      const id = await repo.save(record);
      console.log(`[MongoDB] Registro salvo com id: ${id}`);
    } catch (e) {
      console.warn(
        "[MongoDB] Falha na persistência:",
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  console.log(`[Status] ${record.analysis.status} | Criticidade: ${record.analysis.criticality}`);
  console.log(`[Gaps] ${record.analysis.documentationGaps.length} gaps encontrados`);
}

export function registerAuditCommand(program: Command): void {
  program
    .command("audit")
    .description("Audita um PR contra a documentação existente")
    .requiredOption("--diff <path>", "Caminho do arquivo pr-corpus.json")
    .requiredOption("--docs <dir>", "Caminho do diretório de documentação")
    .option("--output <path>", "Caminho para salvar o relatório Markdown")
    .action(runAudit);
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
npx vitest run tests/cli/commands/audit.test.ts
```

Expected: PASS — 5 tests passando

- [ ] **Step 5: Commit**

```bash
git add tests/cli/commands/audit.test.ts src/cli/commands/audit.ts
git commit -m "feat: add audit CLI command with --diff, --docs, --output flags"
```

---

### Task 5: Criar comando `history` (TDD)

**Files:**
- Create: `src/cli/commands/history.ts`
- Create: `tests/cli/commands/history.test.ts`

- [ ] **Step 1: Escrever o teste falho**

```typescript
// tests/cli/commands/history.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runHistory } from "../../../src/cli/commands/history";

vi.mock("../../../src/services/persistence/AnalysisRepository.js", () => ({
  AnalysisRepository: vi.fn().mockImplementation(() => ({
    findRecent: vi.fn().mockResolvedValue([
      {
        id: "647a2f8e1b3c4d5e6f7a8b9c",
        repository: "acme/widget",
        pullRequest: {
          id: "42",
          title: "Add auth",
          author: "dev",
          url: "https://github.com/acme/widget/pull/42",
        },
        analysis: {
          status: "Atenção necessária",
          criticality: "Alta",
          requiresDocsUpdate: true,
          detectedChanges: ["src/auth.ts (modified)"],
          documentationGaps: ["Gap 1"],
          justification: "Justificativa",
          recommendations: ["Rec 1"],
        },
        llm: {
          provider: "groq",
          model: "llama",
          inputTokens: 100,
          outputTokens: 50,
          estimatedCost: 0,
        },
        routing: { reason: "Standard" },
        createdAt: "2026-06-05T14:32:01Z",
      },
      {
        id: "647a2f8e1b3c4d5e6f7a8b9d",
        repository: "acme/widget",
        pullRequest: {
          id: "38",
          title: "Fix typo",
          author: "dev",
          url: "https://github.com/acme/widget/pull/38",
        },
        analysis: {
          status: "OK",
          criticality: "Baixa",
          requiresDocsUpdate: false,
          detectedChanges: ["src/utils.ts (modified)"],
          documentationGaps: [],
          justification: "Justificativa",
          recommendations: ["Nenhuma ação necessária."],
        },
        llm: {
          provider: "gemini",
          model: "gemini-2.5-flash",
          inputTokens: 200,
          outputTokens: 30,
          estimatedCost: 0,
        },
        routing: { reason: "Security" },
        createdAt: "2026-06-04T09:15:22Z",
      },
    ]),
  })),
}));

vi.mock("../../../src/services/config.js", () => ({
  getMongoUri: vi.fn().mockReturnValue("mongodb://localhost:27017/test"),
}));

describe("runHistory", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints a table with recent audit records", async () => {
    await runHistory({ limit: "10" });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("ID")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("647a2f8e1b3c4d5e6f7a8b9c")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Alta")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Baixa")
    );
  });

  it("exits with error when MONGODB_URI is not configured", async () => {
    const { getMongoUri } = await import("../../../src/services/config.js");
    vi.mocked(getMongoUri as any).mockReturnValueOnce(undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    await runHistory({ limit: "10" });

    expect(console.error).toHaveBeenCalledWith(
      "MONGODB_URI não configurado. Configure para usar --history."
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
npx vitest run tests/cli/commands/history.test.ts
```

Expected: FAIL — module not found (`Cannot find module '../../../src/cli/commands/history'`)

- [ ] **Step 3: Escrever a implementação mínima**

```typescript
// src/cli/commands/history.ts
import { Command } from "commander";
import { AnalysisRepository } from "../../services/persistence/AnalysisRepository.js";
import { getMongoUri } from "../../services/config.js";

export async function runHistory(options: {
  limit: string;
}): Promise<void> {
  const mongoUri = getMongoUri();
  if (!mongoUri) {
    console.error("MONGODB_URI não configurado. Configure para usar --history.");
    process.exit(1);
  }

  const limit = parseInt(options.limit, 10);
  const repo = new AnalysisRepository();
  const records = await repo.findRecent(limit);

  if (records.length === 0) {
    console.log("Nenhuma auditoria encontrada.");
    return;
  }

  console.log("ID                  | PR    | Repo              | Data                | Criticidade");
  console.log("--------------------|-------|-------------------|---------------------|------------");

  for (const r of records) {
    const id = r.id || "???";
    const prId = `#${r.pullRequest.id}`;
    const repoName = r.repository;
    const date = r.createdAt.replace("T", " ").slice(0, 19);
    const crit = r.analysis.criticality;
    console.log(`${id.padEnd(20)}| ${prId.padEnd(6)}| ${repoName.padEnd(18)}| ${date.padEnd(20)}| ${crit}`);
  }
}

export function registerHistoryCommand(program: Command): void {
  program
    .command("history")
    .description("Lista o histórico de auditorias persistidas")
    .option("--limit <number>", "Número máximo de registros", "10")
    .action(runHistory);
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
npx vitest run tests/cli/commands/history.test.ts
```

Expected: PASS — 2 tests passando

- [ ] **Step 5: Commit**

```bash
git add tests/cli/commands/history.test.ts src/cli/commands/history.ts
git commit -m "feat: add history CLI command with --limit flag"
```

---

### Task 6: Criar comando `fetch` (TDD)

**Files:**
- Create: `src/cli/commands/fetch.ts`
- Create: `tests/cli/commands/fetch.test.ts`

- [ ] **Step 1: Escrever o teste falho**

```typescript
// tests/cli/commands/fetch.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runFetch } from "../../../src/cli/commands/fetch";
import * as fs from "fs";

vi.mock("../../../src/services/GitHubExtractorService.js", () => ({
  GitHubExtractorService: vi.fn().mockImplementation(() => ({
    extract: vi.fn().mockResolvedValue({
      pr: {
        number: "42",
        repository: "acme/widget",
        title: "Add feature",
        description: "A test PR",
        author: "dev",
        labels: [],
        html_url: "https://github.com/acme/widget/pull/42",
      },
      files: [
        {
          path: "src/index.ts",
          status: "modified",
          additions: 10,
          deletions: 2,
          language: "TypeScript",
          isPublicAPI: true,
          isTest: false,
          isDocumentation: false,
          isConfig: false,
          changeSummary: "Mudanças em: funções/métodos (+10/-2)",
          diff: "+new code",
        },
      ],
    }),
  })),
}));

describe("runFetch", () => {
  const writeFileSyncSpy = vi
    .spyOn(fs, "writeFileSync")
    .mockImplementation(() => {});
  const mkdirSyncSpy = vi.spyOn(fs, "mkdirSync").mockImplementation(() => {});

  beforeEach(() => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts PR and saves corpus JSON to the output path", async () => {
    await runFetch("acme", "widget", "42", { output: "/tmp/pr-corpus.json" });

    expect(writeFileSyncSpy).toHaveBeenCalledWith(
      "/tmp/pr-corpus.json",
      expect.stringContaining('"repository":"acme/widget"'),
      "utf-8"
    );
    expect(console.log).toHaveBeenCalledWith(
      "✅ Corpus salvo em: /tmp/pr-corpus.json"
    );
  });

  it("exits with error when GITHUB_TOKEN is missing", async () => {
    const oldToken = process.env.GITHUB_TOKEN;
    delete (process.env as any).GITHUB_TOKEN;
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);

    await runFetch("acme", "widget", "42", { output: "/tmp/pr-corpus.json" });

    expect(console.error).toHaveBeenCalledWith(
      "GITHUB_TOKEN não configurado. Configure a variável de ambiente."
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    if (oldToken) process.env.GITHUB_TOKEN = oldToken;
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
npx vitest run tests/cli/commands/fetch.test.ts
```

Expected: FAIL — module not found (`Cannot find module '../../../src/cli/commands/fetch'`)

- [ ] **Step 3: Escrever a implementação mínima**

```typescript
// src/cli/commands/fetch.ts
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { GitHubExtractorService } from "../../services/GitHubExtractorService.js";

export async function runFetch(
  owner: string,
  repo: string,
  prNumber: string,
  options: { output: string }
): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN não configurado. Configure a variável de ambiente.");
    process.exit(1);
  }

  const service = new GitHubExtractorService(token);
  const corpus = await service.extract(owner, repo, parseInt(prNumber, 10));

  const outputDir = path.dirname(options.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    options.output,
    JSON.stringify(corpus, null, 2),
    "utf-8"
  );

  console.log(`✅ Corpus salvo em: ${options.output}`);
}

export function registerFetchCommand(program: Command): void {
  program
    .command("fetch <owner> <repo> <prNumber>")
    .description("Extrai dados de um PR do GitHub para um arquivo corpus")
    .option("--output <path>", "Caminho de saída do corpus", "./output/pr-corpus.json")
    .action(runFetch);
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
npx vitest run tests/cli/commands/fetch.test.ts
```

Expected: PASS — 2 tests passando

- [ ] **Step 5: Commit**

```bash
git add tests/cli/commands/fetch.test.ts src/cli/commands/fetch.ts
git commit -m "feat: add fetch CLI command for GitHub PR extraction"
```

---

### Task 7: Criar comando `fetch-and-audit`

**Files:**
- Create: `src/cli/commands/fetch-and-audit.ts`

- [ ] **Step 1: Escrever a implementação**

```typescript
// src/cli/commands/fetch-and-audit.ts
import { Command } from "commander";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { GitHubExtractorService } from "../../services/GitHubExtractorService.js";
import { LLMIntegrationService } from "../../services/LLMIntegrationService.js";
import { ReportGenerator } from "../../services/ReportGenerator.js";
import { AnalysisRepository } from "../../services/persistence/AnalysisRepository.js";
import { loadConfig, getMongoUri } from "../../services/config.js";

export async function runFetchAndAudit(
  owner: string,
  repo: string,
  prNumber: string,
  options: { docs: string; output?: string; keepCorpus?: boolean }
): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN não configurado. Configure a variável de ambiente.");
    process.exit(1);
  }

  if (!fs.existsSync(options.docs)) {
    console.error(`Diretório não encontrado: ${options.docs}`);
    process.exit(1);
  }

  const corpusPath = options.keepCorpus
    ? path.join(process.cwd(), "output", `pr-${prNumber}-${owner}-${repo}-corpus.json`)
    : path.join(os.tmpdir(), `pr-${prNumber}-${owner}-${repo}-corpus.json`);

  const corpusDir = path.dirname(corpusPath);
  if (!fs.existsSync(corpusDir)) {
    fs.mkdirSync(corpusDir, { recursive: true });
  }

  // Fetch
  const extractor = new GitHubExtractorService(token);
  const corpus = await extractor.extract(owner, repo, parseInt(prNumber, 10));
  fs.writeFileSync(corpusPath, JSON.stringify(corpus, null, 2), "utf-8");

  // Audit
  const config = loadConfig();
  const llmService = new LLMIntegrationService(config.geminiApiKey, config.groqApiKey);
  const record = await llmService.analyzePR(corpusPath, options.docs);

  // Report
  const generator = new ReportGenerator();
  const markdown = generator.generate(record);

  if (options.output) {
    fs.writeFileSync(options.output, markdown, "utf-8");
    console.log(`[Arquivo] Relatório salvo em ${options.output}`);
  }

  // Persist
  const mongoUri = getMongoUri();
  if (mongoUri) {
    try {
      const repo = new AnalysisRepository();
      const id = await repo.save(record);
      console.log(`[MongoDB] Registro salvo com id: ${id}`);
    } catch (e) {
      console.warn(
        "[MongoDB] Falha na persistência:",
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  // Cleanup
  if (!options.keepCorpus && fs.existsSync(corpusPath)) {
    fs.unlinkSync(corpusPath);
  }

  // Summary
  console.log(`[Status] ${record.analysis.status} | Criticidade: ${record.analysis.criticality}`);
  console.log(`[Gaps] ${record.analysis.documentationGaps.length} gaps encontrados`);
}

export function registerFetchAndAuditCommand(program: Command): void {
  program
    .command("fetch-and-audit <owner> <repo> <prNumber>")
    .description("Extrai um PR do GitHub e executa auditoria em um passo")
    .requiredOption("--docs <dir>", "Caminho do diretório de documentação")
    .option("--output <path>", "Caminho para salvar o relatório Markdown")
    .option("--keep-corpus", "Mantém o arquivo corpus gerado em ./output/")
    .action(runFetchAndAudit);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/commands/fetch-and-audit.ts
git commit -m "feat: add fetch-and-audit pipeline command"
```

---

### Task 8: Criar `src/cli/parser.ts`

**Files:**
- Create: `src/cli/parser.ts`

- [ ] **Step 1: Escrever o parser**

```typescript
// src/cli/parser.ts
import { Command } from "commander";
import { registerAuditCommand } from "./commands/audit.js";
import { registerHistoryCommand } from "./commands/history.js";
import { registerFetchCommand } from "./commands/fetch.js";
import { registerFetchAndAuditCommand } from "./commands/fetch-and-audit.js";

export function createCLI(): Command {
  const program = new Command();
  program
    .name("pr-auditor")
    .description("Auditoria automatizada de Pull Requests via CLI")
    .version("0.2.0");

  registerAuditCommand(program);
  registerHistoryCommand(program);
  registerFetchCommand(program);
  registerFetchAndAuditCommand(program);

  return program;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/parser.ts
git commit -m "feat: add CLI parser with commander registry"
```

---

### Task 9: Refatorar `src/index.ts` para thin dispatcher

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Substituir o conteúdo de `index.ts`**

```typescript
// src/index.ts
import * as dotenv from "dotenv";
dotenv.config();

import { createCLI } from "./cli/parser.js";

createCLI().parse();
```

- [ ] **Step 2: Verificar que o build não quebra**

```bash
npm run build
```

Expected: `tsc` compila sem erros (pode haver warnings, mas nenhum erro).

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "refactor: index.ts becomes thin commander dispatcher"
```

---

### Task 10: Atualizar `package.json` (scripts, versão, dependência)

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Atualizar versão, dependências e scripts**

Substituir o conteúdo do `package.json` por:

```json
{
  "name": "pr-documentation-auditor",
  "version": "0.2.0",
  "description": "Ferramenta de auditoria automatizada de documentação em PRs com IA",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "audit": "tsx src/index.ts audit --diff ./output/pr-corpus.json --docs ./docs",
    "fetch": "tsx src/index.ts fetch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "keywords": [
    "github",
    "pr",
    "documentation",
    "ai",
    "llm",
    "audit"
  ],
  "author": "Guilherme Pereira",
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@vitest/coverage-v8": "^4.1.7",
    "mongodb-memory-server": "^11.2.0",
    "ts-node": "^10.9.1",
    "tsx": "^4.22.4",
    "typescript": "^5.4.5",
    "vitest": "^4.1.7"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "dotenv": "^16.3.1",
    "mongoose": "^9.6.3"
  },
  "mongodbMemoryServer": {
    "version": "7.0.20",
    "downloadDir": "./.mongodb-binaries"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: update package.json v0.2.0, add commander, update scripts"
```

---

### Task 11: Remover `apps/poc-diff-reader/`

**Files:**
- Remove: `apps/poc-diff-reader/`

- [ ] **Step 1: Remover o diretório e commit**

```bash
rm -rf apps/poc-diff-reader
git add -A
git commit -m "chore: remove poc-diff-reader (migrated to GitHubExtractorService)"
```

---

### Task 12: Validação final — build e testes

**Files:**
- Nenhum novo arquivo (validação)

- [ ] **Step 1: Executar build completo**

```bash
npm run build
```

Expected: Saída limpa sem erros de compilação TypeScript.

- [ ] **Step 2: Executar suite de testes**

```bash
npm test
```

Expected: Todos os testes existentes + novos passam. Se algum teste existente quebrar (porque `index.ts` mudou), ajustar o teste conforme necessário.

- [ ] **Step 3: Checklist de testes manuais**

Executar os comandos localmente (com variáveis de ambiente configuradas):

```bash
# RF-007 — CLI com flags
npm run dev audit -- --diff ./output/pr-corpus.json --docs ./docs --output ./relatorio.md
# Esperado: resumo no terminal + arquivo ./relatorio.md gerado

# RF-005 — Verificar conteúdo do relatório
cat ./relatorio.md
# Esperado: # Status, ## Criticidade, ## Mudanças Identificadas,
#           ## Gaps Documentais Encontrados, ## Recomendação

# RF-008 — Histórico
npm run dev history -- --limit 5
# Esperado: tabela com colunas ID, PR, Repo, Data, Criticidade

# Fetch (extrator promovido)
npm run dev fetch -- facebook react 27534 --output ./output/pr-corpus.json
# Esperado: "✅ Corpus salvo em: ./output/pr-corpus.json"

# Fetch-and-audit (pipeline)
npm run dev fetch-and-audit -- facebook react 27534 --docs ./docs --output ./relatorio.md
# Esperado: extração + auditoria em sequência, resumo no terminal
```

- [ ] **Step 4: Commit (se houver ajustes)**

```bash
git add -A
git commit -m "fix: adjust tests and types after CLI refactor"
```

---

### Task 13: Atualizar `README.MD`

**Files:**
- Modify: `README.MD`

- [ ] **Step 1: Atualizar a seção "Instalação e Execução"**

Substituir a seção de uso atual (aproximadamente linhas 48-70) por:

```markdown
## Instalação e Execução

```bash
# 1. Entrar no repositório
cd Project-tasi6

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# edite .env com suas chaves (GITHUB_TOKEN, GROQ_API_KEY, GEMINI_API_KEY, MONGODB_URI)

# 4. Extrair os dados de um PR (comando `fetch`)
npm run dev fetch -- <owner> <repo> <pr-number> [--output <caminho>]
# ex.: npm run dev fetch -- facebook react 27534

# 5. Auditar o corpus extraído (comando `audit`)
npm run dev audit -- --diff <corpus> --docs <docs-dir> [--output <relatorio.md>]
# ex.: npm run dev audit -- --diff ./output/pr-corpus.json --docs ./docs --output ./relatorio.md

# 6. Pipeline completo: extrair + auditar em um comando (fetch-and-audit)
npm run dev fetch-and-audit -- <owner> <repo> <pr-number> --docs <docs-dir> [--output <relatorio.md>]
# ex.: npm run dev fetch-and-audit -- facebook react 27534 --docs ./docs --output ./relatorio.md

# 7. Consultar histórico de auditorias persistidas (comando `history`)
npm run dev history -- [--limit N]
```

- [ ] **Step 2: Atualizar a seção "Limitações conhecidas"**

Marcar como resolvidos:
- ❌ ~~Sem parsing de argumentos robusto~~ → Resolvido (commander)
- ❌ ~~Sem geração de relatório~~ → Resolvido (ReportGenerator)
- ❌ ~~Sem persistência~~ → Parcialmente resolvido (MongoDB implementado, histórico via CLI)

- [ ] **Step 3: Commit**

```bash
git add README.MD
git commit -m "docs: update README with new CLI commands and flags"
```

---

## Self-Review

### 1. Spec coverage

| Requisito do Spec | Task que implementa |
|---|---|
| RF-005 — Relatório Markdown com 5 seções | Task 2 (ReportGenerator) + Task 4 (audit `--output`) |
| RF-007 — CLI com flags `--diff`, `--docs`, `--output` | Task 4 (audit command) |
| RF-007 — CLI com flag `--history` | Task 5 (history command) |
| RF-008 — Comando `history` com `--limit` | Task 5 (history command) |
| Promoção do `poc-diff-reader` para serviço | Task 3 (GitHubExtractorService) + Task 6 (fetch command) + Task 7 (fetch-and-audit) |
| Arquitetura de comandos com `commander` | Task 8 (parser) + Task 9 (index.ts dispatcher) |
| Tratamento de erros robusto | Todas as tasks (validações em cada comando) |
| Testes unitários | Tasks 2, 3, 4, 5, 6 |
| Atualização de scripts | Task 10 |

**Gap encontrado:** Nenhum. Todos os requisitos do spec estão cobertos.

### 2. Placeholder scan

- [x] Nenhum "TBD", "TODO", "implement later", "fill in details"
- [x] Nenhum "Add appropriate error handling" sem código
- [x] Nenhum "Write tests for the above" sem código de teste
- [x] Nenhum "Similar to Task N" sem código repetido
- [x] Cada step com código mostra o código completo

### 3. Type consistency

- [x] `AnalysisRecord` tem `id?: string` (Task 1) → usado em `history.ts` (Task 5) e `findRecent`/`findById` (Task 1)
- [x] `ReportGenerator.generate(record: AnalysisRecord)` → usado em `audit.ts` (Task 4) e `fetch-and-audit.ts` (Task 7)
- [x] `GitHubExtractorService.extract()` retorna `PRCorpus` → usado em `fetch.ts` (Task 6) e `fetch-and-audit.ts` (Task 7)
- [x] `runAudit`, `runHistory`, `runFetch`, `runFetchAndAudit` — todos exportados para testes
- [x] Nomes de métodos e flags consistentes entre design doc e plano

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-05-cli-commands-markdown-history.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for parallelizing independent tasks and keeping context clean.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Best if you want to see progress in real time and make on-the-fly decisions.

Which approach do you prefer?