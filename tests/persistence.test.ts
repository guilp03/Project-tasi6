import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { AnalysisRepository } from "../src/services/persistence/AnalysisRepository";
import { AnalysisRecord } from "../src/services/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<AnalysisRecord> = {}): AnalysisRecord {
  return {
    repository: "acme/widget",
    pullRequest: {
      id: "42",
      title: "Add feature X",
      author: "dev",
      url: "https://github.com/acme/widget/pull/42",
    },
    analysis: {
      status: "Atenção necessária",
      criticality: "Alta",
      requiresDocsUpdate: true,
      detectedChanges: ["src/feature.ts (modified)"],
      documentationGaps: ["Endpoint not documented"],
      justification: "Major API surface changed without docs.",
      recommendations: ["Update API reference"],
    },
    llm: {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      inputTokens: 1200,
      outputTokens: 300,
      estimatedCost: 0,
    },
    routing: {
      reason: "Standard PR — routed to Groq",
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MongoDB in-memory setup
// ---------------------------------------------------------------------------

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  delete process.env.MONGODB_URI;
});

beforeEach(async () => {
  // Wipe all collections between tests for isolation
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AnalysisRepository", () => {
  describe("save()", () => {
    it("persists a record and returns a non-empty string id", async () => {
      const repo = new AnalysisRepository();
      const id = await repo.save(makeRecord());

      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("returns distinct ids for two separate saves", async () => {
      const repo = new AnalysisRepository();
      const id1 = await repo.save(makeRecord());
      const id2 = await repo.save(makeRecord());

      expect(id1).not.toBe(id2);
    });

    it("actually persists the document to the database", async () => {
      const repo = new AnalysisRepository();
      const record = makeRecord();
      const id = await repo.save(record);

      // Verify via findRecent that the document is really in MongoDB
      const results = await repo.findRecent(1);
      expect(results).toHaveLength(1);
      expect(results[0].repository).toBe(record.repository);
      // The returned id must be a valid ObjectId hex string
      expect(id).toMatch(/^[a-f0-9]{24}$/);
    });

    it("throws when MONGODB_URI is not set", async () => {
      const savedUri = process.env.MONGODB_URI;
      delete process.env.MONGODB_URI;

      // Disconnect so ensureConnection actually runs the URI check
      await mongoose.disconnect();

      const repo = new AnalysisRepository();
      await expect(repo.save(makeRecord())).rejects.toThrow("MONGODB_URI");

      // Restore connection for subsequent tests
      process.env.MONGODB_URI = savedUri;
      await mongoose.connect(savedUri!);
    });
  });

  describe("findRecent()", () => {
    it("returns an empty array when the collection is empty", async () => {
      const repo = new AnalysisRepository();
      const results = await repo.findRecent();

      expect(results).toEqual([]);
    });

    it("returns the saved record with all fields intact (1:1 with AnalysisRecord)", async () => {
      const repo = new AnalysisRepository();
      const original = makeRecord();
      await repo.save(original);

      const [found] = await repo.findRecent(1);

      // Top-level fields
      expect(found.repository).toBe(original.repository);
      expect(found.createdAt).toBe(original.createdAt);

      // pullRequest
      expect(found.pullRequest.id).toBe(original.pullRequest.id);
      expect(found.pullRequest.title).toBe(original.pullRequest.title);
      expect(found.pullRequest.author).toBe(original.pullRequest.author);
      expect(found.pullRequest.url).toBe(original.pullRequest.url);

      // analysis
      expect(found.analysis.status).toBe(original.analysis.status);
      expect(found.analysis.criticality).toBe(original.analysis.criticality);
      expect(found.analysis.requiresDocsUpdate).toBe(original.analysis.requiresDocsUpdate);
      expect(found.analysis.detectedChanges).toEqual(original.analysis.detectedChanges);
      expect(found.analysis.documentationGaps).toEqual(original.analysis.documentationGaps);
      expect(found.analysis.justification).toBe(original.analysis.justification);
      expect(found.analysis.recommendations).toEqual(original.analysis.recommendations);

      // llm
      expect(found.llm.provider).toBe(original.llm.provider);
      expect(found.llm.model).toBe(original.llm.model);
      expect(found.llm.inputTokens).toBe(original.llm.inputTokens);
      expect(found.llm.outputTokens).toBe(original.llm.outputTokens);
      expect(found.llm.estimatedCost).toBe(original.llm.estimatedCost);

      // routing
      expect(found.routing.reason).toBe(original.routing.reason);
    });

    it("respects the limit parameter", async () => {
      const repo = new AnalysisRepository();

      for (let i = 0; i < 5; i++) {
        await repo.save(makeRecord({ repository: `org/repo-${i}` }));
      }

      const results = await repo.findRecent(3);
      expect(results).toHaveLength(3);
    });

    it("uses limit = 10 when none is provided", async () => {
      const repo = new AnalysisRepository();

      for (let i = 0; i < 15; i++) {
        await repo.save(makeRecord({ repository: `org/repo-${i}` }));
      }

      const results = await repo.findRecent();
      expect(results).toHaveLength(10);
    });
  });

  describe("ordering — createdAt descending", () => {
    it("returns records ordered by createdAt desc (newest first)", async () => {
      const repo = new AnalysisRepository();

      const timestamps = [
        "2024-01-01T10:00:00.000Z",
        "2024-01-01T10:00:01.000Z",
        "2024-01-01T10:00:02.000Z",
      ];

      for (const ts of timestamps) {
        await repo.save(makeRecord({ createdAt: ts }));
      }

      const results = await repo.findRecent(3);

      expect(results[0].createdAt).toBe("2024-01-01T10:00:02.000Z");
      expect(results[1].createdAt).toBe("2024-01-01T10:00:01.000Z");
      expect(results[2].createdAt).toBe("2024-01-01T10:00:00.000Z");
    });

    it("returns the 2 most recent when limit=2 and 3 records exist", async () => {
      const repo = new AnalysisRepository();

      const timestamps = [
        "2024-06-01T08:00:00.000Z",
        "2024-06-01T09:00:00.000Z",
        "2024-06-01T10:00:00.000Z",
      ];

      for (const ts of timestamps) {
        await repo.save(makeRecord({ createdAt: ts }));
      }

      const results = await repo.findRecent(2);

      expect(results).toHaveLength(2);
      expect(results[0].createdAt).toBe("2024-06-01T10:00:00.000Z");
      expect(results[1].createdAt).toBe("2024-06-01T09:00:00.000Z");
    });
  });

  describe("findById()", () => {
    it("returns the correct record by id", async () => {
      const repo = new AnalysisRepository();
      const record = makeRecord({ repository: "acme/find-by-id" });
      const id = await repo.save(record);

      const found = await repo.findById(id);

      expect(found).not.toBeNull();
      expect(found!.repository).toBe("acme/find-by-id");
      expect(found!.pullRequest.id).toBe(record.pullRequest.id);
    });

    it("returns null for a non-existent ObjectId", async () => {
      const repo = new AnalysisRepository();
      const fakeId = new (mongoose.Types.ObjectId)().toString();

      const found = await repo.findById(fakeId);

      expect(found).toBeNull();
    });

    it("returns null for an invalid id string (not an ObjectId)", async () => {
      const repo = new AnalysisRepository();

      const found = await repo.findById("not-a-valid-objectid");

      expect(found).toBeNull();
    });
  });

  describe("update()", () => {
    it("updates analysis fields and returns the updated record", async () => {
      const repo = new AnalysisRepository();
      const id = await repo.save(makeRecord());

      const updated = await repo.update(id, {
        status: "OK",
        requiresDocsUpdate: false,
        recommendations: ["No action needed"],
      });

      expect(updated).not.toBeNull();
      expect(updated!.analysis.status).toBe("OK");
      expect(updated!.analysis.requiresDocsUpdate).toBe(false);
      expect(updated!.analysis.recommendations).toEqual(["No action needed"]);
    });

    it("does not alter fields outside the analysis sub-document", async () => {
      const repo = new AnalysisRepository();
      const record = makeRecord({ repository: "acme/immutable" });
      const id = await repo.save(record);

      await repo.update(id, { status: "OK" });

      const found = await repo.findById(id);
      expect(found!.repository).toBe("acme/immutable");
      expect(found!.pullRequest.author).toBe(record.pullRequest.author);
      expect(found!.llm.provider).toBe(record.llm.provider);
    });

    it("returns null for a non-existent id", async () => {
      const repo = new AnalysisRepository();
      const fakeId = new (mongoose.Types.ObjectId)().toString();

      const result = await repo.update(fakeId, { status: "OK" });

      expect(result).toBeNull();
    });

    it("returns null for an invalid id string", async () => {
      const repo = new AnalysisRepository();

      const result = await repo.update("not-valid", { status: "OK" });

      expect(result).toBeNull();
    });
  });

  describe("deleteById()", () => {
    it("deletes an existing record and returns true", async () => {
      const repo = new AnalysisRepository();
      const id = await repo.save(makeRecord());

      const deleted = await repo.deleteById(id);

      expect(deleted).toBe(true);
    });

    it("the record is no longer found after deletion", async () => {
      const repo = new AnalysisRepository();
      const id = await repo.save(makeRecord());
      await repo.deleteById(id);

      const found = await repo.findById(id);

      expect(found).toBeNull();
    });

    it("returns false for a non-existent ObjectId", async () => {
      const repo = new AnalysisRepository();
      const fakeId = new (mongoose.Types.ObjectId)().toString();

      const result = await repo.deleteById(fakeId);

      expect(result).toBe(false);
    });

    it("returns false for an invalid id string", async () => {
      const repo = new AnalysisRepository();

      const result = await repo.deleteById("not-a-valid-id");

      expect(result).toBe(false);
    });

    it("does not affect other records when one is deleted", async () => {
      const repo = new AnalysisRepository();
      const id1 = await repo.save(makeRecord({ repository: "acme/keep" }));
      const id2 = await repo.save(makeRecord({ repository: "acme/delete" }));

      await repo.deleteById(id2);

      const remaining = await repo.findRecent(10);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].repository).toBe("acme/keep");

      // id1 still accessible by findById
      const stillThere = await repo.findById(id1);
      expect(stillThere).not.toBeNull();
    });
  });
});
