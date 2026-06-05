# PR Documentation Auditor

CLI em Node.js + TypeScript que audita automaticamente Pull Requests para garantir que mudanças de código estejam refletidas na documentação, usando roteamento inteligente entre dois provedores de LLM gratuitos (Groq no caminho rápido, Google Gemini no fallback de alto contexto e segurança).

> **Status:** MVP — Fase 3 (Ensaio) 🔄

## Problema

A documentação de projetos grandes envelhece mais rápido do que é atualizada. Quem mais sofre com isso é o profissional de **PMO**, responsável por garantir documentação consistente para processos de release, auditoria e testes de funcionalidade e segurança — mas que normalmente **não tem expertise em código nem imersão diária no repositório**.

Na prática, a cada Pull Request, esse profissional precisa recorrer a desenvolvedores para entender se uma mudança exige atualização de documentação. Isso cria um gargalo recorrente: ocorre em **todo PR relevante** de um repositório ativo, consome tempo de PMO e de devs, e abre espaço para que mudanças sensíveis (autenticação, infraestrutura, CI/CD) cheguem à produção sem documentação adequada.

## Solução

A aplicação é uma ferramenta de CI/CD acionada via linha de comando que:

1. **Extrai** os dados de um PR via GitHub API (metadados + diffs) e os serializa em `output/pr-corpus.json`.
2. **Roteia** a análise de forma inteligente (ADR-005): PRs que tocam arquivos sensíveis (`auth`, `.env`, infraestrutura, CI/CD) ou diffs muito grandes vão para o **Gemini** (maior contexto e raciocínio); o caminho feliz padrão vai para o **Groq** (latência ultrabaixa, custo quase nulo).
3. **Audita** as mudanças de código contra a documentação existente, identificando lacunas.
4. **Retorna** um resultado estruturado em JSON com nível de criticidade, gaps e justificativa.

**Como a IA é utilizada:** a LLM compara semanticamente o que mudou no código com o que está documentado e classifica o risco da lacuna. O prompt é construído a partir de um catálogo versionado (`docs/CATALOGO_PROMPTS-v2.md`) e força *structured output* em JSON.

**Diferencial:** em vez de usar um único modelo caro para tudo, o roteamento por sensibilidade/tamanho mantém **custo próximo de zero** (~R$ 0,0003–0,0005/PR) no caso comum, escalando para um modelo mais capaz apenas quando o risco justifica — garantindo zero falso-negativo em mudanças de segurança sem inflar o custo médio.

## Arquitetura (resumo)

Monólito CLI em TypeScript, sem servidor, projetado para rodar dentro de um pipeline de CI/CD:

- **`apps/poc-diff-reader/`** — extrator de PR (GitHub API → `pr-corpus.json`).
- **`src/services/LLMIntegrationService.ts`** — núcleo: lê o corpus, decide o roteamento (Groq vs Gemini), chama a API via `fetch` nativo e faz parse seguro do JSON.
- **`src/services/types.ts`** — contratos (`AuditResult`, `PRCorpus`, `RoutingDecision`).
- **`src/utils/prompts.ts`** — catálogo de prompts de auditoria.
- **`src/index.ts`** — ponto de entrada da CLI.

Decisões arquiteturais completas (C4 Model + ADR-001 a ADR-005) em **[docs/Arquitetura.MD](./docs/Arquitetura.MD)**. O roteamento Groq + Gemini é descrito na **ADR-005**.

## Pré-requisitos

- **Node.js 20+** (uso de `fetch` nativo, sem bibliotecas HTTP externas)
- **TypeScript 5+** (executado via `ts-node`)
- **Variáveis de ambiente** (ver `.env.example`):
  - `GITHUB_TOKEN` — token para o extrator de PR ([gerar aqui](https://github.com/settings/tokens))
  - `GROQ_API_KEY` — chave Groq, tier gratuito ([console.groq.com](https://console.groq.com))
  - `GEMINI_API_KEY` — chave Gemini, gratuita ([aistudio.google.com](https://aistudio.google.com/app/apikey))
  - `MONGODB_URI` — URI de conexão MongoDB (opcional, para persistência de histórico)

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

Para build de produção: `npm run build` (gera `./dist`).

## Uso

**Comandos disponíveis:**

```bash
# Extrair PR do GitHub
npm run dev fetch -- <owner> <repo> <pr-number> [--output <path>]

# Auditar corpus existente
npm run dev audit -- --diff <corpus> --docs <docs-dir> [--output <relatorio.md>]

# Pipeline: extrair + auditar
npm run dev fetch-and-audit -- <owner> <repo> <pr> --docs <dir> [--output <md>]

# Consultar histórico
npm run dev history -- [--limit N]
```

**Saída** (exemplo real do formato `AuditResult`):

```json
{
  "requires_docs_update": true,
  "criticidade": "Alta",
  "gaps": [
    "Novo endpoint de autenticação não documentado",
    "Mudanças no tratamento de sessão ausentes do README"
  ],
  "justificativa": "O PR modifica o middleware de autenticação e introduz mudanças de API que quebram compatibilidade, mas a documentação não reflete essas atualizações críticas."
}
```

Logs de roteamento indicam qual provedor foi escolhido:

```
[Routing] Using GROQ provider: Standard path: fast & cost-effective
[Routing] Using GEMINI provider: Security-sensitive files detected
```

Níveis de criticidade: **Baixa** (cosmético), **Média** (ajustes menores), **Alta** (mudanças importantes de API/feature), **Crítica** (segurança, autenticação, infraestrutura, breaking changes).

## Limitações conhecidas

- **Sem teste end-to-end validado:** as métricas de latência/custo são projeções, ainda não medidas em execução real contra as APIs.
- **Dependência de APIs gratuitas:** sujeito a rate limits e à descontinuação de modelos (o modelo Groq precisou ser trocado quando o `mixtral-8x7b-32768` foi descontinuado).
- **Onde a IA pode falhar:** documentação muito genérica confunde a detecção de gaps; diffs que excedem a janela de contexto exigem fragmentação; classificações de criticidade dependem da qualidade do prompt e podem variar entre execuções.
- **Truncamento:** a documentação é truncada (~8000 caracteres) para controle de custo, podendo perder contexto em docs muito extensas.

### ✅ Resolvido em v0.2.0

- **Histórico de auditorias** — histórico de auditorias via comando `history` e persistência MongoDB.
- **Parsing de argumentos robusto** — substituído por Commander.js.
- **Geração de relatório** — ReportGenerator integrados na saída `--output`.

## Equipe

**Equipe 3**

| Membro | Papel | Contribuições |
|--------|-------|---------------|
| Guilherme Pereira | Dev / Arquitetura / Implementação | C4 Model, ADRs, POC do extrator de PR, implementação inicial do CLI  |
| Alexandre Moreno | Dev / TL / Arquitetura / Prompts | Catálogo de prompts, revisão crítica de decisões, implementação do `LLMIntegrationService` e roteamento ADR-005, reorganização do repositório. |
| Stela Nascimento | Requisitos / Documentação | Levantamento de requisitos (RF/RNF), escopo do MVP e documentação. |
| Reilson Fonseca | Análise / QA | Personas, validação de roteamento e casos de borda. |

## Referências

- **Provedores LLM:** [Groq](https://console.groq.com) (modelos `llama3-70b-8192` / família Llama), [Google Gemini](https://aistudio.google.com) (Gemini 1.5 Flash/Pro).
- **Documentação do projeto:**
  - [Arquitetura.MD](./docs/Arquitetura.MD) — C4 Model e ADRs (ADR-005: roteamento Groq + Gemini)
  - [IMPLEMENTATION.md](./docs/IMPLEMENTATION.md) — guia de integração da LLM
  - [Requisitos_longo.md](./docs/Requisitos_longo.md) — 8 RF + 7 RNF
  - [CATALOGO_PROMPTS-v2.md](./docs/CATALOGO_PROMPTS-v2.md) — catálogo de prompts
  - [workflow.MD](./docs/workflow.MD) — registro de uso de IA e economicidade
- **APIs externas:** GitHub REST API (extração de PRs).

---

## Licença

MIT
