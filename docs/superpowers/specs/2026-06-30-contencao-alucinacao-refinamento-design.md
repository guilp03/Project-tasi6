# Design Doc: Refinamento da Contenção de Alucinação (floor por código vs. documentação + gaps não verificados visíveis)

**Data:** 2026-06-30
**Status:** Aprovado para implementação
**Evolução de:** `docs/superpowers/specs/2026-06-30-contencao-alucinacao-design.md`
**Escopo:** Mitigar dois efeitos colaterais do MVP de contenção de alucinação identificados em testes reais, preservando o RNF-003 (0% falso-negativo em segurança).

---

## 1. Contexto e Problema

O spec de contenção de alucinação (`2026-06-30-contencao-alucinacao-design.md`) aprovou três camadas determinísticas pós-LLM (floor de criticidade, grounding dos gaps e fail-closed no parsing) e **documentou deliberadamente** dois trade-offs de MVP em sua seção §5 ("Limitações assumidas"):

1. A regex ampla de `securityPatterns` (`/token/i`, `/auth/i`, `/crypto/i`, ...) casa arquivos de **documentação** sobre segurança, não apenas código-fonte de segurança.
2. O matcher de grounding por basename/path exato descarta gaps válidos que referenciam arquivos por paráfrase; quando todos os gaps são descartados, a análise inteira da LLM é substituída por uma mensagem genérica.

Os trade-offs foram aceitos no MVP por alinharem-se ao RNF-003 ("priorizar falso-positivo a falso-negativo"). Executamos dois testes reais (`fetch-and-audit chalk/chalk 642` e `fetch-and-audit nextauthjs/next-auth 13396`) que expuseram o custo desse trade-off em dois cenários representativos:

### 1.1 Sintoma A — chalk/chalk #642 (rota Groq)

O PR modifica `source/vendor/supports-color/browser.js`. A LLM gerou justificativa útil (em `result.justificativa`, sobre o bug do `navigator`), mas o gap que ela produziu **não citou literalmente** `browser.js`. O `validateGapsGrounding` rejeitou todos os gaps; como `securityFloorTriggered = false`, `assembleRecord` descartou a análise inteira e o relatório virou `Inconclusiva` com uma mensagem genérica. A justificativa original permaneceu no rodapé mas o gap útil sumiu do corpo — o PMO perdeu o conteúdo analítico que a LLM produziu, recebendo em troca uma instrução genérica de "revisão humana recomendada".

### 1.2 Sintoma B — nextauthjs/next-auth #13396 (rota Gemini)

O PR modifica apenas `docs/pages/guides/refresh-token-rotation.mdx` (correção de um *exemplo* TypeScript em um guia de docs). A regex `SENSITIVE_FILE_RE` no `assembleRecord` casou `token` em `refresh-token-rotation` e disparou o floor determinístico, forçando criticidade `Crítica` e injetando o gap `[DETERMINÍSTICO] Arquivo sensível detectado (docs/pages/guides/refresh-token-rotation.mdx)`. A LLM, via Groq no routing ampliado, corretamente julgou que o PR era "fora de escopo" (só corrige tipo em exemplo de docs), mas o floor achatou sua análise. Resultado: um PR trivial de correção de tipagem em documentação foi classificado como `Crítica` e marcado como exigindo atualização documental obrigatória.

### 1.3 Bug latente adicional — listas de padrões divergentes

Investigação do código revelou que a lista de padrões sensíveis está **duplicada** com conteúdo **divergente**:

- `calculateRoutingDecision` (`LLMIntegrationService.ts:356`) usa um array `securityPatterns` com `/api[_-]?key/i`, `/dockerfile/i`, `/cloudformation/i`, `/aws|gcp|azure/i`, etc.
- `assembleRecord` (`LLMIntegrationService.ts:158`) usa uma regex única `SENSITIVE_FILE_RE` com `/token/i`, `/crypto/i`, `/ssl|tls/i`, etc.

Consequência: o floor pode disparar por `token` sem que o routing tenha ido a Gemini, ou o routing ir a Gemini por `api_key` sem que o floor dispare. Hoje isso é invisível porque `hasSecurityChanges` (linha 396) governa o routing e só casualmente cobre os mesmos padrões do floor — mas é um drift não testado entre duas fontes de verdade.

### 1.4 Objetivo deste refinamento

Mitigar os sintomas A e B **sem relaxar o RNF-003**. A diretiva do requisito é "qualquer modificação em regras de autenticação, autorização, criptografia ou infraestrutura" deve ser `Crítica` — isso se refere a **código-fonte** de segurança, não a arquivos de documentação que *mencionam* segurança. O refinamento distingue essas duas classes usando a flag `FileMetadata.isDocumentation` (já determinística e testada em `GitHubExtractorService.classifyFile:109`), e une as duas listas de padrões num único helper compartilhado. Em paralelo, expõe os gaps rejeitados pelo grounding sob um selo `[NÃO ANCORADO]` numa seção dedicada do relatório, preservando o conteúdo analítico da LLM sem tratá-lo como fato verificado. O status `Inconclusiva` (fail-closed) é mantido quando todos os gaps são rejeitados.

---

## 2. Escopo

### 2.1 Incluído

1. **Novo utilitário `src/utils/securityPatterns.ts`** com `matchesSecurityPattern(path): boolean` — fonte única de verdade, união das duas listas hoje divergentes.
2. **Refino da Medida #1 (floor)** em `assembleRecord`: floor passa a computar `securityFloorTriggered` aplicando `matchesSecurityPattern` **apenas sobre arquivos com `isDocumentation === false`**. A lista `sensitiveFiles` na mensagem `[DETERMINÍSTICO]` segue o mesmo gate. `routing.context` **não** é alterado — o routing continua usando `matchesSecurityPattern` sobre todos os arquivos (docs sensíveis seguem para Gemini para revisão cuidadosa).
3. **Exposição dos gaps rejeitados (Medida #2 aprimorada)**: `assembleRecord` povoa `analysis.untrackedGaps: string[]` com cada gap rejeitado prefixado de `[NÃO ANCORADO] `. O status `Inconclusiva` quando `!grounded && !securityFloorTriggered` é **mantido** (fail-closed preservado); os `untrackedGaps` apenas tornam visível o que a LLM disse.
4. **Novo campo `analysis.untrackedGaps?: string[]`** em `AnalysisRecord` (`types.ts`) + schema Mongoose em `AnalysisRepository.ts`. Opcional; default `[]`; sem migration.
5. **`ReportGenerator`**: nova seção condicional `## Gaps não verificados` renderizando `untrackedGaps` como bullet list + nota fixa de uma linha explicando o selo. Seção omitida quando `untrackedGaps` é `undefined`/`[]`.
6. **Unificação das duas listas de padrões** (bug latente do drift): `calculateRoutingDecision` e `assembleRecord` passam a usar o mesmo helper `matchesSecurityPattern`.
7. **Testes**: novo `tests/utils/securityPatterns.test.ts` (cobertura 100% do helper); `tests/record.test.ts` recebe casos de floor não disparando em PR só-doc sensível, floor disparando em PR misto, e `untrackedGaps` populado nos três ramos; `tests/services/ReportGenerator.test.ts` recebe caso de renderização da nova seção.
8. **Documento curto `docs/CONTENCAO_ALUCINACAO.md`**: atualizar §5 ("Limitações assumidas") para registrar que o matcher agora distingue código de documentação, e adicionar §2.4 mencionando a nova seção de "Gaps não verificados".

### 2.2 Excluído (escopo futuro)

- **Matcher de grounding fuzzy** (similaridade léxica leve, token overlap) — permanece fora; o matcher literal continua being o contrato de grounding. O aprimoramento aqui é apenas na *apresentação* dos gaps rejeitados, não na heurística de aceitação.
- **Identificação de "arquivo sensível" via diff content** (regex sobre o conteúdo do diff em vez do path) — aumentaria a complexidade e escaparia do envelope de "pós-processamento determinístico barato". Mantém-se em path only.
- **Schema `gaps[]` ampliado para `{ file, docSection, claim, evidence }`** — dependente de prompt engineering adicional, fora do scope MVP; continua como evolução pós-MVP.
- **Telemetria adiável por gap rejeitado** (contagem, motivo) — os `untrackedGaps` ficam disponíveis no `AnalysisRecord` para análise pós-hoc; sem contador extra neste refinamento.

---

## 3. Arquitetura

### 3.1 Estrutura de diretórios (delta)

```
src/
├── services/
│   ├── LLMIntegrationService.ts   # MODIFICADO — assembleRecord (floor gated + untrackedGaps)
│   ├── ReportGenerator.ts         # MODIFICADO — renderiza "## Gaps não verificados"
│   ├── persistence/
│   │   └── AnalysisRepository.ts   # MODIFICADO — schema Mongoose ganha untrackedGaps
│   └── types.ts                   # MODIFICADO — analysis.untrackedGaps?: string[]
└── utils/
    ├── prompts.ts                 # INALTERADO
    ├── grounding.ts               # INALTERADO (rejectedGaps já retornado)
    └── securityPatterns.ts        # NOVO — matchesSecurityPattern()

tests/
├── record.test.ts                 # MODIFICADO — novos casos
├── services/
│   └── ReportGenerator.test.ts    # MODIFICADO — novo caso
└── utils/
    └── securityPatterns.test.ts   # NOVO

docs/
├── CONTENCAO_ALUCINACAO.md        # MODIFICADO — §2.4 + §5 atualizados
└── superpowers/specs/
    └── 2026-06-30-contencao-alucinacao-refinamento-design.md  # ESTE SPEC
```

### 3.2 Princípios orientadores

1. **RNF-003 preservado estrito para código-fonte**: PR que toca `src/auth/middleware.ts` (não-doc sensível) continua forçando `Crítica` mesmo que a LLM tenha dito `Média`. O gating `!isDocumentation` remove apenas arquivos de documentação do floor.
2. **Decisão de provedor (ADR-005) inalterada**: routing continua em Gemini quando há qualquer arquivo sensível (incluindo docs). Revisão cuidadosa mantida; apenas a criticidade final não é inflada por pura documentação.
3. **`routing.context` intocado**: as 4 flags booleanas existentes permanecem para telemetria e para o routing decidir provedor. O floor passa a computar sua própria condição local a partir de `corpus.files`, usando o helper compartilhado e o gate `!isDocumentation`. Sem quebra de contrato.
4. **Fonte única de verdade para padrões sensíveis**: o novo `matchesSecurityPattern` serve a routing e floor, eliminando o drift entre as duas listas hoje divergentes.
5. **Fail-closed preservado**: status `Inconclusiva` quando `!grounded && !securityFloorTriggered` continua bloqueando auto-aprovação; os `untrackedGaps` apenas expõem o conteúdo da LLM sem promover "não dá pra confiar" a "OK".
6. **Zero custo adicional e latência desprezível**: continua sendo pós-processamento determinístico; o helper é uma função pura O(n) sobre `corpus.files` com uma regex por arquivo.

---

## 4. Componentes e Interfaces

### 4.1 `src/utils/securityPatterns.ts` — NOVO

Função pura, sem side-effects, testável isoladamente. Espelha o padrão de `grounding.ts`.

```typescript
/**
 * Fonte única de verdade para padrões de arquivo sensível (RNF-003).
 * Consumido por `calculateRoutingDecision` (routing ADR-005) e por
 * `assembleRecord` (Medida #1 floor).
 *
 * União das listas hoje divergentes em LLMIntegrationService.ts
 * (securityPatterns vs. SENSITIVE_FILE_RE). Ordem alfabética para legibilidade.
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

export function matchesSecurityPattern(filePath: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(filePath));
}
```

**Decisões:**
- **Lista única exportada como array**: routing e floor chamam o mesmo helper, garantindo que sempre concordem sobre quais paths são sensíveis.
- **Case-insensitive** (todas as regexes carregam `/i`), igual ao comportamento atual.
- **Não recebe `FileMetadata`**: opera só sobre o path (string). O gate `!isDocumentation` é aplicado pelo chamador — mantém o helper focado em uma responsabilidade.
- **`/token/i` permanece**: cobre arquivos como `src/auth/token.ts`. Embora também case `docs/guides/refresh-token-rotation.mdx`, o gate `!isDocumentation` no floor remove o artefato de documentação do cálculo. O routing ainda casa o `.mdx` e envia o PR para Gemini (revisão cuidadosa mantida), mas o floor não infla criticidade.
- **`/docker[-_]?compose/i`**: a versão anterior no routing era `/docker[-_]?compose/i` (sem capturar) e no floor era ausente. A união mantém o comportamento do routing (casa `docker-compose` e `docker_compose`). `dockerfile` é casado por regex separada (`/dockerfile/i`), igual à lista antiga do routing.
- **`/aws|gcp|azure/i`**: mantida da lista de routing original. Tem risco residual de falso-positivo por substring (ex.: `lawyers.ts` casa `aws`). Já existia no routing antigo e seu efeito é só rotear a Gemini (revisão cuidadosa), não inflar criticidade. Se virar ruído mensurável, evolução futura: trocar por word-boundary (`/\baws\b/i`) — fora deste spec.

### 4.2 `src/services/LLMIntegrationService.ts` — `calculateRoutingDecision` (refatorado)

Substituir o array local `securityPatterns` (linhas atuais ~356-375) e o loop de teste (`securityPatterns.forEach`) por chamadas ao helper:

```typescript
// Detect sensitive file patterns (ADR-005 routing) — uses shared helper
corpus.files.forEach((file) => {
  const filePath = file.path.toLowerCase();

  // Flags específicas continuam sendo setadas por includes() — contrato de
  // routing.context intocado (telemetria). Não há gate !isDocumentation aqui.
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
```

**Notas:**
- **Sem gate `!isDocumentation` aqui** — o routing continua mandando docs sensíveis para Gemini (revisão cuidadosa mantida). Isso preserva a observabilidade: o PMO vê no relatório que o PR foi roteado a Gemini porque o tópico é sensível.
- O `hasSecurityChanges` agora é uma cobertura mais ampla que antes? Sim — a união das listas aproxima-se do sobrejunto (todas as regexes de ambas). O efeito incremental é que routing passa a enviar para Gemini casos que antes o floor pegava mas o routing não (`token`, `crypto`, `ssl|tls`) e casos que antes o routing pegava mas o floor não (`api_key`, `dockerfile` puro, `cloudformation`, `aws|gcp|azure`). Isso é estritamente uma melhora de cobertura de revisão cuidadosa, alinhada a ADR-005.

### 4.3 `src/services/LLMIntegrationService.ts` — `assembleRecord` (refinado)

Abaixo, o novo `assembleRecord`. Seções inalteradas elididas com `// ... inalterado ...`:

```typescript
private assembleRecord(
  corpus: PRCorpus,
  routing: RoutingDecision,
  result: AuditResult,
  usage: TokenUsage,
  model: string
): AnalysisRecord {
  // --- Medida #3: detectar falha de parsing — INALTERADO ---
  const parseFailure = result.gaps.some(g =>
    typeof g === "string" && g.startsWith("Análise inconclusiva — resposta da LLM")
  );

  // --- Medida #2: grounding — agora expõe rejeitados ---
  const { groundedGaps, rejectedGaps, grounded } = validateGapsGrounding(result, corpus);

  // --- Medida #1: floor — agora gated por !isDocumentation, usa helper ---
  const securityFloorTriggered = corpus.files.some(
    f => !f.isDocumentation && matchesSecurityPattern(f.path)
  );

  // --- Consolidar gaps, status, criticality ---
  let finalGaps: string[];
  let finalStatus: "Atenção necessária" | "OK" | "Inconclusiva";
  let finalCriticality: AuditResult["criticidade"];
  let finalJustification = result.justificativa;
  let finalRequiresDocsUpdate = result.requires_docs_update;
  let untrackedGaps: string[] = [];   // ← NOVO campo

  const untrackedTagged = rejectedGaps.map(g => `[NÃO ANCORADO] ${g}`);

  if (parseFailure) {
    // INALTERADO — estado bloqueante sobrepõe tudo
    finalGaps = result.gaps;
    finalStatus = "Inconclusiva";
    finalCriticality = "Crítica";
    finalRequiresDocsUpdate = true;
    // untrackedGaps permanece [] — análise não é trustable, não há gaps para exibir
  } else if (!grounded && !securityFloorTriggered) {
    // INALTERADO — Inconclusiva Alta (fail-closed mantido)
    finalGaps = [
      "Análise inconclusiva: gaps gerados pela LLM não puderam ser ancorados nos artefatos do PR — revisão humana recomendada.",
    ];
    finalStatus = "Inconclusiva";
    finalCriticality = "Alta";
    finalRequiresDocsUpdate = true;
    // ← NOVO: preserva gaps rejeitados sob selo, para o PMO ver a análise da LLM
    untrackedGaps = untrackedTagged;
  } else if (securityFloorTriggered) {
    // REFINADO — sensitiveFiles só sobre !isDocumentation, usa helper
    const sensitiveFiles = corpus.files
      .filter(f => !f.isDocumentation && matchesSecurityPattern(f.path))
      .map(f => f.path);
    const fileList = sensitiveFiles.length > 0
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
    // ← NOVO: mesmo com floor, se houve gaps rejeitados, eles ficam visíveis
    untrackedGaps = untrackedTagged;
  } else {
    // Caminho feliz — INALTERADO, mas agora também expõe rejeitados se houver
    finalGaps = groundedGaps;
    finalStatus = result.requires_docs_update ? "Atenção necessária" : "OK";
    finalCriticality = result.criticidade;
    untrackedGaps = untrackedTagged;
  }

  const effectiveResult = {
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
      detectedChanges: corpus.files.map((f: FileMetadata) => `${f.path} (${f.status})`),
      documentationGaps: finalGaps,
      untrackedGaps,                                          // ← NOVO
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

**Decisões:**
- **`untrackedGaps` populado em todos os ramos não-#3**: a análise da LLM é conteúdo potencialmente útil mesmo quando o floor dispara (o PMO pode entender por que a LLM disse `Média` antes do floor forçar `Crítica`). Exibir sob selo `[NÃO ANCORADO]` deixa claro que **não é fato verificado**.
- **Bloco `parseFailure` não povoa `untrackedGaps`**: a análise não é trustable (JSON quebrado); não há gaps da LLM para mostrar.
- **`fileList` fallback para `"arquivos sensíveis (ver routing)"`**: defensivo; na prática `securityFloorTriggered = true` implica sempre ao menos um arquivo `!isDocumentation` casando o helper, então `sensitiveFiles` é não-vazio.
- **Caminho feliz pode terminar `OK` agora para PRs só-doc antes classificados `Crítica`**: é exatamente o alívio do sintoma B. O PR continua em Gemini (revisão cuidadosa), mas se a LLM julgar `requires_docs_update: false`, a ferramenta não sobrepõe — alinhado ao espírito do RNF-003 (código de segurança, não documentação sobre segurança).
- **`deriveRecommendations` INALTERADO**: continua derancando recomendações por criticidade/gaps; os novos `untrackedGaps` não interferem nessa derivação.

### 4.4 `src/services/types.ts` — alteração de contrato

```typescript
export interface AnalysisRecord {
  // ... campos existentes inalterados ...
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
  // ... resto inalterado ...
}
```

**Migração MongoDB:** campo novo opcional; documentos antigos sem `untrackedGaps` são lidos como `undefined`, e o `ReportGenerator` omite a seção quando ausente ou vazio. Sem migration script necessário (Mongoose é schemaless). Schema Mongoose em `AnalysisRepository.ts:getModel()` deve declarar `untrackedGaps: { type: [String], default: [] }` para gravar explicitamente o default e manter consistência nos novos documentos.

### 4.5 `src/services/persistence/AnalysisRepository.ts` — schema Mongoose

Adicionar ao schema do `AnalysisRecord`:

```typescript
untrackedGaps: { type: [String], default: [] },
```

**Localização:** inserir logo abaixo de `documentationGaps` no schema existente. Sem outra mudança — o `getModel()` continua single-document, o repositório só persiste o novo campo.

### 4.6 `src/services/ReportGenerator.ts` — nova seção condicional

Após a seção "## Gaps Documentais Encontrados" existente, inserir condicionalmente:

```typescript
// Dentro de generate(), após renderizar documentationGaps:
const untracked = record.analysis.untrackedGaps ?? [];
if (untracked.length > 0) {
  markdown.push("");
  markdown.push("## Gaps não verificados");
  markdown.push("");
  for (const gap of untracked) {
    markdown.push(`- ${gap}`);   // gap já contém prefixo "[NÃO ANCORADO] "
  }
  markdown.push("");
  markdown.push(
    "Gaps marcados como [NÃO ANCORADO] não puderam ser verificados contra os artefatos do PR. " +
    "Avalie manualmente antes de decidir o merge."
  );
}
```

**Regras de renderização:**
- Cada item de `analysis.untrackedGaps` vira um bullet precedido de `- `, mantendo o prefixo `[NÃO ANCORADO] ` aplicado em `assembleRecord` — o leitor vê claramente o selo.
- Seção **omitida** quando `untrackedGaps` é `undefined` ou `[]` — zero ruído no caminho feliz.
- Nota fixa de uma linha abaixo da lista, sempre que a seção aparece, explicando o significado do selo e reforçando a recomendação de merge review manual.

### 4.7 `docs/CONTENCAO_ALUCINACAO.md` — atualização do documento curto

**Adicionar §2.4 — "Gaps não verificados"** (após §2.3 existente), curto (~15 linhas):

> "Se algum gap gerado pela LLM não pôde ser ancorado em um arquivo real do PR (ou seja, não cita nem o path nem o basename de nenhum arquivo do corpus), ele não é simplesmente descartado. Aparece no relatório numa seção **Gaps não verificados**, com o prefixo `[NÃO ANCORADO]`. O status permanece `Inconclusiva` quando nenhum gap foi ancorado (fail-closed), mas o conteúdo analítico fica visível para o PMO avaliar manualmente. Esta melhoria é **apresentação**, não relaxamento: o matcher de grounding continua operando por basename/path exato case-insensitive; o que mudou é que os gaps rejeitados são preservados na saída em vez de descartados silenciosamente."

**Atualizar §5 — Limitações assumidas**:

- Substituir a primeira limitação ("Regex de securityPatterns é abrangente") por: "Regex de `securityPatterns` é abrangente, mas o floor de criticidade agora a aplica **apenas sobre arquivos não-documentais** (`isDocumentation === false`). Um PR que edita apenas `docs/guides/refresh-token-rotation.mdx` não força `Crítica` — o roteamento ainda o envia a Gemini para revisão cuidadosa, mas a criticidade segue a análise da LLM. Arquivos de **código-fonte** de segurança (`src/auth/middleware.ts`, `.env`, workflows de CI/CD) continuam disparando o floor `Crítica`, preservando o RNF-003."
- Atualizar a segunda limitação ("Matcher de grounding é literal") para registrar que gaps rejeitados são preservados na nova seção em vez de descartados silenciosamente.

---

## 5. Fluxo de Dados (Data Flow)

### 5.1 Pós-processamento pós-LLM (pós-refinamento)

```text
[LLMIntegrationService] callGroqRaw / callGeminiRaw → AuditResult
  │
  ▼
[parseJSONSafely]  #3 fail-closed                           (INALTERADO)
  ├── JSON válido + schema ok → AuditResult normal
  └── Falha → AuditResult conservador { Crítica, gap "inconclusiva" }
  │
  ▼
[assembleRecord]
  ├── #3 telemetria: parseFailure = gap.startsWith("Análise inconclusiva")?  (INALTERADO)
  │
  ├── #2 validateGapsGrounding(result, corpus)                                (INALTERADO)
  │     ├── groundedGaps → mantidos em `documentationGaps`
  │     └── rejectedGaps → prefixados "[NÃO ANCORADO] " em `untrackedGaps`  ← NOVO
  │
  ├── #1 floor: matchesSecurityPattern(f.path) sobre f com !isDocumentation  ← REFINADO
  │     └── Sim → injeta gap [DETERMINÍSTICO], força Crítica                 (gate novo)
  │
  ├── Consolidar finalGaps / finalStatus / finalCriticality / untrackedGaps
  │     ├── parseFailure? → "Inconclusiva" + Crítica + untrackedGaps = []         (INALTERADO)
  │     ├── !grounded && !securityFloor? → "Inconclusiva" + Alta + untrackedGaps  (expõe rejeitados)
  │     ├── securityFloor? → "Atenção necessária" + Crítica + untrackedGaps       (expõe rejeitados)
  │     └── caminho feliz → status/criticidade da LLM + untrackedGaps             (expõe rejeitados)
  │
  ▼
[AnalysisRecord] → ReportGenerator.generate() → Markdown
                  → AnalysisRepository.save() → MongoDB
```

### 5.2 Comportamento observável pós-refinamento (cinco cenários)

| Cenário | LLM retorna | #3 | #2 | #1 (gated) | Resultado final |
|---|---|---|---|---|---|
| **A. Caminho feliz** | `{Crítica, gaps citando arquivos reais}` | ok | grounded, 0 rejeitados | -- | Status `Atenção necessária`, `Crítica`, gaps LLM; `untrackedGaps = []` (seção omitida) |
| **B. Amacia criticidade em PR `auth/` (código)** | `{Média, gaps ok}` | ok | grounded | **dispara** (código `!isDoc`) | Status `Atenção necessária`, `Crítica` floor, gaps LLM + `[DETERMINÍSTICO]`; `untrackedGaps` conforme rejeitados |
| **C. Documentação sensível** (next-auth #13396) | `{fora de escopo, requires_docs_update=false}` | ok | grounded | **não dispara** (`.mdx` é `isDoc`) | Status `OK`, `Média`/LLM; routing ainda Gemini; `untrackedGaps = []` |
| **D. Inventa gaps sem citar arquivo** (chalk #642) | `{Alta, gaps por paráfrase}` | ok | **!grounded** | -- | Status `Inconclusiva`, `Alta`; `documentationGaps = [msg genérica]`; `untrackedGaps = ['[NÃO ANCORADO] ...']` (seção renderizada) |
| **E. JSON truncado** | `undefined` / markdown | **fail-closed** | -- | -- | Status `Inconclusiva`, `Crítica`, `parseFailure: true`, `untrackedGaps = []` (seção omitida) |

---

## 6. Estratégia de Testes

### 6.1 `tests/utils/securityPatterns.test.ts` (NOVO)

Cobertura do helper `matchesSecurityPattern`:

- Path de código auth (`src/auth/middleware.ts`) → `true`.
- Path `.env` (`.env.production`) → `true`.
- Path de workflow CI (`.github/workflows/deploy.yml`) → `true`.
- Path `Dockerfile` → `true`.
- Path `k8s/deployment.yaml` → `true`.
- Path `infra/main.tf` → `true`.
- Path com `token` (`src/auth/token.ts`) → `true`.
- Path com `api_key` (`api_key.json`) → `true`.
- Path de documentação sensível (`docs/guides/refresh-token-rotation.mdx`) → `true` (helper não deve aplicar gate `!isDocumentation`; gate é responsabilidade do chamador).
- Path de código não-sensível (`src/utils/format.ts`) → `false`.
- Path `README.md` → `false`.
- Case-insensitivity (`SRC/AUTH/MIDDLEWARE.TS`) → `true`.

### 6.2 `tests/record.test.ts` (MODIFICADO)

- **Adicionar caso C (só-doc sensível)**: PR com `[file("docs/guides/refresh-token-rotation.mdx")]` (cujo `file()` helper em `tests/fixtures.ts:37` retorna `isDocumentation: true` porque o path termina em `.mdx`) + routing `routingSecurity()` + resultado LLM `{requires_docs_update: false, criticidade: "Média", gaps: ["refresh-token-rotation.mdx carece de review"], justificativa: "fora de escopo"}` → esperar `status: "OK"`, `criticality: "Média"`, `documentationGaps = ["refresh-token-rotation.mdx carece de review"]` (gap ancorado pois cita o basename), `documentationGaps` **sem** `[DETERMINÍSTICO]` (floor não dispara, `.mdx` é `isDocumentation`), `untrackedGaps = []` (o único gap ancorou). Este caso valida diretamente o sintoma B (next-auth #13396).
- **Adicionar caso B (misto)**: PR com `[file("docs/auth.md"), file("src/auth/middleware.ts")]` + routing sensível + LLM `{requires_docs_update: false, criticidade: "Média", gaps: ["middleware.ts carece de docs"], justificativa: "ok"}` → esperar `criticality: "Crítica"` (floor dispara por `src/auth/middleware.ts`, que é `!isDocumentation`), `documentationGaps` contém `middleware.ts carece de docs` + gap `[DETERMINÍSTICO]` mencionando `src/auth/middleware.ts` (não mencionando `docs/auth.md`, que é doc), `untrackedGaps = []` (gap ancorou).
- **Adicionar caso D**: reproduzir o chalk — `[file("source/vendor/supports-color/browser.js")]` + routing standard + LLM gap por paráfrase sem citar basename → esperar `status: "Inconclusiva"`, `criticality: "Alta"`, `documentationGaps = [msg genérica]`, `untrackedGaps` contém o gap rejeitado prefixado.
- **Adicionar caso (caminho feliz com gap rejeitado)**: `[file("src/foo.ts")]` + routing standard + LLM `{Alta, gaps: ["foo.ts carece de docs", "endpoint /api/login não documentado"]}` → esperar `status: "Atenção necessária"`, `documentationGaps = ["foo.ts carece de docs"]`, `untrackedGaps = ["[NÃO ANCORADO] endpoint /api/login não documentado"]`. Confirma que rejeitados são expostos no caminho feliz.
- **Manter testes existentes**: o caso "#1 floor: PR auth/ com LLM dizendo Média → força Crítica" continua passando (usa `file("src/auth/middleware.ts")` que é `!isDocumentation`). Garantir que `file()` helper em `tests/fixtures.ts` produz `isDocumentation: false` para paths de código (verificação já feita no grep — `isDocumentation: path.endsWith(".md")` em `fixtures.ts:37`).
- **Manter caso "#2 grounding: gap não-ancorado + sem floor → Inconclusiva Alta"**: agora também valida que `untrackedGaps` é populado (novo assert).

### 6.3 `tests/services/ReportGenerator.test.ts` (MODIFICADO)

- **Adicionar caso "renderiza seção Gaps não verificados quando untrackedGaps não-vazio"**: instanciar `AnalysisRecord` com `analysis.untrackedGaps = ["[NÃO ANCORADO] gap X"]`, chamar `generate()`, esperar markdown contendo `## Gaps não verificados`, o bullet `- [NÃO ANCORADO] gap X`, e a nota explicativa fixa.
- **Adicionar caso "omite seção quando untrackedGaps vazio"**: mesmo record com `untrackedGaps = []` → markdown **não** contém `## Gaps não verificados`.
- **Adicionar caso "omite seção quando untrackedGaps undefined"**: mesmo record sem o campo → markdown **não** contém `## Gaps não verificados`.
- **Manter testes existentes** de `Inconclusiva` e `parseFailure` (já adicionados no PR containção original).

### 6.4 `tests/routing.test.ts` — INALTERADO

Routing não muda de comportamento observável para os casos existentes:
- `file(".env.production")` → Gemini + `hasEnvChanges=true` + `hasSecurityChanges=true`. A união das listas não remove nenhum match que já disparava.
- Risco: novos matches passam a aparecer (`token` no routing, antes só no floor). Verificar se algum teste atual contém path com `token` que antes **não** disparava routing — ex.: `file("src/auth/login.ts")` (já dispara por `auth`); `file("k8s/deployment.yaml")` (já dispara por `k8s`); nenhum caso atual usa só `token`. Logo, testes existentes seguem válidos.
- Verificação adicional: confirmar que a união das listas não remove matches (só agrega), entao nenhum teste verde fica vermelho por perda de match.

### 6.5 `tests/utils/grounding.test.ts` — INALTERADO

`validateGapsGrounding` não muda; seus testes seguem válidos.

### 6.6 Cobertura esperada

- `src/utils/securityPatterns.ts`: 100% (novo arquivo, novo teste).
- `src/utils/grounding.ts`: manter 100%.
- `src/services/LLMIntegrationService.ts`: manter cobertura ≥ atual; novos ramos de `assembleRecord` cobertos pelos novos casos de `record.test.ts`.
- `src/services/ReportGenerator.ts`: cobertura mantida ou aumentada com os novos casos de renderização.

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| PR só-doc com código sensível embutido (ex.: exemplo de código de auth dentro de `.mdx`) é classificado `OK` quando talvez devesse ser `Atenção necessária` | Média | Médio | O routing permanece em Gemini para revisão cuidadosa; a LLM vê o diff e pode retornar `requires_docs_update: true` se julgar. O RNF-003 foca em **modificação de regras de auth/infra**, não em mudar texto de um guia — interpretacao correta. |
| Falso-negativo por `isDocumentation` mal classificado | Baixa | Alto | `classifyFile` já é determinístico e testado; casos confirmados em `tests/services/GitHubExtractorService.test.ts:80`. Se surgir caso, atualizar `classifyFile` — não afeta este refinamento. |
| Quebra de contrato MongoDB por campo novo | Baixa | Baixo | Campo opcional, default `[]`, schemaless. Migração retroativa automática (`undefined` ≡ `[]` no ReportGenerator). |
| Comportamento de routing muda (união das listas) e quebra teste existente | Baixa | Baixo | A união só **agrega** padrões — nunca remove. Verificação manual dos casos em `tests/routing.test.ts` confirmou nenhum path atual deixa de casar. |
| `untrackedGaps` inflar relatório em PRs com LLM verbosa | Média | Baixo | Seção é visualmente separada e explicitada como "não verificado". Se virar problema de ruído, evolução futura: exibir só top-N rejeitados ou aplicar filtro por tamanho. Fora deste spec. |

---

## 8. Ordenação de Implementação (Tasks)

Conforme padrão `docs/superpowers/plans/`, gere plano separado com tasks em checkboxes. Ordem sugerida:

1. **Task 1 — Helper `securityPatterns`**: criar `src/utils/securityPatterns.ts` + `tests/utils/securityPatterns.test.ts` (cobertura 100%). `npm test -- securityPatterns` verde.
2. **Task 2 — Contrato**: adicionar `analysis.untrackedGaps?: string[]` em `types.ts` + schema Mongoose. `npm run build` verde.
3. **Task 3 — `calculateRoutingDecision`**: refatorar para usar `matchesSecurityPattern`. `npm test -- routing` verde (testes existentes seguem válidos — união só agrega).
4. **Task 4 — `assembleRecord`**: refinar floor com gate `!isDocumentation` + popular `untrackedGaps` em todos os ramos não-#3. `npm test -- record` verde com os novos casos B/C/D + caminho feliz com rejeitado.
5. **Task 5 — `ReportGenerator`**: adicionar seção condicional `## Gaps não verificados` + nota explicativa. `npm test -- ReportGenerator` verde com novos casos.
6. **Task 6 — Documentação**: atualizar `docs/CONTENCAO_ALUCINAO.md` §2.4 + §5.
7. **Task 7 — Validação**: `npm run build && npm test` verde. Atualizar `README.MD` seção "Limitações conhecidas" se citar o floor/grounding.
8. **Task 8 — Smoke test**: re-rodar `npm run dev -- fetch-and-audit chalk chalk 642 ...` e `npm run dev -- fetch-and-audit nextauthjs next-auth 13396 ...` e validar:
   - chalk: relatório com seção "## Gaps não verificados" contendo a análise do `navigator` sob `[NÃO ANCORADO]`; status continua `Inconclusiva`.
   - next-auth: relatório **sem** `[DETERMINÍSTICO]`; criticidade segue a LLM (`Média` ou `OK` conforme o modelo responder); routing ainda Gemini; se a LLM gerar gap não-ancorado, aparece em `## Gaps não verificados`.

---

## 9. Decisões de Design Registradas

| Decisão | Alternativa considerada | Razão da escolha |
|---|---|---|
| Gate por `FileMetadata.isDocumentation` (flag existente) | Nova regex de path (diretórios `docs/` + extensões `.md`/`.mdx`/...) | `isDocumentation` já é determinístico e testado em `GitHubExtractorService.classifyFile:109`, evitando reinventar heurística. Fonte única de verdade para "isto é documentação?". |
| Helper compartilhado `matchesSecurityPattern` | Manter duas listas separadas (routing e floor) | Elimina drift já existente entre as duas listas (bug latente exposto pelo caso next-auth). Garante que routing e floor sempre concordem sobre o que é sensível. |
| Routing sem gate `!isDocumentation` (Gemini para docs sensíveis) | Routing também gated (só-doc sensível → Groq) | Preserva revisão cuidadosa para tópicos sensíveis — PR que edita `docs/guides/auth.md` continua indo a Gemini. A revisão ainda é útil para checar que a doc está correta; apenas a criticidade final não é inflada. |
| `untrackedGaps` exposto em todos os ramos não-#3 | Expor só no ramo `!grounded && !securityFloor` | A análise da LLM é conteúdo útil mesmo quando o floor dispara (o PMO pode entender por que a LLM disse `Média` antes do floor). Selo `[NÃO ANCORADO]` deixa claro que não é fato verificado. |
| `untrackedGaps` campo opcional (`?`) | Campo obrigatório com default `[]` no tipo | Retrocompatibilidade com documentos MongoDB antigos — `undefined` é lido como `[]` no ReportGenerator. Schema Mongoose declara default; tipo TS é opcional. |
| `parseFailure` não povoa `untrackedGaps` | Expor gaps mesmo em parse failure | Em parse failure, `result.gaps` contém só o gap canônico "Análise inconclusiva" do fallback — não há conteúdo analítico da LLM para expor. |
| Selo `[NÃO ANCORADO]` aplicado em `assembleRecord`, não no ReportGenerator | Selo aplicado na renderização | Mantém o prefixo no dado persistido (traceabilidade no MongoDB) e simplifica o ReportGenerator (só concatena bullets). |

---

## 10. Referências

- **Spec evoluído:** `docs/superpowers/specs/2026-06-30-contencao-alucinacao-design.md`
- **Requisitos relevantes:** `Requisitos.MD` → RNF-003 (0% falso-negativo em segurança, "priorizar falso-positivo em vez da omissão de riscos"), RNF-001 (latência ≤30s/PR), RNF-007 (custo médio < R$ 0,10/PR).
- **Relatório de segurança:** `docs/RELATORIO_SEGURANCA_APPSEC.md` → AS-06, AS-07.
- **Arquitetura:** `docs/Arquitetura.MD` → ADR-005 (roteamento Groq/Gemini por sensibilidade).
- **Documento curto:** `docs/CONTENCAO_ALUCINACAO.md` — alvo da atualização em §2.4 + §5.
- **Casos de teste que motivaram o refinamento:**
  - `chalk/chalk` PR #642 — "Fix `navigator` not defined `ReferenceError`".
  - `nextauthjs/next-auth` PR #13396 — "docs: fix TypeScript type mismatch in refresh token rotation example".