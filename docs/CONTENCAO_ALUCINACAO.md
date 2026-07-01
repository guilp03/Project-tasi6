# Contenção de Alucinação no PR Documentation Auditor

> Documento curto, voltado a PMO, revisores e professores. Para o design técnico completo, consulte [`docs/superpowers/specs/2026-06-30-contencao-alucinacao-design.md`](./superpowers/specs/2026-06-30-contencao-alucinacao-design.md).

## 1. Por que este documento existe

A ferramenta entrega ao PMO um relatório Markdown que diz "OK" ou "Atenção necessária". Esse relatório é construído a partir da resposta de uma LLM (Groq Llama 3.3 70B no caminho padrão, Gemini 2.5 Flash no caminho sensível). LLMs, por construção, cometem três tipos de erro que chamamos genericamente de **alucinação**:

1. **Amaciar a criticidade** — classificar como "Média" uma mudança em `auth/middleware.ts` que deveria ser sempre "Crítica".
2. **Inventar gaps** — afirmar que "o endpoint `/api/login` não está documentado" em um PR que não contém esse arquivo.
3. **Degenerar a resposta** — devolver JSON truncado, markdown em vez de JSON, ou um objeto com schema inválido.

O **RNF-003** do `Requisitos.MD` exige meta de **0% de falsos-negativos** em segurança, infraestrutura, compliance e autenticação. Sem barreiras explícitas, as três classes de alucinação acima violam diretamente esse requisito. O `RELATORIO_SEGURANCA_APPSEC.md` já registrou isso como **AS-06** (falta de validação determinística) e **AS-07** (fallback atual "falha aberto", produzindo falso-negativo silencioso).

Para conter essas alucinações, a ferramenta implementa **três camadas determinísticas pós-LLM**. "Determinísticas" significa: não chamam outro modelo, não consomem tokens extras e não dependem de IA para serem aplicadas. Elas rodam depois que a LLM respondeu e **filtram ou sobrepõem** a decisão do modelo. O custo adicional é zero (RNF-007 preservado) e a latência adicional é negligenciável (RNF-001 preservado).

## 2. As três camadas

### 2.1 #1 — Override determinístico de criticidade ("floor de segurança")

**O que faz:** depois que a LLM responde, a ferramenta inspeciona os arquivos do PR (não a resposta da LLM) procurando padrões sensíveis: `auth/`, `.env`, `.github/workflows/`, `infra/`, `secret`, `token`, `credential`, `dockerfile`, `terraform`, `kubernetes`, `ssl`/`tls`, entre outros. Esses padrões já são detectados hoje para escolha do provedor (ADR-005); agora também disparam um **floor de criticidade**.

**Quando dispara:** se o PR contém qualquer arquivo sensível e a LLM retornou criticidade abaixo de `Crítica`, a ferramenta sobrepõe para `Crítica` e `requires_docs_update: true`. Mesmo que a LLM tenha dito "Média" ou "Baixa", o relatório final dirá "Crítica".

**Efeito observável no relatório:** aparece um gap com o prefixo `[DETERMINÍSTICO]`, ex.:

> `[DETERMINÍSTICO] Arquivo sensível detectado (auth/middleware.ts) — documentação obrigatória por regra determinística (RNF-003).`

O prefixo `[DETERMINÍSTICO]` permite ao PMO distinguir "essa foi uma regra mandatória da ferramenta" de "essa foi uma análise semântica do modelo". A justificativa final também indica que a criticidade foi elevada por floor:

> `Criticidade elevada por floor determinístico (RNF-003). Justificativa LLM: <texto original do modelo>.`

**Por quê:** atende diretamente o requisito mandatório do **RNF-003** ("Qualquer modificação em regras de autenticação, autorização, criptografia ou infraestrutura sem a correspondente documentação deverá ser obrigatoriamente classificada como Crítica"). A LLM sozinha não é confiável para cumprir essa regra 100% das vezes; a validação determinística garante.

### 2.2 #2 — Validação de grounding dos gaps

**O que faz:** cada gap retornado pela LLM precisa citar um arquivo que **realmente existe** no PR. A ferramenta compara os gaps contra a lista de arquivos do corpus (`corpus.files[]`) e descarta os gaps que não mencionam nenhum arquivo presente.

**Como funciona o matcher (versão MVP):** o texto do gap precisa conter, em alguma forma, o caminho completo (`auth/middleware.ts`) ou o basename (`middleware.ts`) de um arquivo real do PR. A comparação é case-insensitive para tolerar capitalização diferente da LLM. Não é usada similaridade léxica difusa — isso seria indesejável porque poderia ancorar gaps em arquivos vagamente parecidos, criando falso-positivo de grounding.

**Quando dispara:** sempre, em toda auditoria, depois da resposta da LLM.

**Efeito observável no relatório:**
- Se **pelo menos um** gap for ancorado em arquivo real → os gaps não-ancorados são silenciosamente descartados; os ancorados seguem para o relatório.
- Se a LLM **produziu** gaps mas **nenhum** ancorou em arquivo real (alucinação inventiva) → o status vira `"Inconclusiva"`, a criticidade vira `"Alta"` (conservadora) e o relatório mostra:

> `Análise inconclusiva: gaps gerados pela LLM não puderam ser ancorados nos artefatos do PR — revisão humana recomendada.`

- Se a LLM produziu **zero** gaps (julga o PR limpo, com ou sem `requires_docs_update`) → não há invenção a conter; o status e a criticidade **seguem a LLM** (`OK` ou `Atenção necessária` conforme `requires_docs_update`), sem forçar `Inconclusiva`.

**Por quê:** corta a classe de alucinação mais comum — inventar gaps que não se referem a nada no PR. A `Inconclusiva` dispara só quando de fato houve alucinação inventiva (gaps produzidos, nenhum ancorado), garantindo que o PMO não confunda "LLM disse OK" com "ferramenta não conseguiu confiar". Quando a LLM explicitamente returna zero gaps, confia-se no julgamento dela (com revisão humana implícita via `requires_docs_update`), evitando `Inconclusiva` falso-positivo que mascararia decisões limpas. A decisão seria `Crítica` se houvesse prova de risco de segurança; como não há, escolhe-se `"Alta"` conservadora, exigindo intervenção humana sem bloquear automaticamente tipos de PR sem perfil de segurança.

### 2.3 #3 — Fail-closed no parsing

**O que faz:** quando a LLM devolve uma resposta que não pode ser interpretada — JSON truncado, markdown em vez de JSON, campos faltando, schema inválido — a ferramenta **não diz OK**. Em vez disso, retorna um estado conservador bloqueante.

**Quando dispara:**
- `JSON.parse` lança exceção (resposta não é JSON válido).
- `JSON.parse` funciona mas o objeto não tem os campos esperados (`requires_docs_update`, `criticidade`, `gaps`, `justificativa`) com os tipos corretos.

**Efeito observável no relatório:**

> `# Status` → `Inconclusiva`
> `## Criticidade` → `Crítica`
> `## Gaps Documentais Encontrados` →
> `1. Análise inconclusiva — resposta da LLM não pôde ser interpretada. Revisão humana obrigatória.`

Além disso, o `AnalysisRecord` persistido em MongoDB grava `analysis.parseFailure: true` para telemetria, e o rodapé do relatório recebe uma nota visual:

> `⚠ Esta auditoria foi marcada como inconclusiva por falha de parsing da LLM — não utilizar como aprovação automática.`

**Por quê:** o comportamento anterior (registrado em AS-07 do relatório de segurança) fazia "falhar aberto" — devolvia `requires_docs_update: false`, criticidade `Média`, e a ferramenta seguia como se nada tivesse acontecido. Isso é o oposto do que um pipeline de CI/CD exige: quando não dá para confiar, **não confia**. "Falhar fechado" é o princípio correto para uma ferramenta que pode bloquear releases.

### 2.4 #2 (refinada) — Gaps não verificados visíveis

**O que faz:** quando algum gap gerado pela LLM não pôde ser ancorado em um arquivo real do PR (ou seja, não cita nem o path nem o basename de nenhum arquivo do corpus), ele não é simplesmente descartado. Aparece no relatório numa seção **Gaps não verificados**, com o prefixo `[NÃO ANCORADO]`.

**Quando dispara:** sempre que há ao menos um gap rejeitado pelo grounding — no caminho feliz, no floor, ou no caso inconclusivo.

**Efeito observável no relatório:**

```
## Gaps não verificados

- [NÃO ANCORADO] a mudança do navigator pode afetar compatibilidade em diferentes ambientes de execução

Gaps marcados como [NÃO ANCORADO] não puderam ser verificados contra os artefatos do PR. Avalie manualmente antes de decidir o merge.
```

O status permanece `Inconclusiva` quando **nenhum** gap foi ancorado (fail-closed preservado), mas o conteúdo analítico fica visível para o PMO avaliar manualmente. Esta melhoria é de **apresentação**, não relaxamento: o matcher de grounding continua operando por basename/path exato case-insensitive; o que mudou é que os gaps rejeitados são preservados na saída em vez de descartados silenciosamente. Eles aparecem persistidos no `AnalysisRecord.analysis.untrackedGaps` para rastreabilidade no MongoDB.

## 3. Como as três camadas aparecem na saída

| Medida | Gatilho | Efeito no `AnalysisRecord` e no relatório |
|---|---|---|
| **#1 Floor de criticidade** | PR contém arquivo **não-documental** (`isDocumentation === false`) que casa `matchesSecurityPattern` (`auth`/`.env`/CI/CD/infra/`token`/`secret`/...) | `criticality = "Crítica"`, `requiresDocsUpdate = true`, gap extra `[DETERMINÍSTICO]` listando o(s) arquivo(s) sensível(is) de código, justificativa combinada `floor determinístico (RNF-003). Justificativa LLM: …`. PR só-doc sensível (ex.: `docs/guides/refresh-token-rotation.mdx`) **não** dispara — routing ainda envia a Gemini, mas a criticidade segue a LLM. |
| **#2 Grounding dos gaps** | LLM produziu gaps e nenhum cita arquivo real do PR (alucinação inventiva, e floor não dispara) | `status = "Inconclusiva"`, `criticality = "Alta"`, gap com texto fixo de revisão humana; gaps rejeitados preservados em `untrackedGaps` e renderizados em `## Gaps não verificados` (§2.4) |
| **#3 Fail-closed** | Resposta da LLM não é JSON válido ou não segue o schema | `status = "Inconclusiva"`, `criticality = "Crítica"`, `parseFailure = true`, gap com texto fixo de revisão humana, nota visual no rodapé |

As três camadas rodam em ordem fixa dentro da ferramenta: **`#3` (fail-closed) → `#2` (grounding) → `#1` (floor)**. O gatilho do floor é **independente** do resultado de #2: `securityFloorTriggered` é computado sobre `corpus.files` (filtro `!isDocumentation && matchesSecurityPattern`), não sobre os gaps que sobreviveram a #2. Assim: se `#3` dispara, `#2` e `#1` não têm efeito adicional — a auditoria já é inconclusiva com `Crítica`. Se `#2` **rejeitou** todos os gaps produzidos pela LLM (houve alucinação inventiva) **e** nenhum arquivo não-documental sensível está presente, o status é `Inconclusiva`/`Alta` (fail-closed) — e os gaps rejeitados ficam visíveis em `## Gaps não verificados` (ver §2.4). Se a LLM **produziu zero gaps** (julga o PR limpo), não há `Inconclusiva` — segue o julgamento da LLM (`OK`/`Atenção necessária` conforme `requires_docs_update`), mesmo sem floor. Se há arquivo não-documental sensível presente, `#1` força `Crítica` independentemente de `#2` (inclusive se a LLM não produziu gaps). No caminho feliz (ao menos um gap ancorado, floor não dispara), status e criticidade seguem a LLM; gaps rejeitados também ficam visíveis sob selo `[NÃO ANCORADO]`.

## 4. Por que não usamos mais chamadas LLM

Técnicas como **consenso de dois modelos** (chamar Groq e Gemini e comparar) ou **citação literal com `evidence`** (exigir que o gap cite trecho exato do diff) são alternativas mais robustas e estão documentadas no spec técnico. No MVP, foram excluídas por dois motivos:

1. **Custo (RNF-007):** cada chamada adicional dobraria ou triplicaria o uso de tokens, quebrando o envelope de R$ 0,10/PR.
2. **Latência (RNF-001):** uma chamada extra somaria ao tempo de resposta e arriscaria ultrapassar os 30 segundos por PR.

As três camadas deste documento são **pós-processamento em código TypeScript comum** — assumem que a LLM já respondeu e filtram a resposta com regex e string matching. O custo adicional é zero tokens; a latência adicional é da ordem de milissegundos.

As técnicas mais avançadas ficam registradas no spec como evolução pós-MVP.

## 5. Limitações assumidas

- **Regex de `securityPatterns` é abrangente, mas o floor é gated por `isDocumentation`:** a regex continua casando arquivos de documentação que mencionam segurança (`docs/guides/refresh-token-rotation.mdx` contém "token"), mas o floor de criticidade (#1) agora a aplica **apenas sobre arquivos não-documentais** (`FileMetadata.isDocumentation === false`). Um PR que edita apenas `docs/guides/refresh-token-rotation.mdx` não força `Crítica` — o roteamento ainda o envia a Gemini para revisão cuidadosa, mas a criticidade segue a análise da LLM. Arquivos de **código-fonte** de segurança (`src/auth/middleware.ts`, `.env`, workflows de CI/CD) continuam disparando o floor `Crítica`, preservando o RNF-003. A distinção código-vs-documentação usa a flag `isDocumentation` já existente em `GitHubExtractorService.classifyFile`.
- **Matcher de grounding é literal:** um gap válido que referencia um arquivo por paráfrase ("o middleware da autenticação") pode ser descartado de `documentationGaps`. Para MVP aceita-se uma taxa de descarte controlada; desde o refinamento de 2026-06-30, esses gaps rejeitados são preservados na nova seção **Gaps não verificados** sob selo `[NÃO ANCORADO]` (ver §2.4), em vez de descartados silenciosamente. A mensagem de `"Inconclusiva"` orienta o PMO a revisar manualmente, e o conteúdo da LLM fica acessível para informar essa revisão.
- **Status `"Inconclusiva"` é novo:** auditorias antigas persistidas em MongoDB não têm esse campo; a renderização retroativa ainda funciona porque o valor default ausente é equivalente a `"OK"` ou `"Atenção necessária"` nos registros antigos. O novo campo `untrackedGaps` é opcional e default `[]`; registros antigos sem o campo são lidos como `undefined` e a nova seção do relatório é omitida.

## 6. Referências

- `Requisitos.MD` → **RNF-003** (0% falso-negativo em segurança), **RNF-001** (latência ≤30s/PR), **RNF-007** (custo médio < R$ 0,10/PR).
- `docs/RELATORIO_SEGURANCA_APPSEC.md` → **AS-06** (prompt injection / falta de validação determinística), **AS-07** (fallback "falha aberto").
- `docs/Arquitetura.MD` → **ADR-005** (roteamento Groq/Gemini por sensibilidade — origem do `routing.context` reusado pela Medida #1).
- `docs/superpowers/specs/2026-06-30-contencao-alucinacao-design.md` → design técnico completo com contratos, fluxos de dados e estratégia de testes.