/**
 * POC: GitHub PR Diff Reader - Simplificado para análise de documentação
 *
 * Gera um único corpus.json com diffs inline para consumo por LLM agents.
 * Uso: npx ts-node poc-diff-reader.ts <owner> <repo> <pr_number>
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config();

interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  previous_filename?: string;
}

interface GitHubPR {
  title: string;
  body: string | null;
  user: { login: string; html_url: string };
  labels: Array<{ name: string }>;
  html_url: string;
}

interface FileOutput {
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

interface CorpusOutput {
  pr: {
    number: string;
    repository: string;
    title: string;
    description: string | null;
    author: string;
    labels: string[];
    html_url: string;
  };
  files: FileOutput[];
}

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript (JSX)',
    js: 'JavaScript', jsx: 'JavaScript (JSX)',
    py: 'Python', rb: 'Ruby', go: 'Go',
    java: 'Java', kt: 'Kotlin',
    rs: 'Rust', c: 'C', cpp: 'C++', h: 'C Header',
    cs: 'C#', vb: 'Visual Basic',
    php: 'PHP', swift: 'Swift',
    md: 'Markdown', rst: 'reStructuredText',
    json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', toml: 'TOML',
    css: 'CSS', scss: 'SCSS', less: 'Less',
    html: 'HTML', svg: 'SVG',
    sh: 'Shell', bash: 'Bash', zsh: 'Zsh',
    sql: 'SQL', graphql: 'GraphQL',
    dockerfile: 'Dockerfile',
  };
  return ext ? langMap[ext] || ext : 'unknown';
}

function classifyFile(filename: string): {
  isTest: boolean;
  isDocumentation: boolean;
  isConfig: boolean;
  isPublicAPI: boolean;
} {
  const parts = filename.split('/');
  const basename = parts[parts.length - 1];
  const ext = basename.split('.').pop()?.toLowerCase();

  const isTest =
    basename.includes('.test.') ||
    basename.includes('.spec.') ||
    basename.includes('-test.') ||
    parts.includes('__tests__') ||
    parts.includes('tests') ||
    parts.includes('test') ||
    basename.startsWith('test_');

  const isDocumentation =
    ext === 'md' || ext === 'mdx' || ext === 'rst' ||
    parts.includes('docs') || parts.includes('documentation') ||
    basename.includes('README') || basename.includes('CHANGELOG') ||
    basename.includes('CONTRIBUTING');

  const isConfig =
    basename === 'package.json' || basename === 'tsconfig.json' ||
    basename === '.eslintrc' || basename === '.prettierrc' ||
    basename === 'webpack.config.js' || basename === 'vite.config.ts' ||
    basename.startsWith('.') || ext === 'yaml' || ext === 'yml' ||
    ext === 'toml' || basename === 'Dockerfile' ||
    parts.includes('config') || parts.includes('configuration');

  const isPublicAPI =
    !isTest && !isDocumentation && !isConfig &&
    !parts.includes('internal') &&
    !parts.includes('__tests__') &&
    !parts.includes('node_modules');

  return { isTest, isDocumentation, isConfig, isPublicAPI };
}

function generateChangeSummary(filename: string, status: string, additions: number, deletions: number, patch: string): string {
  if (status === 'added') return `Novo arquivo adicionado (+${additions} linhas)`;
  if (status === 'deleted') return `Arquivo removido (-${deletions} linhas)`;
  if (status === 'renamed') return `Arquivo renomeado`;

  const hasTypeChanges = patch.includes('type ') || patch.includes('interface ') || patch.includes('class ');
  const hasFunctionChanges = patch.includes('function ') || patch.includes('def ') || patch.includes('const ');
  const hasImportChanges = patch.includes('\n+import ') || patch.includes('\n-import ');
  const hasExportChanges = patch.includes('\n+export ') || patch.includes('\n-export ');

  const changes: string[] = [];
  if (hasTypeChanges) changes.push('tipos/interfaces');
  if (hasFunctionChanges) changes.push('funções/métodos');
  if (hasImportChanges) changes.push('imports');
  if (hasExportChanges) changes.push('exports');

  return changes.length > 0
    ? `Mudanças em: ${changes.join(', ')} (+${additions}/-${deletions})`
    : `Modificações diversas (+${additions}/-${deletions})`;
}

async function fetchPRMetadata(owner: string, repo: string, prNumber: number, token: string): Promise<GitHubPR> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
  const response = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

async function fetchPRFiles(owner: string, repo: string, prNumber: number, token: string): Promise<GitHubFile[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
  const response = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN env var não definida");
  }

  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log("Uso: npx ts-node poc-diff-reader.ts <owner> <repo> <pr_number>");
    console.log("\nExemplo:");
    console.log("  npx ts-node poc-diff-reader.ts facebook react 27534");
    process.exit(1);
  }

  const [owner, repo, prNumber] = args;

  try {
    console.log(`\n🔍 Buscando PR #${prNumber} em ${owner}/${repo}...`);

    console.log("📋 Buscando metadados da PR...");
    const prMetadata = await fetchPRMetadata(owner, repo, parseInt(prNumber), token);
    console.log(`✅ PR: "${prMetadata.title}" por @${prMetadata.user.login}`);

    console.log("📁 Buscando arquivos alterados...");
    const files = await fetchPRFiles(owner, repo, parseInt(prNumber), token);
    console.log(`✅ ${files.length} arquivos encontrados\n`);

    const fileOutputs: FileOutput[] = files.map((file) => {
      const classification = classifyFile(file.filename);
      const status = file.status === 'renamed' ? 'renamed' : file.status as FileOutput["status"];

      return {
        path: file.filename,
        status,
        additions: file.additions,
        deletions: file.deletions,
        language: detectLanguage(file.filename),
        ...classification,
        changeSummary: generateChangeSummary(file.filename, file.status, file.additions, file.deletions, file.patch || ""),
        diff: file.patch || "",
      };
    });

    const corpus: CorpusOutput = {
      pr: {
        number: prNumber,
        repository: `${owner}/${repo}`,
        title: prMetadata.title,
        description: prMetadata.body,
        author: prMetadata.user.login,
        labels: prMetadata.labels.map(l => l.name),
        html_url: prMetadata.html_url,
      },
      files: fileOutputs,
    };

    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const corpusFile = path.join(outputDir, `pr-${prNumber}-${owner}-${repo}-corpus.json`);
    fs.writeFileSync(corpusFile, JSON.stringify(corpus, null, 2), 'utf-8');

    const totalAdditions = fileOutputs.reduce((s, f) => s + f.additions, 0);
    const totalDeletions = fileOutputs.reduce((s, f) => s + f.deletions, 0);
    const publicApiFiles = fileOutputs.filter(f => f.isPublicAPI).length;
    const testFiles = fileOutputs.filter(f => f.isTest).length;
    const docFiles = fileOutputs.filter(f => f.isDocumentation).length;

    console.log(`✅ Output salvo em: ${corpusFile}`);
    console.log(`📄 ${fileOutputs.length} arquivos`);
    console.log(`🌐 ${publicApiFiles} públicos | 🧪 ${testFiles} testes | 📚 ${docFiles} docs`);
    console.log(`➕ +${totalAdditions} | ➖ -${totalDeletions}\n`);

  } catch (error) {
    console.error("❌ Erro:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
