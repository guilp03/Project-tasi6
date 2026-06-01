import * as dotenv from "dotenv";
dotenv.config();

import { LLMIntegrationService } from "./services/LLMIntegrationService.js";
import { loadConfig } from "./services/config.js";
import { AnalysisRepository } from "./services/persistence/AnalysisRepository.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      "Usage: npm run dev <corpus-file> <docs-path>"
    );
    console.error("Example: npm run dev ./output/pr-corpus.json ./docs");
    process.exit(1);
  }

  const corpusFile = args[0];
  const docsPath = args[1];

  try {
    console.log(`[LLM Audit] Starting analysis...`);
    console.log(`  Corpus: ${corpusFile}`);
    console.log(`  Docs: ${docsPath}`);

    const config = loadConfig();
    const service = new LLMIntegrationService(
      config.geminiApiKey,
      config.groqApiKey
    );

    // TL-1: analyzePR returns the full AnalysisRecord (PR context + §5.6 analysis
    // + LLM/token metadata). This is the integration point for the upcoming work:
    //   - Reilson: persistir `record` no MongoDB (AnalysisRepository.save)
    //   - Stela:   gerar Markdown a partir de `record` (ReportGenerator)
    const record = await service.analyzePR(corpusFile, docsPath);

    // Persist to MongoDB — failure must never abort the main flow.
    try {
      const repository = new AnalysisRepository();
      const id = await repository.save(record);
      console.log(`[MongoDB] Record saved with id: ${id}`);
    } catch (persistError) {
      console.warn(
        "[MongoDB] Persistence unavailable:",
        persistError instanceof Error ? persistError.message : String(persistError)
      );
    }

    console.log("\n[Result] Audit completed:");
    console.log(JSON.stringify(record, null, 2));
  } catch (error) {
    console.error(
      "[Error]",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
