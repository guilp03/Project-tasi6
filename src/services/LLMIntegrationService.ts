import * as fs from "fs";
import * as path from "path";
import {
  AuditResult,
  PRCorpus,
  RoutingDecision,
  FileMetadata,
} from "./types";
import { buildAuditPrompt } from "../utils/prompts";

export class LLMIntegrationService {
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
      const prompt = buildAuditPrompt(corpus, docsContent);

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

    // Priority: README.md, then any markdown files
    const priorityFiles = ["README.md", "readme.md", "API.md", "DOCUMENTATION.md"];

    for (const file of priorityFiles) {
      const filePath = path.join(absolutePath, file);
      if (fs.existsSync(filePath)) {
        try {
          return fs.readFileSync(filePath, "utf-8").slice(0, 8000); // Truncate to 8000 chars
        } catch {
          // Continue to next file
        }
      }
    }

    // Fallback: read first .md file found
    try {
      const files = fs.readdirSync(absolutePath).filter((f) => f.endsWith(".md"));
      if (files.length > 0) {
        const filePath = path.join(absolutePath, files[0]);
        return fs.readFileSync(filePath, "utf-8").slice(0, 8000);
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
      (sum, f) => sum + (f.additions || 0) + (f.deletions || 0),
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
    } else if (totalDiffSize > 30000) {
      decision.provider = "gemini";
      decision.reason = `Large diff (${totalDiffSize} tokens) requires Gemini's larger context`;
    } else {
      decision.provider = "groq";
      decision.reason = "Standard path: fast & cost-effective";
    }

    return decision;
  }

  /**
   * Call Google Gemini API with JSON mode
   */
  private async callGemini(prompt: string): Promise<AuditResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`;

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

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        throw new Error("Gemini returned empty content");
      }

      return this.parseJSONSafely(content);
    } catch (error) {
      throw new Error(
        `Gemini call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Call Groq API with JSON mode
   */
  private async callGroq(prompt: string): Promise<AuditResult> {
    const url = "https://api.groq.com/openai/v1/chat/completions";

    const payload = {
      model: "mixtral-8x7b-32768",
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

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("Groq returned empty content");
      }

      return this.parseJSONSafely(content);
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
