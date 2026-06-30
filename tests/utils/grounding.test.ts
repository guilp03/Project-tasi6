import { describe, it, expect } from "vitest";
import { validateGapsGrounding } from "../../src/utils/grounding";
import { PRCorpus, FileMetadata } from "../../src/services/types";

function makeCorpus(paths: string[]): PRCorpus {
  const files: FileMetadata[] = paths.map((p) => ({
    path: p,
    status: "modified" as const,
    additions: 1,
    deletions: 1,
    language: "ts",
    isPublicAPI: false,
    isTest: false,
    isDocumentation: false,
    isConfig: false,
    changeSummary: "",
    diff: "",
  }));
  return {
    pr: {
      number: "1",
      repository: "o/r",
      title: "t",
      description: null,
      author: "a",
      labels: [],
      html_url: "u",
    },
    files,
  };
}

describe("validateGapsGrounding", () => {
  it("grounds gap que cita path completo", () => {
    const c = makeCorpus(["auth/middleware.ts"]);
    const r = validateGapsGrounding({ gaps: ["auth/middleware.ts não documentado"] }, c);
    expect(r.grounded).toBe(true);
    expect(r.groundedGaps).toHaveLength(1);
    expect(r.rejectedGaps).toHaveLength(0);
  });

  it("grounds gap que cita só basename", () => {
    const c = makeCorpus(["src/auth/middleware.ts"]);
    const r = validateGapsGrounding({ gaps: ["middleware.ts carece de docs"] }, c);
    expect(r.grounded).toBe(true);
  });

  it("rejects gap que não cita arquivo do corpus", () => {
    const c = makeCorpus(["auth/middleware.ts"]);
    const r = validateGapsGrounding({ gaps: ["endpoint /api/login não documentado"] }, c);
    expect(r.grounded).toBe(false);
    expect(r.rejectedGaps).toHaveLength(1);
    expect(r.groundedGaps).toHaveLength(0);
  });

  it("é case-insensitive", () => {
    const c = makeCorpus(["README.md"]);
    const r = validateGapsGrounding({ gaps: ["readme.md desatualizado"] }, c);
    expect(r.grounded).toBe(true);
  });

  it("mistura grounded e rejected corretamente", () => {
    const c = makeCorpus(["auth/middleware.ts"]);
    const r = validateGapsGrounding(
      { gaps: ["auth/middleware.ts ok", "endpoint /api/login não documenta"] },
      c
    );
    expect(r.groundedGaps).toEqual(["auth/middleware.ts ok"]);
    expect(r.rejectedGaps).toEqual(["endpoint /api/login não documenta"]);
  });

  it("lista de gaps vazia → grounded false", () => {
    const c = makeCorpus(["auth/middleware.ts"]);
    const r = validateGapsGrounding({ gaps: [] }, c);
    expect(r.grounded).toBe(false);
    expect(r.groundedGaps).toHaveLength(0);
    expect(r.rejectedGaps).toHaveLength(0);
  });
});