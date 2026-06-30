# Contenção de Alucinação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar três camadas determinísticas pós-LLM (#3 fail-closed, #2 grounding de gaps, #1 floor de criticidade) que contêm alucinação da LLM em conformidade com o RNF-003 e as recomendações AS-06/AS-07 do `RELATORIO_SEGURANCA_APPSEC.md`, sem inflar custo (RNF-007) ou latência (RNF-001).

**Architecture:** Pós-processamento em código TypeScript comum dentro de `LLMIntegrationService.assembleRecord`. Ordem fixa: `parseJSONSafely` (#3) → `validateGapsGrounding` (#2) → floor de criticidade (#1). Novo status `"Inconclusiva"` persistido em MongoDB. Novo utilitário `src/utils/grounding.ts`. `AuditResult` (contrato LLM) inalterado; mudanças vivem em `AnalysisRecord` (fronteira de persistência/apresentação).

**Tech Stack:** Node.js 20, TypeScript 5, Vitest, Mongoose 9.

**Spec de referência:** [`docs/superpowers/specs/2026-06-30-contencao-alucinacao-design.md`](../specs/2026-06-30-contencao-alucinacao-design.md)

---

## File Structure

### Novos arquivos
- `src/utils/grounding.ts` — `validateGapsGrounding()` função pura
- `tests/utils/grounding.test.ts` — testes do matcher por basename/path
- `docs/CONTENCAO_ALUCINACAO.md` — documento curto explicativo (≤200 linhas, PT-BR)

### Arquivos modificados
- `src/services/types.ts` — enum `status` ganha `"Inconclusiva"`, novo campo `analysis.parseFailure: boolean`
- `src/services/persistence/AnalysisRepository.ts` — schema Mongoose declara `parseFailure: { type: Boolean, default: false }`
- `src/services/LLMIntegrationService.ts` — `parseJSONSafely` fail-closed, `assembleRecord` orquestra as 3 camadas, `deriveRecommendations` recebe branch `Inconclusiva`
- `src/services/ReportGenerator.ts` — renderiza `"Inconclusiva"` e nota visual de `parseFailure`
- `src/cli/commands/audit.ts` — log compacto aceita novo status `Inconclusiva`
- `tests/parse.test.ts` — espera fallback conservador (`Crítica`/gap "inconclusiva")
- `tests/record.test.ts` — casos #1 floor, #2 grounding-zaera, `parseFailure` propagation
- `tests/services/ReportGenerator.test.ts` — caso status `Inconclusiva` + nota `parseFailure`
- `README.MD` — seção "Limitações conhecidas" menciona as 3 camadas e linka o doc curto

---

## Task 1: Atualizar contrato `AnalysisRecord` (enum `status` + `parseFailure`)

**Files:**
- Modify: `src/services/types.ts`
- Modify: `src/services/persistence/AnalysisRepository.ts`

- [ ] **Step 1: Adicionar `"Inconclusiva"` ao enum de `status` em `types.ts`**

```typescript
// src/services/types.ts — dentro de AnalysisRecord.analysis
analysis: {
  status: "Atenção necessária" | "OK" | "Inconclusiva";   // ← ADICIONAR "Inconclusiva"
  criticality: AuditResult["criticidade"];
  requiresDocsUpdate: boolean;
  detectedChanges: string[];
  documentationGaps: string[];
  justification: string;
  recommendations: string[];
  parseFailure: boolean;                                  // ← NOVO CAMPO
};
```

- [ ] **Step 2: Declarar `parseFailure` no schema Mongoose em `AnalysisRepository.ts`**

```typescript
// src/services/persistence/AnalysisRepository.ts — dentro de getModel()
const analysisSchema = new Schema({
  // ... campos existentes ...
  parseFailure: { type: Boolean, default: false },   // ← ADICIONAR
});
```

**Migration note:** documentos antigos sem o campo serão lidos como `false` (default). Sem script de migration necessário.

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Expected: compila sem erros TypeScript.

- [ ] **Step 4: Verificar testes que dependem do tipo `AnalysisRecord`**

```bash
npm run test
```

Expected: erros de tipo apenas em testes que usam o mock de `AnalysisRecord` sem `parseFailure`. Anotar os arquivos para corrigir nas próximas tasks conforme cada testefor tocado.

- [ ] **Step 5: Commit**

```bash
git add src/services/types.ts src/services/persistence/AnalysisRepository.ts
git commit -m "feat(contencao): add Inconclusiva status and parseFailure to AnalysisRecord"
```

---

## Task 2: Medida #3 — Fail-closed no `parseJSONSafely`

**Files:**
- Modify: `src/services/LLMIntegrationService.ts`
- Modify: `tests/parse.test.ts`

- [ ] **Step 1: Atualizar fallback de `parseJSONSafely`**

```typescript
// src/services/LLMIntegrationService.ts:461 — substituir o bloco catch
private parseJSONSafely(content: string): AuditResult {
  try {
    const parsed = JSON.parse(content);

    if (
      typeof parsed.requires_docs_update !== "boolean" ||
      !["Baixa", "Média", "Alta", "Crítica"].includes(parsed.criticidade) ||
      !Array.isArray(parsed.gaps) ||
      typeof parsed.justificativa !== "string"
    ) {
      throw new Error("Invalid AuditResult structure from LLM");
    }

    return parsed as AuditResult;
  } catch (error) {
    console.warn(
      `[Warning] LLM response unparseable: ${
        error instanceof Error ? error.message : String(error)
      }. Fail-closed.`
    );

    return {
      requires_docs_update: true,
      criticidade: "Crítica",
      gaps: [
        "Análise inconclusiva — resposta da LLM não pôde ser interpretada. Revisão humana obrigatória.",
      ],
      justificativa:
        "Falha de parsing ou schema inválido. A auditoria não é trustable; revisar PR manualmente.",
    };
  }
}
```

**Nota:** o prefixo `"Análise inconclusiva — resposta da LLM"` é estável por contrato — `assembleRecord` (Task 4) vai detectá-lo para setar `parseFailure: true`.

- [ ] **Step 2: Atualizar `tests/parse.test.ts` para esperar fallback conservador**

Substituir o teste que espera `requires_docs_update: false`/`Média` por:

```typescript
it("returns fail-closed conservador when JSON invalid", () => {
  const result = (LLM as any).parseJSONSafely("not json at all");

  expect(result.requires_docs_update).toBe(true);
  expect(result.criticidade).toBe("Crítica");
  expect(result.gaps).toHaveLength(1);
  expect(result.gaps[0]).toMatch(/^Análise inconclusiva — resposta da LLM/);
  expect(result.justificativa).toContain("Falha de parsing");
});

it("returns fail-closed when JSON lacks required fields", () => {
  const result = (LLM as any).parseJSONSafely('{"foo":"bar"}');

  expect(result.requires_docs_update).toBe(true);
  expect(result.criticidade).toBe("Crítica");
});

it("still returns parsed object when JSON is valid and matches schema", () => {
  const valid = JSON.stringify({
    requires_docs_update: true,
    criticidade: "Alta",
    gaps: ["x"],
    justificativa: "y",
  });
  const result = (LLM as any).parseJSONSafely(valid);

  expect(result.requires_docs_update).toBe(true);
  expect(result.criticidade).toBe("Alta");
  expect(result.gaps).toEqual(["x"]);
});
```

- [ ] **Step 3: Verificar testes**

```bash
npm run test -- tests/parse.test.ts
```

Expected: 3 testes passando (caminho feliz + dois fallbacks).

- [ ] **Step 4: Commit**

```bash
git add src/services/LLMIntegrationService.ts tests/parse.test.ts
git commit -m "feat(contencao): fail-closed fallback in parseJSONSafely (#3)"
```

---

## Task 3: Medida #2 — `src/utils/grounding.ts` (TDD)

**Files:**
- Create: `src/utils/grounding.ts`
- Create: `tests/utils/grounding.test.ts`

- [ ] **Step 1: Escrever testes primeiro (TDD)**

```typescript
// tests/utils/grounding.test.ts
import { describe, it, expect } from "vitest";
import { validateGapsGrounding } from "../../src/utils/grounding";
import { PRCorpus } from "../../src/services/types";

function makeCorpus(paths: string[]): PRCorpus {
  return {
    pr: { number: "1", repository: "o/r", title: "t", description: null, author: "a", labels: [], html_url: "u" },
    files: paths.map(p => ({
      path: p, status: "modified" as const, additions: 1, deletions: 1,
      language: "ts", isPublicAPI: false, isTest: false, isDocumentation: false, isConfig: false,
      changeSummary: "", diff: "",
    })),
  };
}

describe("validateGapsGrounding", () => {
  it("grounds gap that cites path completo", () => {
    const c = makeCorpus(["auth/middleware.ts"]);
    const r = validateGapsGrounding({ gaps: ["auth/middleware.ts não documentado"] }, c);
    expect(r.grounded).toBe(true);
    expect(r.groundedGaps).toHaveLength(1);
    expect(r.rejectedGaps).toHaveLength(0);
  });

  it("grounds gap that cites só basename", () => {
    const c = makeCorpus(["src/auth/middleware.ts"]);
    const r = validateGapsGrounding({ gaps: ["middleware.ts carece de docs"] }, c);
    expect(r.grounded).toBe(true);
  });

  it("rejects gap que não cita arquivo do corpus", () => {
    const c = makeCorpus(["auth/middleware.ts"]);
    const r = validateGapsGrounding({ gaps: ["endpoint /api/login não documentado"] }, c);
    expect(r.grounded).toBe(false);
    expect(r.rejectedGaps).toHaveLength(1);
    expect(r.groundedGaps).toHaveLength(0);
  });

  it("é case-insensitive", () => {
    const c = makeCorpus(["README.md"]);
    const r = validateGapsGrounding({ gaps: ["readme.md desatualizado"] }, c);
    expect(r.grounded).toBe(true);
  });

  it("mistura grounded e rejected corretamente", () => {
    const c = makeCorpus(["auth/middleware.ts"]);
    const r = validateGapsGrounding(
      { gaps: ["auth/middleware.ts ok", "endpoint /api/login não documenta"] },
      c
    );
    expect(r.groundedGaps).toEqual(["auth/middleware.ts ok"]);
    expect(r.rejectedGaps).toEqual(["endpoint /api/login não documenta"]);
  });

  it("lista de gaps vazia → grounded false", () => {
    const c = makeCorpus(["auth/middleware.ts"]);
    const r = validateGapsGrounding({ gaps: [] }, c);
    expect(r.grounded).toBe(false);
    expect(r.groundedGaps).toHaveLength(0);
    expect(r.rejectedGaps).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implementar `src/utils/grounding.ts`**

```typescript
import { AuditResult, PRCorpus } from "../services/types.js";

export interface GroundingResult {
  groundedGaps: string[];
  rejectedGaps: string[];
  grounded: boolean;
}

/**
 * Medida #2 — valida que cada gap da LLM cita (por basename ou path completo,
 * case-insensitive) um arquivo presente em corpus.files.
 *
 * Matcher MVP: basename/path exato. Não usa similaridade léxica — determinístico,
 * ~15 linhas, zero dependências, evita falso-positivo de grounding.
 */
export function validateGapsGrounding(
  result: Pick<AuditResult, "gaps">,
  corpus: PRCorpus
): GroundingResult {
  const paths = corpus.files.map(f => f.path.toLowerCase());
  const basenames = corpus.files.map(f => {
    const parts = f.path.toLowerCase().split("/");
    return parts[parts.length - 1];
  });

  const groundedGaps: string[] = [];
  const rejectedGaps: string[] = [];

  for (const gap of result.gaps) {
    const g = gap.toLowerCase();
    const matches =
      paths.some(p => g.includes(p)) ||
      basenames.some(b => g.includes(b));
    if (matches) {
      groundedGaps.push(gap);
    } else {
      rejectedGaps.push(gap);
    }
  }

  return {
    groundedGaps,
    rejectedGaps,
    grounded: groundedGaps.length > 0,
  };
}
```

- [ ] **Step 3: Verificar testes (cobertura 100% alvo)**

```bash
npm run test -- tests/utils/grounding.test.ts
npm run test:coverage -- --include src/utils/grounding.ts
```

Expected: 6 testes passando, 100% de cobertura do arquivo `grounding.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/utils/grounding.ts tests/utils/grounding.test.ts
git commit -m "feat(contencao): add validateGapsGrounding util (#2)"
```

---

## Task 4: Medida #1 — Reescrever `assembleRecord` orquestrando as 3 camadas

**Files:**
- Modify: `src/services/LLMIntegrationService.ts`
- Modify: `tests/record.test.ts`

- [ ] **Step 1: Importar `validateGapsGrounding` no topo de `LLMIntegrationService.ts`**

```typescript
import { validateGapsGrounding } from "../utils/grounding.js";
```

- [ ] **Step 2: Reescrever `assembleRecord` conforme spec §4.3.2**

Aplicar na ordem fixa: telemetria #3 → #2 → #1 → consolidação. Ver código completo no spec `2026-06-30-contencao-alucinacao-design.md` §4.3.2.

Pontos críticos:
- `parseFailure` é detectado por `result.gaps.some(g => g.startsWith("Análise inconclusiva — resposta da LLM"))`.
- `securityFloorTriggered` combina `hasSecurityChanges || hasAuthChanges || hasEnvChanges || hasCICDChanges`.
- Quatro branches de consolidação: `parseFailure` → `!grounded && !securityFloor` → `securityFloor` → caminho feliz.
- Gap `[DETERMINÍSTICO]` lista nomes de arquivos sensíveis (regex `/auth|\.env|\.github[/\\]workflows|infra/i`).
- Justificativa do floor combina texto LLM + sufixo indicando elevação determinística.

- [ ] **Step 3: Expandir `deriveRecommendations` para branch `Inconclusiva`**

```typescript
private deriveRecommendations(result: AuditResult): string[] {
  if (result.gaps.some(g => g.includes("Análise inconclusiva"))) {
    return [
      "Rejeitar auto-aprovação: resultados inconclusivos demandam revisão humana.",
      "Inspeção manual do PR antes de qualquer decisão de merge.",
    ];
  }
  if (!result.requires_docs_update) {
    return ["Documentação parece adequada; nenhuma ação documental necessária."];
  }
  switch (result.criticidade) {
    case "Crítica":
      return [
        "Bloquear o merge: atualizar a documentação ANTES de aprovar o PR.",
        "Revisar itens de segurança/infraestrutura impactados com o time responsável.",
      ];
    case "Alta":
      return ["Atualizar a documentação antes de aprovar o PR."];
    case "Média":
      return ["Avaliar a atualização da documentação antes do merge."];
    default:
      return ["Atualização documental opcional/menor."];
  }
}
```

- [ ] **Step 4: Atualizar `tests/record.test.ts` com 3 novos casos**

Caso A — caminho feliz (caminho feliz recebe `parseFailure: false`):

```typescript
it("caminho feliz: parseFailure false, status preservado", () => {
  const record = (LLM as any).assembleRecord(
    makeCorpus(["src/utils/foo.ts"]),         // não sensível
    { provider: "groq", reason: "Standard", context: { hasSecurityChanges: false, hasCICDChanges: false, hasAuthChanges: false, hasEnvChanges: false, totalDiffSize: 100 } },
    { requires_docs_update: true, criticidade: "Alta", gaps: ["foo.ts carece de docs"], justificativa: "...", },
    { inputTokens: 1, outputTokens: 1 },
    "groq-model"
  );
  expect(record.analysis.status).toBe("Atenção necessária");
  expect(record.analysis.criticality).toBe("Alta");
  expect(record.analysis.parseFailure).toBe(false);
  expect(record.analysis.documentationGaps).toEqual(["foo.ts carece de docs"]);
});
```

Caso B — floor de criticidade (PR `auth/` mas LLM disse Média):

```typescript
it("floor #1 força Crítica e injeta gap [DETERMINÍSTICO]", () => {
  const record = (LLM as any).assembleRecord(
    makeCorpus(["auth/middleware.ts"]),
    { provider: "gemini", reason: "security", context: { hasSecurityChanges: true, hasCICDChanges: false, hasAuthChanges: true, hasEnvChanges: false, totalDiffSize: 100 } },
    { requires_docs_update: false, criticidade: "Média", gaps: ["middleware.tsblahblah"], justificativa: "LLM disse tudo ok", },
    { inputTokens: 1, outputTokens: 1 },
    "gemini-model"
  );
  expect(record.analysis.status).toBe("Atenção necessária");
  expect(record.analysis.criticality).toBe("Crítica");
  expect(record.analysis.requiresDocsUpdate).toBe(true);
  expect(record.analysis.documentationGaps.some(g => g.startsWith("[DETERMINÍSTICO]"))).toBe(true);
  expect(record.analysis.justification).toContain("floor determinístico");
});
```

Caso C — grounding zera todos os gaps (sem floor):

```typescript
it("#2 zera gaps não-groundados + sem floor → Inconclusiva Alta", () => {
  const record = (LLM as any).assembleRecord(
    makeCorpus(["src/utils/foo.ts"]),
    { provider: "groq", reason: "Standard", context: { hasSecurityChanges: false, hasCICDChanges: false, hasAuthChanges: false, hasEnvChanges: false, totalDiffSize: 100 } },
    { requires_docs_update: true, criticidade: "Alta", gaps: ["endpoint /api/login não documentado"], justificativa: "x", },
    { inputTokens: 1, outputTokens: 1 },
    "groq-model"
  );
  expect(record.analysis.status).toBe("Inconclusiva");
  expect(record.analysis.criticality).toBe("Alta");
  expect(record.analysis.documentationGaps.some(g => g.includes("revisão humana"))).toBe(true);
});
```

Caso D — `parseFailure: true` propagado:

```typescript
it("#3 parseFailure propaga para AnalysisRecord", () => {
  const record = (LLM as any).assembleRecord(
    makeCorpus(["src/foo.ts"]),
    { provider: "groq", reason: "Standard", context: { hasSecurityChanges: false, hasCICDChanges: false, hasAuthChanges: false, hasEnvChanges: false, totalDiffSize: 100 } },
    { requires_docs_update: true, criticidade: "Crítica", gaps: ["Análise inconclusiva — resposta da LLM não pôde ser interpretada. Revisão humana obrigatória."], justificativa: "Falha", },
    { inputTokens: 1, outputTokens: 1 },
    "groq-model"
  );
  expect(record.analysis.parseFailure).toBe(true);
  expect(record.analysis.status).toBe("Inconclusiva");
  expect(record.analysis.criticality).toBe("Crítica");
});
```

- [ ] **Step 5: Verificar testes**

```bash
npm run test -- tests/record.test.ts
```

Expected: 4 testes novos passando + testes existentes (que não cobriam `parseFailure`) atualizados com `parseFailure: false` nos mocks.

- [ ] **Step 6: Commit**

```bash
git add src/services/LLMIntegrationService.ts tests/record.test.ts
git commit -m "feat(contencao): assembleRecord orquestra #3→#2→#1 (#1)"
```

---

## Task 5: Apresentação — `ReportGenerator` + log compacto

**Files:**
- Modify: `src/services/ReportGenerator.ts`
- Modify: `src/cli/commands/audit.ts`
- Modify: `tests/services/ReportGenerator.test.ts`

- [ ] **Step 1: Atualizar `ReportGenerator.generate` para status `Inconclusiva`**

`generate(record)` já renderiza `record.analysis.status` na seção `# Status`. Validar que o valor `"Inconclusiva"` é renderizado como string. Se houver switch case explícito em `ReportGenerator`, adicionar `case "Inconclusiva":`.

- [ ] **Step 2: Adicionar nota visual no rodapé quando `parseFailure: true`**

```typescript
// src/services/ReportGenerator.ts — antes de fechar o template
const parseFailureNote = record.analysis.parseFailure
  ? "\n---\n⚠ Esta auditoria foi marcada como inconclusiva por falha de parsing da LLM — não utilizar como aprovação automática.\n"
  : "";
```

Inserir `parseFailureNote` antes da linha `*Auditoria gerada automaticamente...*`.

- [ ] **Step 3: Adicionar testes para status `Inconclusiva`**

```typescript
it("renderiza status Inconclusiva", () => {
  const record = { /* mock com status: "Inconclusiva" */ } as AnalysisRecord;
  const md = new ReportGenerator().generate(record);
  expect(md).toContain("# Status");
  expect(md).toContain("Inconclusiva");
});

it("adiciona nota visual quando parseFailure true", () => {
  const record = { /* mock com parseFailure: true */ } as AnalysisRecord;
  const md = new ReportGenerator().generate(record);
  expect(md).toContain("⚠");
  expect(md).toContain("não utilizar como aprovação automática");
});
```

- [ ] **Step 4: Atualizar log compacto em `audit.ts`**

O log `[Status] ${status} | Criticidade: ${criticidade}` já imprime寡 status dinamicamente. Validar que `Inconclusiva` aparece corretamente.

- [ ] **Step 5: Verificar testes**

```bash
npm run test -- tests/services/ReportGenerator.test.ts
```

Expected: testes existentes + 2 novos passando.

- [ ] **Step 6: Commit**

```bash
git add src/services/ReportGenerator.ts src/cli/commands/audit.ts tests/services/ReportGenerator.test.ts
git commit -m "feat(contencao): ReportGenerator suporta Inconclusiva e nota de parseFailure"
```

---

## Task 6: Documento curto `docs/CONTENCAO_ALUCINACAO.md`

**Files:**
- Create: `docs/CONTENCAO_ALUCINACAO.md`

- [ ] **Step 1: Escrever o documento conforme estrutura do spec §7**

Sections obrigatórias (≤200 linhas total, PT-BR):
1. Introdução (5-10 linhas) — RNF-003, três vetores de alucinação, princípio determinístico.
2. Sub-seção por medida (~30 linhas cada):
   - #1 Override determinístico — o quê, quando dispara, efeito observável, por quê.
   - #2 Validação de grounding — o quê, matcher basename/path, efeito quando 0 gaps passam, por quê.
   - #3 Fail-closed — o quê, quando dispara, efeito, por quê (AS-07).
3. Tabela resumo (3 linhas + header) — Medida | Gatilho | Efeito observável.
4. Por que não usamos mais chamadas LLM (5 linhas) — RNF-001/RNF-007.
5. Limitações assumidas (5-10 linhas) — regex lata, matcher literal, status novo.
6. Referências cruzadas (3 linhas) — `Requisitos.MD`, `RELATORIO_SEGURANCA_APPSEC.md`, `Arquitetura.MD`, spec.

**Tom:** alinhado a `docs/Escopo_MVP.md` e `docs/RELATORIO_SEGURANCA_APPSEC.md`.

- [ ] **Step 2: Commit**

```bash
git add docs/CONTENCAO_ALUCINACAO.md
git commit -m "docs(contencao): documento curto explicando as 3 camadas"
```

---

## Task 7: Validação final + `README.MD`

**Files:**
- Modify: `README.MD`
- Verify: `npm run build && npm run test`

- [ ] **Step 1: Atualizar seção "Limitações conhecidas" do `README.MD`**

Adicionar bullet apontando para o doc curto:

```markdown
- **Contenção de alucinação:** três camadas determinísticas pós-LLM (#3 fail-closed + #2 grounding + #1 floor de criticidade) garantem RNF-003 sem inflar custo/latência. Detalhes em [`docs/CONTENCAO_ALUCINACAO.md`](./docs/CONTENCAO_ALUCINACAO.md).
```

- [ ] **Step 2: Build de produção**

```bash
npm run build
```

Expected: `tsc` sem erros.

- [ ] **Step 3: Full test suite**

```bash
npm run test
```

Expected: todos os testes passando, incluídos atualizados em `parse.test.ts`, `record.test.ts`, `grounding.test.ts`, `ReportGenerator.test.ts`. Sem regressão nos 77 testes existentes.

- [ ] **Step 4: Coverage check do utilitário crítico**

```bash
npm run test:coverage -- --include src/utils/grounding.ts
```

Expected: 100% de cobertura em `src/utils/grounding.ts`.

- [ ] **Step 5: Commit**

```bash
git add README.MD
git commit -m "docs(contencao): mention hallucination containment in README limitations"
```

---

## Resumo de Dependências

```text
Task 1 (Contrato) ──┬──► Task 2 (#3 fail-closed)
                    ├──► Task 3 (#2 grounding)  ──┐
                    └──► Task 4 (#1 floor) ◄─── Task 3
                              │
                              ▼
                         Task 5 (Apresentação)
                              │
                              ▼
                         Task 6 (Doc curto)
                              │
                              ▼
                         Task 7 (Validação final)
```

- Task 3 pode rodar em paralelo com Task 2 (não há dependência direta de código, só de types que vêm da Task 1).
- Task 4 depende de Task 2 (fallback de `parseJSONSafely` precisa estar no lugar) e Task 3 (`validateGapsGrounding` importable).
- Task 5 depende de Task 4 (novo status `Inconclusiva` precisa ser produzido).
- Task 6 independente do código — pode ser escrita a qualquer momento após Task 1.
- Task 7 é gate final.

---

## Critérios de Aceitação Globais

- [ ] `npm run build` limpo, sem erros TypeScript.
- [ ] `npm run test` verde, com novos testes passando.
- [ ] Cobertura 100% em `src/utils/grounding.ts`.
- [ ] `AuditResult` (contrato LLM) **não foi modificado**.
- [ ] `AnalysisRecord` (contrato persistência) agora suporta `status === "Inconclusiva"` e `analysis.parseFailure === boolean`.
- [ ] `parseJSONSafely` retorna `Crítica` + gap "inconclusiva" em caso de falha.
- [ ] PR sensível (`auth/.env/CI/CD`) sempre termina com `criticality === "Crítica"` na saída do `assembleRecord`.
- [ ] Gaps não ancorados em arquivo real do PR são descartados; quando todos são descartados, status vira `"Inconclusiva"`.
- [ ] `docs/CONTENCAO_ALUCINACAO.md` existe, ≤200 linhas, PT-BR, com as 6 seções definidas.
- [ ] `README.MD` atualizado com referência ao doc de contenção.

---

## Referências

- **Spec:** [`docs/superpowers/specs/2026-06-30-contencao-alucinacao-design.md`](../specs/2026-06-30-contencao-alucinacao-design.md)
- **Requisitos:** `Requisitos.MD` → RNF-001, RNF-003, RNF-007
- **Relatório de segurança:** `docs/RELATORIO_SEGURANCA_APPSEC.md` → AS-06, AS-07
- **Arquitetura:** `docs/Arquitetura.MD` → ADR-005