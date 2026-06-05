import { AnalysisRecord } from "../../services/types.js";
import { Command } from "commander";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { GitHubExtractorService } from "../../services/GitHubExtractorService.js";
import { LLMIntegrationService } from "../../services/LLMIntegrationService.js";
import { ReportGenerator } from "../../services/ReportGenerator.js";
import { AnalysisRepository } from "../../services/persistence/AnalysisRepository.js";
import { loadConfig, getMongoUri } from "../../services/config.js";

export async function runFetchAndAudit(
  owner: string,
  repo: string,
  prNumber: string,
  options: { docs: string; output?: string; keepCorpus?: boolean }
): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("GITHUB_TOKEN não configurado. Configure a variável de ambiente.");
    process.exit(1);
  }

  if (!fs.existsSync(options.docs)) {
    console.error(`Diretório não encontrado: ${options.docs}`);
    process.exit(1);
  }

  const corpusPath = options.keepCorpus
    ? path.join(process.cwd(), "output", `pr-${prNumber}-${owner}-${repo}-corpus.json`)
    : path.join(os.tmpdir(), `pr-${prNumber}-${owner}-${repo}-corpus.json`);

  const corpusDir = path.dirname(corpusPath);
  if (!fs.existsSync(corpusDir)) {
    fs.mkdirSync(corpusDir, { recursive: true });
  }

  let record: AnalysisRecord;
  try {
    const extractor = new GitHubExtractorService(token);
    const corpus = await extractor.extract(owner, repo, parseInt(prNumber, 10));
    fs.writeFileSync(corpusPath, JSON.stringify(corpus, null, 2), "utf-8");

    const config = loadConfig();
    const llmService = new LLMIntegrationService(config.geminiApiKey, config.groqApiKey);
    record = await llmService.analyzePR(corpusPath, options.docs);

    const generator = new ReportGenerator();
    const markdown = generator.generate(record);

    if (options.output) {
      fs.writeFileSync(options.output, markdown, "utf-8");
      console.log(`[Arquivo] Relatório salvo em ${options.output}`);
    }

    const mongoUri = getMongoUri();
    if (mongoUri) {
      try {
        const repo = new AnalysisRepository();
        const id = await repo.save(record);
        console.log(`[MongoDB] Registro salvo com id: ${id}`);
      } catch (e) {
        console.warn(
          "[MongoDB] Falha na persistência:",
          e instanceof Error ? e.message : String(e)
        );
      }
    }
  } finally {
    if (!options.keepCorpus && fs.existsSync(corpusPath)) {
      fs.unlinkSync(corpusPath);
    }
  }

  console.log(`[Status] ${record.analysis.status} | Criticidade: ${record.analysis.criticality}`);
  console.log(`[Gaps] ${record.analysis.documentationGaps.length} gaps encontrados`);
}

export function registerFetchAndAuditCommand(program: Command): void {
  program
    .command("fetch-and-audit <owner> <repo> <prNumber>")
    .description("Extrai um PR do GitHub e executa auditoria em um passo")
    .requiredOption("--docs <dir>", "Caminho do diretório de documentação")
    .option("--output <path>", "Caminho para salvar o relatório Markdown")
    .option("--keep-corpus", "Mantém o arquivo corpus gerado em ./output/")
    .action(runFetchAndAudit);
}
