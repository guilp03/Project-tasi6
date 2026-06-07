# PR Documentation Auditor - LLM Integration Implementation

## Overview

This implementation provides a CLI tool (`pr-auditor`) that bridges the gap between GitHub PR data and free LLM APIs (Groq + Google Gemini) for intelligent documentation auditing. Version 0.2.0 introduces a Commander.js CLI, GitHub PR extraction, Markdown report generation, and MongoDB persistence.

**Key Features:**
- ADR-005 routing: Groq for standard path (fast, cost-effective), Gemini for security-sensitive changes
- Intelligent file detection: Automatically routes security/auth/.env/CI-CD/infra changes to Gemini
- Commander.js CLI with subcommands: `audit`, `fetch`, `fetch-and-audit`, `history`
- GitHubExtractorService: extract PR data directly from the GitHub API
- ReportGenerator: structured Markdown reports with `--output` flag
- AnalysisRepository: MongoDB persistence with `save()` and `findRecent()`
- Structured JSON output: Forced via `responseMimeType` (Gemini) and `response_format` (Groq)
- Graceful error handling: Safe fallback if LLM response parsing fails
- Native fetch HTTP calls: No external HTTP libraries, pure Node.js

---

## Project Structure

```
Project-tasi6/
├── docs/                          # Documentation
├── src/
│   ├── index.ts                   # CLI entry point (thin dispatcher → createCLI().parse())
│   ├── cli/
│   │   ├── parser.ts              # Commander.js registry (audit, history, fetch, fetch-and-audit)
│   │   └── commands/
│   │       ├── audit.ts           # audit command
│   │       ├── fetch.ts           # fetch command
│   │       ├── fetch-and-audit.ts # pipeline command
│   │       └── history.ts        # history command
│   ├── services/
│   │   ├── types.ts               # TypeScript interfaces (AnalysisRecord, PRCorpus, AuditResult, etc.)
│   │   ├── config.ts              # Environment configuration (loadConfig, getMongoUri)
│   │   ├── LLMIntegrationService.ts  # Core LLM service
│   │   ├── GitHubExtractorService.ts  # PR extraction from GitHub API
│   │   ├── ReportGenerator.ts     # Markdown report generation
│   │   └── persistence/
│   │       └── AnalysisRepository.ts   # MongoDB persistence
│   └── utils/
│       └── prompts.ts             # Prompt catalog
├── .env.example
├── package.json                   # v0.2.0, scripts with commander subcommands
├── tsconfig.json
└── README.MD                      # Updated for v0.2.0
```

---

## Quick Start

### 1. Setup Environment Variables

Copy `.env.example` to `.env` and fill in your API keys:

```bash
cp .env.example .env
```

Get your API keys:
- **Groq**: https://console.groq.com (free tier available)
- **Gemini**: https://aistudio.google.com/app/apikey (free API key)

```env
GROQ_API_KEY=gsk_your_key_here
GEMINI_API_KEY=your_gemini_key_here
```

### 2. Fetch and Audit a PR

The `fetch-and-audit` pipeline extracts PR data from GitHub and audits it in one step:

```bash
npm run fetch-and-audit -- facebook react 27534 --docs ./docs
```

Or run each step individually:

```bash
# Step 1: Extract PR data from GitHub
npm run fetch -- facebook react 27534

# Step 2: Audit against documentation
npm run audit -- --diff ./output/pr-corpus.json --docs ./docs
```

### 3. Review Output

By default, the audit result is printed to stdout as JSON. Use `--output` to write a Markdown report:

```bash
npm run audit -- --diff ./output/pr-corpus.json --docs ./docs --output report.md
```

Report sections: Status, Criticidade, Mudancas Identificadas, Gaps Documentais, Recomendacao, Justificativa, metadata.

---

## CLI Commands

### `pr-auditor fetch <owner> <repo> <prNumber> [--output <path>]`

Extracts PR data from the GitHub API and writes a PR corpus JSON file.

- `<owner>` — GitHub repository owner (e.g. `facebook`)
- `<repo>` — GitHub repository name (e.g. `react`)
- `<prNumber>` — Pull request number (e.g. `27534`)
- `--output <path>` — Output path for the corpus file (default: `./output/pr-corpus.json`)

### `pr-auditor audit --diff <corpus> --docs <dir> [--output <relatorio.md>]`

Audits a PR corpus against a documentation directory using LLM routing (ADR-005).

- `--diff <corpus>` — Path to the PR corpus JSON file (required)
- `--docs <dir>` — Path to the documentation directory (required)
- `--output <relatorio.md>` — Write a Markdown report to this file instead of stdout

### `pr-auditor fetch-and-audit <owner> <repo> <prNumber> --docs <dir> [--output <md>] [--keep-corpus]`

Pipeline that extracts PR data from GitHub and audits it in one step.

- `<owner>` — GitHub repository owner
- `<repo>` — GitHub repository name
- `<prNumber>` — Pull request number
- `--docs <dir>` — Path to the documentation directory (required)
- `--output <md>` — Write a Markdown report to this file
- `--keep-corpus` — Keep the intermediate PR corpus file after audit (default: deleted)

### `pr-auditor history [--limit N]`

Lists recently persisted analysis records from MongoDB.

- `--limit N` — Maximum number of records to return (default: 10)

### NPM Script Shortcuts

```bash
npm run dev <command>       # Runs via tsx
npm run audit                # Shortcut for: audit --diff ./output/pr-corpus.json --docs ./docs
npm run fetch                # Shortcut for: fetch
npm run fetch-and-audit      # Shortcut for: fetch-and-audit
npm run history              # Shortcut for: history
npm run build                # Compiles to dist/
npm run test                 # Runs test suite
npm run test:watch           # Runs tests in watch mode
npm run test:coverage        # Runs tests with coverage report
```

---

## Routing Logic (ADR-005)

### Groq (Default Fast Path)
- Standard PRs with no security implications
- Diff size < 30k tokens
- **Latency**: ~50-100ms
- **Cost**: ~$0.0001 per request

### Gemini (High-Context Fallback)
Automatically triggered for:
- `.env` file changes
- Authentication (`/auth`, `security`, etc.) changes
- Infrastructure files (Dockerfile, Terraform, k8s, etc.)
- CI/CD workflows (`.github/workflows`)
- Secrets/credentials/API keys
- Diff > 30k tokens (Groq's limit)

**Latency**: ~200-500ms
**Cost**: ~$0.0005 per request (slightly higher but safer for sensitive changes)

---

## Architecture

### LLMIntegrationService Class

```typescript
class LLMIntegrationService {
  // Public method
  async analyzeDiff(
    corpusFilePath: string,      // Path to pr-corpus.json
    docsPath: string             // Path to documentation directory
  ): Promise<AuditResult>

  // Private methods
  private readCorpusFile(filePath): PRCorpus
  private readDocsDirectory(docsPath): string
  private calculateRoutingDecision(corpus): RoutingDecision
  private buildAuditPrompt(corpus, docs): string
  private callGemini(prompt): AuditResult
  private callGroq(prompt): AuditResult
  private parseJSONSafely(content): AuditResult
}
```

### GitHubExtractorService

Extracts PR data from the GitHub API and produces a `PRCorpus` JSON file. Promoted from POC (`apps/poc-diff-reader/`) to `src/services/` in v0.2.0.

```typescript
class GitHubExtractorService {
  async extractPR(owner: string, repo: string, prNumber: string): Promise<PRCorpus>
}
```

### Prompt Catalog (src/utils/prompts.ts)

Three main prompts available:

1. **buildAuditPrompt()** - Main analysis prompt
   - Compares code changes against documentation
   - Forces JSON output with AuditResult structure
   - Handles security detection rules

2. **PROMPT_CATALOG.extractChanges()** - Extract semantic changes
3. **PROMPT_CATALOG.detectGaps()** - Compare changes to docs
4. **PROMPT_CATALOG.classifyCriticality()** - Risk classification

---

## Report Generator

The `ReportGenerator` service (`src/services/ReportGenerator.ts`) converts `AuditResult` data into structured Markdown reports. It is invoked via the `--output <path>` flag on the `audit` and `fetch-and-audit` commands.

**Report sections:**
- Status (OK / Atencao necessaria)
- Criticidade (Baixa, Media, Alta, Critica)
- Mudancas Identificadas
- Gaps Documentais
- Recomendacao
- Justificativa
- Metadata (repository, PR, LLM provider/model, token usage, estimated cost)

When `--output` is not specified, the raw JSON result is printed to stdout.

---

## Persistence (MongoDB)

The `AnalysisRepository` (`src/services/persistence/AnalysisRepository.ts`) stores audit results in MongoDB for historical querying via the `history` command.

**Key methods:**
- `save(record: AnalysisRecord): Promise<string>` — Persists an analysis record, returns the generated `id`
- `findRecent(limit?: number): Promise<AnalysisRecord[]>` — Retrieves the most recent records sorted by `createdAt` descending

The `AnalysisRecord` includes an `id` field (auto-generated on save) and the full analysis payload, LLM metadata, and routing decision.

---

## Usage Examples

### Pipeline: Fetch and Audit in One Step

```bash
npm run fetch-and-audit -- facebook react 27534 --docs ./docs --output report.md --keep-corpus
```

This extracts PR 27534 from `facebook/react`, audits it against `./docs`, writes a Markdown report to `report.md`, and keeps the intermediate corpus file.

### Step-by-Step: Fetch then Audit

```bash
# Step 1: Extract PR data
npm run fetch -- facebook react 27534 --output ./output/pr-corpus.json

# Step 2: Audit the corpus
npm run audit -- --diff ./output/pr-corpus.json --docs ./docs --output report.md
```

### Direct Service Usage

```typescript
import { LLMIntegrationService } from './services/LLMIntegrationService';
import { loadConfig } from './services/config';

const config = loadConfig();
const service = new LLMIntegrationService(
  config.geminiApiKey,
  config.groqApiKey
);

const result = await service.analyzeDiff(
  './output/pr-corpus.json',
  './docs'
);

console.log(result);
// {
//   requires_docs_update: true,
//   criticidade: "Alta",
//   gaps: [...],
//   justificativa: "..."
// }
```

### Query History

```bash
npm run history -- --limit 5
```

---

## Response Structure (AnalysisRecord)

All analysis results are persisted as `AnalysisRecord` and validated against this interface:

```typescript
interface AnalysisRecord {
  id?: string;
  repository: string;
  pullRequest: {
    id: string;
    title: string;
    author: string;
    url: string;
  };
  analysis: {
    status: "Atencao necessaria" | "OK";
    criticality: AuditResult["criticidade"];
    requiresDocsUpdate: boolean;
    detectedChanges: string[];
    documentationGaps: string[];
    justification: string;
    recommendations: string[];
  };
  llm: {
    provider: "groq" | "gemini";
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
  };
  routing: { reason: string; };
  createdAt: string;
}

interface AuditResult {
  requires_docs_update: boolean;
  criticidade: "Baixa" | "Media" | "Alta" | "Critica";
  gaps: string[];
  justificativa: string;
}
```

**Criticality Rules:**
- **Critica**: Security, auth, infrastructure, breaking changes — ALWAYS
- **Alta**: Important API/feature changes
- **Media**: Minor updates or enhancements
- **Baixa**: Cosmetic or style changes

---

## Error Handling

### Scenario 1: Missing Environment Variables
```
Error: Missing GEMINI_API_KEY in environment variables
```
→ Add keys to `.env` file

### Scenario 2: Corpus File Not Found
```
Error: Failed to read corpus file: ENOENT: no such file or directory
```
→ Run `fetch` first to extract PR data: `npm run fetch -- <owner> <repo> <prNumber>`

### Scenario 3: Invalid LLM Response
```
Warning: Failed to parse LLM JSON response. Using safe default.
{
  "requires_docs_update": false,
  "criticidade": "Media",
  "gaps": ["LLM response could not be parsed - manual review recommended"],
  "justificativa": "Failed to parse structured response from LLM API."
}
```
→ Safe fallback prevents service crashes

### Scenario 4: MongoDB Connection Failure
```
Error: Failed to connect to MongoDB
```
→ Verify `MONGODB_URI` in `.env` and ensure MongoDB is running

---

## Testing

### Run the Test Suite

```bash
npm run test                # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

### Manual Test: Groq Path (Standard)

Create a minimal `test-corpus.json`:
```json
{
  "pr": {
    "number": "1",
    "repository": "test/repo",
    "title": "Add new feature",
    "author": "test-user",
    "stats": { "additions": 100, "deletions": 50, "files_changed": 2 }
  },
  "files": [
    { "path": "src/feature.ts", "status": "added", "additions": 80 }
  ]
}
```

Run: `npm run audit -- --diff ./test-corpus.json --docs ./docs`
→ Should use **Groq** (no security patterns detected)

### Manual Test: Gemini Path (Security)

Add auth file to corpus:
```json
{
  "files": [
    { "path": "src/auth/middleware.ts", "status": "modified" },
    { "path": "src/.env.example", "status": "modified" }
  ]
}
```

Run: `npm run audit -- --diff ./test-corpus.json --docs ./docs`
→ Should use **Gemini** (auth + .env detected)

---

## Configuration

### Groq Models Available
- `mixtral-8x7b-32768` (Default) - Best balance
- `llama3-70b-8192` - Larger, more accurate

### Gemini Models Available
- `gemini-1.5-flash` (Default in code) - Fast, cost-effective
- `gemini-1.5-pro` - More capable for complex analysis

### Token Limits
- **Groq**: 32k tokens
- **Gemini**: 1M tokens (more flexibility)
- Service truncates docs to 8000 chars if needed

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Groq API key |
| `GEMINI_API_KEY` | Yes | Gemini API key |
| `MONGODB_URI` | For persistence | MongoDB connection string |

---

## Next Steps (v0.3)

- [ ] GitHub Actions integration (CI/CD pipeline for automatic PR auditing)
- [ ] Batch processing for multiple PRs
- [ ] Feedback learning (use audit history to improve prompts and routing)
- [ ] Webhook-based triggers for real-time PR auditing
- [ ] Dashboard for monitoring audit history and trends

---

## ADR-005 Reference

**Decision**: Groq-first routing with intelligent fallback to Gemini for high-context/security scenarios.

**Why**: Pragmatism + Safety
- 90% of PRs can use Groq (fast + cheap)
- 10% with security implications get Gemini (high-context, more careful analysis)
- Cost: ~$0.0003-0.0005 per PR (well under RNF-007: <R$ 0.10)
- Latency: <30s total per PR (meets RNF-001)
- Safety: 0% false negatives on security (meets RNF-003)