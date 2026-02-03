/**
 * GraphQL SentimentAnalysis type
 *
 * Sentiment analysis result for a user message (inline, not a separate event).
 */

import { builder } from '../../builder.ts';
import type { SentimentEventData } from '../../loaders.ts';
import { encodeGlobalId } from '../../node-registry.ts';

/**
 * SentimentAnalysis type for inline display on UserMessage
 */
export const SentimentAnalysisType = builder
  .objectRef<SentimentEventData>('SentimentAnalysis')
  .implement({
    description:
      'Sentiment analysis result for a user message (inline, not a separate event)',
    fields: (t) => ({
      id: t.id({
        description: 'Message global ID',
        resolve: (msg) => encodeGlobalId('Message', msg.id),
      }),
      timestamp: t.field({
        type: 'DateTime',
        description: 'When the analysis occurred',
        resolve: (data) => data.timestamp,
      }),
      sentimentScore: t.float({
        description: 'Raw sentiment score (typically -5 to +5)',
        resolve: (data) => data.sentimentScore,
      }),
      sentimentLevel: t.string({
        description:
          'Categorized sentiment level (positive, neutral, negative)',
        resolve: (data) => data.sentimentLevel,
      }),
      frustrationScore: t.float({
        nullable: true,
        description: 'Frustration score (0-10) if frustration detected',
        resolve: (data) => data.frustrationScore ?? null,
      }),
      frustrationLevel: t.string({
        nullable: true,
        description: 'Frustration level if detected (low, moderate, high)',
        resolve: (data) => data.frustrationLevel ?? null,
      }),
      signals: t.stringList({
        description:
          'Detected signals (e.g., CAPS, punctuation, negative_words)',
        resolve: (data) => data.signals,
      }),
      taskId: t.string({
        nullable: true,
        description: 'Optional link to current task ID',
        resolve: (data) => data.taskId ?? null,
      }),
    }),
  });
