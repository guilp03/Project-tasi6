// tests/services/GitHubExtractorService.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubExtractorService } from "../../src/services/GitHubExtractorService";

describe("GitHubExtractorService", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch() {
    const mockFiles = [
      {
        filename: "src/index.ts",
        status: "modified",
        additions: 10,
        deletions: 2,
        changes: 12,
        patch: "@@ -1,3 +1,5 @@\n+export function newFeature() {\n+  return true;\n+}\n",
      },
      {
        filename: "README.md",
        status: "modified",
        additions: 3,
        deletions: 0,
        changes: 3,
        patch: "+## New Feature",
      },
    ];

    const mockPR = {
      title: "Add feature",
      body: "This PR adds a new feature.",
      user: { login: "devuser", html_url: "https://github.com/devuser" },
      labels: [{ name: "enhancement" }, { name: "documentation" }],
      html_url: "https://github.com/acme/widget/pull/42",
    };

    global.fetch = vi.fn((url: string) => {
      if (url.includes("/pulls/42/files")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFiles),
        });
      }
      if (url.includes("/pulls/42")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPR),
        });
      }
      return Promise.resolve({ ok: false, status: 404, statusText: "Not Found" });
    }) as unknown as typeof fetch;

    return global.fetch;
  }

  it("extracts PR metadata and files into a PRCorpus", async () => {
    mockFetch();
    const service = new GitHubExtractorService("fake-token");
    const corpus = await service.extract("acme", "widget", 42);

    expect(corpus.pr.number).toBe("42");
    expect(corpus.pr.repository).toBe("acme/widget");
    expect(corpus.pr.title).toBe("Add feature");
    expect(corpus.pr.description).toBe("This PR adds a new feature.");
    expect(corpus.pr.author).toBe("devuser");
    expect(corpus.pr.labels).toEqual(["enhancement", "documentation"]);
    expect(corpus.pr.html_url).toBe("https://github.com/acme/widget/pull/42");

    expect(corpus.files).toHaveLength(2);
    expect(corpus.files[0].path).toBe("src/index.ts");
    expect(corpus.files[0].status).toBe("modified");
    expect(corpus.files[0].language).toBe("TypeScript");
    expect(corpus.files[0].isPublicAPI).toBe(true);
    expect(corpus.files[0].isTest).toBe(false);
    expect(corpus.files[0].isDocumentation).toBe(false);
    expect(corpus.files[0].diff).toContain("newFeature");

    expect(corpus.files[1].path).toBe("README.md");
    expect(corpus.files[1].isDocumentation).toBe(true);
  });

  it("classifies test files correctly", async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/pulls/1/files")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              filename: "src/index.test.ts",
              status: "added",
              additions: 50,
              deletions: 0,
              changes: 50,
              patch: "+test code",
            },
          ]),
        });
      }
      if (url.includes("/pulls/1")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            title: "Tests",
            body: null,
            user: { login: "tester", html_url: "" },
            labels: [],
            html_url: "",
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    }) as unknown as typeof fetch;

    const service = new GitHubExtractorService("fake-token");
    const corpus = await service.extract("acme", "widget", 1);

    expect(corpus.files[0].isTest).toBe(true);
    expect(corpus.files[0].isPublicAPI).toBe(false);
  });

  it("throws on GitHub API error", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 403, statusText: "Forbidden" })
    ) as unknown as typeof fetch;

    const service = new GitHubExtractorService("fake-token");
    await expect(service.extract("acme", "widget", 99)).rejects.toThrow(
      /GitHub API error/
    );
  });
});