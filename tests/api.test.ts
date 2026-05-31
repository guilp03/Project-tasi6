import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LLMIntegrationService } from "../src/services/LLMIntegrationService";
import { VALID_AUDIT_JSON } from "./fixtures";

const service = new LLMIntegrationService("gemini-key", "groq-key");

function callGroqRaw(prompt: string) {
  return (service as unknown as {
    callGroqRaw(p: string): Promise<{ result: import("../src/services/types").AuditResult; usage: import("../src/services/types").TokenUsage }>;
  }).callGroqRaw(prompt);
}
function callGeminiRaw(prompt: string) {
  return (service as unknown as {
    callGeminiRaw(p: string): Promise<{ result: import("../src/services/types").AuditResult; usage: import("../src/services/types").TokenUsage }>;
  }).callGeminiRaw(prompt);
}

function mockFetch(impl: (url: string, init: RequestInit) => unknown) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("callGroqRaw", () => {
  it("sends the active free-tier model with json_object mode and returns result + usage", async () => {
    const fetchFn = mockFetch(() => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: VALID_AUDIT_JSON } }],
        usage: { prompt_tokens: 1200, completion_tokens: 300 },
      }),
    }));

    const { result, usage } = await callGroqRaw("audit this");

    expect(result.criticidade).toBe("Alta");
    expect(usage.inputTokens).toBe(1200);
    expect(usage.outputTokens).toBe(300);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain("api.groq.com");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer groq-key",
    });
  });

  it("throws on HTTP error responses", async () => {
    mockFetch(() => ({ ok: false, status: 400, statusText: "Bad Request" }));
    await expect(callGroqRaw("x")).rejects.toThrow(/Groq API error: 400/);
  });

  it("throws when the response has no content", async () => {
    mockFetch(() => ({ ok: true, json: async () => ({ choices: [] }) }));
    await expect(callGroqRaw("x")).rejects.toThrow(/empty content/i);
  });
});

describe("callGeminiRaw", () => {
  it("forces JSON via responseMimeType and returns result + usage", async () => {
    const fetchFn = mockFetch(() => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: VALID_AUDIT_JSON }] } }],
        usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 400 },
      }),
    }));

    const { result, usage } = await callGeminiRaw("audit this");

    expect(result.requires_docs_update).toBe(true);
    expect(usage.inputTokens).toBe(1500);
    expect(usage.outputTokens).toBe(400);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain("generativelanguage.googleapis.com");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("throws on HTTP error responses", async () => {
    mockFetch(() => ({ ok: false, status: 503, statusText: "Service Unavailable" }));
    await expect(callGeminiRaw("x")).rejects.toThrow(/Gemini API error: 503/);
  });
});