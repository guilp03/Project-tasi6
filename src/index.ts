import { LLMIntegrationService } from "./services/LLMIntegrationService";
import { loadConfig } from "./services/config";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      "Usage: npx ts-node src/index.ts <corpus-file> <docs-path>"
    );
    console.error("Example: npx ts-node src/index.ts ./output/pr-corpus.json ./docs");
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

    const result = await service.analyzeDiff(corpusFile, docsPath);

    console.log("\n[Result] Audit completed:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      "[Error]",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
