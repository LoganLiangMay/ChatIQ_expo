import * as functions from 'firebase-functions';
import { stepCountIs, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
// import { wrapAISDK } from 'langsmith/experimental/vercel';
// import * as ai from 'ai';

// Wrap AI SDK with LangSmith for tracing (temporarily disabled)
// const { generateText: tracedGenerateText } = wrapAISDK(ai);

/**
 * System prompt for AI agent
 */
const SYSTEM_PROMPT = `You are an intelligent AI assistant for ChatIQ, a team messaging app designed for remote teams.

Your capabilities:
1. **Summarize conversations** - Provide concise summaries of chat threads with key points
2. **Extract action items** - Identify tasks, owners, deadlines, and priorities
3. **Track decisions** - Find and explain decisions made in conversations with context
4. **Search messages** - Find relevant information across all chats using semantic search
5. **Navigate chats** - Help users find and access their conversations

Your personality:
- Professional but friendly and approachable
- Concise and to-the-point (no unnecessary fluff)
- Proactive in suggesting helpful actions
- Context-aware about remote team workflows and async communication
- Patient and helpful when users are unclear

Guidelines:
- ALWAYS use tools to access real data (never make up information)
- When asked about specific chats, use the appropriate tool to fetch actual data
- If multiple tools are needed, use them in logical sequence
- Provide context and explain your findings clearly
- Suggest relevant follow-up actions when appropriate
- If you don't have enough information, ask clarifying questions
- Highlight important or urgent information
- Format responses for readability (use bullet points, clear sections)`;

// Tools will be added here once deployment is successful

/**
 * AI Agent Firebase Function
 * Handles conversational AI with tool calling and LangSmith tracing
 */
export const aiAgent = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
  })
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { message, conversationHistory = [] } = data;

    if (!message || typeof message !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Message is required'
      );
    }

    try {
      const messages = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        ...conversationHistory.map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: message },
      ];

      const result = await generateText({
        model: openai('gpt-4o'), // Upgraded for better reasoning and accuracy
        messages,
        // tools: {
        //   // Tools will be added here once deployment is successful
        // },
        stopWhen: stepCountIs(5), // Allow up to 5 reasoning steps
        temperature: 0.7,
      });

      return {
        text: result.text,
        toolCalls: result.toolCalls,
        usage: result.usage,
      };
    } catch (error: any) {
      console.error('AI Agent error:', error);
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to process agent request'
      );
    }
  });

