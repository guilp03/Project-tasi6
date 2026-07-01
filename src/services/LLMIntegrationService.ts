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
import { validateGapsGrounding } from "../utils/grounding.js";
import { matchesSecurityPattern } from "../utils/securityPatterns.js";

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
   *
   * Aplica três camadas determinísticas pós-LLM (spec contenção-alucinacao):
   *   #3 fail-closed   — se parseJSONSafely devolveu gap "Análise inconclusiva",
   *                      marca parseFailure e sobrepõe tudo com estado bloqueante.
   *   #2 grounding     — descarta gaps que não citam arquivo real do PR.
   *                      Se nenhum sobreviver (e não houver floor) → Inconclusiva.
   *                      Gaps rejeitados são preservados em `untrackedGaps`
   *                      sob selo [NÃO ANCORADO] (visíveis, não verificados).
   *   #1 floor         — PR com arquivo NÃO-documental sensível (auth/.env/
   *                      CI-CD/infra) força Crítica. Documentos (.md/.mdx/...)
   *                      são gated via FileMetadata.isDocumentation — seguem
   *                      para revisão cuidadosa (Gemini via routing) mas não
   *                      inflacionam a criticidade final.
   */
  private assembleRecord(
    corpus: PRCorpus,
    routing: RoutingDecision,
    result: AuditResult,
    usage: TokenUsage,
    model: string
  ): AnalysisRecord {
    // --- Medida #3: detectar falha de parsing (gap fixo do fallback) ----
    const parseFailure = result.gaps.some(
      (g) => typeof g === "string" && g.startsWith("Análise inconclusiva — resposta da LLM")
    );

    // --- Medida #2: grounding dos gaps ----------------------------------
    const { groundedGaps, rejectedGaps, grounded } = validateGapsGrounding(result, corpus);

    // --- Medida #1: floor de criticidade (gated por !isDocumentation) --
    // Predicado único reusado no Gatilho (.some) e na lista (.filter) do gap
    // [DETERMINÍSTICO] — mantém as duas visitas consistentes (evita drift).
    const isCodeSensitive = (f: FileMetadata) =>
      !f.isDocumentation && matchesSecurityPattern(f.path);
    const securityFloorTriggered = corpus.files.some(isCodeSensitive);

    // --- Consolidar finalGaps / status / criticality --------------------
    let finalGaps: string[];
    let finalStatus: "Atenção necessária" | "OK" | "Inconclusiva";
    let finalCriticality: AuditResult["criticidade"];
    let finalJustification = result.justificativa;
    let finalRequiresDocsUpdate = result.requires_docs_update;
    let untrackedGaps: string[] = [];

    const untrackedTagged = rejectedGaps.map((g) => `[NÃO ANCORADO] ${g}`);

    if (parseFailure) {
      // #3 disparou — estado bloqueante, sobrepõe tudo. Não há gaps da LLM
      // para expor (result.gaps contém só o gap canônico do fallback).
      finalGaps = result.gaps;
      finalStatus = "Inconclusiva";
      finalCriticality = "Crítica";
      finalRequiresDocsUpdate = true;
    } else if (!grounded && rejectedGaps.length > 0 && !securityFloorTriggered) {
      // #2 descartou todos os gaps e nenhum piso de segurança se aplica.
      // Fail-closed: status Inconclusiva, criticidade Alta (sem prova de
      // segurança). Gaps rejeitados ficam visíveis em untrackedGaps.
      // Dispara SÓ quando a LLM produz gaps e nenhum ancorou (alucinação
      // inventiva). Se a LLM explícita produziu 0 gaps (julga limpo), não
      // há invenção a conter — segue o caminho feliz (status/criticidade
      // da LLM), não Inconclusiva falso-positivo.
      finalGaps = [
        "Análise inconclusiva: gaps gerados pela LLM não puderam ser ancorados nos artefatos do PR — revisão humana recomendada.",
      ];
      finalStatus = "Inconclusiva";
      finalCriticality = "Alta";
      finalRequiresDocsUpdate = true;
      untrackedGaps = untrackedTagged;
    } else if (securityFloorTriggered) {
      // #1 floor — injeta gap determinístico e força Crítica.
      // sensitiveFiles é filtrado por !isDocumentation (só código-fonte
      // sensível aparece na mensagem, nunca docs).
      const sensitiveFiles = corpus.files
        .filter(isCodeSensitive)
        .map((f) => f.path);
      // defensive — securityFloorTriggered (.some) garante sensitiveFiles não-vazio neste ramo
      const fileList =
        sensitiveFiles.length > 0
          ? sensitiveFiles.join(", ")
          : "arquivos sensíveis (ver routing)";
      const detGap =
        `[DETERMINÍSTICO] Arquivo sensível detectado (${fileList}) — ` +
        `documentação obrigatória por regra determinística (RNF-003).`;
      finalGaps = [...groundedGaps, detGap];
      finalStatus = "Atenção necessária";
      finalCriticality = "Crítica";
      finalRequiresDocsUpdate = true;
      finalJustification =
        `Criticidade elevada por floor determinístico (RNF-003). ` +
        `Justificativa LLM: ${result.justificativa}`;
      untrackedGaps = untrackedTagged;
    } else {
      // Caminho feliz — somente #2 aplicado. Rejeitados também ficam visíveis
      // para o PMO avaliar manualmente (conteúdo útil mesmo ancorado).
      finalGaps = groundedGaps;
      finalStatus = result.requires_docs_update ? "Atenção necessária" : "OK";
      finalCriticality = result.criticidade;
      untrackedGaps = untrackedTagged;
    }

    const effectiveResult: AuditResult = {
      requires_docs_update: finalRequiresDocsUpdate,
      criticidade: finalCriticality,
      gaps: finalGaps,
      justificativa: finalJustification,
    };

    return {
      repository: corpus.pr.repository,
      pullRequest: {
        id: corpus.pr.number,
        title: corpus.pr.title,
        author: corpus.pr.author,
        url: corpus.pr.html_url,
      },
      analysis: {
        status: finalStatus,
        criticality: finalCriticality,
        requiresDocsUpdate: finalRequiresDocsUpdate,
        detectedChanges: corpus.files.map(
          (f: FileMetadata) => `${f.path} (${f.status})`
        ),
        documentationGaps: finalGaps,
        untrackedGaps,
        justification: finalJustification,
        recommendations: this.deriveRecommendations(effectiveResult),
        parseFailure,
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
   * Branch Inconclusiva tem prioridade sobre criticidade.
   */
  private deriveRecommendations(result: AuditResult): string[] {
    if (result.gaps.some((g) => g.includes("Análise inconclusiva"))) {
      return [
        "Rejeitar auto-aprovação: resultados inconclusivos demandam revisão humana.",
        "Inspeção manual do PR antes de qualquer decisão de merge.",
      ];
    }
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

    // Priority file names matched case-insensitively so the logic behaves the
    // same on case-insensitive (Windows/macOS) and case-sensitive (Linux) FS.
    // Only whole-project overview files are treated as priority — api.md,
    // guide.md, etc. are combined together with the rest of the .md files.
    const priorityNames = ["readme.md", "documentation.md"];

    let allFiles: string[] = [];
    try {
      allFiles = fs.readdirSync(absolutePath);
    } catch {
      return "[No documentation found]";
    }

    for (const name of priorityNames) {
      const match = allFiles.find((f) => f.toLowerCase() === name);
      if (match) {
        try {
          return fs.readFileSync(path.join(absolutePath, match), "utf-8").slice(0, DOCS_CHAR_LIMIT);
        } catch {
          // Continue to next priority file
        }
      }
    }

    // No priority file matched — combine all .md files
    const mdFiles = allFiles.filter((f) => f.toLowerCase().endsWith(".md"));
    if (mdFiles.length === 1) {
      try {
        return fs.readFileSync(path.join(absolutePath, mdFiles[0]), "utf-8").slice(0, DOCS_CHAR_LIMIT);
      } catch {
        // fall through
      }
    }
    if (mdFiles.length > 1) {
      let combined = "";
      for (const f of mdFiles.sort()) {
        const filePath = path.join(absolutePath, f);
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const entry = `\n--- ${f} ---\n${content}\n`;
          if (combined.length + entry.length > DOCS_CHAR_LIMIT) {
            combined += `\n--- ${f} ---\n${content.slice(0, DOCS_CHAR_LIMIT - combined.length)}\n[truncated]`;
            break;
          }
          combined += entry;
        } catch {
          // Skip unreadable files
        }
      }
      if (combined) return combined;
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

    const totalDiffSize = corpus.files.reduce(
      (sum, f) => sum + (f.diff?.length || 0),
      0
    );
    decision.context.totalDiffSize = totalDiffSize;

    // Detect sensitive file patterns (ADR-005 routing) — uses shared helper.
    // Gate !isDocumentation NÃO se aplica aqui: routing continua em Gemini
    // para docs sensíveis (revisão cuidadosa mantida). O gate fica no floor
    // (assembleRecord), onde a criticidade é decidida.
    corpus.files.forEach((file) => {
      const filePath = file.path.toLowerCase();

      if (filePath.includes(".env")) {
        decision.context.hasEnvChanges = true;
      } else if (filePath.includes("auth")) {
        decision.context.hasAuthChanges = true;
      } else if (filePath.includes(".github/workflows")) {
        decision.context.hasCICDChanges = true;
      }

      if (matchesSecurityPattern(filePath)) {
        decision.context.hasSecurityChanges = true;
      }
    });

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
        `[Warning] LLM response unparseable: ${
          error instanceof Error ? error.message : String(error)
        }. Fail-closed.`
      );

      // Medida #3 — fail-closed: nunca devolver "OK" quando a resposta da
      // LLM não pôde ser interpretada (AS-07). Estado conservador bloqueante.
      return {
        requires_docs_update: true,
        criticidade: "Crítica",
        gaps: [
          "Análise inconclusiva — resposta da LLM não pôde ser interpretada. Revisão humana obrigatória.",
        ],
        justificativa:
          "Falha de parsing ou schema inválido. A auditoria não é trustable; revisar PR manualmente.",
      };
    }
  }
}
