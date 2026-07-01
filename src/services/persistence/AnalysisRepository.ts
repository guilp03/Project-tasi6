import mongoose, { Schema, Model, Document } from "mongoose";
import { AnalysisRecord } from "../types.js";

// ---------------------------------------------------------------------------
// Mongoose document type
// ---------------------------------------------------------------------------

type AnalysisDocument = AnalysisRecord & Document;

// ---------------------------------------------------------------------------
// Schema — mirrors AnalysisRecord 1:1
// ---------------------------------------------------------------------------

const AnalysisSchema = new Schema<AnalysisDocument>(
  {
    repository: { type: String, required: true },
    pullRequest: {
      id: { type: String, required: true },
      title: { type: String, required: true },
      author: { type: String, required: true },
      url: { type: String, required: true },
    },
    analysis: {
      status: {
        type: String,
        enum: ["Atenção necessária", "OK", "Inconclusiva"],
        required: true,
      },
      criticality: {
        type: String,
        enum: ["Baixa", "Média", "Alta", "Crítica"],
        required: true,
      },
      requiresDocsUpdate: { type: Boolean, required: true },
      detectedChanges: { type: [String], required: true },
      documentationGaps: { type: [String], required: true },
      untrackedGaps: { type: [String], default: [] },
      justification: { type: String, required: true },
      recommendations: { type: [String], required: true },
      parseFailure: { type: Boolean, default: false },
    },
    llm: {
      provider: { type: String, enum: ["groq", "gemini"], required: true },
      model: { type: String, required: true },
      inputTokens: { type: Number, required: true },
      outputTokens: { type: Number, required: true },
      estimatedCost: { type: Number, required: true },
    },
    routing: {
      reason: { type: String, required: true },
    },
    createdAt: { type: String, required: true },
  },
  {
    // Disable Mongoose's own timestamps — createdAt comes from AnalysisRecord
    timestamps: false,
    // Use _id but don't expose __v
    versionKey: false,
  }
);

// ---------------------------------------------------------------------------
// Indexes — improve query performance
// ---------------------------------------------------------------------------

// Most common query: recent records by repository
AnalysisSchema.index({ createdAt: -1 });
AnalysisSchema.index({ repository: 1, createdAt: -1 });

// ---------------------------------------------------------------------------
// Model (lazy singleton — avoids "Cannot overwrite model" in test reruns)
// ---------------------------------------------------------------------------

function getModel(): Model<AnalysisDocument> {
  if (mongoose.models["Analysis"]) {
    return mongoose.model<AnalysisDocument>("Analysis");
  }
  return mongoose.model<AnalysisDocument>("Analysis", AnalysisSchema);
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class AnalysisRepository {
  private connected = false;

  // Lazy connection: called once per process, reuses the existing socket after that.
  private async ensureConnection(): Promise<void> {
    if (this.connected && mongoose.connection.readyState === 1) {
      return;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }

    await mongoose.connect(uri);
    this.connected = true;
  }

  /**
   * Persist an AnalysisRecord and return the new document's string id.
   */
  async save(record: AnalysisRecord): Promise<string> {
    await this.ensureConnection();
    const AnalysisModel = getModel();
    const doc = await AnalysisModel.create(record);
    return (doc._id as mongoose.Types.ObjectId).toString();
  }

  /**
   * Return the most recent `limit` records, ordered newest-first.
   */
  async findRecent(limit = 10): Promise<AnalysisRecord[]> {
    await this.ensureConnection();
    const AnalysisModel = getModel();
    const docs = await AnalysisModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<any[]>();
    return docs.map((doc) => {
      const { _id, ...rest } = doc;
      return { ...rest, id: (_id as mongoose.Types.ObjectId).toString() };
    });
  }

  /**
   * Find a single record by its MongoDB ObjectId string.
   * Returns null when no document matches the given id.
   */
  async findById(id: string): Promise<AnalysisRecord | null> {
    await this.ensureConnection();
    const AnalysisModel = getModel();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const doc = await AnalysisModel.findById(id).lean<any>();
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { ...rest, id: (_id as mongoose.Types.ObjectId).toString() };
  }

  /**
   * Update an existing record's analysis fields.
   * Returns the updated record, or null if the id was not found.
   * Only allows updating the mutable `analysis` sub-document to preserve
   * immutable fields (repository, pullRequest, llm, routing, createdAt).
   */
  async update(
    id: string,
    patch: Partial<AnalysisRecord["analysis"]>
  ): Promise<AnalysisRecord | null> {
    await this.ensureConnection();
    const AnalysisModel = getModel();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    const updateFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      updateFields[`analysis.${key}`] = value;
    }

    const doc = await AnalysisModel.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true }
    ).lean<AnalysisRecord & { _id: mongoose.Types.ObjectId }>();

    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { ...rest, id: _id.toString() };
  }

  /**
   * Remove a record by its MongoDB ObjectId string.
   * Returns true when deleted, false when the id was not found.
   */
  async deleteById(id: string): Promise<boolean> {
    await this.ensureConnection();
    const AnalysisModel = getModel();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return false;
    }
    const result = await AnalysisModel.findByIdAndDelete(id);
    return result !== null;
  }
}