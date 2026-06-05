// src/cli/commands/history.ts
import { Command } from "commander";
import { AnalysisRecord } from "../../services/types.js";
import { AnalysisRepository } from "../../services/persistence/AnalysisRepository.js";
import { getMongoUri } from "../../services/config.js";

export async function runHistory(options: {
  limit: string;
}): Promise<void> {
  const mongoUri = getMongoUri();
  if (!mongoUri) {
    console.error("MONGODB_URI não configurado. Configure para usar --history.");
    process.exit(1);
  }

  const limit = parseInt(options.limit, 10);
  if (isNaN(limit) || limit <= 0) {
    console.error("--limit deve ser um número positivo.");
    process.exit(1);
  }
  const repo = new AnalysisRepository();
  let records: AnalysisRecord[] = [];
  try {
    records = await repo.findRecent(limit);
  } catch (e) {
    console.error("[MongoDB] Falha ao consultar histórico:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  if (records.length === 0) {
    console.log("Nenhuma auditoria encontrada.");
    return;
  }

  console.log("ID                  | PR    | Repo              | Data                | Criticidade");
  console.log("--------------------|-------|-------------------|---------------------|------------");

  for (const r of records) {
    const id = r.id || "???";
    const prId = `#${r.pullRequest.id}`;
    const repoName = r.repository;
    const date = r.createdAt ? r.createdAt.replace("T", " ").slice(0, 19) : "???";
    const crit = r.analysis?.criticality || "???";
    console.log(`${id.padEnd(20)}| ${prId.padEnd(6)}| ${repoName.padEnd(18)}| ${date.padEnd(20)}| ${crit}`);
  }
}

export function registerHistoryCommand(program: Command): void {
  program
    .command("history")
    .description("Lista o histórico de auditorias persistidas")
    .option("--limit <number>", "Número máximo de registros", "10")
    .action(runHistory);
}
