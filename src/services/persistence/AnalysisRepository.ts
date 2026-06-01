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
        enum: ["Atenção necessária", "OK"],
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
      justification: { type: String, required: true },
      recommendations: { type: [String], required: true },
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
      .lean<AnalysisRecord[]>();
    return docs;
  }
}
