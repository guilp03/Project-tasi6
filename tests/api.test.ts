import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LLMIntegrationService } from "../src/services/LLMIntegrationService";
import { AuditResult } from "../src/services/types";
import { VALID_AUDIT_JSON } from "./fixtures";

const service = new LLMIntegrationService("gemini-key", "groq-key");

function callGroq(prompt: string): Promise<AuditResult> {
  return (service as unknown as {
    callGroq(p: string): Promise<AuditResult>;
  }).callGroq(prompt);
}
function callGemini(prompt: string): Promise<AuditResult> {
  return (service as unknown as {
    callGemini(p: string): Promise<AuditResult>;
  }).callGemini(prompt);
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

describe("callGroq", () => {
  it("sends the active free-tier model with json_object mode and parses the result", async () => {
    const fetchFn = mockFetch(() => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: VALID_AUDIT_JSON } }] }),
    }));

    const result = await callGroq("audit this");

    expect(result.criticidade).toBe("Alta");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain("api.groq.com");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("llama-3.3-70b-versatile"); // not the decommissioned mixtral
    expect(body.response_format).toEqual({ type: "json_object" });
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer groq-key",
    });
  });

  it("throws on HTTP error responses", async () => {
    mockFetch(() => ({ ok: false, status: 400, statusText: "Bad Request" }));
    await expect(callGroq("x")).rejects.toThrow(/Groq API error: 400/);
  });

  it("throws when the response has no content", async () => {
    mockFetch(() => ({ ok: true, json: async () => ({ choices: [] }) }));
    await expect(callGroq("x")).rejects.toThrow(/empty content/i);
  });
});

describe("callGemini", () => {
  it("forces JSON via responseMimeType and parses the result", async () => {
    const fetchFn = mockFetch(() => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: VALID_AUDIT_JSON }] } }],
      }),
    }));

    const result = await callGemini("audit this");

    expect(result.requires_docs_update).toBe(true);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain("generativelanguage.googleapis.com");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("throws on HTTP error responses", async () => {
    mockFetch(() => ({ ok: false, status: 503, statusText: "Service Unavailable" }));
    await expect(callGemini("x")).rejects.toThrow(/Gemini API error: 503/);
  });
});
