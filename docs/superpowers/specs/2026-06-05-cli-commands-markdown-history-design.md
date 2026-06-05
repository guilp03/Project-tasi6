# Design Doc: CLI com Comandos, Relatório Markdown e Histórico Persistido

**Data:** 2026-06-05
**Status:** Aprovado para implementação
**Escopo:** RF-005 (Relatório Markdown), RF-007 (CLI robusta com flags), RF-008 (Consulta de histórico), refatoração do `poc-diff-reader` para serviço de primeira classe.

---

## 1. Contexto e Objetivo

O PR Documentation Auditor possui o core de análise de PRs via LLM já implementado (`LLMIntegrationService`, roteamento Groq/Gemini, persistência MongoDB via `AnalysisRepository`). No entanto, três requisitos funcionais obrigatórios permanecem pendentes para o usuário final:

- **RF-005:** Geração de relatório estruturado em Markdown (seções obrigatórias, linguagem acessível ao PMO).
- **RF-007:** CLI com flags robustas (`--diff`, `--docs`, `--output`, `--history`).
- **RF-008:** Comando `--history` para consultar auditorias persistidas no MongoDB.

Além disso, o extrator de PR (`apps/poc-diff-reader/`) será promovido de "POC" para serviço de primeira classe dentro de `src/services/`, acessível via comando CLI próprio.

**Objetivo deste design:** Definir a arquitetura, componentes, contratos e fluxos de dados para implementar os requisitos pendentes com zero over-engineering e máximo aproveitamento da infraestrutura existente.

---

## 2. Escopo

### Incluído neste design

1. Refatoração do `index.ts` para dispatcher com `commander` (subcomandos).
2. Criação de 4 comandos CLI: `audit`, `history`, `fetch`, `fetch-and-audit`.
3. Criação do serviço `GitHubExtractorService` (promoção do POC).
4. Criação do serviço `ReportGenerator` (formatação Markdown conforme RF-005).
5. Tratamento de erros robusto e mensagens amigáveis.
6. Estratégia de testes unitários e de integração.
7. Atualização dos scripts do `package.json`.

### Excluído deste design (escopo futuro)

- Fallback automático entre LLMs em caso de falha (RNF-002) — já parcialmente implementado via roteamento, mas retry/fallback não está no escopo.
- Geração de relatórios em formatos não-Markdown (HTML, PDF).
- Dashboard web ou API REST.
- Cache de resultados LLM (Redis/in-memory).

---

## 3. Arquitetura do Repositório

### Estrutura de diretórios final

```
src/
├── index.ts                         # Thin dispatcher (registry commander)
│
├── cli/
│   ├── parser.ts                    # Configuração base do commander
│   └── commands/
│       ├── audit.ts                 # Comando: audit
│       ├── history.ts               # Comando: history
│       ├── fetch.ts                 # Comando: fetch (extrai PR do GitHub)
│       └── fetch-and-audit.ts       # Comando: fetch-and-audit (pipeline completo)
│
├── services/
│   ├── types.ts                     # Existente — AuditResult, AnalysisRecord, PRCorpus, etc.
│   ├── config.ts                    # Existente — loadConfig, getMongoUri
│   ├── LLMIntegrationService.ts     # Existente — analyzePR, routing, APIs
│   ├── GitHubExtractorService.ts    # NOVO — extrai PR da API GitHub → PRCorpus
│   ├── ReportGenerator.ts           # NOVO — AnalysisRecord → Markdown
│   └── persistence/
│       └── AnalysisRepository.ts    # Existente — save, findRecent, findById, etc.
│
└── utils/
    └── prompts.ts                   # Existente — buildAuditPrompt, PROMPT_CATALOG
```

### Diretório `apps/poc-diff-reader/`

**Será removido.** A lógica de extração será migrada para `src/services/GitHubExtractorService.ts` e exposta via comando `fetch`. O script legado em `apps/` deixa de ser necessário, pois a CLI oficial cobre a funcionalidade.

---

## 4. Componentes e Interfaces

### 4.1 `src/cli/parser.ts`

Responsabilidade: Configurar a instância base do `commander` (nome, descrição, versão) e registrar todos os comandos.

```typescript
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

### 4.2 `src/cli/commands/audit.ts`

Responsabilidade: Orquestrar o fluxo completo de auditoria — validação de inputs, chamada ao LLM, geração de relatório Markdown, persistência no MongoDB e impressão do resumo no terminal.

**Flags:**
- `--diff <path>` (obrigatório) — caminho do arquivo `pr-corpus.json`.
- `--docs <dir>` (obrigatório) — caminho do diretório de documentação.
- `--output <path>` (opcional) — caminho para salvar o relatório Markdown.

**Saída no terminal (resumo compacto):**
```
[Status] Atenção necessária | Criticidade: Alta
[Gaps] 3 gaps encontrados
[Arquivo] Relatório salvo em ./relatorio.md
[MongoDB] Registro salvo com id: 647a...
```

**Arquivo Markdown (se `--output`):**
Seções obrigatórias conforme RF-005:
1. `# Status`
2. `## Criticidade`
3. `## Mudanças Identificadas`
4. `## Gaps Documentais Encontrados`
5. `## Recomendação`

### 4.3 `src/cli/commands/history.ts`

Responsabilidade: Consultar auditorias persistidas e exibir como tabela formatada no terminal.

**Flags:**
- `--limit <N>` (opcional, default: 10) — quantidade de registros a exibir.

**Saída no terminal:**
```
ID                  | PR    | Repo              | Data                | Criticidade
--------------------|-------|-------------------|---------------------|------------
647a2f...e1b3       | #42   | owner/repo        | 2026-06-05 14:32:01 | Alta
647a2f...e1b4       | #38   | owner/repo        | 2026-06-04 09:15:22 | Média
```

### 4.4 `src/cli/commands/fetch.ts`

Responsabilidade: Extrair dados de um PR do GitHub e serializar em `pr-corpus.json`.

**Argumentos posicionais:**
- `<owner>` — dono do repositório.
- `<repo>` — nome do repositório.
- `<pr-number>` — número do Pull Request.

**Flags:**
- `--output <path>` (opcional, default: `./output/pr-corpus.json`) — caminho de saída.

### 4.5 `src/cli/commands/fetch-and-audit.ts`

Responsabilidade: Pipeline completo — extrai o PR e imediatamente audita, sem necessidade de comando intermediário.

**Argumentos posicionais:**
- `<owner>`, `<repo>`, `<pr-number>` — mesmos do `fetch`.

**Flags:**
- `--docs <dir>` (obrigatório) — diretório de documentação.
- `--output <path>` (opcional) — caminho para salvar o relatório Markdown.

**Comportamento:** Executa `fetch` internamente (gera corpus temporário em `/tmp/pr-<number>-corpus.json`), depois executa `audit` com o corpus gerado. Remove o corpus temporário de `/tmp` ao final do fluxo. Se o usuário passar `--keep-corpus`, o arquivo é movido para `./output/` em vez de ser deletado.

### 4.6 `src/services/GitHubExtractorService.ts`

Responsabilidade: Encapsular toda a lógica de extração de PR do GitHub (anteriormente em `apps/poc-diff-reader/poc-diff-reader.ts`).

**Interface pública:**
```typescript
export class GitHubExtractorService {
  constructor(private token: string);

  async extract(owner: string, repo: string, prNumber: number): Promise<PRCorpus>;
}
```

**Métodos privados (migrados do POC):**
- `fetchPRMetadata(...)` — chama GitHub API `/pulls/{number}`.
- `fetchPRFiles(...)` — chama GitHub API `/pulls/{number}/files`.
- `detectLanguage(filename)` — mapeia extensão para linguagem.
- `classifyFile(filename)` — determina `isTest`, `isDocumentation`, `isConfig`, `isPublicAPI`.
- `generateChangeSummary(...)` — gera `changeSummary` baseado no patch.

**Nota:** Os tipos do POC serão reorganizados:
- `FileOutput` → fundido em `FileMetadata` (já existe em `types.ts`, campos equivalentes).
- `CorpusOutput` → fundido em `PRCorpus` (já existe em `types.ts`, campos equivalentes).
- `GitHubFile` e `GitHubPR` → tipos internos (não exportados) de `GitHubExtractorService.ts`, usados apenas para tipar as respostas da API GitHub.

### 4.7 `src/services/ReportGenerator.ts`

Responsabilidade: Receber um `AnalysisRecord` e retornar uma string Markdown formatada conforme as 5 seções obrigatórias do RF-005.

**Interface pública:**
```typescript
export class ReportGenerator {
  generate(record: AnalysisRecord): string;
}
```

**Estrutura do Markdown gerado:**
```markdown
# Status

Atenção necessária / OK

## Criticidade

Baixa / Média / Alta / Crítica

## Mudanças Identificadas

- src/auth/middleware.ts (modified, public API)
- ...

## Gaps Documentais Encontrados

1. Novo endpoint de autenticação não documentado.
2. ...

## Recomendação

- Bloquear o merge: atualizar a documentação ANTES de aprovar o PR.
- ...

---
*Auditoria gerada automaticamente em 2026-06-05T14:32:01Z*
*Provedor: gemini | Modelo: gemini-2.5-flash | Tokens: 1.234 in / 456 out*
```

---

## 5. Fluxo de Dados (Data Flow)

### 5.1 Comando `audit` (RF-005 + RF-007)

```text
[CLI] audit --diff <path> --docs <dir> [--output <md>]
  │
  ▼
[audit.ts] Validar caminhos (fs.existsSync)
  │
  ├── Caminho inválido? → Erro amigável + exit 1
  │
  ▼
[audit.ts] LLMIntegrationService.analyzePR(diff, docs)
  │
  ├─── readCorpus → PRCorpus
  ├─── readDocs → string (truncado em 8000 chars)
  ├─── calculateRouting → Gemini ou Groq
  ├─── callGemini / callGroq → AuditResult + TokenUsage
  └─── assembleRecord → AnalysisRecord
  │
  ▼
[audit.ts] ReportGenerator.generate(record) → Markdown string
  │
  ▼
[audit.ts] Se --output foi passado:
  ├── fs.writeFileSync(outputPath, markdown)
  └── Log: "[Arquivo] Relatório salvo em <path>"
  │
  ▼
[audit.ts] Se MONGODB_URI configurado:
  ├── AnalysisRepository.save(record) → id
  └── Log: "[MongoDB] Registro salvo com id: <id>"
  │
  ▼
[audit.ts] Imprimir resumo compacto no terminal (3-4 linhas)
```

### 5.2 Comando `history` (RF-008)

```text
[CLI] history [--limit N]
  │
  ▼
[history.ts] Validar MONGODB_URI
  │
  ├── Não configurado? → "MONGODB_URI não configurado. Configure para usar --history." + exit 1
  │
  ▼
[history.ts] AnalysisRepository.findRecent(limit)
  │
  ▼
[history.ts] Formatar como tabela + imprimir no terminal
```

### 5.3 Comando `fetch` (promoção do extrator)

```text
[CLI] fetch <owner> <repo> <pr-number> [--output <path>]
  │
  ▼
[fetch.ts] Validar GITHUB_TOKEN (via loadConfig ou env direto)
  │
  ├── Ausente? → Erro amigável + exit 1
  │
  ▼
[fetch.ts] GitHubExtractorService.extract(owner, repo, number)
  │
  ├── fetchPRMetadata
  ├── fetchPRFiles
  ├── classifyFile + detectLanguage
  └── assembleCorpus → PRCorpus
  │
  ▼
[fetch.ts] Salvar JSON em --output (default: ./output/pr-corpus.json)
  │
  ▼
[fetch.ts] Log: "✅ Corpus salvo em <path>"
```

### 5.4 Comando `fetch-and-audit` (pipeline)

```text
[CLI] fetch-and-audit <owner> <repo> <pr> --docs <dir> [--output <md>]
  │
  ▼
[fetch-and-audit.ts] Chama fetch.ts internamente (owner, repo, pr)
  │
  ├── Gera corpus em /tmp/pr-<number>-corpus.json (ou ./output/)
  │
  ▼
[fetch-and-audit.ts] Chama audit.ts internamente (corpus, docs, output)
  │
  ├── Executa fluxo completo de auditoria
  │
  ▼
[fetch-and-audit.ts] Remove corpus temporário (se criado em /tmp)
  │
  ▼
[fetch-and-audit.ts] Imprime resumo único no terminal
```

---

## 6. Tratamento de Erros

### Princípio orientador

A **análise em si é a prioridade**. Falhas em dependências opcionais (persistência MongoDB) **não devem abortar** o fluxo principal. Falhas em dependências obrigatórias (arquivo de diff, diretório de docs, API keys) devem gerar mensagens claras e exit code `1`.

### Matriz de erros

| Cenário | Componente | Comportamento | Exit code |
|---|---|---|---|
| `--diff` path inexistente | `audit.ts` | `"Arquivo não encontrado: <path>"` | `1` |
| `--docs` path inexistente | `audit.ts` | `"Diretório não encontrado: <path>"` | `1` |
| API key ausente | `loadConfig()` | `"Missing <KEY_NAME> in environment variables"` | `1` |
| Falha na API LLM (rate limit, 5xx) | `LLMIntegrationService` | Loga erro, não persiste, propaga exceção | `1` |
| JSON inválido da LLM | `parseJSONSafely` | Retorna default seguro, loga warning | `0` |
| Falha ao conectar no MongoDB | `AnalysisRepository` | Loga warning, **continua fluxo** | `0` |
| `history` sem `MONGODB_URI` | `history.ts` | `"MONGODB_URI não configurado..."` | `1` |
| `fetch` sem `GITHUB_TOKEN` | `fetch.ts` | `"GITHUB_TOKEN não configurado..."` | `1` |
| GitHub API error (404, 403) | `GitHubExtractorService` | Loga status + message, propaga exceção | `1` |

---

## 7. Estratégia de Testes

### 7.1 Testes unitários (novos)

| Arquivo de teste | O que testa | Mocka |
|---|---|---|
| `tests/services/GitHubExtractorService.test.ts` | `extract()`, `classifyFile()`, `detectLanguage()` | `fetch` global |
| `tests/services/ReportGenerator.test.ts` | `generate()` — valida 5 seções do RF-005 | Nenhum (função pura) |
| `tests/cli/audit.command.test.ts` | Parsing de flags, validação de paths, orquestração | `LLMIntegrationService`, `ReportGenerator`, `AnalysisRepository` |
| `tests/cli/history.command.test.ts` | `--limit`, formatação de tabela, erro sem MONGODB_URI | `AnalysisRepository` |
| `tests/cli/fetch.command.test.ts` | Parsing de args, chamada ao `GitHubExtractorService`, escrita de arquivo | `GitHubExtractorService`, `fs` |

### 7.2 Testes de integração (existentes + ajustes)

| Arquivo | Ajuste necessário |
|---|---|
| `tests/integration.test.ts` | Atualizar para chamar `audit` via commander em vez de `index.ts` diretamente, ou manter teste do `LLMIntegrationService.analyzePR` isolado e adicionar novo teste de integração para o fluxo CLI. |

### 7.3 Testes manuais (checklist de validação)

```bash
# RF-007 — CLI robusta com flags
npm run dev audit -- --diff ./output/pr-corpus.json --docs ./docs --output ./relatorio.md
# Esperado: resumo no terminal + arquivo .md gerado

# RF-005 — Relatório Markdown estruturado
cat ./relatorio.md
# Esperado: seções # Status, ## Criticidade, ## Mudanças Identificadas,
#             ## Gaps Documentais Encontrados, ## Recomendação

# RF-008 — Histórico de auditorias
npm run dev history -- --limit 5
# Esperado: tabela formatada com ID, PR, Repo, Data, Criticidade

# Fetch (refatoração extrator)
npm run dev fetch -- facebook react 27534 --output ./output/pr-corpus.json
# Esperado: corpus gerado corretamente

# Fetch-and-audit (pipeline)
npm run dev fetch-and-audit -- facebook react 27534 --docs ./docs --output ./relatorio.md
# Esperado: extração + auditoria em um comando
```

---

## 8. Atualização de Scripts (`package.json`)

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "audit": "tsx src/index.ts audit --diff ./output/pr-corpus.json --docs ./docs",
    "fetch": "tsx src/index.ts fetch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Nota:** O script legado `poc:diff-reader` será removido. A funcionalidade é coberta pelo comando `fetch`.

---

## 9. Dependências

### Nova dependência de produção

- `commander` (^12.x) — parsing robusto de CLI, subcomandos, flags, `--help` automático.

### Dependências existentes (sem mudanças)

- `dotenv` — carregamento de variáveis de ambiente.
- `mongoose` — persistência MongoDB.
- `typescript`, `tsx`, `vitest` — toolchain existente.

---

## 10. Checklist de Implementação

- [ ] Adicionar `commander` ao `package.json` (`npm install commander`).
- [ ] Criar `src/cli/parser.ts` com registry de comandos.
- [ ] Criar `src/cli/commands/audit.ts` com flags `--diff`, `--docs`, `--output`.
- [ ] Criar `src/cli/commands/history.ts` com flag `--limit`.
- [ ] Criar `src/cli/commands/fetch.ts` com args posicionais e flag `--output`.
- [ ] Criar `src/cli/commands/fetch-and-audit.ts` (pipeline).
- [ ] Criar `src/services/GitHubExtractorService.ts` (migrar lógica do POC).
- [ ] Criar `src/services/ReportGenerator.ts` (formatação Markdown).
- [ ] Refatorar `src/index.ts` para thin dispatcher (`createCLI().parse()`).
- [ ] Remover `apps/poc-diff-reader/` e script legado do `package.json`.
- [ ] Atualizar `package.json` scripts.
- [ ] Atualizar versão do `package.json` para `0.2.0`.
- [ ] Escrever testes unitários para `GitHubExtractorService`.
- [ ] Escrever testes unitários para `ReportGenerator`.
- [ ] Escrever testes para comandos `audit`, `history`, `fetch`.
- [ ] Executar testes manuais (checklist da seção 7.3).
- [ ] Atualizar `README.MD` com novos comandos e flags.
- [ ] Executar `npm run build` e verificar que compila sem erros.
- [ ] Executar suite de testes completa (`npm test`).

---

## 11. Decisões Arquiteturais

### ADR-006: Uso de `commander` para CLI

**Contexto:** O `index.ts` atual usa `process.argv.slice(2)` com args posicionais simples, o que não atende RF-007 (flags `--diff`, `--docs`, `--output`, `--history`).

**Decisão:** Adotar `commander` como biblioteca de parsing. É a opção mais leve (~30kb), popular (20M+ downloads/semana), nativa em TypeScript, e fornece `--help` automático, validação de args obrigatórios e parsing de flags.

**Alternativas rejeitadas:**
- `yargs` — mais pesado, API mais verbosa, overkill para 4 comandos.
- `argparse` — nativo do Python, port para Node não é tão maduro.
- Parsing manual — requer reinventar `--help`, validação, mensagens de erro.

### ADR-007: Promoção do `poc-diff-reader` para serviço

**Contexto:** O extrator de PR vive isolado em `apps/poc-diff-reader/` e não é reutilizável por outros módulos. O time deseja que ele seja parte da CLI oficial.

**Decisão:** Migrar a lógica para `src/services/GitHubExtractorService.ts`, removendo o diretório `apps/poc-diff-reader/`. Isso elimina duplicação de código, unifica a toolchain (`tsx src/index.ts` cobre tudo) e simplifica a estrutura do repositório.

**Risco mitigado:** O diretório `apps/` pode ser usado no futuro para outros entrypoints (ex: GitHub Action). Se isso acontecer, novos apps serão criados do zero, não reaproveitando o POC.

---

*Documento gerado via processo de brainstorming. Aprovado para fase de plano de implementação.*
