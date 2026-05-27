import { describe, it, expect } from "vitest";
import { LLMIntegrationService } from "../src/services/LLMIntegrationService";
import { RoutingDecision } from "../src/services/types";
import { makeCorpus, file } from "./fixtures";

// calculateRoutingDecision is private; exercise it via a typed bracket cast.
function route(corpus: ReturnType<typeof makeCorpus>): RoutingDecision {
  const service = new LLMIntegrationService("gemini-key", "groq-key");
  return (service as unknown as {
    calculateRoutingDecision(c: typeof corpus): RoutingDecision;
  }).calculateRoutingDecision(corpus);
}

describe("ADR-005 routing (calculateRoutingDecision)", () => {
  it("routes standard application code to Groq (happy path)", () => {
    const d = route(makeCorpus([file("src/services/widget.ts"), file("tests/widget.test.ts")]));
    expect(d.provider).toBe("groq");
    expect(d.context.hasSecurityChanges).toBe(false);
  });

  it("routes .env changes to Gemini and flags hasEnvChanges", () => {
    const d = route(makeCorpus([file(".env.production")]));
    expect(d.provider).toBe("gemini");
    expect(d.context.hasEnvChanges).toBe(true);
    expect(d.context.hasSecurityChanges).toBe(true);
  });

  it("routes auth files to Gemini and flags hasAuthChanges", () => {
    const d = route(makeCorpus([file("src/auth/login.ts")]));
    expect(d.provider).toBe("gemini");
    expect(d.context.hasAuthChanges).toBe(true);
  });

  it("routes CI/CD workflow files to Gemini and flags hasCICDChanges", () => {
    const d = route(makeCorpus([file(".github/workflows/deploy.yml")]));
    expect(d.provider).toBe("gemini");
    expect(d.context.hasCICDChanges).toBe(true);
  });

  it("routes infrastructure files (Dockerfile, terraform, k8s) to Gemini", () => {
    expect(route(makeCorpus([file("Dockerfile")])).provider).toBe("gemini");
    expect(route(makeCorpus([file("infra/main.tf")])).provider).toBe("gemini");
    expect(route(makeCorpus([file("k8s/deployment.yaml")])).provider).toBe("gemini");
  });

  it("routes large diffs (>30k lines) to Gemini even without sensitive files", () => {
    const d = route(makeCorpus([file("src/generated/data.ts", 20000, 11000)]));
    expect(d.provider).toBe("gemini");
    expect(d.context.hasSecurityChanges).toBe(false);
    expect(d.context.totalDiffSize).toBe(31000);
    expect(d.reason).toMatch(/large diff/i);
  });

  it("keeps a small, non-sensitive multi-file PR on Groq", () => {
    const d = route(
      makeCorpus([file("README.md", 10), file("src/utils/format.ts", 40, 5)])
    );
    expect(d.provider).toBe("groq");
    expect(d.context.totalDiffSize).toBe(55);
  });
});
