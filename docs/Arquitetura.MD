# Documento de Arquitetura -- Documentação Automatizada (D3)

## Versão e histórico

| Versão | Data | Autor | Descrição |

|--------|------|-------|-----------|

| 1.0 | 14/05/2026 | Guilherme Pereira, Alexandre Moreno, Stela Nascimento, Reilson Fonseca | Versão inicial com C4 Model Nível 1 |

---

## Nível 1 -- Contexto (Context Diagram)

> Sistema de auditoria automática de documentação em PRs, acionado por eventos do GitHub e que usa LLM para detectar gaps na documentação.

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub                                  │
│  (Repositório + Pull Requests + Webhooks)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Abre PR / Webhook dispara
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│      [Sistema] Auditor de Documentação                          │
│  CLI + GitHub Bot integrado com IA                              │
│                                                                  │
│  - Analisa mudanças no código                                   │
│  - Detecta gaps na documentação                                 │
│  - Gera relatórios de auditoria                                 │
│  - Dispara alertas de segurança                                 │
└──────────┬───────────────────────────────────────────────────────┘
           │
           │ Comenta resultado na PR
           │
           ▼
        [GitHub]
           │
           │ Visualiza relatório
           │
           ├─────────────────────────────┬─────────────────────────────┐
           │                             │                             │
           ▼                             ▼                             ▼
    [PMO / Reviewer]              [Developer]              [Security/Compliance]
    Audita em 30s                 Implementa docs          Monitora segurança
    Aprova/rejeita                baseado em feedback      Verifica compliance


┌─────────────────────────────────────────────────────────────────┐
│            [Serviço Externo] LLM Provider                       │
│  (Claude API, OpenAI GPT-4, etc)                                │
│                                                                  │
│  - Analisa mudanças estruturalmente (AST, diffs)                │
│  - Compara com documentação existente                           │
│  - Gera insights de gaps e recomendações                        │
│  - Classifica severidade (baixa/média/alta/crítica-segurança)   │
└──────────────────────────────────────────────────────────────────┘
        ▲
        │ Requisição de análise (diff + docs)
        │
        └──────────────────────────────────────┐
                                               │
                         [Sistema] Auditor ────┘
```

**Descrição:**

**Usuários:**
- **PMO / Project Manager (Revisor):** Audita documentação em PRs. Toma decisão de bloqueio/aprovação baseada no relatório da IA em ~30 segundos.
- **Developer:** Implementa features/correções. Recebe feedback automático sobre o que documentar. PR aprovada mais rapidamente.
- **Security / Compliance (Secundário):** Monitora alerts críticos de segurança para garantir que mudanças sensíveis são documentadas.

**Sistemas Externos:**
- **GitHub:** Dispara webhooks quando PR é aberta/atualizada. Sistema onde o resultado (comentário) fica visível. Fonte de verdade para código, diffs e documentação.
- **LLM Provider (Claude, GPT-4, etc):** Realiza a análise inteligente de mudanças vs documentação. Detecta gaps estruturalmente e classifica severidade.

**Papel dos LLMs:**
- Analisar diffs de código (mudanças em APIs, schemas, segurança, features)
- Comparar mudanças com documentação existente (README, Swagger, Wiki, etc)
- Detectar gaps estruturalmente
- Gerar insights actionáveis (exatamente o que está faltando documentar)
- Classificar alertas por severidade (0% false negatives em segurança, <10% falsos positivos em geral)
- Reduzir tempo de análise de 15-20 min para 30 segundos

---

## Nível 2 -- Contêineres (Container Diagram)

> Decomposição do sistema: Aplicação Python acionada por CI/CD, armazenamento opcional para histórico, e integrações externas.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         GitHub                                             │
│              (Repositório + PRs + Workflows/Actions)                       │
└────────────────────────────┬───────────────────────────────────────────────┘
                             │
                             │ Dispara workflow (PR opened/sync)
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  [Contêiner] Python Application (CLI)                                      │
│  Execução efêmera via GitHub Actions (runner)                              │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │ Entry Point / Main                                               │     │
│  │ - Lê contexto da PR (via env vars / GitHub API)                  │     │
│  │ - Busca arquivos modificados e documentação relevante            │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                  │                                         │
│                                  ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │ Documentation Analyzer Engine                                    │     │
│  │ - Parse diff (mudanças no código)                                │     │
│  │ - Identifica tipos de mudança (API, schema, infra, segurança)    │     │
│  │ - Busca documentação existente no repo                           │     │
│  │ - Prepara contexto para LLM                                      │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                  │                                         │
│                                  ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │ LLM Integration Module                                           │     │
│  │ - Monta prompt (diff + docs + contexto)                          │     │
│  │ - Chama LLM Provider (Claude, GPT-4)                             │     │
│  │ - Parse + estrutura resposta                                     │     │
│  │ - Tratamento de erros / retry com backoff                        │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                  │                                         │
│                                  ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │ Report Generator + GitHub Commenter                              │     │
│  │ - Formata resultado em markdown                                  │     │
│  │ - Comenta na PR via GitHub API                                   │     │
│  │ - Opcional: envia alertas (Slack, email)                         │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
        │                            │                               │
        │ Comenta resultado          │                         │
        │ (GitHub API)               │                         │
        │                            │                         │
        └──────────────┬─────────────┼─────────────────────────┘
                       │             │
                       ▼             ▼
                    [GitHub]    [MongoDB]
                  (visualiza)   (histórico)

┌────────────────────────────────────────────────────────────────────────────┐
│ [Serviço Externo] LLM Provider API                                         │
│ (Claude API, OpenAI GPT-4, etc)                                            │
│ - Chamadas síncronas com timeout                                           │
│ - Retry com exponential backoff                                            │
│ - Fallback para modelo menor se quota exceder                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Descrição de cada contêiner:**

| Contêiner | Tecnologia | Responsabilidade |
|-----------|-----------|-----------------|
| **Node.js Application** | Node.js 20 + TypeScript (CLI) | Parse diff, busca docs, chama LLM, gera relatório, comenta na PR, persiste análise |
| **MongoDB** | NoSQL Document Database | Armazena análises completas em JSON: resultado, diff, gaps, metadata, timestamp |
| **GitHub API** | REST API v3 | Busca contexto de PR (files, diffs), publica comentário com resultado |
| **LLM Provider** | Groq (Mixtral) + Claude (fallback) | Groq: análise rápida de gaps; Claude: validação em casos críticos/segurança |

---

## Nível 3 -- Componentes (Component Diagram)

> Visão geral dos componentes da Node.js Application. Detalhes refinados durante implementação.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Node.js Application (TypeScript)                      │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [1] Main Entry Point                                             │   │
│  │  - Lê variáveis de ambiente                                      │   │
│  │  - Orquestra o fluxo de análise                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                            │                                             │
│                            ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [2] GitHub Context Fetcher                                       │   │
│  │  - Busca PR details e arquivos modificados                       │   │
│  │  - Recupera diffs e documentação relevante                       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                            │                                             │
│                            ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [3] Documentation Analyzer                                       │   │
│  │  - Parse e classifica mudanças (tipo, severidade)                │   │
│  │  - Busca documentação relevante                                  │   │
│  │  - Monta contexto para LLM                                       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                            │                                             │
│                            ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [4] LLM Integration                                              │   │
│  │  - Monta prompt (Groq como default, Claude fallback)             │   │
│  │  - Chama LLM com retry/fallback                                  │   │
│  │  - Parse e valida resposta                                       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                            │                                             │
│                            ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [5] Report Generator + GitHub Commenter                          │   │
│  │  - Formata resultado em markdown                                 │   │
│  │  - Comenta na PR via GitHub API                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                            │                                             │
│                            ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ [6] MongoDB Persistence                                          │   │
│  │  - Armazena documento de análise completa                        │   │
│  │  - Schema: PR info + diff + gaps + metadata + timestamp          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Fluxo alto-nível:**

| # | Componente | Responsabilidade |
|---|-----------|-----------------|
| 1 | **Entry Point** | Orquestra fluxo, lê env vars |
| 2 | **GitHub Fetcher** | Busca PR, diffs, docs |
| 3 | **Doc Analyzer** | Parse, classifica, busca docs |
| 4 | **LLM Integration** | Chama Groq/Claude, parse resposta |
| 5 | **Report + Commenter** | Formata, comenta PR |
| 6 | **MongoDB Persistence** | Armazena documento de análise |

**Nota:** Componentes internos refinados durante desenvolvimento (Design Emergente).

---

## LLM Provider: Groq + Fallback Claude

**Seleção:** Groq Mixtral como default, Claude como fallback para casos críticos/segurança.

**Estratégia:**
```typescript
const selectModel = (diffSize: number, hasSecurity: boolean) => {
  if (hasSecurity) return "claude-3-5-sonnet"; // Segurança = alta acurácia
  if (diffSize > 30000) return "groq"; // Groove com truncate
  return "groq"; // Default: rápido + barato
};
```

**Trade-offs:** Groq 90%+ acurácia, 32k contexto, ~$1-5/mês.

---

## Autenticação e Acesso

**Env vars (GitHub secrets):**
- `GITHUB_TOKEN` — Injetado automaticamente (seguro, temporário)
- `LLM_API_KEY` — Groq (default) ou Claude (fallback)
- `MONGODB_URI` — mongodb+srv://user:pass@cluster/db_name

**Workflow:** Node 20, npm ci, então `npm run audit`

---

## Decisões Arquiteturais (ADRs)

> Registro das principais decisões tomadas durante o projeto.

### ADR-001: Autenticação no GitHub — GITHUB_TOKEN vs Personal Access Token

- **Contexto:** Aplicação precisa acessar GitHub API (buscar PRs, comentar, etc). Como autenticar?

- **Decisão:** Usar `GITHUB_TOKEN` injetado automaticamente pelo GitHub Actions.

- **Alternativas consideradas:** 
  - Personal Access Token (manual, longa duração)
  - GitHub App (fine-grained, mas complexo)

- **Consequências:** 
  - ✅ Automático, sem setup manual
  - ✅ Token temporário (válido só durante execução)
  - ✅ Escopo automático ao repositório
  - ⚠️ Limitado ao repo onde a action roda (não pode acessar outro repo)
  - ⚠️ Permissões fixas (não tão granular quanto GitHub App)

---

### ADR-002: Stack Tecnológico — Node.js + TypeScript (CLI)

- **Contexto:** Qual linguagem/framework para a aplicação acionada por GitHub Actions?

- **Decisão:** Node.js 20+ com TypeScript (CLI puro, sem framework web).

- **Alternativas consideradas:**
  - Python (CLI puro) - melhor para ML/LLM, mas startup lento
  - Go (compiled) - muito rápido, mas menos libs para LLM
  - FastAPI full - web server (overkill para CLI ephemeral)

- **Consequências:**
  - ✅ Startup rápido (~0.5s em GitHub Actions vs 5-15s Python)
  - ✅ npm/bun muito rápido para instalar deps
  - ✅ Type-safe com TypeScript
  - ✅ Excelente para CLI (commander, yargs)
  - ✅ SDK Anthropic bem mantido (ts-sdk)
  - ✅ Menor footprint (deps mais leves)
  - ✅ Melhor para execução ephemeral
  - ⚠️ Menos libs especializadas em LLM/AI (vs Python)
  - ⚠️ Comunidade Python maior para ML

---

### ADR-003: Persistência — MongoDB para Histórico e Feedback Learning

- **Contexto:** Como armazenar histórico de análises?

- **Decisão:** MongoDB com documentos JSON (sem schema fixo) desde v1.

- **Alternativas consideradas:**
  - PostgreSQL (tabelas estruturadas, mais rígido)
  - Arquivo JSON em Vercel Blob Storage (sem queries)
  - Nenhum (stateless) — não permite feedback learning

- **Consequências:**
  - ✅ Flexível (análises podem ter estrutura variável)
  - ✅ Fácil armazenar resposta inteira do LLM
  - ✅ Bom para queries ad-hoc (análises por severidade, repo, etc)
  - ✅ Possibilita feedback learning em v2 (melhorar acurácia)
  - ⚠️ Custo cloud (MongoDB Atlas ~$10-50/mês)
  - ⚠️ Sem transações (mas aceitável para nossa use case)

---

### ADR-004: Execução — GitHub Actions vs Servidor Dedicado

- **Contexto:** Como executar a aplicação? Em um servidor sempre ligado ou sob demanda?

- **Decisão:** GitHub Actions (acionada por webhook de PR, executa uma vez, termina).

- **Alternativas consideradas:**
  - Servidor dedicado (FastAPI + webhook handler)
  - Vercel Functions (serverless)
  - Lambda (AWS)

- **Consequências:**
  - ✅ Sem overhead de manter servidor
  - ✅ Executores rápidos, confiáveis
  - ✅ Integração nativa com GitHub
  - ✅ Gratuito para repos públicos
  - ⚠️ Timeout ~35min (adequado para our use case)
  - ⚠️ Logging limitado (precisa exportar para MongoDB/CloudWatch)

---

### ADR-005: LLM Provider — Groq-first com fallback a Claude

- **Contexto:** Qual LLM usar para análise de gaps de documentação, considerando os 5 valores do projeto?

- **Decisão:** Groq Mixtral (rápido, barato) como default, com fallback automático a Claude 3.5 Sonnet para segurança crítica.

- **Alternativas consideradas:**
  - Claude puro (200k contexto, acurácia altíssima) — alinha com segurança, mas caro ($25-75/mês)
  - GPT-4 Turbo — ótima acurácia, mas caro ($50-100/mês)
  - Groq puro (sem fallback) — super barato, mas pode falhar em segurança
  - Deepseek — barato, menos confiável

- **Consequências:**
  - ✅ Alinha com "Máxima Eficiência de Custo": $5-20/mês (vs $50+ Claude)
  - ✅ Alinha com "Pragmatismo": 90%+ acurácia é bom suficiente
  - ✅ Alinha com "Contexto Real": 50-100ms latência (<30s análise)
  - ✅ Alinha com "Segurança Negociável": fallback automático a Claude se segurança crítica
  - ✅ Alinha com "Transparência": documenta limitações (32k contexto)
  - ⚠️ Contexto limitado (32k) — pode truncar diffs muito grandes
  - ⚠️ ~10% false positives possível (aceitável: PMO revisa em 30s)
  - ✅ 0% false negatives segurança (fallback a Claude valida)
  
- **Justificativa final:** 
  - Começa pragmático com Groq (custo mínimo, latência ótima)
  - Garante segurança com fallback a Claude quando necessário
  - Se depois da v1 precisar de mais acurácia, migra para Claude puro
  - Economiza $200+/mês respeitando o valor "Máxima Eficiência pelo Menor Custo"
