import { describe, it, expect } from "vitest";
import { matchesSecurityPattern } from "../../src/utils/securityPatterns";

describe("matchesSecurityPattern", () => {
  it("casa path de código auth", () => {
    expect(matchesSecurityPattern("src/auth/middleware.ts")).toBe(true);
  });

  it("casa .env (rota Gemini)", () => {
    expect(matchesSecurityPattern(".env.production")).toBe(true);
  });

  it("casa workflow de CI/CD", () => {
    expect(matchesSecurityPattern(".github/workflows/deploy.yml")).toBe(true);
  });

  it("casa Dockerfile", () => {
    expect(matchesSecurityPattern("Dockerfile")).toBe(true);
  });

  it("casa k8s/deployment.yaml", () => {
    expect(matchesSecurityPattern("k8s/deployment.yaml")).toBe(true);
  });

  it("casa infra/main.tf (terraform)", () => {
    expect(matchesSecurityPattern("infra/main.tf")).toBe(true);
  });

  it("casa src/auth/token.ts", () => {
    expect(matchesSecurityPattern("src/auth/token.ts")).toBe(true);
  });

  it("casa api_key.json", () => {
    expect(matchesSecurityPattern("api_key.json")).toBe(true);
  });

  it("NÃO é responsável por gate de documentação: casa docs/guides/refresh-token-rotation.mdx", () => {
    expect(matchesSecurityPattern("docs/guides/refresh-token-rotation.mdx")).toBe(true);
  });

  it("NÃO casa código comum", () => {
    expect(matchesSecurityPattern("src/utils/format.ts")).toBe(false);
  });

  it("NÃO casa README.md", () => {
    expect(matchesSecurityPattern("README.md")).toBe(false);
  });

  it("é case-insensitive", () => {
    expect(matchesSecurityPattern("SRC/AUTH/MIDDLEWARE.TS")).toBe(true);
  });

  it("casa docker-compose.yml", () => {
    expect(matchesSecurityPattern("docker-compose.yml")).toBe(true);
  });

  it("casa docker_compose.yml", () => {
    expect(matchesSecurityPattern("docker_compose.yml")).toBe(true);
  });

  it("casa cloudformation.yaml", () => {
    expect(matchesSecurityPattern("cloudformation.yaml")).toBe(true);
  });

  it("casa cloudformation-trigger.ts", () => {
    expect(matchesSecurityPattern("src/cloudformation-trigger.ts")).toBe(true);
  });

  it("casa path com ssl/certificate", () => {
    expect(matchesSecurityPattern("certs/ssl/server.crt")).toBe(true);
  });

  it("casa path com crypto", () => {
    expect(matchesSecurityPattern("src/utils/crypto.ts")).toBe(true);
  });

  it("casa path com credential", () => {
    expect(matchesSecurityPattern("config/credentials.json")).toBe(true);
  });

  it("casa path com password", () => {
    expect(matchesSecurityPattern("src/password-reset.ts")).toBe(true);
  });

  it("casa path com secret", () => {
    expect(matchesSecurityPattern("secrets/api.txt")).toBe(true);
  });

  it("casa path com gcp (nuvem)", () => {
    expect(matchesSecurityPattern("deploy/gcp/main.tf")).toBe(true);
  });

  it("casa src/security/policy.ts (superset: 'security' é padrão sensível)", () => {
    expect(matchesSecurityPattern("src/security/policy.ts")).toBe(true);
  });

  it("casa docs/SECURITY.md (superset: 'security' substring)", () => {
    expect(matchesSecurityPattern("docs/SECURITY.md")).toBe(true);
  });
});