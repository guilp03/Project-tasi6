# POC Diff Reader - GitHub PR Diff Extractor

## Visão Geral

Ferramenta que extrai diffs de Pull Requests do GitHub e os estrutura em formatos otimizados para análise por LLM agents. Ideal para automatizar auditoria de documentação e geração de alertas sobre mudanças relevantes em código.

## Instalação

```bash
npm install
```

## Configuração

Crie um arquivo `.env` na raiz do projeto:

```env
GITHUB_TOKEN=ghp_seu_token_aqui
```

Para gerar um token: GitHub → Settings → Developer settings → Personal access tokens → Generate new token (scopes: `repo`).

## Uso

```bash
npm run poc:diff-reader -- <owner> <repo> <pr_number>
```

**Exemplo:**

```bash
npm run poc:diff-reader -- facebook react 27534
```

## Output Gerado

A ferramenta gera 4 tipos de arquivos na pasta `output/`:

### 1. Corpus Completo (`pr-{num}-{owner}-{repo}-corpus.json`)

JSON com **todos os dados** da PR em um único arquivo:

```json
{
  "pr": {
    "number": "27534",
    "repository": "facebook/react",
    "title": "[Fizz][Float] Only flush Hoistable Elements...",
    "description": "This PR changes how hoistable elements...",
    "author": "sebmarkbage",
    "state": "closed",
    "merged": true,
    "labels": ["CLA Signed", "React Core Team"],
    "created_at": "2023-08-15T...",
    "merged_at": "2023-08-16T...",
    "base_ref": "main",
    "head_ref": "feature-branch",
    "stats": {
      "files_changed": 30,
      "additions": 611,
      "deletions": 1095,
      "commits": 5,
      "comments": 12,
      "review_comments": 8
    },
    "html_url": "https://github.com/facebook/react/pull/27534"
  },
  "files": [...],
  "hunks": [...],
  "line_changes": [...],
  "manifest": {...}
}
```

### 2. Hunks Individuais (`pr-{num}-{owner}-{repo}-hunks/hunk-XXX.json`)

Um arquivo JSON **por hunk** para distribuição paralela entre agentes:

```json
{
  "pr": {
    "number": "27534",
    "repository": "facebook/react",
    "title": "...",
    "labels": ["CLA Signed"],
    "html_url": "..."
  },
  "file": {
    "path": "packages/react-dom-bindings/src/server/ReactFizzConfigDOM.js",
    "status": "modified",
    "isTest": false,
    "isDocumentation": false,
    "isPublicAPI": true,
    "language": "JavaScript"
  },
  "hunk": {
    "id": "hunk-001",
    "header": "@@ -149,11 +149,7 @@",
    "oldStart": 149,
    "oldCount": 11,
    "newStart": 149,
    "newCount": 7,
    "diff": "- charsetChunks...\n+ importMapChunks...",
    "additions": 1,
    "deletions": 4,
    "line_changes": [
      {
        "type": "deleted",
        "content": "charsetChunks: Array<Chunk | PrecomputedChunk>,",
        "oldLine": 152,
        "newLine": null,
        "hunkId": "hunk-001"
      },
      {
        "type": "added",
        "content": "importMapChunks: Array<Chunk | PrecomputedChunk>,",
        "oldLine": null,
        "newLine": 152,
        "hunkId": "hunk-001"
      }
    ]
  }
}
```

### 3. Manifest (`pr-{num}-{owner}-{repo}-manifest.json`)

Arquivo de **coordenação** com lista de IDs para distribuição:

```json
{
  "pr": { "number": "27534", "repository": "facebook/react", "title": "...", "author": "sebmarkbage", "labels": [...], "merged": true, "html_url": "..." },
  "manifest": {
    "total_hunks": 145,
    "files_with_hunks": 30,
    "public_api_files": 18,
    "test_files": 8,
    "documentation_files": 2,
    "total_line_changes": 1706,
    "generated_at": "2024-01-15T..."
  },
  "hunk_ids": ["hunk-001", "hunk-002", ...],
  "hunk_files": ["hunk-001.json", "hunk-002.json", ...]
}
```

### 4. Mudanças Linha por Linha (`pr-{num}-{owner}-{repo}-line-changes.json`)

Array plano de **cada linha individual** alterada:

```json
{
  "pr": { "number": "27534", "repository": "facebook/react", "title": "..." },
  "line_changes": [
    { "type": "deleted", "content": "charsetChunks: ...", "oldLine": 152, "newLine": null, "hunkId": "hunk-001" },
    { "type": "added", "content": "importMapChunks: ...", "oldLine": null, "newLine": 152, "hunkId": "hunk-001" }
  ]
}
```

## Estrutura de Dados

### Tipos de Linha

| Tipo | Descrição |
|------|-----------|
| `added` | Linha adicionada (prefixo `+` no diff) |
| `deleted` | Linha removida (prefixo `-` no diff) |
| `context` | Linha de contexto (inalterada, prefixo espaço) |

### Classificação de Arquivos

| Campo | Descrição |
|-------|-----------|
| `isTest` | Arquivo de teste (`.test.`, `__tests__/`, etc) |
| `isDocumentation` | Documentação (`.md`, `docs/`, `README`) |
| `isConfig` | Configuração (`package.json`, `.eslintrc`, etc) |
| `isPublicAPI` | Código público (não é test/doc/config/internal) |

### Linguagens Suportadas

TypeScript, JavaScript, Python, Ruby, Go, Java, Kotlin, Rust, C/C++, C#, PHP, Swift, Markdown, JSON, YAML, XML, CSS/SCSS, HTML, Shell, SQL, GraphQL, Dockerfile.

## Arquitetura para LLM Agents

```
┌─────────────────┐
│   PR Reader     │  →  Extrai diffs + metadados da GitHub API
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Corpus JSON   │  →  Dados completos da PR
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Coordinator    │  →  Lê manifest, distribui hunks
│     Agent       │  →  Filtra por isPublicAPI, relevância
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│Agent 1│ │Agent 2│  →  Cada um recebe hunk-XXX.json
│       │ │       │     autocontido com contexto
└───┬───┘ └───┬───┘
    │         │
    ▼         ▼
┌─────────────────┐
│  Alertas/Docs   │  →  "⚠️ Breaking: função X removida"
│                 │  →  "📝 Docs: nova API Y precisa docs"
│                 │  →  "✅ Internal: sem impacto docs"
└─────────────────┘
```

## Prompt Sugerido para LLM

```
Você é um analista de documentação técnica. Analise esta mudança de código
e determine se ela requer atualização na documentação.

Contexto da PR:
- Título: {pr.title}
- Labels: {pr.labels}
- Arquivo: {file.path}
- Tipo: {file.isPublicAPI ? 'API Pública' : 'Interno'}

Mudança:
{hunk.diff}

Responda em JSON:
{
  "requires_docs_update": true/false,
  "impact": "breaking|feature|internal|bugfix",
  "reason": "Explicação breve",
  "suggested_action": "O que o PMO deve fazer"
}
```

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm run poc:diff-reader -- owner repo num` | Executa a POC |
| `npm run build` | Compila TypeScript |
| `npm run dev` | Roda src/index.ts |
