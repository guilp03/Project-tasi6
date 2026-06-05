// src/cli/commands/audit.ts
import { Command } from "commander";
import * as fs from "fs";
import { LLMIntegrationService } from "../../services/LLMIntegrationService.js";
import { ReportGenerator } from "../../services/ReportGenerator.js";
import { AnalysisRepository } from "../../services/persistence/AnalysisRepository.js";
import { loadConfig, getMongoUri } from "../../services/config.js";

export async function runAudit(options: {
  diff: string;
  docs: string;
  output?: string;
}): Promise<void> {
  if (!fs.existsSync(options.diff)) {
    console.error(`Arquivo não encontrado: ${options.diff}`);
    process.exit(1);
  }
  if (!fs.existsSync(options.docs)) {
    console.error(`Diretório não encontrado: ${options.docs}`);
    process.exit(1);
  }

  const config = loadConfig();
  const service = new LLMIntegrationService(
    config.geminiApiKey,
    config.groqApiKey
  );
  const record = await service.analyzePR(options.diff, options.docs);

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

  console.log(`[Status] ${record.analysis.status} | Criticidade: ${record.analysis.criticality}`);
  console.log(`[Gaps] ${record.analysis.documentationGaps.length} gaps encontrados`);
}

export function registerAuditCommand(program: Command): void {
  program
    .command("audit")
    .description("Audita um PR contra a documentação existente")
    .requiredOption("--diff <path>", "Caminho do arquivo pr-corpus.json")
    .requiredOption("--docs <dir>", "Caminho do diretório de documentação")
    .option("--output <path>", "Caminho para salvar o relatório Markdown")
    .action(runAudit);
}