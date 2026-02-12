/**
 * Team Citation Type
 *
 * Citation type with visibility metadata for team memory queries.
 */

import { builder } from '../../builder.ts';
import { CitationVisibilityEnum } from './citation-visibility-enum.ts';

/**
 * Team citation data interface
 */
export interface TeamCitationData {
  source: string;
  excerpt: string;
  sessionId?: string;
  visibility: 'public' | 'team' | 'private';
  author?: string;
  timestamp?: number;
}

/**
 * Team citation object reference
 */
const TeamCitationRef = builder.objectRef<TeamCitationData>('TeamCitation');

/**
 * Team citation type implementation
 */
export const TeamCitationType = TeamCitationRef.implement({
  description: 'Citation from team memory with visibility metadata',
  fields: (t) => ({
    source: t.exposeString('source', {
      description: 'Source identifier (e.g., transcript:sessionId:msgId)',
    }),
    excerpt: t.exposeString('excerpt', {
      description: 'Relevant excerpt (sanitized for privacy)',
    }),
    sessionId: t.string({
      nullable: true,
      description: 'Session ID if from a session',
      resolve: (c) => c.sessionId ?? null,
    }),
    visibility: t.field({
      type: CitationVisibilityEnum,
      description: 'Visibility level of the source',
      resolve: (c) => c.visibility,
    }),
    author: t.string({
      nullable: true,
      description: 'Author if known',
      resolve: (c) => c.author ?? null,
    }),
    timestamp: t.field({
      type: 'DateTime',
      nullable: true,
      description: 'Timestamp if known',
      resolve: (c) => (c.timestamp ? new Date(c.timestamp) : null),
    }),
  }),
});
