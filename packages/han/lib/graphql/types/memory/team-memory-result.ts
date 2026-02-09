/**
 * Team Memory Result Type
 *
 * Result type for team memory queries with permission-aware citations.
 */

import { builder } from '../../builder.ts';
import { ConfidenceEnum } from './confidence-enum.ts';
import { type TeamCitationData, TeamCitationType } from './team-citation.ts';

/**
 * Team memory search stats
 */
export interface TeamMemoryStats {
  totalSessions: number;
  permittedSessions: number;
  resultsFound: number;
  resultsFiltered: number;
}

/**
 * Team memory result data interface
 */
export interface TeamMemoryResultData {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  citations: TeamCitationData[];
  sessionsSearched: number;
  cached: boolean;
  stats: TeamMemoryStats;
}

/**
 * Team memory stats object reference
 */
const TeamMemoryStatsRef =
  builder.objectRef<TeamMemoryStats>('TeamMemoryStats');

/**
 * Team memory stats type implementation
 */
export const TeamMemoryStatsType = TeamMemoryStatsRef.implement({
  description: 'Statistics from team memory search',
  fields: (t) => ({
    totalSessions: t.exposeInt('totalSessions', {
      description: 'Total sessions available',
    }),
    permittedSessions: t.exposeInt('permittedSessions', {
      description: 'Sessions user has permission to access',
    }),
    resultsFound: t.exposeInt('resultsFound', {
      description: 'Number of results found',
    }),
    resultsFiltered: t.exposeInt('resultsFiltered', {
      description: 'Number of results filtered out by permissions',
    }),
  }),
});

/**
 * Team memory result object reference
 */
const TeamMemoryResultRef =
  builder.objectRef<TeamMemoryResultData>('TeamMemoryResult');

/**
 * Team memory result type implementation
 */
export const TeamMemoryResultType = TeamMemoryResultRef.implement({
  description: 'Result of a team memory query',
  fields: (t) => ({
    answer: t.exposeString('answer', {
      description: 'Synthesized answer based on team memory',
    }),
    confidence: t.field({
      type: ConfidenceEnum,
      description: 'Confidence level based on source quality',
      resolve: (r) => r.confidence.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
    }),
    citations: t.field({
      type: [TeamCitationType],
      description: 'Citations with visibility metadata',
      resolve: (r) => r.citations,
    }),
    sessionsSearched: t.exposeInt('sessionsSearched', {
      description: 'Number of sessions searched',
    }),
    cached: t.exposeBoolean('cached', {
      description: 'Whether result was served from cache',
    }),
    stats: t.field({
      type: TeamMemoryStatsType,
      description: 'Search statistics',
      resolve: (r) => r.stats,
    }),
  }),
});
