// src/services/GitHubExtractorService.ts
import { PRCorpus, FileMetadata } from "./types.js";

interface GitHubPR {
  title: string;
  body: string | null;
  user: { login: string; html_url: string };
  labels: Array<{ name: string }>;
  html_url: string;
}

interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  previous_filename?: string;
}

export class GitHubExtractorService {
  constructor(private token: string) {}

  async extract(owner: string, repo: string, prNumber: number): Promise<PRCorpus> {
    const [prMetadata, files] = await Promise.all([
      this.fetchPRMetadata(owner, repo, prNumber),
      this.fetchPRFiles(owner, repo, prNumber),
    ]);

    const fileOutputs: FileMetadata[] = files.map((file) => {
      const classification = this.classifyFile(file.filename);
      return {
        path: file.filename,
        status: file.status as FileMetadata["status"],
        additions: file.additions,
        deletions: file.deletions,
        language: this.detectLanguage(file.filename),
        ...classification,
        changeSummary: this.generateChangeSummary(
          file.filename, file.status, file.additions, file.deletions, file.patch || ""
        ),
        diff: file.patch || "",
      };
    });

    return {
      pr: {
        number: String(prNumber),
        repository: `${owner}/${repo}`,
        title: prMetadata.title,
        description: prMetadata.body,
        author: prMetadata.user.login,
        labels: prMetadata.labels.map((l) => l.name),
        html_url: prMetadata.html_url,
      },
      files: fileOutputs,
    };
  }

  private async fetchPRMetadata(owner: string, repo: string, prNumber: number): Promise<GitHubPR> {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    const response = await fetch(url, {
      headers: { Authorization: `token ${this.token}`, Accept: "application/vnd.github.v3+json" },
    });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as GitHubPR;
  }

  private async fetchPRFiles(owner: string, repo: string, prNumber: number): Promise<GitHubFile[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
    const response = await fetch(url, {
      headers: { Authorization: `token ${this.token}`, Accept: "application/vnd.github.v3+json" },
    });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as GitHubFile[];
  }

  private detectLanguage(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: "TypeScript", tsx: "TypeScript (JSX)", js: "JavaScript", jsx: "JavaScript (JSX)",
      py: "Python", rb: "Ruby", go: "Go", java: "Java", kt: "Kotlin", rs: "Rust",
      c: "C", cpp: "C++", h: "C Header", cs: "C#", vb: "Visual Basic", php: "PHP",
      swift: "Swift", md: "Markdown", rst: "reStructuredText", json: "JSON",
      yaml: "YAML", yml: "YAML", xml: "XML", toml: "TOML", css: "CSS", scss: "SCSS",
      less: "Less", html: "HTML", svg: "SVG", sh: "Shell", bash: "Bash", zsh: "Zsh",
      sql: "SQL", graphql: "GraphQL", dockerfile: "Dockerfile",
    };
    return ext ? langMap[ext] || ext : "unknown";
  }

  private classifyFile(filename: string): {
    isTest: boolean; isDocumentation: boolean; isConfig: boolean; isPublicAPI: boolean;
  } {
    const parts = filename.split("/");
    const basename = parts[parts.length - 1];
    const ext = basename.split(".").pop()?.toLowerCase();

    const isTest =
      basename.includes(".test.") || basename.includes(".spec.") || basename.includes("-test.") ||
      parts.includes("__tests__") || parts.includes("tests") || parts.includes("test") ||
      basename.startsWith("test_");

    const isDocumentation =
      ext === "md" || ext === "mdx" || ext === "rst" ||
      parts.includes("docs") || parts.includes("documentation") ||
      basename.includes("README") || basename.includes("CHANGELOG") || basename.includes("CONTRIBUTING");

    const isConfig =
      basename === "package.json" || basename === "tsconfig.json" || basename === ".eslintrc" ||
      basename === ".prettierrc" || basename === "webpack.config.js" || basename === "vite.config.ts" ||
      basename.startsWith(".") || ext === "yaml" || ext === "yml" || ext === "toml" ||
      basename === "Dockerfile" || parts.includes("config") || parts.includes("configuration");

    const isPublicAPI =
      !isTest && !isDocumentation && !isConfig &&
      !parts.includes("internal") && !parts.includes("__tests__") && !parts.includes("node_modules");

    return { isTest, isDocumentation, isConfig, isPublicAPI };
  }

  private generateChangeSummary(
    filename: string, status: string, additions: number, deletions: number, patch: string
  ): string {
    if (status === "added") return `Novo arquivo adicionado (+${additions} linhas)`;
    if (status === "deleted") return `Arquivo removido (-${deletions} linhas)`;
    if (status === "renamed") return `Arquivo renomeado`;

    const hasTypeChanges = patch.includes("type ") || patch.includes("interface ") || patch.includes("class ");
    const hasFunctionChanges = patch.includes("function ") || patch.includes("def ") || patch.includes("const ");
    const hasImportChanges = patch.includes("\n+import ") || patch.includes("\n-import ");
    const hasExportChanges = patch.includes("\n+export ") || patch.includes("\n-export ");

    const changes: string[] = [];
    if (hasTypeChanges) changes.push("tipos/interfaces");
    if (hasFunctionChanges) changes.push("funções/métodos");
    if (hasImportChanges) changes.push("imports");
    if (hasExportChanges) changes.push("exports");

    return changes.length > 0
      ? `Mudanças em: ${changes.join(", ")} (+${additions}/-${deletions})`
      : `Modificações diversas (+${additions}/-${deletions})`;
  }
}