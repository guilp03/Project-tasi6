export interface LLMConfig {
  geminiApiKey: string;
  groqApiKey: string;
}

export function loadConfig(): LLMConfig {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment variables");
  }

  if (!groqApiKey) {
    throw new Error("Missing GROQ_API_KEY in environment variables");
  }

  return {
    geminiApiKey,
    groqApiKey,
  };
}
