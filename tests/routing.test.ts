import { describe, it, expect } from "vitest";
import { LLMIntegrationService } from "../src/services/LLMIntegrationService";
import { RoutingDecision, FileMetadata } from "../src/services/types";
import { makeCorpus, file } from "./fixtures";

function route(files: FileMetadata[], overrides?: Partial<ReturnType<typeof makeCorpus>["pr"]>): RoutingDecision {
  const corpus = makeCorpus(files, overrides);
  const service = new LLMIntegrationService("gemini-key", "groq-key");
  return (service as unknown as {
    calculateRoutingDecision(c: typeof corpus): RoutingDecision;
  }).calculateRoutingDecision(corpus);
}

describe("ADR-005 routing (calculateRoutingDecision)", () => {
  it("routes standard application code to Groq (happy path)", () => {
    const d = route([file("src/services/widget.ts"), file("tests/widget.test.ts")]);
    expect(d.provider).toBe("groq");
    expect(d.context.hasSecurityChanges).toBe(false);
  });

  it("routes .env changes to Gemini and flags hasEnvChanges", () => {
    const d = route([file(".env.production")]);
    expect(d.provider).toBe("gemini");
    expect(d.context.hasEnvChanges).toBe(true);
    expect(d.context.hasSecurityChanges).toBe(true);
  });

  it("routes auth files to Gemini and flags hasAuthChanges", () => {
    const d = route([file("src/auth/login.ts")]);
    expect(d.provider).toBe("gemini");
    expect(d.context.hasAuthChanges).toBe(true);
  });

  it("routes CI/CD workflow files to Gemini and flags hasCICDChanges", () => {
    const d = route([file(".github/workflows/deploy.yml")]);
    expect(d.provider).toBe("gemini");
    expect(d.context.hasCICDChanges).toBe(true);
  });

  it("routes infrastructure files (Dockerfile, terraform, k8s) to Gemini", () => {
    expect(route([file("Dockerfile")]).provider).toBe("gemini");
    expect(route([file("infra/main.tf")]).provider).toBe("gemini");
    expect(route([file("k8s/deployment.yaml")]).provider).toBe("gemini");
  });

  it("routes large diffs (>30k chars) to Gemini even without sensitive files", () => {
    const longDiff = "x".repeat(35000);
    const d = route([file("src/generated/data.ts", 20000, 11000, "modified", longDiff)]);
    expect(d.provider).toBe("gemini");
    expect(d.context.hasSecurityChanges).toBe(false);
    expect(d.context.totalDiffSize).toBeGreaterThanOrEqual(30000);
    expect(d.reason).toMatch(/large diff/i);
  });

  it("keeps a small, non-sensitive multi-file PR on Groq", () => {
    const d = route([file("README.md", 10), file("src/utils/format.ts", 40, 5)]);
    expect(d.provider).toBe("groq");
    expect(d.context.totalDiffSize).toBeLessThanOrEqual(30000);
  });

  it("calculates totalDiffSize from diff content length, not additions+deletions", () => {
    const diff200 = "a".repeat(200);
    const d = route([file("src/a.ts", 5, 2, "modified", diff200)]);
    expect(d.context.totalDiffSize).toBe(200);
  });

  it("routes security-only files to Gemini (superset regression guard)", () => {
    const d = route([file("src/security/policy.ts")]);
    expect(d.provider).toBe("gemini");
    expect(d.context.hasSecurityChanges).toBe(true);
  });
});