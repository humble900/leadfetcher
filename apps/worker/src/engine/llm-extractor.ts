import { GoogleGenAI } from '@google/genai';
import { LLMExtractionSchema } from '@leadfetcher/shared/schemas';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required for LLM extraction fallback.');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export async function extractWithLLM(
  cleanText: string,
  missingFields: string[]
): Promise<{ data: Record<string, string | null>; tokensUsed: number }> {
  const ai = getAIClient();

  const prompt = `You are a data extraction assistant.
You are given the cleaned text of a marketplace/listing web page.
Extract values for ONLY the following requested missing fields:
${missingFields.join(', ')}

Strictly adhere to the following rules:
1. Extract information from the text accurately.
2. If a field is not found or not present in the text, return null for that field.
3. For fields not listed in the missing fields above, return null.

Here is the cleaned text of the page:
---
${cleanText}
---`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: LLMExtractionSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Empty response from Gemini');
  }

  const parsed = JSON.parse(text);
  const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

  return {
    data: parsed,
    tokensUsed,
  };
}
