# Refinamento da Contenção de Alucinação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mitigar dois efeitos colaterais do MVP de contenção de alucinação (floor inflando Crítica em PRs só-doc sensíveis; grounding descartando silenciosamente gaps úteis da LLM) preservando o RNF-003, via gate `!isDocumentation` no floor, exposição dos gaps rejeitados sob selo `[NÃO ANCORADO]`, e unificação das duas listas de padrões sensíveis hoje divergentes.

**Architecture:** Novo helper puro `src/utils/securityPatterns.ts` (fonte única de verdade consumida por routing e floor). `assembleRecord` ganha gate `!isDocumentation` no cálculo de `securityFloorTriggered` e povoa novo campo `analysis.untrackedGaps: string[]` com gaps rejeitados prefixados. `ReportGenerator` renderiza seção condicional `## Gaps não verificados` + nota explicativa. `routing.context` intocado; routing continua em Gemini para docs sensíveis (revisão cuidadosa sem inflar criticidade).

**Tech Stack:** TypeScript, Vitest, Mongoose (schema delta), tsx. Padrões existentes: `src/utils/grounding.ts` (helper puro + suite isolada), `tests/fixtures.ts` (`file()`, `makeCorpus()`).

**Spec de referência:** `docs/superpowers/specs/2026-06-30-contencao-alucinacao-refinamento-design.md`

---

## File Structure

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/utils/securityPatterns.ts` | Criar | Helper puro `matchesSecurityPattern(path): boolean` — lista única de padrões sensíveis |
| `tests/utils/securityPatterns.test.ts` | Criar | Cobertura 100% do helper |
| `src/services/types.ts` | Modificar (linha ~80) | Adicionar `analysis.untrackedGaps?: string[]` |
| `src/services/persistence/AnalysisRepository.ts` | Modificar (linha ~36) | Schema Mongoose ganha `untrackedGaps: { type: [String], default: [] }` |
| `src/services/LLMIntegrationService.ts` | Modificar (~335-409, ~111-209) | `calculateRoutingDecision` usa helper; `assembleRecord` refina floor com gate `!isDocumentation` e povoa `untrackedGaps` |
| `tests/record.test.ts` | Modificar | Novos casos: só-doc sensível (C), misto código+doc (B), reproduce chalk (D), caminho feliz com rejeitado |
| `src/services/ReportGenerator.ts` | Modificar (após linha 31) | Seção condicional `## Gaps não verificados` + nota explicativa |
| `tests/services/ReportGenerator.test.ts` | Modificar | Casos: renderiza seção quando não-vazio; omite quando vazio/undefined |
| `docs/CONTENCAO_ALUCINACAO.md` | Modificar | Adicionar §2.4; atualizar §5 |

---

## Task 1: Helper `securityPatterns.ts`

**Files:**
- Create: `src/utils/securityPatterns.ts`
- Test: `tests/utils/securityPatterns.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/utils/securityPatterns.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { matchesSecurityPattern } from "../../src/utils/securityPatterns";

describe("matchesSecurityPattern", () => {
  it("casa path de código auth", () => {
    expect(matchesSecurityPattern("src/auth/middleware.ts")).toBe(true);
  });

  it("casa .env (rota Gemini)", () => {
    expect(matchesSecurityPattern(".env.production")).toBe(true);
  });

  it("casa workflow de CI/CD", () => {
    expect(matchesSecurityPattern(".github/workflows/deploy.yml")).toBe(true);
  });

  it("casa Dockerfile", () => {
    expect(matchesSecurityPattern("Dockerfile")).toBe(true);
  });

  it("casa k8s/deployment.yaml", () => {
    expect(matchesSecurityPattern("k8s/deployment.yaml")).toBe(true);
  });

  it("casa infra/main.tf (terraform)", () => {
    expect(matchesSecurityPattern("infra/main.tf")).toBe(true);
  });

  it("casa src/auth/token.ts", () => {
    expect(matchesSecurityPattern("src/auth/token.ts")).toBe(true);
  });

  it("casa api_key.json", () => {
    expect(matchesSecurityPattern("api_key.json")).toBe(true);
  });

  it("NÃO é responsável por gate de documentação: casa docs/guides/refresh-token-rotation.mdx", () => {
    // Helper não aplica gate !isDocumentation; gate é responsabilidade do chamador.
    // Esta asserção documenta o contrato: o helper casa docs sensíveis também,
    // e o gate é aplicado pelo assembleRecord (ver tests/record.test.ts caso C).
    expect(matchesSecurityPattern("docs/guides/refresh-token-rotation.mdx")).toBe(true);
  });

  it("NÃO casa código comum", () => {
    expect(matchesSecurityPattern("src/utils/format.ts")).toBe(false);
  });

  it("NÃO casa README.md", () => {
    expect(matchesSecurityPattern("README.md")).toBe(false);
  });

  it("é case-insensitive", () => {
    expect(matchesSecurityPattern("SRC/AUTH/MIDDLEWARE.TS")).toBe(true);
  });

  it("casa docker-compose.yml", () => {
    expect(matchesSecurityPattern("docker-compose.yml")).toBe(true);
  });

  it("casa docker_compose.yml", () => {
    expect(matchesSecurityPattern("docker_compose.yml")).toBe(true);
  });

  it("cama cloudformation.yaml", () => {
    expect(matchesSecurityPattern("cloudformation.yaml")).toBe(true);
  });

  it("casa aoi/cloudformation-trigger.ts", () => {
    expect(matchesSecurityPattern("src/cloudformation-trigger.ts")).toBe(true);
  });

  it("casa path com ssl/certificate", () => {
    expect(matchesSecurityPattern("certs/ssl/server.crt")).toBe(true);
  });

  it("casa path com crypto", () => {
    expect(matchesSecurityPattern("src/utils/crypto.ts")).toBe(true);
  });

  it("casa path com credential", () => {
    expect(matchesSecurityPattern("config/credentials.json")).toBe(true);
  });

  it("casa path com password", () => {
    expect(matchesSecurityPattern("src/password-reset.ts")).toBe(true);
  });

  it("casa path com secret", () => {
    expect(matchesSecurityPattern("secrets/api.txt")).toBe(true);
  });

  it("casa path com gcp (nuvem)", () => {
    expect(matchesSecurityPattern("deploy/gcp/main.tf")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/utils/securityPatterns.test.ts`
Expected: FAIL with "Failed to resolve import" ou "matchesSecurityPattern is not a function" (módulo ainda não existe).

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/securityPatterns.ts`:

```typescript
/**
 * Fonte única de verdade para padrões de arquivo sensível (RNF-003).
 * Consumido por `calculateRoutingDecision` (routing ADR-005) e por
 * `assembleRecord` (Medida #1 floor).
 *
 * União das listas hoje divergentes em LLMIntegrationService.ts
 * (securityPatterns vs. SENSITIVE_FILE_RE). O gate `!isDocumentation`
 * é aplicado pelo chamador (assembleRecord), não por este helper.
 *
 * Ordem alfabética para legibilidade.
 */
const SENSITIVE_PATTERNS: readonly RegExp[] = [
  /api[_-]?key/i,
  /auth/i,
  /aws|gcp|azure/i,
  /certificate/i,
  /cloudformation/i,
  /credential/i,
  /crypto/i,
  /\.env/i,
  /\.github[/\\]workflows/i,
  /docker[-_]?compose/i,
  /dockerfile/i,
  /infrastructure/i,
  /infra/i,
  /k8s/i,
  /kubernetes/i,
  /password/i,
  /secret/i,
  /ssl|tls/i,
  /terraform/i,
  /token/i,
] as const;

/**
 * Testa se o caminho do arquivo casa qualquer padrão sensível.
 * Case-insensitive (todas as regexes carregam flag /i).
 * Não recebe FileMetadata — opera só sobre o path (string);
 * o gate `!isDocumentation` é responsabilidade do chamador.
 */
export function matchesSecurityPattern(filePath: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(filePath));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/utils/securityPatterns.test.ts`
Expected: PASS — todos os ~22 casos passam.

- [ ] **Step 5: Commit**

```bash
git add src/utils/securityPatterns.ts tests/utils/securityPatterns.test.ts
git commit -m "feat(contencao): add matchesSecurityPattern helper unifying sensitive patterns"
```

---

## Task 2: Contrato `AnalysisRecord.untrackedGaps`

**Files:**
- Modify: `src/services/types.ts` (~linha 80, dentro de `analysis`)
- Modify: `src/services/persistence/AnalysisRepository.ts` (linha 36, dentro de `analysis` schema)

- [ ] **Step 1: Adicionar campo opcional em `types.ts`**

Em `src/services/types.ts`, localize o bloco `analysis` dentro de `AnalysisRecord` (atual linhas 75-84). Ele já tem `documentationGaps: string[]` e `parseFailure?: boolean`. Adicione `untrackedGaps?: string[]` **após** `documentationGaps`, **antes** de `justification`:

```typescript
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
    status: "Atenção necessária" | "OK" | "Inconclusiva";
    criticality: AuditResult["criticidade"];
    requiresDocsUpdate: boolean;
    detectedChanges: string[];
    documentationGaps: string[];
    untrackedGaps?: string[];          // ← NOVO: gaps rejeitados pelo grounding, prefixados "[NÃO ANCORADO] "
    justification: string;
    recommendations: string[];
    parseFailure?: boolean;
  };
  llm: {
    provider: "groq" | "gemini";
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
  };
  routing: {
    reason: string;
  };
  createdAt: string;
}
```

- [ ] **Step 2: Atualizar schema Mongoose em `AnalysisRepository.ts`**

Em `src/services/persistence/AnalysisRepository.ts`, dentro do objeto `analysis` do `AnalysisSchema` (atual linhas 23-40), adicione `untrackedGaps` **logo abaixo** de `documentationGaps` (linha 36):

```typescript
    analysis: {
      status: {
        type: String,
        enum: ["Atenção necessária", "OK", "Inconclusiva"],
        required: true,
      },
      criticality: {
        type: String,
        enum: ["Baixa", "Média", "Alta", "Crítica"],
        required: true,
      },
      requiresDocsUpdate: { type: Boolean, required: true },
      detectedChanges: { type: [String], required: true },
      documentationGaps: { type: [String], required: true },
      untrackedGaps: { type: [String], default: [] },   // ← NOVO
      justification: { type: String, required: true },
      recommendations: { type: [String], required: true },
      parseFailure: { type: Boolean, default: false },
    },
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: PASS sem erros de tipo. (TypeScript aceita campo opcional novo; schema Mongoose só estende.)

- [ ] **Step 4: Commit**

```bash
git add src/services/types.ts src/services/persistence/AnalysisRepository.ts
git commit -m "feat(contencao): add AnalysisRecord.untrackedGaps optional field + Mongoose schema"
```

---

## Task 3: `calculateRoutingDecision` usa helper compartilhado

**Files:**
- Modify: `src/services/LLMIntegrationService.ts` (~linhas 13, 355-393)
- Test: `tests/routing.test.ts` (executar — deve permanecer verde sem edição)

- [ ] **Step 1: Adicionar import do helper**

No topo de `src/services/LLMIntegrationService.ts`, após o import de `validateGapsGrounding` (linha 13), adicione:

```typescript
import { matchesSecurityPattern } from "../utils/securityPatterns.js";
```

- [ ] **Step 2: Substituir array local `securityPatterns` por chamada ao helper**

Em `src/services/LLMIntegrationService.ts`, localize `calculateRoutingDecision` (atual linhas 335-409). Substitua o bloco que define `securityPatterns` e o `forEach` que o aplica (atual linhas 355-393) por:

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

    // Detect sensitive file patterns (ADR-005 routing) — uses shared helper.
    // Gate !isDocumentation NÃO se aplica aqui: routing continua em Gemini
    // para docs sensíveis (revisão cuidadosa mantida). O gate fica no floor
    // (assembleRecord), onde a criticidade é decidida.
    corpus.files.forEach((file) => {
      const filePath = file.path.toLowerCase();

      if (filePath.includes(".env")) {
        decision.context.hasEnvChanges = true;
      } else if (filePath.includes("auth")) {
        decision.context.hasAuthChanges = true;
      } else if (filePath.includes(".github/workflows")) {
        decision.context.hasCICDChanges = true;
      }

      if (matchesSecurityPattern(filePath)) {
        decision.context.hasSecurityChanges = true;
      }
    });

    if (decision.context.hasSecurityChanges) {
      decision.provider = "gemini";
      decision.reason =
        "Security-sensitive files detected (auth, env, secrets, infra, CI/CD)";
    } else if (totalDiffSize > DIFF_SIZE_THRESHOLD) {
      decision.provider = "gemini";
      decision.reason = `Large diff (${totalDiffSize} tokens) requires Gemini's larger context`;
    } else {
      decision.provider = "groq";
      decision.reason = "Standard path: fast & cost-effective";
    }

    return decision;
  }
```

- [ ] **Step 3: Rodar testes de routing (devem permanecer verdes — união só agrega)**

Run: `npx vitest run tests/routing.test.ts`
Expected: PASS — todos os 7 casos existentes passam. Nenhum path de teste atual (`src/services/widget.ts`, `.env.production`, `src/auth/login.ts`, `.github/workflows/deploy.yml`, `Dockerfile`, `infra/main.tf`, `k8s/deployment.yaml`, `src/generated/data.ts`, `README.md`, `src/utils/format.ts`, `src/a.ts`) deixa de casar ou passa a casar indevidamente.

- [ ] **Step 4: Rodar testes de record (devem permanecer verdes — routing não afeta ramos felizes parseFailure/grounding sem floor)**

Run: `npx vitest run tests/record.test.ts`
Expected: PASS — todos os casos existentes (caminho feliz, #1 floor com `src/auth/middleware.ts`, #2 grounding Inconclusiva Alta, #3 fail-closed) continuam passando. A unificação das listas não remove nenhum match (só agrega), e o gate `!isDocumentation` ainda não foi aplicado (vai na próxima task).

- [ ] **Step 5: Commit**

```bash
git add src/services/LLMIntegrationService.ts
git commit -m "refactor(contencao): calculateRoutingDecision uses matchesSecurityPattern helper"
```

---

## Task 4: `assembleRecord` — floor gated por `!isDocumentation` + `untrackedGaps`

**Files:**
- Modify: `src/services/LLMIntegrationService.ts` (~linhas 111-210)
- Modify: `tests/record.test.ts` (adicionar novos casos)

- [ ] **Step 1: Escrever testes novos primeiro (TDD)**

No final de `tests/record.test.ts`, dentro do `describe("assembleRecord — contenção de alucinação (3 camadas)")`, adicione os quatro novos casos abaixo. (Os casos existentes — caminho feliz, #1 floor, #2 grounding, #3 fail-closed — permanecem inalterados.)

```typescript
  it("#1 floor (refinado): PR só-doc sensível (.mdx) NÃO força Crítica — segue análise LLM", () => {
    // Reproduce sintoma B (next-auth #13396): PR edita só docs/guides/refresh-token-rotation.mdx
    const docFile: FileMetadata = {
      path: "docs/guides/refresh-token-rotation.mdx",
      status: "modified",
      additions: 3,
      deletions: 1,
      language: "Markdown",
      isPublicAPI: false,
      isTest: false,
      isDocumentation: true,   // ← gate aplica aqui
      isConfig: false,
      changeSummary: "Fix TypeScript type in refresh token rotation example",
      diff: "-const token = ...\n+const token: string = ...",
    };
    const record = callAssembleRecord(
      [docFile],
      routingSecurity(),   // routing continua Gemini — revisão cuidadosa
      {
        requires_docs_update: false,   // LLM julga "fora de escopo"
        criticidade: "Média",
        gaps: ["refresh-token-rotation.mdx carece de review de exemplo"],
        justificativa: "PR corrige tipo em exemplo de docs — fora de escopo do D3",
      }
    );
    expect(record.analysis.status).toBe("OK");           // ← ALÍVIO do sintoma B
    expect(record.analysis.criticality).toBe("Média");   // segue a LLM
    expect(record.analysis.requiresDocsUpdate).toBe(false);
    expect(
      record.analysis.documentationGaps.some((g) =>
        g.startsWith("[DETERMINÍSTICO]")
      )
    ).toBe(false);   // floor não disparou
    expect(
      record.analysis.justification.includes("floor determinístico (RNF-003)")
    ).toBe(false);   // justificativa preserva origem LLM
    expect(record.analysis.untrackedGaps ?? []).toEqual([]);   // gap ancorou
  });

  it("#1 floor (refinado): PR misto (docs/auth.md + src/auth/middleware.ts) dispara floor pelo código", () => {
    const docFile: FileMetadata = {
      path: "docs/auth.md",
      status: "modified",
      additions: 5,
      deletions: 1,
      language: "Markdown",
      isPublicAPI: false,
      isTest: false,
      isDocumentation: true,
      isConfig: false,
      changeSummary: "Atualiza doc de auth",
      diff: "+descrição de token rotation",
    };
    const codeFile: FileMetadata = {
      path: "src/auth/middleware.ts",
      status: "modified",
      additions: 10,
      deletions: 2,
      language: "TypeScript",
      isPublicAPI: true,
      isTest: false,
      isDocumentation: false,   // ← floor dispara por este arquivo
      isConfig: false,
      changeSummary: "Modifica middleware de auth",
      diff: "+export function verifyToken() { ... }",
    };
    const record = callAssembleRecord(
      [docFile, codeFile],
      routingSecurity(),
      {
        requires_docs_update: false,
        criticidade: "Média",
        gaps: ["middleware.ts carece de docs"],
        justificativa: "LLM disse ok",
      }
    );
    expect(record.analysis.status).toBe("Atenção necessária");
    expect(record.analysis.criticality).toBe("Crítica");   // floor dispara
    expect(record.analysis.requiresDocsUpdate).toBe(true);
    // Gap determinístico menciona src/auth/middleware.ts (não-doc), NÃO menciona docs/auth.md
    const detGap = record.analysis.documentationGaps.find((g) =>
      g.startsWith("[DETERMINÍSTICO]")
    );
    expect(detGap).toBeDefined();
    expect(detGap!).toContain("src/auth/middleware.ts");
    expect(detGap!).not.toContain("docs/auth.md");
  });

  it("#2 grounding (refinado): reproduz chalk #642 — gaps por paráfrase viram untrackedGaps visíveis", () => {
    // Reproduce sintoma A (chalk #642): LLM fala do bug do navigator sem citar browser.js
    const record = callAssembleRecord(
      [file("source/vendor/supports-color/browser.js")],
      routingStandard(),
      {
        requires_docs_update: true,
        criticidade: "Alta",
        gaps: [
          "a mudança do navigator pode afetar compatibilidade em diferentes ambientes de execução",
        ],
        justificativa:
          "A mudança introduzida para resolver o problema do `navigator` não definido pode afetar a compatibilidade",
      }
    );
    // Fail-closed mantido
    expect(record.analysis.status).toBe("Inconclusiva");
    expect(record.analysis.criticality).toBe("Alta");
    expect(record.analysis.requiresDocsUpdate).toBe(true);
    // Mensagem genérica de revisão humana aparece em documentationGaps
    expect(
      record.analysis.documentationGaps.some((g) => g.includes("revisão humana"))
    ).toBe(true);
    // Gap da LLM (por paráfrase) é preservado visível sob selo [NÃO ANCORADO]
    expect(record.analysis.untrackedGaps ?? []).toEqual([
      "[NÃO ANCORADO] a mudança do navigator pode afetar compatibilidade em diferentes ambientes de execução",
    ]);
  });

  it("caminho feliz com gap rejeitado exposto: groundedGaps em documentationGaps, rejeitados em untrackedGaps", () => {
    const record = callAssembleRecord(
      [file("src/foo.ts")],
      routingStandard(),
      {
        requires_docs_update: true,
        criticidade: "Alta",
        gaps: [
          "foo.ts carece de docs",
          "endpoint /api/login não documentado",
        ],
        justificativa: "ok",
      }
    );
    expect(record.analysis.status).toBe("Atenção necessária");
    expect(record.analysis.documentationGaps).toEqual(["foo.ts carece de docs"]);
    expect(record.analysis.untrackedGaps ?? []).toEqual([
      "[NÃO ANCORADO] endpoint /api/login não documentado",
    ]);
  });
```

- [ ] **Step 2: Atualizar caso existente "#2 grounding" para também verificar `untrackedGaps`**

Em `tests/record.test.ts`, localize o caso existente (atual linhas 236-254):

```typescript
  it("#2 grounding: gap não-ancorado + sem floor → Inconclusiva Alta", () => {
```

No fim desse `it`, antes do fechamento `});`, adicione:

```typescript
    expect(record.analysis.untrackedGaps ?? []).toEqual([
      "[NÃO ANCORADO] endpoint /api/login não documentado",
    ]);
```

- [ ] **Step 3: Rodar testes — esperado: os 4 novos falham, os existentes permanecem (exceto o #2 grounding atualizado que falha por `untrackedGaps` ainda não populado)**

Run: `npx vitest run tests/record.test.ts`
Expected: FAIL — 5 casos falham (4 novos + o #2 grounding atualizado), todos reclamando que `untrackedGaps` é `undefined` (default) em vez do valor esperado. Demais casos existentes passam.

- [ ] **Step 4: Refatorar `assembleRecord`**

Em `src/services/LLMIntegrationService.ts`, localize `assembleRecord` (atual linhas 111-210). Substitua **integralmente** o método por:

```typescript
  /**
   * Map the raw AuditResult + context into the §5.6-aligned AnalysisRecord.
   *
   * Aplica três camadas determinísticas pós-LLM (spec contencao-alucinacao):
   *   #3 fail-closed   — se parseJSONSafely devolveu gap "Análise inconclusiva",
   *                      marca parseFailure e sobrepõe tudo com estado bloqueante.
   *   #2 grounding     — descarta gaps que não citam arquivo real do PR.
   *                      Se nenhum sobreviver (e não houver floor) → Inconclusiva.
   *                      Gaps rejeitados são preservados em `untrackedGaps`
   *                      sob selo [NÃO ANCORADO] (visíveis, não verificados).
   *   #1 floor         — PR com arquivo NÃO-documental sensível (auth/.env/
   *                      CI-CD/infra) força Crítica. Documentos (.md/.mdx/...)
   *                      são gated via FileMetadata.isDocumentation — seguem
   *                      para revisão cuidadosa (Gemini via routing) mas não
   *                      inflacionam a criticidade final.
   */
  private assembleRecord(
    corpus: PRCorpus,
    routing: RoutingDecision,
    result: AuditResult,
    usage: TokenUsage,
    model: string
  ): AnalysisRecord {
    // --- Medida #3: detectar falha de parsing (gap fixo do fallback) ----
    const parseFailure = result.gaps.some(
      (g) => typeof g === "string" && g.startsWith("Análise inconclusiva — resposta da LLM")
    );

    // --- Medida #2: grounding dos gaps ----------------------------------
    const { groundedGaps, rejectedGaps, grounded } = validateGapsGrounding(result, corpus);

    // --- Medida #1: floor de criticidade (gated por !isDocumentation) --
    const securityFloorTriggered = corpus.files.some(
      (f) => !f.isDocumentation && matchesSecurityPattern(f.path)
    );

    // --- Consolidar finalGaps / status / criticality --------------------
    let finalGaps: string[];
    let finalStatus: "Atenção necessária" | "OK" | "Inconclusiva";
    let finalCriticality: AuditResult["criticidade"];
    let finalJustification = result.justificativa;
    let finalRequiresDocsUpdate = result.requires_docs_update;
    let untrackedGaps: string[] = [];

    const untrackedTagged = rejectedGaps.map((g) => `[NÃO ANCORADO] ${g}`);

    if (parseFailure) {
      // #3 disparou — estado bloqueante, sobrepõe tudo. Não há gaps da LLM
      // para expor (result.gaps contém só o gap canônico do fallback).
      finalGaps = result.gaps;
      finalStatus = "Inconclusiva";
      finalCriticality = "Crítica";
      finalRequiresDocsUpdate = true;
    } else if (!grounded && !securityFloorTriggered) {
      // #2 descartou todos os gaps e nenhum piso de segurança se aplica.
      // Fail-closed: status Inconclusiva, criticidade Alta (sem prova de
      // segurança). Gaps rejeitados ficam visíveis em untrackedGaps.
      finalGaps = [
        "Análise inconclusiva: gaps gerados pela LLM não puderam ser ancorados nos artefatos do PR — revisão humana recomendada.",
      ];
      finalStatus = "Inconclusiva";
      finalCriticality = "Alta";
      finalRequiresDocsUpdate = true;
      untrackedGaps = untrackedTagged;
    } else if (securityFloorTriggered) {
      // #1 floor — injeta gap determinístico e força Crítica.
      // sensitiveFiles é filtrado por !isDocumentation (só código-fonte
      // sensível aparece na mensagem, nunca docs).
      const sensitiveFiles = corpus.files
        .filter((f) => !f.isDocumentation && matchesSecurityPattern(f.path))
        .map((f) => f.path);
      const fileList =
        sensitiveFiles.length > 0
          ? sensitiveFiles.join(", ")
          : "arquivos sensíveis (ver routing)";
      const detGap =
        `[DETERMINÍSTICO] Arquivo sensível detectado (${fileList}) — ` +
        `documentação obrigatória por regra determinística (RNF-003).`;
      finalGaps = [...groundedGaps, detGap];
      finalStatus = "Atenção necessária";
      finalCriticality = "Crítica";
      finalRequiresDocsUpdate = true;
      finalJustification =
        `Criticidade elevada por floor determinístico (RNF-003). ` +
        `Justificativa LLM: ${result.justificativa}`;
      untrackedGaps = untrackedTagged;
    } else {
      // Caminho feliz — somente #2 aplicado. Rejeitados também ficam visíveis
      // para o PMO avaliar manualmente (conteúdo útil mesmo ancorado).
      finalGaps = groundedGaps;
      finalStatus = result.requires_docs_update ? "Atenção necessária" : "OK";
      finalCriticality = result.criticidade;
      untrackedGaps = untrackedTagged;
    }

    const effectiveResult: AuditResult = {
      requires_docs_update: finalRequiresDocsUpdate,
      criticidade: finalCriticality,
      gaps: finalGaps,
      justificativa: finalJustification,
    };

    return {
      repository: corpus.pr.repository,
      pullRequest: {
        id: corpus.pr.number,
        title: corpus.pr.title,
        author: corpus.pr.author,
        url: corpus.pr.html_url,
      },
      analysis: {
        status: finalStatus,
        criticality: finalCriticality,
        requiresDocsUpdate: finalRequiresDocsUpdate,
        detectedChanges: corpus.files.map(
          (f: FileMetadata) => `${f.path} (${f.status})`
        ),
        documentationGaps: finalGaps,
        untrackedGaps,
        justification: finalJustification,
        recommendations: this.deriveRecommendations(effectiveResult),
        parseFailure,
      },
      llm: {
        provider: routing.provider,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCost: 0,
      },
      routing: { reason: routing.reason },
      createdAt: new Date().toISOString(),
    };
  }
```

- [ ] **Step 5: Rodar testes de record — esperado: PASS**

Run: `npx vitest run tests/record.test.ts`
Expected: PASS — todos os casos (existentes + 4 novos) passam.

- [ ] **Step 6: Commit**

```bash
git add src/services/LLMIntegrationService.ts tests/record.test.ts
git commit -m "feat(contencao): floor gated by !isDocumentation + expose rejected gaps as untrackedGaps"
```

---

## Task 5: `ReportGenerator` — seção `## Gaps não verificados`

**Files:**
- Modify: `src/services/ReportGenerator.ts` (após linha 31)
- Modify: `tests/services/ReportGenerator.test.ts` (adicionar casos)

- [ ] **Step 1: Escrever testes novos (TDD)**

No final de `tests/services/ReportGenerator.test.ts`, dentro do `describe("ReportGenerator")`, adicione:

```typescript
  it("renderiza seção '## Gaps não verificados' quando untrackedGaps não-vazio", () => {
    const record: AnalysisRecord = {
      ...mockRecord,
      analysis: {
        ...mockRecord.analysis,
        untrackedGaps: [
          "[NÃO ANCORADO] a mudança do navigator pode afetar compatibilidade",
          "[NÃO ANCORADO] endpoint /api/login não documentado",
        ],
      },
    };

    const generator = new ReportGenerator();
    const md = generator.generate(record);

    expect(md).toContain("## Gaps não verificados");
    expect(md).toContain("- [NÃO ANCORADO] a mudança do navigator pode afetar compatibilidade");
    expect(md).toContain("- [NÃO ANCORADO] endpoint /api/login não documentado");
    expect(md).toContain(
      "Gaps marcados como [NÃO ANCORADO] não puderam ser verificados contra os artefatos do PR. Avalie manualmente antes de decidir o merge."
    );
  });

  it("omite seção '## Gaps não verificados' quando untrackedGaps é vazio", () => {
    const record: AnalysisRecord = {
      ...mockRecord,
      analysis: {
        ...mockRecord.analysis,
        untrackedGaps: [],
      },
    };

    const generator = new ReportGenerator();
    const md = generator.generate(record);

    expect(md).not.toContain("## Gaps não verificados");
    expect(md).not.toContain("[NÃO ANCORADO]");
  });

  it("omite seção '## Gaps não verificados' quando untrackedGaps é undefined", () => {
    // mockRecord original não tem untrackedGaps — simula registro antigo do MongoDB
    const generator = new ReportGenerator();
    const md = generator.generate(mockRecord);

    expect(md).not.toContain("## Gaps não verificados");
    expect(md).not.toContain("[NÃO ANCORADO]");
  });
```

- [ ] **Step 2: Rodar testes — esperado: os 2 últimos passam (mockRecord não tem untrackedGaps → não renderiza); o primeiro falha (seção ainda não existe)**

Run: `npx vitest run tests/services/ReportGenerator.test.ts`
Expected: FAIL — 1 caso falha aguardando `## Gaps não verificados`. Os 2 casos de "omite" passam (seção ausente ainda → não contém a string).

- [ ] **Step 3: Implementar a seção condicional em `ReportGenerator`**

Em `src/services/ReportGenerator.ts`, localize o bloco que renderiza `documentationGaps` (atual linhas 25-31):

```typescript
    if (analysis.documentationGaps.length === 0) {
      lines.push("Nenhum gap documental identificado.");
    } else {
      analysis.documentationGaps.forEach((gap, idx) => {
        lines.push(`${idx + 1}. ${gap}`);
      });
    }
```

Imediatamente **após** esse bloco (antes do `lines.push("",  "## Recomendação", ...)`), insira:

```typescript
    // Medida #2 (refinada) — gaps rejeitados pelo grounding, exibidos sob selo
    // [NÃO ANCORADO] em seção dedicada. Omite quando ausente ou vazio.
    const untracked = analysis.untrackedGaps ?? [];
    if (untracked.length > 0) {
      lines.push("");
      lines.push("## Gaps não verificados");
      lines.push("");
      for (const gap of untracked) {
        lines.push(`- ${gap}`);
      }
      lines.push("");
      lines.push(
        "Gaps marcados como [NÃO ANCORADO] não puderam ser verificados contra os artefatos do PR. Avalie manualmente antes de decidir o merge."
      );
    }
```

- [ ] **Step 4: Rodar testes de ReportGenerator — esperado: PASS**

Run: `npx vitest run tests/services/ReportGenerator.test.ts`
Expected: PASS — todos os casos (existentes + 3 novos) passam.

- [ ] **Step 5: Commit**

```bash
git add src/services/ReportGenerator.ts tests/services/ReportGenerator.test.ts
git commit -m "feat(contencao): ReportGenerator renders 'Gaps não verificados' section"
```

---

## Task 6: Documentação — atualizar `docs/CONTENCAO_ALUCINACAO.md`

**Files:**
- Modify: `docs/CONTENCAO_ALUCINACAO.md` (adicionar §2.4; atualizar §5)

- [ ] **Step 1: Adicionar seção §2.4 após §2.3**

Em `docs/CONTENCAO_ALUCINACAO.md`, localize o fim de §2.3 (linha ~70, antes de `## 3. Como as três camadas aparecem na saída`). Insira a nova subseção:

```markdown
### 2.4 #2 (refinada) — Gaps não verificados visíveis

**O que faz:** quando algum gap gerado pela LLM não pôde ser ancorado em um arquivo real do PR (ou seja, não cita nem o path nem o basename de nenhum arquivo do corpus), ele não é simplesmente descartado. Aparece no relatório numa seção **Gaps não verificados**, com o prefixo `[NÃO ANCORADO]`.

**Quando dispara:** sempre que há ao menos um gap rejeitado pelo grounding — no caminho feliz, no floor, ou no caso inconclusivo.

**Efeito observável no relatório:**

```markdown
## Gaps não verificados

- [NÃO ANCORADO] a mudança do navigator pode afetar compatibilidade em diferentes ambientes de execução

Gaps marcados como [NÃO ANCORADO] não puderam ser verificados contra os artefatos do PR. Avalie manualmente antes de decidir o merge.
```

O status permanece `Inconclusiva` quando **nenhum** gap foi ancorado (fail-closed preservado), mas o conteúdo analítico fica visível para o PMO avaliar manualmente. Esta melhoria é de **apresentação**, não relaxamento: o matcher de grounding continua operando por basename/path exato case-insensitive; o que mudou é que os gaps rejeitados são preservados na saída em vez de descartados silenciosamente. Eles aparecem persistidos no `AnalysisRecord.analysis.untrackedGaps` para rastreabilidade no MongoDB.
```

- [ ] **Step 2: Atualizar §5 — Limitações assumidas**

Em `docs/CONTENCAO_ALUCINACAO.md`, localize §5 (atual linhas 93-97). Substitua o conteúdo da seção por:

```markdown
## 5. Limitações assumidas

- **Regex de `securityPatterns` é abrangente, mas o floor é gated por `isDocumentation`:** a regex continua casando arquivos de documentação que mencionam segurança (`docs/guides/refresh-token-rotation.mdx` contém "token"), mas o floor de criticidade (#1) agora a aplica **apenas sobre arquivos não-documentais** (`FileMetadata.isDocumentation === false`). Um PR que edita apenas `docs/guides/refresh-token-rotation.mdx` não força `Crítica` — o roteamento ainda o envia a Gemini para revisão cuidadosa, mas a criticidade segue a análise da LLM. Arquivos de **código-fonte** de segurança (`src/auth/middleware.ts`, `.env`, workflows de CI/CD) continuam disparando o floor `Crítica`, preservando o RNF-003. A distinção código-vs-documentação usa a flag `isDocumentation` já existente em `GitHubExtractorService.classifyFile`.
- **Matcher de grounding é literal:** um gap válido que referencia um arquivo por paráfrase ("o middleware da autenticação") pode ser descartado de `documentationGaps`. Para MVP aceita-se uma taxa de descarte controlada; desde o refinamento de 2026-06-30, esses gaps rejeitados são preservados na nova seção **Gaps não verificados** sob selo `[NÃO ANCORADO]` (ver §2.4), em vez de descartados silenciosamente. A mensagem de `"Inconclusiva"` orienta o PMO a revisar manualmente, e o conteúdo da LLM fica acessível para informar essa revisão.
- **Status `"Inconclusiva"` é novo:** auditorias antigas persistidas em MongoDB não têm esse campo; a renderização retroativa ainda funciona porque o valor default ausente é equivalente a `"OK"` ou `"Atenção necessária"` nos registros antigos. O novo campo `untrackedGaps` é opcional e default `[]`; registros antigos sem o campo são lidos como `undefined` e a nova seção do relatório é omitida.
```

- [ ] **Step 3: Commit**

```bash
git add docs/CONTENCAO_ALUCINACAO.md
git commit -m "docs(contencao): adiciona §2.4 (gaps não verificados) e atualiza §5 (floor gated)"
```

---

## Task 7: Validação final — build + suite completa

**Files:** Nenhum (validação)

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: PASS sem erros de tipo.

- [ ] **Step 2: Suite completa de testes**

Run: `npm test`
Expected: PASS — todos os testes (existente + novos) verdes, zeroes regressões.

- [ ] **Step 3: Verificar cobertura de `securityPatterns.ts`**

Run: `npx vitest run --coverage tests/utils/securityPatterns.test.ts`
Expected: `src/utils/securityPatterns.ts` com 100% de cobertura (lines/branches/functions).

- [ ] **Step 4: Commit (se houver ajustes pontuais de lint/estilo)**

Se `npm run lint` ou `npm run typecheck` existir, rodar antes:

Run: `npm run lint && npm run typecheck`  (se definidos em `package.json`)
Expected: PASS.

Caso haja ajustes:

```bash
git add -A
git commit -m "chore(contencao): fix lint after refactor"
```

Se nada a ajustar: **skip** — não criar commit vazio.

---

## Task 8: Smoke test dos dois PRs que motivaram o refinamento

**Files:** Nenhum (validação espectral)

Esta task re-executa os dois comandos que originalmente expuseram os sintomas A e B, e valida visualmente que o comportamento foi corrigido. Requer `.env` com `GROQ_API_KEY` e `GEMINI_API_KEY` configurados (já usados nas execuções originais).

- [ ] **Step 1: Re-rodar chalk #642 (sintoma A — gaps não-ancorados)**

Run:
```bash
npm run dev -- fetch-and-audit chalk chalk 642 --docs ./docs --output ./relatorio-groq-refinado.md --keep-corpus
```
Expected stdout:
- `[Routing] Using GROQ provider: Standard path: fast & cost-effective`
- `[Status] Inconclusiva | Criticidade: Alta`
- `[Gaps] 1 gaps encontrados` (ou mais)

- [ ] **Step 2: Validar relatório do chalk — seção "## Gaps não verificados" aparece com o conteúdo da LLM**

Abrir `./relatorio-groq-refinado.md`. Confirmar:
- `# Status` → `Inconclusiva`
- `## Criticidade` → `Alta`
- `## Gaps Documentais Encontrados` contém a mensagem genérica "Análise inconclusiva: gaps gerados pela LLM não puderam ser ancorados..."
- **`## Gaps não verificados`** aparece, com bullet `- [NÃO ANCORADO] ...` contendo a análise da LLM sobre o `navigator` (que antes sumia).
- Rodapé permanece igual (justificativa original preservada).

- [ ] **Step 3: Re-rodar next-auth #13396 (sintoma B — floor inflado em docs)**

Run:
```bash
npm run dev -- fetch-and-audit nextauthjs next-auth 13396 --docs ./docs --output ./relatorio-gemini-refinado.md --keep-corpus
```
Expected stdout:
- `[Routing] Using GEMINI provider: Security-sensitive files detected (auth, env, secrets, infra, CI/CD)`
- `[Status] Atenção necessária | Criticidade: Crítica` **OU** (dependendo se a LLM gera `requires_docs_update`):
  - Se LLM retornar `requires_docs_update: false`: `[Status] OK | Criticidade: Média` (ou similar baixo)
  - Se LLM retornar `requires_docs_update: true`: `[Status] Atenção necessária | Criticidade: Alta/Média`

- [ ] **Step 4: Validar relatório do next-auth — ausência de gap `[DETERMINÍSTICO]`**

Abrir `./relatorio-gemini-refinado.md`. Confirmar:
- `# Status` e `## Criticidade` refletem o julgamento da LLM (não mais forçado `Crítica`).
- `## Gaps Documentais Encontrados` **NÃO** contém gap `[DETERMINÍSTICO]` (floor não disparou — `.mdx` é `isDocumentation`).
- `## Gaps não verificados` aparece **somente se** a LLM gerou gaps não-ancorados (depende da resposta do modelo; pode ou não aparecer).
- Routing ainda Gemini (reason no campo de rodapé): `Security-sensitive files detected...`

- [ ] **Step 5: Cleanup dos relatórios de smoke (opcional)**

Se quiser evitar arquivos temporários no repo:

```bash
rm ./relatorio-groq-refinado.md ./relatorio-gemini-refinado.md
```

Estes arquivos **não** devem ser commitados (são saídas de smoke test). Verificar com `git status` que não aparecem como staged.

- [ ] **Step 6: Commit final do plano**

Se o plano foi incluído no repo (passo opcional — verifique se `docs/superpowers/plans/2026-06-30-contencao-alucinacao-refinamento.md` já está commitado da task de escrita do plano; se não):

```bash
git add docs/superpowers/plans/2026-06-30-contencao-alucinacao-refinamento.md
git commit -m "docs(contencao): implementation plan for hallucination containment refinement"
```

Caso já esteja commitado: **skip**.

---

## Self-Review (executado pelo agente que escreveu o plano)

- **Spec coverage**: §4.1 helper → Task 1. §4.2 routing → Task 3. §4.3 assembleRecord → Task 4. §4.4 types → Task 2. §4.5 AnalysisRepository → Task 2. §4.6 ReportGenerator → Task 5. §4.7 docs → Task 6. §5 data flow → coberto em Tasks 4+5. §6 testes → todos os arquivos de teste mapeados. §7 riscos → mitigados pelo design; sem task direta. §8 ordenação → seguida. ✓
- **Placeholder scan**: nenhum "TBD"/"TODO"/"fill in". Todos os steps têm código completo ou comando exato. ✓
- **Type consistency**: `matchesSecurityPattern(filePath: string): boolean` (Task 1) == chamado em Task 3 e Task 4. `analysis.untrackedGaps?: string[]` (Task 2) == esperado em Tasks 4 e 5 como `record.analysis.untrackedGaps`. Método `assembleRecord` signature inalterada. ✓
- **Teste de routing existente revisitado**: confirmado que nenhum path das 7 specs atuais deixa de casar após unificação (só agrega). Detalhe verified inline na Task 3 Step 3. ✓

---

**Fim do plano.**