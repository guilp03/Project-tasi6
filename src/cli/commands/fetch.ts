// src/cli/commands/fetch.ts
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { GitHubExtractorService } from "../../services/GitHubExtractorService.js";

export async function runFetch(
  owner: string,
  repo: string,
  prNumber: string,
  options: { output: string }
): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN não configurado. Configure a variável de ambiente.");
    process.exit(1);
  }

  const service = new GitHubExtractorService(token);
  const corpus = await service.extract(owner, repo, parseInt(prNumber, 10));

  const outputDir = path.dirname(options.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    options.output,
    JSON.stringify(corpus, null, 2),
    "utf-8"
  );

  console.log(`[OK] Corpus salvo em: ${options.output}`);
}

export function registerFetchCommand(program: Command): void {
  program
    .command("fetch <owner> <repo> <prNumber>")
    .description("Extrai dados de um PR do GitHub para um arquivo corpus")
    .option("--output <path>", "Caminho de saída do corpus", "./output/pr-corpus.json")
    .action(runFetch);
}