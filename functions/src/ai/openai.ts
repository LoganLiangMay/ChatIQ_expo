import OpenAI from 'openai';
import * as functions from 'firebase-functions';

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = functions.config().openai?.api_key || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    openaiClient = new OpenAI({
      apiKey: apiKey,
    });
  }

  return openaiClient;
}

/**
 * Call OpenAI Chat Completion API
 */
export async function callChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const client = getOpenAIClient();

  const {
    model = 'gpt-4o', // Upgraded to gpt-4o for maximum accuracy
    temperature = 0.7,
    maxTokens = 1000,
  } = options;

  const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
    model,
    messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    temperature,
    max_tokens: maxTokens,
  };

  try {
    const response = await client.chat.completions.create(params);
    return response as OpenAI.Chat.Completions.ChatCompletion;
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    throw new functions.https.HttpsError(
      'internal',
      `OpenAI API error: ${error.message}`
    );
  }
}

/**
 * Generate embeddings for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();

  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small', // Upgraded from ada-002 for better accuracy
      input: text,
    });

    return response.data[0].embedding;
  } catch (error: any) {
    console.error('OpenAI embedding error:', error);
    throw new functions.https.HttpsError(
      'internal',
      `OpenAI embedding error: ${error.message}`
    );
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  const client = getOpenAIClient();

  // OpenAI allows up to 2048 inputs per request
  const BATCH_SIZE = 2048;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small', // Upgraded from ada-002 for better accuracy
        input: batch,
      });

      const embeddings = response.data.map((d) => d.embedding);
      allEmbeddings.push(...embeddings);
    } catch (error: any) {
      console.error('OpenAI batch embedding error:', error);
      throw new functions.https.HttpsError(
        'internal',
        `OpenAI batch embedding error: ${error.message}`
      );
    }
  }

  return allEmbeddings;
}

