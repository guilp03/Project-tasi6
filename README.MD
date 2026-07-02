# PR Documentation Auditor

CLI em Node.js + TypeScript que audita automaticamente Pull Requests para garantir que mudanças de código estejam refletidas na documentação, usando roteamento inteligente entre dois provedores de LLM gratuitos (Groq no caminho rápido, Google Gemini no fallback de alto contexto e segurança).

Link da apresentação: https://canva.link/h0p32knbtgqw561
Link da DEMO: https://www.youtube.com/watch?v=c6ljcjtRlBw

## Problema

A documentação de projetos grandes envelhece mais rápido do que é atualizada. Quem mais sofre com isso é o profissional de **PMO**, responsável por garantir documentação consistente para processos de release, auditoria e testes de funcionalidade e segurança — mas que normalmente **não tem expertise em código nem imersão diária no repositório**.

Na prática, a cada Pull Request, esse profissional precisa recorrer a desenvolvedores para entender se uma mudança exige atualização de documentação. Isso cria um gargalo recorrente: ocorre em **todo PR relevante** de um repositório ativo, consome tempo de PMO e de devs, e abre espaço para que mudanças sensíveis (autenticação, infraestrutura, CI/CD) cheguem à produção sem documentação adequada.

## Solução

A aplicação é uma ferramenta de CI/CD acionada via linha de comando que:

1. **Extrai** os dados de um PR via GitHub API (`fetch`) e os serializa em `pr-corpus.json`.
2. **Roteia** a análise de forma inteligente (ADR-005): PRs que tocam arquivos sensíveis (`auth`, `.env`, infraestrutura, CI/CD) ou diffs muito grandes vão para o **Gemini** (maior contexto e raciocínio); o caminho feliz padrão vai para o **Groq** (latência ultrabaixa, custo quase nulo).
3. **Audita** as mudanças de código contra a documentação existente, identificando lacunas.
4. **Gera relatório** Markdown estruturado com status, criticidade, gaps, recomendações e justificativa (`--output`).
5. **Persiste** o resultado em MongoDB para consulta posterior (`history`).

**Como a IA é utilizada:** a LLM compara semanticamente o que mudou no código com o que está documentado e classifica o risco da lacuna. O prompt é construído a partir de um catálogo versionado (`docs/CATALOGO_PROMPTS-v2.md`) e força *structured output* em JSON.

**Diferencial:** em vez de usar um único modelo caro para tudo, o roteamento por sensibilidade/tamanho mantém **custo próximo de zero** (~R$ 0,0003-0,0005/PR) no caso comum, escalando para um modelo mais capaz apenas quando o risco justifica — garantindo zero falso-negativo em mudanças de segurança sem inflar o custo médio.

## Arquitetura (resumo)

Monólito CLI em TypeScript com subcomandos Commander.js, sem servidor, projetado para rodar dentro de um pipeline de CI/CD:

```
src/
├── index.ts                          # Entry point (thin dispatcher)
├── cli/
│   ├── parser.ts                     # Commander registry (audit, fetch, history, fetch-and-audit)
│   └── commands/
│       ├── audit.ts                  # Audita corpus existente
│       ├── fetch.ts                  # Extrai PR do GitHub
│       ├── fetch-and-audit.ts        # Pipeline completo: extrai + audita
│       └── history.ts                # Consulta histórico de auditorias
├── services/
│   ├── LLMIntegrationService.ts      # Núcleo: roteamento Groq/Gemini + chamada LLM
│   ├── GitHubExtractorService.ts     # Extrator de PR (GitHub API → PRCorpus)
│   ├── ReportGenerator.ts           # Geração de relatório Markdown
│   ├── types.ts                      # Contratos (AnalysisRecord, PRCorpus, AuditResult)
│   ├── config.ts                     # Configuração de ambiente
│   └── persistence/
│       └── AnalysisRepository.ts     # Persistência MongoDB
└── utils/
    └── prompts.ts                    # Catálogo de prompts de auditoria
```

Decisões arquiteturais completas (C4 Model + ADR-001 a ADR-007) em **[docs/Arquitetura.MD](./docs/Arquitetura.MD)**. O roteamento Groq + Gemini é descrito na **ADR-005**. A arquitetura de comandos CLI é descrita na **ADR-006**.

## Pré-requisitos

- **Node.js 20+** (uso de `fetch` nativo, sem bibliotecas HTTP externas)
- **TypeScript 5+** (executado via `tsx`)
- **Variáveis de ambiente** (ver `.env.example`):
  - `GITHUB_TOKEN` — token para o extrator de PR ([gerar aqui](https://github.com/settings/tokens))
  - `GROQ_API_KEY` — chave Groq, tier gratuito ([console.groq.com](https://console.groq.com))
  - `GEMINI_API_KEY` — chave Gemini, gratuita ([aistudio.google.com](https://aistudio.google.com/app/apikey))
  - `MONGODB_URI` — URI de conexão MongoDB (opcional, para persistência de histórico)

## Instalação e Execução

```bash
# 1. Clonar e entrar no repositório
git clone <repo-url> && cd Project-tasi6

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# edite .env com suas chaves

# 4. Extrair dados de um PR
npm run dev fetch -- facebook react 27534

# 5. Auditar o corpus extraído
npm run dev audit -- --diff ./output/pr-corpus.json --docs ./docs --output ./relatorio.md

# 6. Pipeline completo (extrair + auditar)
npm run dev fetch-and-audit -- facebook react 27534 --docs ./docs --output ./relatorio.md

# 7. Consultar histórico
npm run dev history -- --limit 10
```

Para build de produção: `npm run build` (gera `./dist`).

## Comandos

| Comando | Descrição | Flags |
|---------|-----------|-------|
| `fetch <owner> <repo> <prNumber>` | Extrai dados de um PR do GitHub | `--output <path>` (default: `./output/pr-corpus.json`) |
| `audit` | Audita um corpus contra a documentação | `--diff <path>` (obrigatório), `--docs <dir>` (obrigatório), `--output <path>` (relatório Markdown) |
| `fetch-and-audit <owner> <repo> <prNumber>` | Extrai e audita em um passo | `--docs <dir>` (obrigatório), `--output <path>`, `--keep-corpus` |
| `history` | Lista auditorias persistidas | `--limit <N>` (default: 10) |

**Scripts de atalho** (`package.json`):

```bash
npm run audit              # audit --diff ./output/pr-corpus.json --docs ./docs
npm run fetch              # fetch
npm run fetch-and-audit    # fetch-and-audit
npm run history            # history
npm run test               # vitest run
npm run test:watch         # vitest
npm run test:coverage      # vitest run --coverage
```

## Saída

### Terminal (resumo)

```
[Routing] Using GROQ provider: Standard path: fast & cost-effective
[Status] Atenção necessária | Criticidade: Alta
[Gaps] 3 gaps encontrados
[Arquivo] Relatório salvo em ./relatorio.md
[MongoDB] Registro salvo com id: 6820a1b2c3d4e5f6a7b8c9d0
```

### Relatório Markdown (`--output`)

```markdown
# Status

Atenção necessária

## Criticidade

Alta

## Mudanças Identificadas

- Novo middleware de autenticação adicionado
- Configuração de sessão alterada

## Gaps Documentais Encontrados

1. Novo endpoint de autenticação não documentado
2. Mudanças no tratamento de sessão ausentes do README

## Recomendação

- Atualizar README com novo fluxo de autenticação
- Documentar mudanças de API no Swagger

---
**Justificativa:** O PR modifica o middleware de autenticação...
---
*Auditoria gerada automaticamente em 2026-06-07T12:00:00Z*
*Repositório: facebook/react | PR: #27534 - Refactor auth middleware*
*Provedor: groq | Modelo: llama-3.3-70b-versatile | Tokens: 1234 in / 567 out*
```

Níveis de criticidade: **Baixa** (cosmético), **Média** (ajustes menores), **Alta** (mudanças importantes de API/feature), **Crítica** (segurança, autenticação, infraestrutura, breaking changes).

## AnalysisRecord

O resultado completo de cada auditoria segue o contrato `AnalysisRecord` (definido em `src/services/types.ts`):

```typescript
interface AnalysisRecord {
  id?: string;                                         // MongoDB ObjectId (após persistir)
  repository: string;                                  // "facebook/react"
  pullRequest: { id: string; title: string; author: string; url: string; };
  analysis: {
    status: "Atenção necessária" | "OK";
    criticality: "Baixa" | "Média" | "Alta" | "Crítica";
    requiresDocsUpdate: boolean;
    detectedChanges: string[];                         // derivado dos arquivos do PR
    documentationGaps: string[];                       // gaps encontrados pela LLM
    justification: string;                             // justificativa em PT-BR
    recommendations: string[];                         // ações recomendadas
  };
  llm: { provider: "groq" | "gemini"; model: string; inputTokens: number; outputTokens: number; estimatedCost: number; };
  routing: { reason: string; };                       // motivo do roteamento
  createdAt: string;                                   // ISO timestamp
}
```

## Limitações conhecidas

- **Contenção de alucinação:** três camadas determinísticas pós-LLM (#3 fail-closed no parsing + #2 grounding dos gaps + #1 floor de criticidade) garantem RNF-003 sem inflar custo/latência. Detalhes em [`docs/CONTENCAO_ALUCINACAO.md`](./docs/CONTENCAO_ALUCINACAO.md).
- **Sem teste end-to-end validado:** as métricas de latência/custo são projeções, ainda não medidas em execução real contra as APIs.
- **Dependência de APIs gratuitas:** sujeito a rate limits e à descontinuação de modelos (o modelo Groq precisou ser trocado quando o `mixtral-8x7b-32768` foi descontinuado).
- **Onde a IA pode falhar:** documentação muito genérica confunde a detecção de gaps; diffs que excedem a janela de contexto exigem fragmentação; classificações de criticidade dependem da qualidade do prompt e podem variar entre execuções.
- **Truncamento:** a documentação é truncada (~8000 caracteres) para controle de custo, podendo perder contexto em docs muito extensas.

## Histórico de versões

### v0.2.0 — Interlídio

- **CLI com Commander.js:** 4 subcomandos (`audit`, `fetch`, `fetch-and-audit`, `history`) com flags nomeadas e validação.
- **Relatório Markdown (RF-005):** `ReportGenerator` gera relatório estruturado via `--output`.
- **Histórico persistido (RF-007):** `AnalysisRepository` com MongoDB; comando `history` consulta auditorias recentes.
- **Extrator promovido (RF-008):** `GitHubExtractorService` substitui a POC; classificação de arquivos, detecção de linguagem e sumário de mudanças.
- **77 testes** em 12 arquivos, build limpo.

### v0.1.0 — Ensaio

- `LLMIntegrationService` com roteamento Groq/Gemini (ADR-005).
- POC do extrator de PR (`apps/poc-diff-reader/`).
- CLI posicional (`npm run dev <corpus> <docs>`).
- Persistência MongoDB básica (`save`, `findRecent`).

## Equipe

**Equipe 3**

| Membro | Papel | Contribuições |
|--------|-------|---------------|
| Guilherme Pereira | Dev / Arquitetura / Implementação | C4 Model, ADRs, POC do extrator de PR, CLI v0.2.0 (Commander, comandos, ReportGenerator, documentação) |
| Alexandre Moreno | Dev / TL / Arquitetura / Prompts | Catálogo de prompts, revisão crítica de decisões, implementação do `LLMIntegrationService` e roteamento ADR-005, reorganização do repositório. |
| Stela Nascimento | Requisitos / Documentação | Levantamento de requisitos (RF/RNF), escopo do MVP, persistência MongoDB. |
| Reilson Fonseca | Análise / QA / Persistência | Personas, validação de roteamento e casos de borda, CRUD MongoDB e índices. |

## Referências

- **Provedores LLM:** [Groq](https://console.groq.com) (modelos `llama-3.3-70b-versatile` / família Llama), [Google Gemini](https://aistudio.google.com) (Gemini 1.5 Flash/Pro).
- **Documentação do projeto:**
  - [Arquitetura.MD](./docs/Arquitetura.MD) — C4 Model e ADRs (ADR-001 a ADR-007)
  - [IMPLEMENTATION.md](./docs/IMPLEMENTATION.md) — guia completo de uso v0.2.0
  - [PERSISTENCE.md](./docs/PERSISTENCE.md) — persistência MongoDB
  - [Requisitos_longo.md](./docs/Requisitos_longo.md) — 8 RF + 7 RNF
  - [CATALOGO_PROMPTS-v2.md](./docs/CATALOGO_PROMPTS-v2.md) — catálogo de prompts
  - [workflow.MD](./docs/workflow.MD) — registro de uso de IA e economicidade
- **APIs externas:** GitHub REST API (extração de PRs).

---

## Licença

MIT
