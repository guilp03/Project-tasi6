# Design: Corpus Enxuto + Diff Inline para LLM

**Data:** 2026-05-31
**Status:** Aprovado

## Problema

Dois problemas identificados no fluxo atual:

1. **Redundância no corpus** — O POCDiffReader gera 4 arquivos (`corpus.json`, `hunks/`, `manifest.json`, `line-changes.json`) com o mesmo conteúdo de diff repetido 3-4 vezes. Para um PR com 10 arquivos e 30 hunks, o mesmo diff aparece em `files[].hunks`, no array `hunks` do topo, em `line_changes` individualizado, e nos JSONs de hunk.

2. **Diff nunca chega à LLM** — O `buildAuditPrompt()` só envia `f.path` e `f.status` para o prompt. Os hunks e line_changes extraídos com cuidado ficam de fora, tornando a auditoria cega ao conteúdo real das mudanças.

## Solução: Corpus Enxuto + Diff Inline

### 1. Corpus Simplificado

**Antes (4 arquivos):**
- `pr-X-owner-repo-corpus.json` — tudo com redundância
- `pr-X-owner-repo-hunks/` — cada hunk em JSON separado
- `pr-X-owner-repo-manifest.json` — resumo que repete info do corpus
- `pr-X-owner-repo-line-changes.json` — linha por linha que repete o diff

**Depois (1 arquivo):**
- `pr-X-owner-repo-corpus.json` — tudo num arquivo só

Estrutura proposta:

```json
{
  "pr": {
    "number": "27534",
    "repository": "facebook/react",
    "title": "Fix auth middleware token verification",
    "description": "...",
    "author": "someone",
    "labels": [],
    "html_url": "..."
  },
  "files": [
    {
      "path": "src/auth/middleware.ts",
      "status": "modified",
      "additions": 12,
      "deletions": 3,
      "language": "TypeScript",
      "isPublicAPI": true,
      "isTest": false,
      "isDocumentation": false,
      "isConfig": false,
      "changeSummary": "Mudanças em: imports, funções/métodos (+12/-3)",
      "diff": "@@ -45,5 +48,14 @@\n+import { verifyToken } from './jwt';\n..."
    }
  ]
}
```

**Campos removidos:**
- `pr.merged`, `pr.state`, `pr.created_at`, `pr.merged_at`, `pr.base_ref`, `pr.head_ref`, `pr.stats.commits`, `pr.stats.comments`, `pr.stats.review_comments` — irrelevantes para auditoria de documentação
- `manifest` — substituído pela contagem direta em `files.length`
- `hunks[]` no topo — redundante com `files[].diff`
- `line_changes[]` — redundante com o diff bruto
- `previousPath` — irrelevante para a auditoria
- `hunkIds[]` — sem consumidor
- Arquivos `hunks/`, `manifest.json`, `line-changes.json` — eliminados

**Campo adicionado:**
- `files[].diff` — o patch bruto do GitHub (string), que é tudo oq a LLM precisa
- `files[].changeSummary` — resumo textual das mudanças por arquivo

### 2. Prompt com Diff Inline

O `buildAuditPrompt()` será reescrito para incluir o diff real com truncamento inteligente.

**Estrutura do prompt:**
```
You are a technical documentation auditor...

## PR Context
Repository, PR number, title, description, author

## Files Changed
- path (status, language, flags) +N/-M

## Diffs
--- path (status, flags) ---
<diff content>

## Current Documentation
<docs content>

## Analysis Rules
1. Focus on semantic/structural changes (ignore style/refactor)
2. Compare against the documentation provided
3. Security, auth, infra without docs = ALWAYS Crítica
4. Return JSON...
```

**Regras de truncamento (por prioridade de remoção):**
- Limite: ~6k chars de diff para Groq (sobrando ~2k para doc + prompt), ~120k chars para Gemini
- Ordem de remoção (primeiro a ser cortado): `isTest` > `isConfig` > `isDocumentation` > `isPublicAPI`
- Arquivos com padrões de segurança (auth, env, infra) **nunca** são truncados
- Se truncar, adicionar nota: `[... N files omitted: file1.spec.ts, config.json]`

### 3. Ajustes no LLMIntegrationService

**Roteamento (`calculateRoutingDecision`):**
- Calcular tamanho real do payload como `files.reduce((sum, f) => sum + (f.diff?.length || 0), 0)` em vez de apenas `additions + deletions`
- Manter threshold de 30k chars para rotear para Gemini

**Leitura de documentação (`readDocsDirectory`):**
- Ler múltiplos arquivos .md do diretório (hoje só lê o primeiro)
- Agregar conteúdo com limite de ~8k chars total
- Prioridade: README > docs/ > demais .md

### 4. Ajustes em types.ts

**`PRCorpus` simplificado:**
```typescript
export interface PRCorpus {
  pr: {
    number: string;
    repository: string;
    title: string;
    description: string | null;
    author: string;
    labels: string[];
    html_url: string;
  };
  files: FileMetadata[];
}
```

**`FileMetadata` atualizado:**
```typescript
export interface FileMetadata {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  language: string;
  isPublicAPI: boolean;
  isTest: boolean;
  isDocumentation: boolean;
  isConfig: boolean;
  changeSummary: string;
  diff: string;
}
```

### 5. Ajustes em poc-diff-reader.ts

- Gerar um único arquivo `pr-X-owner-repo-corpus.json`
- Remover geração de `hunks/`, `manifest.json`, `line-changes.json`
- Incluir `diff` (o `patch` do GitHub) em cada arquivo
- Incluir `changeSummary` em cada arquivo
- Remover campos irrelevantes do PR
- Remover `line_changes`, `hunks` do topo, `manifest`, `hunkIds`
- Remover tipos `Hunk`, `LineChange`, `HunkForAgent`, `PRCorpus` (do POC) — simplificar para o novo formato

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `apps/poc-diff-reader/poc-diff-reader.ts` | Simplificar output para 1 arquivo com diff inline |
| `src/services/types.ts` | Simplificar `PRCorpus` e `FileMetadata` |
| `src/utils/prompts.ts` | Reescrever `buildAuditPrompt` com diff inline + truncamento |
| `src/services/LLMIntegrationService.ts` | Roteamento por tamanho real do diff; ler múltiplos .md |