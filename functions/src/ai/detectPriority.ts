import * as functions from 'firebase-functions';
import { callChatCompletion } from './openai';
import { PROMPTS } from './prompts';
import type { DetectPriorityRequest, DetectPriorityResponse } from './types';

/**
 * Detect if a message is high priority
 * 
 * Uses GPT-4-mini to analyze message content for urgency indicators:
 * - Keywords: URGENT, ASAP, critical, blocker, etc.
 * - Time sensitivity: deadlines, today, now, etc.
 * - Impact: broken, down, failed, etc.
 * 
 * Returns priority score (0-1) and urgency level
 */
export const detectPriority = functions.https.onCall(
  async (data: DetectPriorityRequest, context): Promise<DetectPriorityResponse> => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to detect priority'
      );
    }

    const { content, messageId, chatId } = data;

    // Validate input
    if (!content || typeof content !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Message content is required'
      );
    }

    try {
      // Call OpenAI with priority detection prompt
      const messages = PROMPTS.detectPriority(content);
      const response = await callChatCompletion(messages, {
        model: 'gpt-4o', // Upgraded for better priority detection accuracy
        temperature: 0.3, // Low temperature for consistent classification
        maxTokens: 200,
      });

      const result = response.choices[0].message.content;
      
      // Log raw response for debugging
      functions.logger.info('OpenAI raw response', {
        messageId,
        content,
        rawResponse: result,
        model: response.model,
        usage: response.usage
      });
      
      if (!result) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse JSON response
      const parsed = JSON.parse(result);

      // Validate response structure
      if (typeof parsed.isPriority !== 'boolean' ||
          typeof parsed.score !== 'number' ||
          !parsed.urgencyLevel ||
          !parsed.reason) {
        throw new Error('Invalid response format from OpenAI');
      }

      // Log for monitoring (optional)
      functions.logger.info('Priority detected', {
        messageId,
        chatId,
        isPriority: parsed.isPriority,
        urgencyLevel: parsed.urgencyLevel,
        score: parsed.score,
      });

      return {
        isPriority: parsed.isPriority,
        score: Number(parsed.score),
        urgencyLevel: parsed.urgencyLevel,
        reason: parsed.reason,
      };
    } catch (error: any) {
      functions.logger.error('Error detecting priority', {
        error: error.message,
        messageId,
        chatId,
      });

      // Handle JSON parsing errors
      if (error instanceof SyntaxError) {
        throw new functions.https.HttpsError(
          'internal',
          'Failed to parse AI response'
        );
      }

      // Re-throw HttpsErrors as-is
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new functions.https.HttpsError(
        'internal',
        `Failed to detect priority: ${error.message}`
      );
    }
  }
);


