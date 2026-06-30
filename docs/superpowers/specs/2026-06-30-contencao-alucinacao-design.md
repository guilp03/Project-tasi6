# Design Doc: Contenção de Alucinação (Camadas Determinísticas Pós-LLM)

**Data:** 2026-06-30
**Status:** Aprovado para implementação
**Escopo:** RNF-003 (0% falso-negativo em segurança), AS-06/AS-07 do `RELATORIO_SEGURANCA_APPSEC.md`, requisito de contenção de alucinação do MVP.

---

## 1. Contexto e Objetivo

O PR Documentation Auditor produz sua `AuditResult` 100% a partir da resposta de uma LLM (Groq Llama 3.3 70B no caminho rápido, Gemini 2.5 Flash no caminho sensível). Os únicos controles existentes hoje são:

- `response_format: json_object` / `responseMimeType: application/json` — garante **JSON válido**, não **conteúdo verdadeiro**.
- `parseJSONSafely` em `LLMIntegrationService.ts:461` — valida apenas tipagem; em caso de falha devolve `requires_docs_update: false`, criticidade `Média` (fallback "falha aberta", violando AS-07).
- `routing.context.hasSecurityChanges` — já detectado deterministicamente em `calculateRoutingDecision`, mas **não** influencia a criticidade final; apenas escolhe o provedor.

Sob esse desenho, três vetores de alucinação atingem a saída sem barreira:

1. **Alucinação de classificação** — a LLM "amacia" a criticidade de um PR que toca `auth/`, `.env` ou CI/CD (falso-negativo em segurança, exatamente o que o RNF-003 proíbe).
2. **Alucinação de inventividade** — a LLM inventa gaps que não se referem a nenhum artefato real do PR ("endpoint /api/login não documentado" em um PR que não contém tal arquivo).
3. **Alucinação degenerada** — resposta truncada, markdown em vez de JSON, schema inválido. Hoje vira falso-negativo silencioso.

**Objetivo deste design:** Definir três camadas determinísticas pós-LLM (zero chamadas adicionais de modelo) que contêm essas três classes de alucinação, смыслamente Compliance com o RNF-003 e AS-06/AS-07, sem inflar custo (RNF-007) ou latência (RNF-001).

---

## 2. Escopo

### Incluído neste design

1. **Medida #1 — Override determinístico de criticidade ("floor de segurança")**: pós-processa `AuditResult` para forçar `Crítica` quando `routing.context` já tiver flags sensíveis.
2. **Medida #2 — Validação de grounding dos gaps**: filtra gaps que não citam arquivo real do PR; se nenhum sobreviver, marca auditoria como `"Inconclusiva"`.
3. **Medida #3 — Fail-closed no `parseJSONSafely`**: troca o fallback atual por estado conservador bloqueante; adiciona telemetria `analysis.parseFailure`.
4. Novo valor `"Inconclusiva"` no enum `AnalysisRecord.analysis.status` (contrato persistido em MongoDB).
5. Novo campo `analysis.parseFailure: boolean` no `AnalysisRecord`.
6. Novo utilitário `src/utils/grounding.ts` (função pura, testável isoladamente).
7. Atualização do `ReportGenerator` para renderizar o novo status.
8. Atualização de `tests/parse.test.ts` para refletir o novo fallback.
9. Documento curto `docs/CONTENCAO_ALUCINACAO.md` (≥200 linhas) explicando cada medida para leitor não-implementador.

### Excluído deste design (escopo futuro)

- **#4 Consenso de modelos** — re-execução em segundo provedor para criticidade `Crítica` ou discordância. Excluído por custo/latência fora do envelope RNF-001/RNF-007.
- **#5 Citação literal com `evidence`** — schema ampliado de `gaps[]` para `{ file, docSection, claim, evidence }`. Excluído por mudar demais o contrato e exigir prompt engineering adicional.
- **Prompt hardening contra prompt-injection** (envelopamento `<<<UNTRUSTED_DATA>>>`). Recomendado em AS-06, mas tratado em Spec futura por pertencer à camada de prompt e não à de pós-processamento.

---

## 3. Arquitetura

### 3.1 Estrutura de diretórios (delta)

```
src/
├── services/
│   ├── LLMIntegrationService.ts   # MODIFICADO — assembleRecord + parseJSONSafely
│   ├── ReportGenerator.ts         # MODIFICADO — renderiza "Inconclusiva"
│   └── types.ts                   # MODIFICADO — enum status + parseFailure
└── utils/
    ├── prompts.ts                 # INALTERADO
    └── grounding.ts               # NOVO — validateGapsGrounding()

tests/
├── parse.test.ts                  # MODIFICADO — novo fallback conservador
├── routing.test.ts                # INALTERADO
└── utils/
    └── grounding.test.ts          # NOVO

docs/
└── CONTENCAO_ALUCINACAO.md        # NOVO — doc curto explicativo
```

### 3.2 Princípio orientador

As três medidas são **determinísticas e pós-LLM**: rodam depois que o modelo respondeu, não consomem tokens extras, não mudam o roteamento ADR-005, não chamam outro modelo. A ordem de aplicação importa e é fixa:

```text
LLM ──► parseJSONSafely (#3 fail-closed)
   │
   ▼
rastreabilidade dos gaps (#2 grounding)
   │
   ▼
assembleRecord (#1 floor de criticidade)
   │
   ▼
AnalysisRecord → ReportGenerator / MongoDB
```

Justificativa da ordem:
- **#3 primeiro** porque #1 e #2 operam sobre uma `AuditResult` válida. Se #3 falhar, as duas subsequentes não têm material.
- **#2 antes de #1** porque #1 pode injetar um gap `[DETERMINÍSTICO]` que **por construção** cita o arquivo sensível — logo passa automaticamente no filtro de grounding. Propriedade emergente to be detailed em §4.3.
- **#1 por último** porque aplica o floor final sobre a criticidade após todos os gaps já estarem consolidados.

---

## 4. Componentes e Interfaces

### 4.1 `src/services/types.ts` — alterações de contrato

```typescript
// ALTERAÇÃO 1: enum de status ganha novo valor
export interface AnalysisRecord {
  // ... campos existentes inalterados ...
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
  // ... resto inalterado ...
}
```

**Migração MongoDB:** campo novo opcional; documentos antigos sem `parseFailure` são lidos como `false`. Sem migration script necessário (Mongoose é schemaless). Atualizar schema Mongoose em `AnalysisRepository.ts: getModel()` para declarar `parseFailure: { type: Boolean, default: false }`.

**Compatibilidade com `AuditResult` (nível LLM):** `AuditResult` **não** muda — continua só com `requires_docs_update`, `criticidade`, `gaps`, `justificativa`. Os estados `Inconclusiva`/`parseFailure` vivem exclusivamente no nível `AnalysisRecord`, que é a fronteira de persistência/apresentação.

### 4.2 `src/utils/grounding.ts` — Medida #2

Função pura, sem side-effects, testável isoladamente.

```typescript
import { AuditResult, PRCorpus } from "../services/types.js";

export interface GroundingResult {
  groundedGaps: string[];      // gaps que passaram no filtro
  rejectedGaps: string[];      // gaps que não ancoraram em nenhum arquivo
  grounded: boolean;           // true se almeno um gap passou
}

/**
 * Valida que cada gap da LLM cita (por basename ou path completo,
 * case-insensitive) um arquivo presente em corpus.files.
 *
 * Matcher MVP: basename/path exato (decisão de design). Não usa
 * similaridade léxica — determinístico, ~15 linhas, zero dependências.
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
    const matches = paths.some(p => g.includes(p)) ||
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

**Decisões de design:**
- **Matcher por basename/path exato** (decisão de brainstorm): gap precisa citar `auth/middleware.ts` ou `middleware.ts`. Não usa similaridade léxica — evita falso-positivo de grounding.
- **Case-insensitive** para tolerância a capitalização da LLM ("README.md" vs "readme.md").
- **Rejeição só descarta o gap**, não invalida a auditoria inteira. Só invalida se **todos** forem rejeitados (ver §4.3).
- **Gaps `[DETERMINÍSTICO]` de #1** mencionam por construção o arquivo sensible: `"Arquivo sensível detectado (auth/middleware.ts) — documentação obrigatória (RNF-003)"`. Logo passam no filtro automaticamente — **propriedade emergente desejada**.

### 4.3 `src/services/LLMIntegrationService.ts` — orquestração do pós-processamento

#### 4.3.1 `parseJSONSafely` — Medida #3 (fail-closed)

Substituir fallback atual (`requires_docs_update: false`, `Média`) por estado conservador:

```typescript
private parseJSONSafely(content: string): AuditResult {
  try {
    const parsed = JSON.parse(content);
    if (/* validação existente inalterada */) {
      return parsed as AuditResult;
    }
    throw new Error("Invalid AuditResult structure from LLM");
  } catch (error) {
    console.warn(`[Warning] LLM response unparseable: ${...}. Fail-closed.`);
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

**Decisão:** fallback **sempre conservador**, sem `strictMode` no construtor (decisão de brainstorm). Justificativa: o fallback `false/Média` não é desejável em nenhum ambiente; pretendemos atualizar `parse.test.ts` para refletir o novo contrato.

**Telemetria:** `assembleRecord` seta `analysis.parseFailure: true` quando detecta gap com o texto-exato `"Análise inconclusiva — resposta da LLM não pôde ser interpretada..."`. Alternativa considerada e **rejeitada**: propagar exceção estruturada do `parseJSONSafely` — quebraria fluxos de erro já testados. Optou-se por detecção por prefixo de string (assume-se texto estável no fallback).

#### 4.3.2 `assembleRecord` — Medida #1 (floor) e integração com #2

Reescrever `assembleRecord` para aplicar as três camadas na ordem fixa:

```typescript
private assembleRecord(
  corpus: PRCorpus,
  routing: RoutingDecision,
  result: AuditResult,
  usage: TokenUsage,
  model: string
): AnalysisRecord {
  // --- Medida #3: detectar se houve falha de parsing -------------------
  const parseFailure = result.gaps.some(g =>
    g.startsWith("Análise inconclusiva — resposta da LLM")
  );

  // --- Medida #2: grounding dos gaps -----------------------------------
  const { groundedGaps, grounded } = validateGapsGrounding(result, corpus);

  // --- Medida #1: floor de criticidade ---------------------------------
  const ctx = routing.context;
  const securityFloorTriggered =
    ctx.hasSecurityChanges || ctx.hasAuthChanges ||
    ctx.hasEnvChanges  || ctx.hasCICDChanges;

  // --- Consolidar gaps e status ----------------------------------------
  let finalGaps: string[];
  let finalStatus: "Atenção necessária" | "OK" | "Inconclusiva";
  let finalCriticality: AuditResult["criticidade"];
  let finalJustification = result.justificativa;
  let finalRequiresDocsUpdate = result.requires_docs_update;

  if (parseFailure) {
    // #3 disparou — estado bloqueante, sobrepõe tudo
    finalGaps = result.gaps;
    finalStatus = "Inconclusiva";
    finalCriticality = "Crítica";
    finalRequiresDocsUpdate = true;
  } else if (!grounded && !securityFloorTriggered) {
    // #2 descartou todos os gaps e nenhum piso de segurança se aplica
    finalGaps = [
      "Análise inconclusiva: gaps gerados pela LLM não puderam " +
      "ser ancorados nos artefatos do PR — revisão humana recomendada.",
    ];
    finalStatus = "Inconclusiva";
    finalCriticality = "Alta"; // conservador, não Crítica: não há prova de segurança
    finalRequiresDocsUpdate = true;
  } else if (securityFloorTriggered) {
    // #1 floor — injeta gap determinístico e força Crítica
    const sensitiveFiles = corpus.files
      .filter(f => /auth|\.env|\.github[/\\]workflows|infra/i.test(f.path))
      .map(f => f.path);
    const detGap =
      `[DETERMINÍSTICO] Arquivo sensível detectado ` +
      `(${sensitiveFiles.join(", ")}) — documentação obrigatória ` +
      `por regra determinística (RNF-003).`;
    finalGaps = [...groundedGaps, detGap];
    finalStatus = "Atenção necessária";
    finalCriticality = "Crítica";
    finalRequiresDocsUpdate = true;
    finalJustification =
      `Criticidade elevada por floor determinístico (RNF-003). ` +
      `Justificativa LLM: ${result.justificativa}`;
  } else {
    // Caminho feliz — somente #2 aplicado
    finalGaps = groundedGaps;
    finalStatus = result.requires_docs_update ? "Atenção necessária" : "OK";
    finalCriticality = result.criticidade;
  }

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
      detectedChanges: corpus.files.map(f => `${f.path} (${f.status})`),
      documentationGaps: finalGaps,
      justification: finalJustification,
      recommendations: this.deriveRecommendations({
        ...result,
        criticidade: finalCriticality,
        requires_docs_update: finalRequiresDocsUpdate,
      }),
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

**Mudança colateral em `deriveRecommendations`**: hoje deriva recomendações por criticidade. Necessita de branch nova para status `"Inconclusiva"`:

```typescript
private deriveRecommendations(result: AuditResult): string[] {
  // Inconclusiva tem prioridade sobre criticidade
  if (result.gaps.some(g => g.includes("Análise inconclusiva"))) {
    return [
      "Rejeitar auto-aprovação: resultados inconclusivos demandam revisão humana.",
      "Inspeção manual do PR antes de qualquer decisão de merge.",
    ];
  }
  // ... branches existentes para Crítica/Alta/Média/Baixa inalterados ...
}
```

### 4.4 `src/services/ReportGenerator.ts` — renderizar novo status

Renderização `"Inconclusiva"` no relatório Markdown:

```markdown
# Status

Inconclusiva

## Criticidade

Crítica ou Alta (conforme caso)

## Gaps Documentais Encontrados

1. Análise inconclusiva — resposta da LLM não pôde ser interpretada. Revisão humana obrigatória.
```

Adicionar nota visual no rodapé quando `parseFailure: true`: `"⚠ Esta auditoria foi marcada como inconclusiva por falha de parsing da LLM — não utilizar como aprovação automática."`

No log compacto do terminal (já impresso por `audit.ts`), atualizar linha de status:

```
[Status] Inconclusiva | Criticidade: Crítica
[Status] Atenção necessária | Criticidade: Alta
```

### 4.5 `docs/CONTENCAO_ALUCINACAO.md` — documento curto

Ver Spec do documento em §7. Moscenido na ordem de tasks de §6.

---

## 5. Fluxo de Dados (Data Flow)

### 5.1 Pós-processamento pós-LLM

```text
[LLMIntegrationService] callGroqRaw / callGeminiRaw → AuditResult
  │
  ▼
[parseJSONSafely]  #3 fail-closed
  ├── JSON válido + schema ok → AuditResult normal
  └── Falha → AuditResult conservador { requires_docs_update: true, Crítica, gap "inconclusiva" }
  │
  ▼
[assembleRecord]
  ├── #3 telemetria: parseFailure = gap.startsWith("Análise inconclusiva")?
  │
  ├── #2 validateGapsGrounding(result, corpus)
  │     ├── groundedGaps → mantidos
  │     └── rejectedGaps → descartados
  │
  ├── #1 floor: routing.context.hasSecurityChanges|hasAuth|hasEnv|hasCICD?
  │     └── Sim → injeta gap [DETERMINÍSTICO], forçar Crítica
  │
  ├── Consolidar finalGaps / finalStatus / finalCriticality
  │     ├── parseFailure? → "Inconclusiva" + Crítica
  │     ├── !grounded && !securityFloor? → "Inconclusiva" + Alta
  │     ├── securityFloor? → "Atenção necessária" + Crítica
  │     └── caminho feliz → status/criticidade da LLM
  │
  ▼
[AnalysisRecord] → ReportGenerator.generate() → Markdown
                 → AnalysisRepository.save() → MongoDB
```

### 5.2 Comportamento observável em quatro cenários representativos

| Cenário | LLM retorna | #3 | #2 | #1 | Resultado final |
|---|---|---|---|---|---|
| **A. Caminho feliz** | `{Crítica, gaps citando arquivos reais}` | ok | grounded | -- | Status `Atenção necessária`, `Crítica`, gaps LLM |
| **B. Amacia criticidade** em PR `auth/` | `{Média, gaps ok}` | ok | grounded | **dispara** | Status `Atenção necessária`, **`Crítica`** floor, gaps LLM + gap `[DETERMINÍSTICO]` |
| **C. Inventa gaps** sem citar arquivo | `{Alta, gaps genéricos}` | ok | **!grounded** | -- | Status `Inconclusiva`, `Alta`, gap "revisão humana" |
| **D. JSON truncado** | `undefined` / markdown | **fail-closed** | -- | -- | Status `Inconclusiva`, `Crítica`, `parseFailure: true` |

---

## 6. Estratégia de Testes

### 6.1 `tests/utils/grounding.test.ts` (NOVO)

Cobertura da função pura:

- Gap cita path completo (`"auth/middleware.ts não documentado"`) → grounded.
- Gap cita só basename (`"middleware.ts ..."`) → grounded.
- Gap genérico sem arquivo (`"endpoint /api/login não documentado"` em PR sem `/api/login`) → rejeitado.
- Case-insensitivity (`"README.md"` vs corpus `readme.md`) → grounded.
- Múltiplos gaps, mistura de grounded/rejeitados → `groundedGaps` e `rejectedGaps` corretos.
- Lista de gaps vazia → `grounded: false`.

### 6.2 `tests/parse.test.ts` (MODIFICADO)

- Atualizar teste do fallback para esperar `requires_docs_update: true`, `Crítica`, gap com prefixo `"Análise inconclusiva — resposta da LLM"`.
- Manter testes de caminho feliz (JSON válido + schema ok) inalterados.
- Adicionar teste: JSON parseável mas missing `criticidade` → dispara fallback.

### 6.3 `tests/routing.test.ts` — INALTERADO

Roteamento ADR-005 não é tocado, então testes existentes seguem válidos.

### 6.4 `tests/record.test.ts` (MODIFICADO)

- Adicionar caso: `assembleRecord` com routing sensível + LLM dizendo `Média` → finalizar com `Crítica` + gap `[DETERMINÍSTICO]`.
- Adicionar caso: `assembleRecord` com gaps não-groundados + routing não-sensível → finalizar com `Inconclusiva`/`Alta`.
- Adicionar caso: `parseFailure: true` propagado para `AnalysisRecord.analysis.parseFailure`.

### 6.5 `tests/services/ReportGenerator.test.ts` (MODIFICADO)

- Adicionar caso de renderização para status `"Inconclusiva"`.
- Adicionar caso de nota visual no rodapé quando `parseFailure: true`.

### 6.6 Cobertura esperada

Atingir 100% em `src/utils/grounding.ts`. Manter cobertura existente em `LLMIntegrationService` ≥ atual.

---

## 7. Documento curto `docs/CONTENCAO_ALUCINACAO.md`

Estrutura proposta (≤200 linhas, PT-BR, tom alinhado a `Escopo_MVP.md` e `RELATORIO_SEGURANCA_APPSEC.md`):

1. **Introdução (5-10 linhas)** — por que o projeto tem requisito de contenção de alucinação. Citar RNF-003 (0% falso-negativo de segurança). Descrever os 3 vetores (inventividade, classificação amaciada, resposta degenerada). Declarar princípio: três camadas determinísticas pós-LLM, zero tokens extras.
2. **Seções paralelas por medida** (3 sub-seções, ~30 linhas cada):
   - **#1 Override determinístico de criticidade**: o quê (pós-processa `AuditResult` contra `routing.context`), quando (PR toca auth/.env/CI/CD/infra), efeito no relatório (gap `[DETERMINÍSTICO]`, criticidade garantida `Crítica`), por quê (RNF-003).
   - **#2 Validação de grounding**: o quê (cada gap precisa citar arquivo do corpus), quando (sempre, pós-LLM), efeito (gaps não-groundados descartados; se todos descartados → `Inconclusiva`), por quê (corta alucinação de inventividade sem nova chamada LLM).
   - **#3 Fail-closed no parsing**: o quê (se JSON/schema inválido, responde conservador), efeito (status `Inconclusiva`, `Crítica`, `parseFailure: true`), por quê (AS-07 proíbe "falhar aberto").
3. **Como aparece na saída (tabela resumo, ~10 linhas)** — 3 colunas: Medida | Gatilho | Efeito observável no `AnalysisRecord`/relatório. (Moscenada em §5.2 deste Spec.)
4. **Por que não usamos mais chamadas LLM (5 linhas)** — zerar custo (RNF-007) e latência (RNF-001). Citar que #4 (consenso) e #5 (citação literal `evidence`) ficam como evolução pós-MVP.
5. **Limitações assumidas (5-10 linhas)** — regex de `securityPatterns` pode gerar falso-positivo controlado (preferir falso-positivo a falso-negativo, alinhado ao RNF-003); matcher por basename pode descartar gap válido que cita arquivo por referência indireta — aceitável para MVP e mensagem de "revisão humana" cobre o caso.
6. **Referência cruzada (3 linhas)** — links para `Requisitos.MD` (RNF-003), `RELATORIO_SEGURANCA_APPSEC.md` (AS-06, AS-07), `Arquitetura.MD` (ADR-005), e para este Spec.

---

## 8. Ordenação de Implementação (Tasks)

Conforme padrão `docs/superpowers/plans/`, recomenda-se gerar plano separado com tasks em checkboxes. Ordem sugerida:

1. **Task 1 — Contrato:** Atualizar `AnalysisRecord` em `types.ts` (enum `status` + `parseFailure`) e schema Mongoose em `AnalysisRepository.ts`. Atualizar tests que dependem do tipo.
2. **Task 2 — #3 fail-closed:** Refatorar fallback em `parseJSONSafely`, atualizar `tests/parse.test.ts`.
3. **Task 3 — #2 grounding:** Criar `src/utils/grounding.ts` + `tests/utils/grounding.test.ts` com cobertura 100%.
4. **Task 4 — #1 floor + integração:** Reescrever `assembleRecord` com as três camadas na ordem fixa, expandir `deriveRecommendations` para `Inconclusiva`, atualizar `tests/record.test.ts`.
5. **Task 5 — Apresentação:** Atualizar `ReportGenerator` para renderizar `"Inconclusiva"` e nota de `parseFailure`, atualizar `tests/services/ReportGenerator.test.ts`.
6. **Task 6 — Documentação curta:** Escrever `docs/CONTENCAO_ALUCINACAO.md` conforme estrutura em §7.
7. **Task 7 — Validação:** `npm run build && npm test` verde. Atualizar `README.MD` seção "Limitações conhecidas" mencionando as três camadas e linkando o documento curto.

---

## 9. Decisões de Design Registradas

| Decisão | Alternativa considerada | Razão da escolha |
|---|---|---|
| Fallback **sempre conservador** em `parseJSONSafely` | `strictMode` no construtor (CI liga, testes legados mantêm) | `false/Média` não é desejável em ambiente nenhum. Exp4; Atualizar `parse.test.ts` é custo baixo. |
| Matcher de grounding por **basename/path exato** | Similaridade léxica leve (token overlap) | Determinístico, ~15 linhas, zero deps, evita falso-positivo de grounding. |
| Novo status `"Inconclusiva"` persistido em MongoDB | Sinalizar só via `parseFailure: boolean` | PMO precisa distinguir visualmente "OK" de "não dá pra confiar". Status é o campo de UI, não telemetria. |
| #1 aplicado em `assembleRecord`, não em `parseJSONSafely` | Centralizar tudo em `parseJSONSafely` | `parseJSONSafely` deve permanecer focado em parseamento. `assembleRecord` já tem `routing` + `result` e é ponto único de montagem. |
| Gaps `[DETERMINÍSTICO]` com prefixo explícito | Gap sem prefixo | PMO precisa distinguir "regra da ferramenta" de "análise semântica da LLM". |
| #2 não invalida auditoria se ≥1 gap grounded | Invalidar sempre que qualquer gap for rejeitado | Muito rígido para LLMs verbosas; descartar gap individual já contém a alucinação. |
| `parseFailure` detectado por prefixo de string gap | Exceção estruturada do `parseJSONSafely` | Não quebra fluxos de erro já testados; texto estável do fallback é garantido por contrato. |

---

## 10. Referências

- **Requisitos relevantes:**
  - `Requisitos.MD` → RNF-003 (0% falso-negativo em segurança, preferir falso-positivo)
  - `Requisitos.MD` → RNF-001 (latência ≤30s/PR) e RNF-007 (custo médio < R$ 0,10/PR)
- **Relatório de segurança:**
  - `docs/RELATORIO_SEGURANCA_APPSEC.md` → AS-06 (prompt injection / falta de validação determinística), AS-07 (fallback "falha aberta")
- **Arquitetura:**
  - `docs/Arquitetura.MD` → ADR-005 (roteamento Groq/Gemini por sensibilidade)
- **Specs correlatos:**
  - `docs/superpowers/specs/2026-06-05-cli-commands-markdown-history-design.md` — define `ReportGenerator`, `AnalysisRecord` `_5.6`, persistência MongoDB recém-expandida.
- **Resultado das referências externas citadas em `proposta.MD`:**
  - `https://djw.fyi/portfolio/preventing-drift/` — *grounded citation* como técnica de prevenção de drift