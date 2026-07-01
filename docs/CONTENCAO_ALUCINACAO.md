# Contenção de Alucinação no PR Documentation Auditor

> Documento curto, voltado a PMO, revisores e professores. Para o design técnico completo, consulte [`docs/superpowers/specs/2026-06-30-contencao-alucinacao-design.md`](./superpowers/specs/2026-06-30-contencao-alucinacao-design.md).

## 1. Por que este documento existe

A ferramenta entrega ao PMO um relatório Markdown que diz "OK" ou "Atenção necessária". Esse relatório é construído a partir da resposta de uma LLM (Groq Llama 3.3 70B no caminho padrão, Gemini 2.5 Flash no caminho sensível). LLMs, por construção, cometem três tipos de erro que chamamos genericamente de **alucinação**:

1. **Amaciar a criticidade** — classificar como "Média" uma mudança em `auth/middleware.ts` que deveria ser sempre "Crítica".
2. **Inventar gaps** — afirmar que "o endpoint `/api/login` não está documentado" em um PR que não contém esse arquivo.
3. **Degenerar a resposta** — devolver JSON truncado, markdown em vez de JSON, ou um objeto com schema inválido.

O **RNF-003** do `Requisitos.MD` exige meta de **0% de falsos-negativos** em segurança, infraestrutura, compliance e autenticação. Sem barreiras explícitas, as três classes de alucinação acima violam diretamente esse requisito. O `RELATORIO_SEGURANCA_APPSEC.md` já registrou isso como **AS-06** (falta de validação determinística) e **AS-07** (fallback atual "falha aberto", produzindo falso-negativo silencioso).

Para conter essas alucinações, a ferramenta implementa **duas camadas determinísticas pós-LLM**. "Determinísticas" significa: não chamam outro modelo, não consomem tokens extras e não dependem de IA para serem aplicadas. Elas rodam depois que a LLM respondeu e **filtram ou sobrepõem** a decisão do modelo. O custo adicional é zero (RNF-007 preservado) e a latência adicional é negligenciável (RNF-001 preservado).

> **Histórico:** esta ferramenta já teve uma terceira camada — *grounding* de gaps (filtrar gaps que não citam arquivo real do PR). Ela foi **removida** por gerar falsos-positivos de `Inconclusiva` e descartar conteúdo útil da LLM. Os gaps produzidos pelo modelo agora são preservados integralmente; o PMO lê a análise crua. O RNF-003 permanece garantido pelo floor (#1) e pelo fail-closed (#3).

## 2. As duas camadas

### 2.1 #1 — Override determinístico de criticidade ("floor de segurança")

**O que faz:** depois que a LLM responde, a ferramenta inspeciona os arquivos do PR (não a resposta da LLM) procurando padrões sensíveis: `auth/`, `.env`, `.github/workflows/`, `infra/`, `secret`, `token`, `credential`, `dockerfile`, `terraform`, `kubernetes`, `ssl`/`tls`, entre outros. Esses padrões já são detectados hoje para escolha do provedor (ADR-005); agora também disparam um **floor de criticidade**.

**Quando dispara:** se o PR contém qualquer arquivo sensível e a LLM retornou criticidade abaixo de `Crítica`, a ferramenta sobrepõe para `Crítica` e `requires_docs_update: true`. Mesmo que a LLM tenha dito "Média" ou "Baixa", o relatório final dirá "Crítica".

**Efeito observável no relatório:** aparece um gap com o prefixo `[DETERMINÍSTICO]`, ex.:

> `[DETERMINÍSTICO] Arquivo sensível detectado (auth/middleware.ts) — documentação obrigatória por regra determinística (RNF-003).`

O prefixo `[DETERMINÍSTICO]` permite ao PMO distinguir "essa foi uma regra mandatória da ferramenta" de "essa foi uma análise semântica do modelo". A justificativa final também indica que a criticidade foi elevada por floor:

> `Criticidade elevada por floor determinístico (RNF-003). Justificativa LLM: <texto original do modelo>.`

**Por quê:** atende diretamente o requisito mandatório do **RNF-003** ("Qualquer modificação em regras de autenticação, autorização, criptografia ou infraestrutura sem a correspondente documentação deverá ser obrigatoriamente classificada como Crítica"). A LLM sozinha não é confiável para cumprir essa regra 100% das vezes; a validação determinística garante.

### 2.2 #3 — Fail-closed no parsing

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

## 3. Como as duas camadas aparecem na saída

| Medida | Gatilho | Efeito no `AnalysisRecord` e no relatório |
|---|---|---|
| **#1 Floor de criticidade** | PR contém arquivo **não-documental** (`isDocumentation === false`) que casa `matchesSecurityPattern` (`auth`/`.env`/CI/CD/infra/`token`/`secret`/...) | `criticality = "Crítica"`, `requiresDocsUpdate = true`, gap extra `[DETERMINÍSTICO]` listando o(s) arquivo(s) sensível(is) de código, justificativa combinada `floor determinístico (RNF-003). Justificativa LLM: …`. PR só-doc sensível (ex.: `docs/guides/refresh-token-rotation.mdx`) **não** dispara — routing ainda envia a Gemini, mas a criticidade segue a LLM. |
| **#3 Fail-closed** | Resposta da LLM não é JSON válido ou não segue o schema | `status = "Inconclusiva"`, `criticality = "Crítica"`, `parseFailure = true`, gap com texto fixo de revisão humana, nota visual no rodapé |

As duas camadas rodam em ordem fixa dentro da ferramenta: **`#3` (fail-closed) primeiro, depois `#1` (floor)**. O gatilho do floor é **independente** da resposta da LLM: `securityFloorTriggered` é computado sobre `corpus.files` (filtro `!isDocumentation && matchesSecurityPattern`), não sobre os gaps. Assim: se `#3` dispara (JSON inválido), `#1` não tem efeito adicional — a auditoria já é inconclusiva com `Crítica`. Se há arquivo não-documental sensível presente, `#1` força `Crítica` independentemente da crítica da LLM (inclusive se a LLM produziu zero gaps), preservando o RNF-003. No caminho feliz (parsing OK e floor não dispara), status e criticidade seguem a LLM (`OK` ou `Atenção necessária` conforme `requires_docs_update`), e os gaps são expostos integralmente como produzidos pelo modelo — o PMO lê a análise crua e decide.

> **Nota sobre o status `"Inconclusiva"`:** sem a camada de *grounding*, ele passa a disparar **somente** por `#3` (falha de parsing). Gaps da LLM que não citam arquivo real do PR não são mais descartados nem rotulados — o conteúdo analítico fica inteiramente disponível no relatório para avaliação humana.

## 4. Por que não usamos mais chamadas LLM

Técnicas como **consenso de dois modelos** (chamar Groq e Gemini e comparar) ou **citação literal com `evidence`** (exigir que o gap cite trecho exato do diff) são alternativas mais robustas e estão documentadas no spec técnico. No MVP, foram excluídas por dois motivos:

1. **Custo (RNF-007):** cada chamada adicional dobraria ou triplicaria o uso de tokens, quebrando o envelope de R$ 0,10/PR.
2. **Latência (RNF-001):** uma chamada extra somaria ao tempo de resposta e arriscaria ultrapassar os 30 segundos por PR.

As duas camadas deste documento são **pós-processamento em código TypeScript comum** — assumem que a LLM já respondeu e filtram a resposta com regex e string matching. O custo adicional é zero tokens; a latência adicional é da ordem de milissegundos.

As técnicas mais avançadas ficam registradas no spec como evolução pós-MVP.

## 5. Limitações assumidas

- **Regex de `securityPatterns` é abrangente, mas o floor é gated por `isDocumentation`:** a regex continua casando arquivos de documentação que mencionam segurança (`docs/guides/refresh-token-rotation.mdx` contém "token"), mas o floor de criticidade (#1) a aplica **apenas sobre arquivos não-documentais** (`FileMetadata.isDocumentation === false`). Um PR que edita apenas `docs/guides/refresh-token-rotation.mdx` não força `Crítica` — o roteamento ainda o envia a Gemini para revisão cuidadosa, mas a criticidade segue a análise da LLM. Arquivos de **código-fonte** de segurança (`src/auth/middleware.ts`, `.env`, workflows de CI/CD) continuam disparando o floor `Crítica`, preservando o RNF-003. A distinção código-vs-documentação usa a flag `isDocumentation` já existente em `GitHubExtractorService.classifyFile`.
- **Gaps não são filtrados:** a camada de *grounding* foi removida. Gaps que inventam arquivos inexistentes, ou que referenciam um arquivo por paráfrase ("o middleware da autenticação") são expostos no relatório integralmente, sem selo e sem descarte. A contenção de alucinação fica a cargo do floor (#1, dispara em código sensível) e do fail-closed (#3, dispara em JSON inválido). Avaliação de inventividade fica a cargo do revisor humano. Em contrapartida, evitam-se falsos-positivos de `Inconclusiva` em PRs limpos com gaps viáveis.
- **Status `"Inconclusiva"` dispara somente por `#3`:** com a remoção do grounding, o status `"Inconclusiva"` passa a ocorrer exclusivamente quando a LLM devolve uma resposta não interpretável. Auditorias antigas persistidas em MongoDB continuam renderizando retroativamente: o valor default ausente de campos opcionais é tratado como `OK`/`Atenção necessária` conforme `requires_docs_update`.

## 6. Referências

- `Requisitos.MD` → **RNF-003** (0% falso-negativo em segurança), **RNF-001** (latência ≤30s/PR), **RNF-007** (custo médio < R$ 0,10/PR).
- `docs/RELATORIO_SEGURANCA_APPSEC.md` → **AS-06** (prompt injection / falta de validação determinística), **AS-07** (fallback "falha aberto").
- `docs/Arquitetura.MD` → **ADR-005** (roteamento Groq/Gemini por sensibilidade — origem do `routing.context` reusado pela Medida #1).
- `docs/superpowers/specs/2026-06-30-contencao-alucinacao-design.md` → design técnico completo com contratos, fluxos de dados e estratégia de testes.