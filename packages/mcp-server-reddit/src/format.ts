/**
 * Normalizes Reddit's raw objects into the small, stable shapes the tools
 * return. Reddit sends roughly 100 fields per post; almost none of them help a
 * model answer a question, and all of them cost context.
 */

import type { RedditThing } from './client.js';

/** Longest body or selftext kept inline before it is truncated. */
const DEFAULT_BODY_LIMIT = 1200;

export interface FormattedPost {
  type: 'post';
  id: string;
  fullname: string;
  title: string;
  subreddit: string;
  author: string;
  score: number;
  num_comments: number;
  created: string;
  permalink: string;
  url?: string;
  flair?: string;
  nsfw?: boolean;
  selftext?: string;
  truncated?: boolean;
}

export interface FormattedComment {
  type: 'comment';
  id: string;
  fullname: string;
  author: string;
  subreddit: string;
  score: number;
  created: string;
  permalink: string;
  body: string;
  truncated?: boolean;
  post_title?: string;
}

export interface FormattedSubreddit {
  type: 'subreddit';
  name: string;
  title?: string;
  subscribers?: number;
  created: string;
  description?: string;
  over18?: boolean;
  url?: string;
}

export type FormattedThing =
  | FormattedPost
  | FormattedComment
  | FormattedSubreddit
  | { type: 'unknown'; kind?: string };

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Converts Reddit's epoch seconds into an ISO string, or empty when absent. */
export function toIso(epochSeconds: unknown): string {
  if (typeof epochSeconds !== 'number' || !Number.isFinite(epochSeconds)) {
    return '';
  }
  return new Date(epochSeconds * 1000).toISOString();
}

/** Truncates text to a limit, reporting whether anything was cut. */
export function clamp(
  text: string | undefined,
  limit: number = DEFAULT_BODY_LIMIT
): { text?: string; truncated?: boolean } {
  if (!text) return {};
  if (text.length <= limit) return { text };
  return { text: `${text.slice(0, limit)}...`, truncated: true };
}

const absolute = (permalink: unknown): string => {
  const path = str(permalink);
  return path ? `https://www.reddit.com${path}` : '';
};

function formatPost(data: Record<string, unknown>): FormattedPost {
  const body = clamp(str(data.selftext));
  return {
    type: 'post',
    id: str(data.id) ?? '',
    fullname: str(data.name) ?? '',
    title: str(data.title) ?? '',
    subreddit: str(data.subreddit) ?? '',
    author: str(data.author) ?? '',
    score: num(data.score),
    num_comments: num(data.num_comments),
    created: toIso(data.created_utc),
    permalink: absolute(data.permalink),
    url: str(data.url),
    flair: str(data.link_flair_text),
    nsfw: data.over_18 === true ? true : undefined,
    selftext: body.text,
    truncated: body.truncated,
  };
}

function formatComment(data: Record<string, unknown>): FormattedComment {
  const body = clamp(str(data.body));
  return {
    type: 'comment',
    id: str(data.id) ?? '',
    fullname: str(data.name) ?? '',
    author: str(data.author) ?? '',
    subreddit: str(data.subreddit) ?? '',
    score: num(data.score),
    created: toIso(data.created_utc),
    permalink: absolute(data.permalink),
    body: body.text ?? '',
    truncated: body.truncated,
    // Present on saved and history listings, and the single most useful field
    // for telling saved comments apart.
    post_title: str(data.link_title),
  };
}

function formatSubreddit(data: Record<string, unknown>): FormattedSubreddit {
  const description = clamp(str(data.public_description), 400);
  return {
    type: 'subreddit',
    name: str(data.display_name) ?? '',
    title: str(data.title),
    subscribers: num(data.subscribers),
    created: toIso(data.created_utc),
    description: description.text,
    over18: data.over18 === true ? true : undefined,
    url: absolute(data.url) || undefined,
  };
}

/** Formats any Reddit thing by its kind, leaving unknown kinds identifiable. */
export function formatThing(thing: RedditThing): FormattedThing {
  const data = thing.data ?? {};
  switch (thing.kind) {
    case 't1':
      return formatComment(data);
    case 't3':
      return formatPost(data);
    case 't5':
      return formatSubreddit(data);
    default:
      return { type: 'unknown', kind: thing.kind };
  }
}

/** Formats a list of things, dropping kinds with nothing useful to say. */
export function formatThings(things: RedditThing[]): FormattedThing[] {
  return things.map(formatThing).filter((item) => item.type !== 'unknown');
}

/** Formats the identity endpoint into the fields a person actually asks for. */
export function formatMe(
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    type: 'account',
    username: str(data.name),
    id: str(data.id),
    created: toIso(data.created_utc),
    link_karma: num(data.link_karma),
    comment_karma: num(data.comment_karma),
    total_karma: num(data.total_karma),
    has_gold: data.is_gold === true,
    is_mod: data.is_mod === true,
    over_18: data.over_18 === true,
    profile_url: str(data.name)
      ? `https://www.reddit.com/user/${str(data.name)}`
      : undefined,
  };
}

/**
 * Reports whether a formatted item matches every whitespace separated term,
 * case insensitively, across the fields worth searching.
 *
 * Reddit has no server side search over saved items, so this is what makes a
 * saved archive answerable rather than merely listable.
 */
export function matchesQuery(item: FormattedThing, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = [
    'title' in item ? item.title : undefined,
    'selftext' in item ? item.selftext : undefined,
    'body' in item ? item.body : undefined,
    'post_title' in item ? item.post_title : undefined,
    'subreddit' in item ? item.subreddit : undefined,
    'author' in item ? item.author : undefined,
    'flair' in item ? item.flair : undefined,
    'url' in item ? item.url : undefined,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}
