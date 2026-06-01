# POC: GitHub PR Diff Reader

Exemplo simples em TypeScript para ler e processar diffs de Pull Requests do GitHub.

## Setup

### 1. Instalar dependências
```bash
npm install
# ou
pnpm add ts-node typescript --save-dev
```

### 2. Configurar variável de ambiente
```bash
export GITHUB_TOKEN="seu_token_aqui"
```

Para gerar um token:
1. GitHub → Settings → Developer settings → Personal access tokens
2. Criar um token com escopo `repo` (ou `public_repo` para repos públicos)

## Uso

### Versão CLI
```bash
npx ts-node poc-diff-reader.ts <owner> <repo> <pr_number>
```

**Exemplo:**
```bash
npx ts-node poc-diff-reader.ts facebook react 27534
```

### Versão programática (em sua aplicação)
```typescript
import { fetchPRFiles, processAllDiffs } from './poc-diff-reader';

async function analyzePR() {
  const token = process.env.GITHUB_TOKEN!;
  const files = await fetchPRFiles('facebook', 'react', 27534, token);
  const diffs = processAllDiffs(files);
  
  // Usar diffs para próximas etapas (LLM, análise, etc)
  console.log(diffs);
}
```

## Estrutura de saída

A POC processa os diffs em uma estrutura pronta para análise:

```typescript
interface ProcessedDiff {
  filename: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  hunks: Hunk[];
}

interface Hunk {
  header: string;  // ex: "@@ -10,5 +12,7 @@"
  lines: string[]; // linhas do diff (+, -, espaço)
}
```

## Exemplo de saída

```
📊 PR DIFF SUMMARY
============================================================
✨ src/new-feature.ts (added) | +45 -0
📝 src/components/App.tsx (modified) | +12 -8
📝 README.md (modified) | +15 -3
============================================================
Total: 3 arquivos alterados
Adições: +72 | Deleções: -11

📌 Detalhes dos primeiros arquivos:

📄 src/new-feature.ts
Status: added | +45 -0
────────────────────────────────────────────────────────────

@@ -0,0 +1,45 @@
+export function newFeature() {
+  console.log('Hello');
+}

📄 src/components/App.tsx
Status: modified | +12 -8
────────────────────────────────────────────────────────────

@@ -24,5 +24,10 @@
 function App() {
   return (
-    <OldComponent />
+    <NewComponent />
+    <NewFeature />
```

## Próximos passos

Esta POC fornece a estrutura de dados pronta para:

1. **Análise com LLM** — Passar cada arquivo/hunk para Claude/Groq
2. **Detecção de padrões** — Procurar palavras-chave (API, auth, config)
3. **Busca de docs** — Verificar quais arquivos .md mencionam os mesmos tópicos
4. **Scoring de criticidade** — Classificar por tipo de mudança

## O que funciona nesta POC

✅ Busca arquivos de uma PR real no GitHub
✅ Faz parsing do unified diff format
✅ Estrutura os hunks para análise
✅ Exibe resumo visual no terminal
✅ Prepara dados para LLM/análise

## O que não está aqui

❌ Análise com LLM
❌ Busca de documentação existente
❌ Persistência em MongoDB
❌ Comentário na PR
❌ Tratamento de erros robusto
❌ Suporte a diffs muito grandes (>30k linhas)

## Dúvidas frequentes

**P: E se a PR for muito grande?**
A: Hoje trunca a exibição, mas os dados completos estão em `ProcessedDiff`. Para versão final, implementar paginação.

**P: Como integrar com GitHub Actions?**
A: O `GITHUB_TOKEN` já vem injetado automaticamente em Actions. Só precisar usar como env var.

**P: Posso usar com repositórios privados?**
A: Sim, desde que o token tenha permissão `repo` (não apenas `public_repo`).
