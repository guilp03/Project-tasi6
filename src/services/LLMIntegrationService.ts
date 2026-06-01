import * as fs from "fs";
import * as path from "path";
import {
  AuditResult,
  PRCorpus,
  RoutingDecision,
  FileMetadata,
  TokenUsage,
  AnalysisRecord,
  DIFF_SIZE_THRESHOLD,
} from "./types.js";
import { buildAuditPrompt } from "../utils/prompts.js";

export class LLMIntegrationService {
  // Free-tier model IDs (ADR-005). Centralized so the record and the payloads agree.
  private readonly GROQ_MODEL = "llama-3.3-70b-versatile";
  private readonly GEMINI_MODEL = "gemini-2.5-flash";

  constructor(
    private geminiApiKey: string,
    private groqApiKey: string
  ) {}

  /**
   * Main public method: analyze PR diff and documentation gaps
   */
  async analyzeDiff(
    corpusFilePath: string,
    docsPath: string
  ): Promise<AuditResult> {
    try {
      // Read PR corpus
      const corpus = await this.readCorpusFile(corpusFilePath);

      // Read documentation
      const docsContent = await this.readDocsDirectory(docsPath);

      // Determine which LLM provider to use (ADR-005 routing)
      const routing = this.calculateRoutingDecision(corpus);

      console.log(
        `[Routing] Using ${routing.provider.toUpperCase()} provider: ${routing.reason}`
      );

      // Build the audit prompt
      const prompt = buildAuditPrompt(corpus, docsContent, routing.provider);

      // Call appropriate API
      let result: AuditResult;
      if (routing.provider === "gemini") {
        result = await this.callGemini(prompt);
      } else {
        result = await this.callGroq(prompt);
      }

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.error(`[Error] LLM Analysis failed: ${message}`);
      throw error;
    }
  }

  /**
   * TL-1 orchestrator: run the full audit and return a complete AnalysisRecord
   * (PR context + analysis aligned to §5.6 + LLM/token metadata + routing).
   *
   * Consumed by the persistence layer (Reilson) and the report generator (Stela).
   * `analyzeDiff` is left untouched for backward compatibility.
   */
  async analyzePR(
    corpusFilePath: string,
    docsPath: string
  ): Promise<AnalysisRecord> {
    const corpus = await this.readCorpusFile(corpusFilePath);
    const docsContent = await this.readDocsDirectory(docsPath);
    const routing = this.calculateRoutingDecision(corpus);

    console.log(
      `[Routing] Using ${routing.provider.toUpperCase()} provider: ${routing.reason}`
    );

    const prompt = buildAuditPrompt(corpus, docsContent, routing.provider);

    let result: AuditResult;
    let usage: TokenUsage;
    let model: string;
    if (routing.provider === "gemini") {
      ({ result, usage } = await this.callGeminiRaw(prompt));
      model = this.GEMINI_MODEL;
    } else {
      ({ result, usage } = await this.callGroqRaw(prompt));
      model = this.GROQ_MODEL;
    }

    return this.assembleRecord(corpus, routing, result, usage, model);
  }

  /**
   * Map the raw AuditResult + context into the §5.6-aligned AnalysisRecord.
   */
  private assembleRecord(
    corpus: PRCorpus,
    routing: RoutingDecision,
    result: AuditResult,
    usage: TokenUsage,
    model: string
  ): AnalysisRecord {
    return {
      repository: corpus.pr.repository,
      pullRequest: {
        id: corpus.pr.number,
        title: corpus.pr.title,
        author: corpus.pr.author,
        url: corpus.pr.html_url,
      },
      analysis: {
        status: result.requires_docs_update ? "Atenção necessária" : "OK",
        criticality: result.criticidade,
        requiresDocsUpdate: result.requires_docs_update,
        detectedChanges: corpus.files.map(
          (f: FileMetadata) => `${f.path} (${f.status})`
        ),
        documentationGaps: result.gaps,
        justification: result.justificativa,
        recommendations: this.deriveRecommendations(result),
      },
      llm: {
        provider: routing.provider,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCost: 0, // free tier
      },
      routing: { reason: routing.reason },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Derive PMO-facing recommendations from the audit result.
   */
  private deriveRecommendations(result: AuditResult): string[] {
    if (!result.requires_docs_update) {
      return ["Documentação parece adequada; nenhuma ação documental necessária."];
    }
    switch (result.criticidade) {
      case "Crítica":
        return [
          "Bloquear o merge: atualizar a documentação ANTES de aprovar o PR.",
          "Revisar itens de segurança/infraestrutura impactados com o time responsável.",
        ];
      case "Alta":
        return ["Atualizar a documentação antes de aprovar o PR."];
      case "Média":
        return ["Avaliar a atualização da documentação antes do merge."];
      default:
        return ["Atualização documental opcional/menor."];
    }
  }

  /**
   * Read and parse PR corpus JSON file
   */
  private async readCorpusFile(filePath: string): Promise<PRCorpus> {
    try {
      const absolutePath = path.resolve(filePath);
      const content = fs.readFileSync(absolutePath, "utf-8");
      return JSON.parse(content) as PRCorpus;
    } catch (error) {
      throw new Error(
        `Failed to read corpus file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Read documentation from directory (README, docs/*.md, etc)
   */
  private async readDocsDirectory(docsPath: string): Promise<string> {
    const absolutePath = path.resolve(docsPath);
    const DOCS_CHAR_LIMIT = 8000;

    const priorityFiles = ["README.md", "readme.md", "API.md", "DOCUMENTATION.md"];

    for (const file of priorityFiles) {
      const filePath = path.join(absolutePath, file);
      if (fs.existsSync(filePath)) {
        try {
          return fs.readFileSync(filePath, "utf-8").slice(0, DOCS_CHAR_LIMIT);
        } catch {
          // Continue to next file
        }
      }
    }

    try {
      const files = fs.readdirSync(absolutePath).filter((f) => f.endsWith(".md"));
      if (files.length === 1) {
        const filePath = path.join(absolutePath, files[0]);
        return fs.readFileSync(filePath, "utf-8").slice(0, DOCS_CHAR_LIMIT);
      }
      if (files.length > 1) {
        let combined = "";
        for (const f of files.sort()) {
          const filePath = path.join(absolutePath, f);
          const content = fs.readFileSync(filePath, "utf-8");
          const entry = `\n--- ${f} ---\n${content}\n`;
          if (combined.length + entry.length > DOCS_CHAR_LIMIT) {
            combined += `\n--- ${f} ---\n${content.slice(0, DOCS_CHAR_LIMIT - combined.length)}\n[truncated]`;
            break;
          }
          combined += entry;
        }
        return combined || "[No documentation found]";
      }
    } catch {
      // Ignore
    }

    return "[No documentation found]";
  }

  /**
   * ADR-005: Intelligent routing based on file content and diff size
   * - Gemini: Security-sensitive files, large diffs (>30k tokens)
   * - Groq: Default fast path
   */
  private calculateRoutingDecision(corpus: PRCorpus): RoutingDecision {
    const decision: RoutingDecision = {
      provider: "groq",
      reason: "",
      context: {
        hasSecurityChanges: false,
        hasCICDChanges: false,
        hasAuthChanges: false,
        hasEnvChanges: false,
        totalDiffSize: 0,
      },
    };

    // Calculate total diff size
    const totalDiffSize = corpus.files.reduce(
      (sum, f) => sum + (f.diff?.length || 0),
      0
    );
    decision.context.totalDiffSize = totalDiffSize;

    // Detect sensitive file patterns
    const securityPatterns = [
      /\.env/i,
      /secret/i,
      /password/i,
      /api[_-]?key/i,
      /token/i,
      /credential/i,
      /auth/i,
      /security/i,
      /\.github[/\\]workflows/i,
      /dockerfile/i,
      /docker-compose/i,
      /kubernetes|k8s/i,
      /terraform/i,
      /cloudformation/i,
      /infra/i,
      /infrastructure/i,
      /aws|gcp|azure/i,
      /ssl|tls|certificate|crypto/i,
    ];

    corpus.files.forEach((file) => {
      const filePath = file.path.toLowerCase();

      if (filePath.includes(".env")) {
        decision.context.hasEnvChanges = true;
      } else if (filePath.includes("auth")) {
        decision.context.hasAuthChanges = true;
      } else if (filePath.includes(".github/workflows")) {
        decision.context.hasCICDChanges = true;
      }

      securityPatterns.forEach((pattern) => {
        if (pattern.test(filePath)) {
          decision.context.hasSecurityChanges = true;
        }
      });
    });

    // Routing logic
    if (decision.context.hasSecurityChanges) {
      decision.provider = "gemini";
      decision.reason =
        "Security-sensitive files detected (auth, env, secrets, infra, CI/CD)";
    } else if (totalDiffSize > DIFF_SIZE_THRESHOLD) {
      decision.provider = "gemini";
      decision.reason = `Large diff (${totalDiffSize} tokens) requires Gemini's larger context`;
    } else {
      decision.provider = "groq";
      decision.reason = "Standard path: fast & cost-effective";
    }

    return decision;
  }

  /** Thin wrapper kept for backward compatibility (analyzeDiff + existing tests). */
  private async callGemini(prompt: string): Promise<AuditResult> {
    return (await this.callGeminiRaw(prompt)).result;
  }

  /**
   * Call Google Gemini API with JSON mode, returning the parsed result + token usage.
   */
  private async callGeminiRaw(
    prompt: string
  ): Promise<{ result: AuditResult; usage: TokenUsage }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.GEMINI_MODEL}:generateContent?key=${this.geminiApiKey}`;

    const payload = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json", // Force JSON output
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Gemini API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        throw new Error("Gemini returned empty content");
      }

      return {
        result: this.parseJSONSafely(content),
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    } catch (error) {
      throw new Error(
        `Gemini call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /** Thin wrapper kept for backward compatibility (analyzeDiff + existing tests). */
  private async callGroq(prompt: string): Promise<AuditResult> {
    return (await this.callGroqRaw(prompt)).result;
  }

  /**
   * Call Groq API with JSON mode, returning the parsed result + token usage.
   */
  private async callGroqRaw(
    prompt: string
  ): Promise<{ result: AuditResult; usage: TokenUsage }> {
    const url = "https://api.groq.com/openai/v1/chat/completions";

    const payload = {
      // mixtral-8x7b-32768 foi descontinuado pela Groq (HTTP 400 model_decommissioned).
      // llama-3.3-70b-versatile é o sucessor ativo no free tier (custo zero, contexto 128k).
      model: this.GROQ_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_object", // Force JSON output
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.groqApiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Groq API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("Groq returned empty content");
      }

      return {
        result: this.parseJSONSafely(content),
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      throw new Error(
        `Groq call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Safe JSON parsing with fallback to default structure
   */
  private parseJSONSafely(content: string): AuditResult {
    try {
      const parsed = JSON.parse(content);

      // Validate structure
      if (
        typeof parsed.requires_docs_update !== "boolean" ||
        !["Baixa", "Média", "Alta", "Crítica"].includes(
          parsed.criticidade
        ) ||
        !Array.isArray(parsed.gaps) ||
        typeof parsed.justificativa !== "string"
      ) {
        throw new Error("Invalid AuditResult structure from LLM");
      }

      return parsed as AuditResult;
    } catch (error) {
      console.warn(
        `[Warning] Failed to parse LLM JSON response: ${
          error instanceof Error ? error.message : String(error)
        }. Using safe default.`
      );

      // Return safe default
      return {
        requires_docs_update: false,
        criticidade: "Média",
        gaps: [
          "LLM response could not be parsed - manual review recommended",
        ],
        justificativa:
          "Failed to parse structured response from LLM API. Please verify PR manually.",
      };
    }
  }
}
