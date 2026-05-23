/**
 * POC: GitHub PR Diff Reader - Enhanced para análise de documentação
 *
 * Extrai diffs + metadados completos para análise por LLM agents
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
  state: string;
  merged: boolean;
  merge_commit_sha: string | null;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  user: { login: string; html_url: string };
  base: { ref: string; sha: string };
  head: { ref: string; sha: string; repo: { full_name: string } };
  labels: Array<{ name: string; color: string; description: string | null }>;
  additions: number;
  deletions: number;
  changed_files: number;
  comments: number;
  review_comments: number;
  commits: number;
  html_url: string;
  diff_url: string;
}

interface Hunk {
  header: string;
  lines: string[];
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
}

interface FileMetadata {
  path: string;
  previousPath: string | null;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  totalChanges: number;
  language: string;
  isTest: boolean;
  isDocumentation: boolean;
  isConfig: boolean;
  isPublicAPI: boolean;
  hunks: Hunk[];
  hunkIds: string[];
  changeSummary: string;
}

interface LineChange {
  type: "added" | "deleted" | "context";
  content: string;
  oldLine: number | null;
  newLine: number | null;
  hunkId: string;
}

interface HunkForAgent {
  id: string;
  file: string;
  status: "added" | "modified" | "deleted" | "renamed";
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  diff: string;
  additions: number;
  deletions: number;
  fileMetadata: {
    isTest: boolean;
    isDocumentation: boolean;
    isPublicAPI: boolean;
    language: string;
  };
}

interface PRCorpus {
  pr: {
    number: string;
    repository: string;
    title: string;
    description: string | null;
    author: string;
    state: string;
    merged: boolean;
    labels: string[];
    created_at: string;
    merged_at: string | null;
    base_ref: string;
    head_ref: string;
    stats: {
      files_changed: number;
      additions: number;
      deletions: number;
      commits: number;
      comments: number;
      review_comments: number;
    };
    html_url: string;
  };
  files: FileMetadata[];
  hunks: HunkForAgent[];
  line_changes: LineChange[];
  manifest: {
    total_hunks: number;
    files_with_hunks: number;
    public_api_files: number;
    test_files: number;
    documentation_files: number;
    total_line_changes: number;
    generated_at: string;
  };
}

/**
 * Busca metadados completos da PR
 */
async function fetchPRMetadata(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): Promise<GitHubPR> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Busca os arquivos alterados de uma PR via GitHub API
 */
async function fetchPRFiles(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): Promise<GitHubFile[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;

  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`
    );
  }

  const files: GitHubFile[] = await response.json();
  return files;
}

/**
 * Detecta linguagem pelo extension
 */
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

/**
 * Classifica o tipo de arquivo
 */
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

/**
 * Gera resumo das mudanças em um arquivo
 */
function generateChangeSummary(filename: string, status: string, additions: number, deletions: number, hunks: Hunk[]): string {
  if (status === 'added') return `Novo arquivo adicionado (+${additions} linhas)`;
  if (status === 'deleted') return `Arquivo removido (-${deletions} linhas)`;
  if (status === 'renamed') return `Arquivo renomeado de ${filename}`;
  
  const hasTypeChanges = hunks.some(h => h.lines.some(l => l.includes('type ') || l.includes('interface ') || l.includes('class ')));
  const hasFunctionChanges = hunks.some(h => h.lines.some(l => l.includes('function ') || l.includes('def ') || l.includes('const ')));
  const hasImportChanges = hunks.some(h => h.lines.some(l => l.startsWith('+import ') || l.startsWith('-import ')));
  const hasExportChanges = hunks.some(h => h.lines.some(l => l.startsWith('+export ') || l.startsWith('-export ')));

  const changes: string[] = [];
  if (hasTypeChanges) changes.push('tipos/interfaces');
  if (hasFunctionChanges) changes.push('funções/métodos');
  if (hasImportChanges) changes.push('imports');
  if (hasExportChanges) changes.push('exports');

  return changes.length > 0 
    ? `Mudanças em: ${changes.join(', ')} (+${additions}/-${deletions})`
    : `Modificações diversas (+${additions}/-${deletions})`;
}

/**
 * Processa um diff raw em hunks estruturados
 */
function parseDiff(patch: string): Hunk[] {
  if (!patch) return [];

  const lines = patch.split("\n");
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      currentHunk = {
        header: line,
        lines: [],
        oldStart: match ? parseInt(match[1]) : 0,
        oldCount: match && match[2] ? parseInt(match[2]) : 1,
        newStart: match ? parseInt(match[3]) : 0,
        newCount: match && match[4] ? parseInt(match[4]) : 1,
      };
    } else if (currentHunk) {
      currentHunk.lines.push(line);
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Processa todos os arquivos de uma PR com metadados
 */
function processAllDiffs(files: GitHubFile[]): FileMetadata[] {
  return files.map((file) => {
    const hunks = parseDiff(file.patch || "");
    const classification = classifyFile(file.filename);
    const status = file.status === 'renamed' ? 'renamed' : file.status as "added" | "modified" | "deleted";
    
    return {
      path: file.filename,
      previousPath: file.previous_filename || null,
      status,
      additions: file.additions,
      deletions: file.deletions,
      totalChanges: file.changes,
      language: detectLanguage(file.filename),
      ...classification,
      hunks,
      hunkIds: [],
      changeSummary: generateChangeSummary(file.filename, file.status, file.additions, file.deletions, hunks),
    };
  });
}

/**
 * Extrai mudanças linha por linha de um hunk
 */
function extractLineChanges(hunk: Hunk, hunkId: string): LineChange[] {
  const lines: LineChange[] = [];
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;

  for (const line of hunk.lines) {
    if (line.startsWith('+')) {
      lines.push({ type: 'added', content: line.slice(1), oldLine: null, newLine, hunkId });
      newLine++;
    } else if (line.startsWith('-')) {
      lines.push({ type: 'deleted', content: line.slice(1), oldLine, newLine: null, hunkId });
      oldLine++;
    } else {
      lines.push({ type: 'context', content: line.slice(1), oldLine, newLine, hunkId });
      oldLine++;
      newLine++;
    }
  }

  return lines;
}

/**
 * Main
 */
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

    // 1. Busca metadados da PR
    console.log("📋 Buscando metadados da PR...");
    const prMetadata = await fetchPRMetadata(owner, repo, parseInt(prNumber), token);
    console.log(`✅ PR: "${prMetadata.title}" por @${prMetadata.user.login}`);

    // 2. Busca arquivos da PR
    console.log("📁 Buscando arquivos alterados...");
    const files = await fetchPRFiles(owner, repo, parseInt(prNumber), token);
    console.log(`✅ ${files.length} arquivos encontrados\n`);

    // 3. Processa diffs com metadados
    const fileMetadatas = processAllDiffs(files);

    // 4. Constrói estrutura para agentes
    let hunkId = 0;
    const hunksForAgents: HunkForAgent[] = [];
    const allLineChanges: LineChange[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const fileMeta of fileMetadatas) {
      totalAdditions += fileMeta.additions;
      totalDeletions += fileMeta.deletions;

      const fileHunkIds: string[] = [];

      for (const hunk of fileMeta.hunks) {
        hunkId++;
        const hunkIdStr = `hunk-${String(hunkId).padStart(3, '0')}`;
        fileHunkIds.push(hunkIdStr);

        const lineChanges = extractLineChanges(hunk, hunkIdStr);
        allLineChanges.push(...lineChanges);

        hunksForAgents.push({
          id: hunkIdStr,
          file: fileMeta.path,
          status: fileMeta.status,
          header: hunk.header,
          oldStart: hunk.oldStart,
          oldCount: hunk.oldCount,
          newStart: hunk.newStart,
          newCount: hunk.newCount,
          diff: hunk.lines.join('\n'),
          additions: hunk.lines.filter(l => l.startsWith('+')).length,
          deletions: hunk.lines.filter(l => l.startsWith('-')).length,
          fileMetadata: {
            isTest: fileMeta.isTest,
            isDocumentation: fileMeta.isDocumentation,
            isPublicAPI: fileMeta.isPublicAPI,
            language: fileMeta.language,
          },
        });
      }

      fileMeta.hunkIds = fileHunkIds;
    }

    const corpus: PRCorpus = {
      pr: {
        number: prNumber,
        repository: `${owner}/${repo}`,
        title: prMetadata.title,
        description: prMetadata.body,
        author: prMetadata.user.login,
        state: prMetadata.state,
        merged: prMetadata.merged,
        labels: prMetadata.labels.map(l => l.name),
        created_at: prMetadata.created_at,
        merged_at: prMetadata.merged_at,
        base_ref: prMetadata.base.ref,
        head_ref: prMetadata.head.ref,
        stats: {
          files_changed: prMetadata.changed_files,
          additions: prMetadata.additions,
          deletions: prMetadata.deletions,
          commits: prMetadata.commits,
          comments: prMetadata.comments,
          review_comments: prMetadata.review_comments,
        },
        html_url: prMetadata.html_url,
      },
      files: fileMetadatas.map(f => ({
        path: f.path,
        previousPath: f.previousPath,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        totalChanges: f.totalChanges,
        language: f.language,
        isTest: f.isTest,
        isDocumentation: f.isDocumentation,
        isConfig: f.isConfig,
        isPublicAPI: f.isPublicAPI,
        hunks: f.hunks,
        hunkIds: f.hunkIds,
        changeSummary: f.changeSummary,
      })),
      hunks: hunksForAgents,
      line_changes: allLineChanges,
      manifest: {
        total_hunks: hunksForAgents.length,
        files_with_hunks: fileMetadatas.filter(f => f.hunks.length > 0).length,
        public_api_files: fileMetadatas.filter(f => f.isPublicAPI).length,
        test_files: fileMetadatas.filter(f => f.isTest).length,
        documentation_files: fileMetadatas.filter(f => f.isDocumentation).length,
        total_line_changes: allLineChanges.length,
        generated_at: new Date().toISOString(),
      },
    };

    // 5. Salva output
    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const corpusFile = path.join(outputDir, `pr-${prNumber}-${owner}-${repo}-corpus.json`);
    fs.writeFileSync(corpusFile, JSON.stringify(corpus, null, 2), 'utf-8');

    const hunksDir = path.join(outputDir, `pr-${prNumber}-${owner}-${repo}-hunks`);
    if (!fs.existsSync(hunksDir)) {
      fs.mkdirSync(hunksDir, { recursive: true });
    }

    for (const hunk of hunksForAgents) {
      const hunkLineChanges = allLineChanges.filter(lc => lc.hunkId === hunk.id);
      const hunkFile = path.join(hunksDir, `${hunk.id}.json`);
      fs.writeFileSync(hunkFile, JSON.stringify({
        pr: {
          number: corpus.pr.number,
          repository: corpus.pr.repository,
          title: corpus.pr.title,
          labels: corpus.pr.labels,
          html_url: corpus.pr.html_url,
        },
        file: {
          path: hunk.file,
          status: hunk.status,
          ...hunk.fileMetadata,
        },
        hunk: {
          id: hunk.id,
          header: hunk.header,
          oldStart: hunk.oldStart,
          oldCount: hunk.oldCount,
          newStart: hunk.newStart,
          newCount: hunk.newCount,
          diff: hunk.diff,
          additions: hunk.additions,
          deletions: hunk.deletions,
          line_changes: hunkLineChanges,
        },
      }, null, 2), 'utf-8');
    }

    // Salva manifest para coordenação
    const manifestFile = path.join(outputDir, `pr-${prNumber}-${owner}-${repo}-manifest.json`);
    fs.writeFileSync(manifestFile, JSON.stringify({
      pr: {
        number: corpus.pr.number,
        repository: corpus.pr.repository,
        title: corpus.pr.title,
        author: corpus.pr.author,
        labels: corpus.pr.labels,
        merged: corpus.pr.merged,
        html_url: corpus.pr.html_url,
      },
      manifest: corpus.manifest,
      hunk_ids: hunksForAgents.map(h => h.id),
      hunk_files: hunksForAgents.map(h => `${h.id}.json`),
    }, null, 2), 'utf-8');

    // Salva mudanças linha por linha
    const lineChangesFile = path.join(outputDir, `pr-${prNumber}-${owner}-${repo}-line-changes.json`);
    fs.writeFileSync(lineChangesFile, JSON.stringify({
      pr: {
        number: corpus.pr.number,
        repository: corpus.pr.repository,
        title: corpus.pr.title,
      },
      line_changes: allLineChanges,
    }, null, 2), 'utf-8');

    console.log(`✅ Output salvo em: ${outputDir}`);
    console.log(`📄 ${corpus.manifest.files_with_hunks} arquivos, ${corpus.manifest.total_hunks} hunks`);
    console.log(`📝 ${corpus.manifest.total_line_changes} linhas individuais extraídas`);
    console.log(`🌐 ${corpus.manifest.public_api_files} arquivos públicos | 🧪 ${corpus.manifest.test_files} testes | 📚 ${corpus.manifest.documentation_files} docs`);
    console.log(`➕ +${totalAdditions} | ➖ -${totalDeletions}`);
    console.log(`📦 Corpus: ${path.basename(corpusFile)}`);
    console.log(`📋 Manifest: ${path.basename(manifestFile)}`);
    console.log(`📝 Line changes: ${path.basename(lineChangesFile)}`);
    console.log(`🔗 Hunks individuais: ${path.basename(hunksDir)}/\n`);

  } catch (error) {
    console.error("❌ Erro:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
