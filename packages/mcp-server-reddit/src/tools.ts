/**
 * Tool registrations. Public tools work in every auth mode; user scoped tools
 * refuse with setup instructions rather than a bare error when the server is
 * not signed in.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { explainMissingUserAuth } from './auth.js';
import type { RedditClient, RedditThing } from './client.js';
import { formatMe, formatThing, formatThings, matchesQuery } from './format.js';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

const ok = (data: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
});

const fail = (message: string): ToolResult => ({
  content: [{ type: 'text', text: message }],
  isError: true,
});

const LIMIT = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(25)
  .describe('Number of items to return (1-100)');

const AFTER = z
  .string()
  .optional()
  .describe('Pagination cursor: the "after" fullname from a previous page');

const SUBREDDIT = z.string().describe('Subreddit name, without the r/ prefix');

const TIME = z
  .enum(['hour', 'day', 'week', 'month', 'year', 'all'])
  .default('day')
  .describe('Time window for score ranking');

/** Resolves and caches the signed in username, needed by every history path. */
function createUsernameResolver(client: RedditClient): () => Promise<string> {
  let cached: string | null = null;
  return async () => {
    if (cached) return cached;
    const me = await client.get<Record<string, unknown>>('/api/v1/me');
    const name = typeof me.name === 'string' ? me.name : null;
    if (!name) throw new Error('Reddit did not return the signed in username');
    cached = name;
    return name;
  };
}

/** Registers every tool on the server, public and user scoped alike. */
export function registerTools(server: McpServer, client: RedditClient): void {
  const whoami = createUsernameResolver(client);

  /** Guards a user scoped handler behind a signed in session. */
  const requireUser = <A>(
    handler: (args: A) => Promise<ToolResult>
  ): ((args: A) => Promise<ToolResult>) => {
    return async (args: A) => {
      if (!client.isUserScoped) {
        return fail(explainMissingUserAuth(client.mode));
      }
      try {
        return await handler(args);
      } catch (error) {
        return fail(`Reddit request failed: ${(error as Error).message}`);
      }
    };
  };

  /** Wraps a public handler so a transport error reads as a tool error. */
  const guard = <A>(
    handler: (args: A) => Promise<ToolResult>
  ): ((args: A) => Promise<ToolResult>) => {
    return async (args: A) => {
      try {
        return await handler(args);
      } catch (error) {
        return fail(`Reddit request failed: ${(error as Error).message}`);
      }
    };
  };

  const history = async (
    path: string,
    query: Record<string, string | number | undefined>,
    limit: number
  ): Promise<ToolResult> => {
    const username = await whoami();
    const page = await client.getListing(`/user/${username}${path}`, {
      ...query,
      limit,
    });
    return ok({
      count: page.things.length,
      after: page.after,
      items: formatThings(page.things),
    });
  };

  // ---------------------------------------------------------------------
  // Identity and saved history: the reason this server exists.
  // ---------------------------------------------------------------------

  server.registerTool(
    'get_me',
    {
      title: 'Get my Reddit profile',
      description:
        'Get the signed in Reddit account: username, karma, account age, ' +
        'and profile URL. Requires user authentication.',
      inputSchema: {},
    },
    requireUser(async () => {
      const me = await client.get<Record<string, unknown>>('/api/v1/me');
      return ok(formatMe(me));
    })
  );

  server.registerTool(
    'get_saved',
    {
      title: 'Get my saved posts and comments',
      description:
        'List items saved to the signed in Reddit account, newest first. ' +
        'Covers both saved posts and saved comments. Requires user ' +
        'authentication.',
      inputSchema: {
        type: z
          .enum(['all', 'posts', 'comments'])
          .default('all')
          .describe('Restrict to saved posts, saved comments, or both'),
        subreddit: z
          .string()
          .optional()
          .describe('Only return saved items from this subreddit'),
        limit: LIMIT,
        after: AFTER,
      },
    },
    requireUser(async ({ type, subreddit, limit, after }) => {
      const username = await whoami();
      const redditType =
        type === 'posts'
          ? 'links'
          : type === 'comments'
            ? 'comments'
            : undefined;

      // Filtering by subreddit happens here rather than at Reddit, which
      // offers no such filter on saved, so over-fetch before narrowing.
      const wanted = subreddit?.replace(/^r\//i, '').toLowerCase();
      const page = await client.getListing(`/user/${username}/saved`, {
        type: redditType,
        limit: wanted ? 100 : limit,
        after,
      });

      let items = formatThings(page.things);
      if (wanted) {
        items = items.filter(
          (item) =>
            'subreddit' in item && item.subreddit?.toLowerCase() === wanted
        );
      }

      return ok({
        count: Math.min(items.length, limit),
        after: page.after,
        items: items.slice(0, limit),
      });
    })
  );

  server.registerTool(
    'search_saved',
    {
      title: 'Search my saved Reddit items',
      description:
        "Search the signed in account's saved posts and comments by " +
        'keyword. Reddit has no server side search over saved items, so ' +
        'this pages through saved history and matches locally on title, ' +
        'body, subreddit, author, and flair. Every term must appear. ' +
        'Note that this issues up to max_pages sequential Reddit requests ' +
        '(default 10, 100 items each), so a deep scan is slower than a ' +
        'single lookup. Lower max_pages when only recent saves matter. ' +
        'Requires user authentication.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe('Space separated terms; all must match'),
        type: z
          .enum(['all', 'posts', 'comments'])
          .default('all')
          .describe('Restrict to saved posts, saved comments, or both'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(25)
          .describe('Maximum matches to return'),
        max_pages: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(10)
          .describe('Pages of saved history to scan, 100 items per page'),
      },
    },
    requireUser(async ({ query, type, limit, max_pages }) => {
      const username = await whoami();
      const redditType =
        type === 'posts'
          ? 'links'
          : type === 'comments'
            ? 'comments'
            : undefined;

      const things: RedditThing[] = await client.collectListing(
        `/user/${username}/saved`,
        { type: redditType },
        { limit: max_pages * 100, maxPages: max_pages }
      );

      const matches = formatThings(things).filter((item) =>
        matchesQuery(item, query)
      );

      return ok({
        query,
        scanned: things.length,
        matched: matches.length,
        truncated: matches.length > limit,
        items: matches.slice(0, limit),
      });
    })
  );

  server.registerTool(
    'get_upvoted',
    {
      title: 'Get my upvoted posts',
      description:
        'List posts the signed in account has upvoted. Only works when the ' +
        'account has not hidden its vote history. Requires user authentication.',
      inputSchema: { limit: LIMIT, after: AFTER },
    },
    requireUser(({ limit, after }) => history('/upvoted', { after }, limit))
  );

  server.registerTool(
    'get_downvoted',
    {
      title: 'Get my downvoted posts',
      description:
        'List posts the signed in account has downvoted. Requires user ' +
        'authentication.',
      inputSchema: { limit: LIMIT, after: AFTER },
    },
    requireUser(({ limit, after }) => history('/downvoted', { after }, limit))
  );

  server.registerTool(
    'get_hidden',
    {
      title: 'Get my hidden posts',
      description:
        'List posts the signed in account has hidden. Requires user ' +
        'authentication.',
      inputSchema: { limit: LIMIT, after: AFTER },
    },
    requireUser(({ limit, after }) => history('/hidden', { after }, limit))
  );

  server.registerTool(
    'get_my_posts',
    {
      title: 'Get my submitted posts',
      description:
        'List posts submitted by the signed in account. Requires user ' +
        'authentication.',
      inputSchema: {
        sort: z
          .enum(['new', 'hot', 'top'])
          .default('new')
          .describe('Sort order'),
        limit: LIMIT,
        after: AFTER,
      },
    },
    requireUser(({ sort, limit, after }) =>
      history('/submitted', { sort, after }, limit)
    )
  );

  server.registerTool(
    'get_my_comments',
    {
      title: 'Get my comments',
      description:
        'List comments written by the signed in account. Requires user ' +
        'authentication.',
      inputSchema: {
        sort: z
          .enum(['new', 'hot', 'top'])
          .default('new')
          .describe('Sort order'),
        limit: LIMIT,
        after: AFTER,
      },
    },
    requireUser(({ sort, limit, after }) =>
      history('/comments', { sort, after }, limit)
    )
  );

  server.registerTool(
    'get_subscribed_subreddits',
    {
      title: 'Get my subreddit subscriptions',
      description:
        'List the subreddits the signed in account subscribes to. Requires ' +
        'user authentication.',
      inputSchema: { limit: LIMIT, after: AFTER },
    },
    requireUser(async ({ limit, after }) => {
      const page = await client.getListing('/subreddits/mine/subscriber', {
        limit,
        after,
      });
      return ok({
        count: page.things.length,
        after: page.after,
        items: formatThings(page.things),
      });
    })
  );

  server.registerTool(
    'get_inbox',
    {
      title: 'Get my Reddit inbox',
      description:
        "Read the signed in account's inbox: comment replies, post replies, " +
        'username mentions, and private messages. Read only. Requires user ' +
        'authentication.',
      inputSchema: {
        filter: z
          .enum(['all', 'unread', 'messages'])
          .default('all')
          .describe('Inbox view to read'),
        limit: LIMIT,
      },
    },
    requireUser(async ({ filter, limit }) => {
      const path =
        filter === 'unread'
          ? '/message/unread'
          : filter === 'messages'
            ? '/message/messages'
            : '/message/inbox';
      const page = await client.getListing(path, { limit });
      return ok({
        filter,
        count: page.things.length,
        after: page.after,
        // Messages are kind t4 and carry their own shape, so pass the useful
        // fields through directly rather than forcing them into a post.
        items: page.things.map((thing) => {
          const data = thing.data ?? {};
          return {
            type: thing.kind === 't4' ? 'message' : 'reply',
            id: data.id,
            author: data.author,
            subject: data.subject,
            subreddit: data.subreddit,
            created: data.created_utc,
            new: data.new,
            body: typeof data.body === 'string' ? data.body : undefined,
          };
        }),
      });
    })
  );

  server.registerTool(
    'get_multireddits',
    {
      title: 'Get my multireddits',
      description:
        'List the multireddits owned by the signed in account. Requires ' +
        'user authentication.',
      inputSchema: {},
    },
    requireUser(async () => {
      const multis =
        await client.get<Array<{ data?: Record<string, unknown> }>>(
          '/api/multi/mine'
        );
      return ok(
        multis.map((multi) => ({
          name: multi.data?.display_name ?? multi.data?.name,
          path: multi.data?.path,
          subreddits: (
            (multi.data?.subreddits as Array<{ name?: string }>) ?? []
          ).map((sub) => sub.name),
        }))
      );
    })
  );

  // ---------------------------------------------------------------------
  // Public reads. Names and parameters match the previous Reddit MCP server
  // so existing prompts and memory providers keep working.
  // ---------------------------------------------------------------------

  server.registerTool(
    'get_frontpage_posts',
    {
      title: 'Get Reddit frontpage posts',
      description:
        'Get hot posts from the Reddit frontpage. When signed in, this is ' +
        'the personalized frontpage of subscribed subreddits.',
      inputSchema: { limit: LIMIT },
    },
    guard(async ({ limit }) => {
      const page = await client.getListing('/hot', { limit });
      return ok({
        count: page.things.length,
        items: formatThings(page.things),
      });
    })
  );

  server.registerTool(
    'get_subreddit_info',
    {
      title: 'Get subreddit information',
      description: 'Get details about a subreddit.',
      inputSchema: { subreddit_name: SUBREDDIT },
    },
    guard(async ({ subreddit_name }) => {
      const thing = await client.get<RedditThing>(`/r/${subreddit_name}/about`);
      return ok(formatThing(thing));
    })
  );

  const listing = (
    name: string,
    sort: string,
    title: string,
    withTime = false
  ): void => {
    server.registerTool(
      name,
      {
        title,
        description: `Get ${sort} posts from a specific subreddit.`,
        inputSchema: withTime
          ? { subreddit_name: SUBREDDIT, limit: LIMIT, time: TIME }
          : { subreddit_name: SUBREDDIT, limit: LIMIT },
      },
      guard(
        async (args: {
          subreddit_name: string;
          limit: number;
          time?: string;
        }) => {
          const page = await client.getListing(
            `/r/${args.subreddit_name}/${sort}`,
            { limit: args.limit, t: args.time }
          );
          return ok({
            subreddit: args.subreddit_name,
            count: page.things.length,
            after: page.after,
            items: formatThings(page.things),
          });
        }
      )
    );
  };

  listing('get_subreddit_hot_posts', 'hot', 'Get subreddit hot posts');
  listing('get_subreddit_new_posts', 'new', 'Get subreddit new posts');
  listing('get_subreddit_rising_posts', 'rising', 'Get subreddit rising posts');
  listing('get_subreddit_top_posts', 'top', 'Get subreddit top posts', true);

  server.registerTool(
    'get_post_content',
    {
      title: 'Get post content and comments',
      description:
        'Get the full content of a post along with its top comments.',
      inputSchema: {
        post_id: z
          .string()
          .describe('Reddit post id, with or without the t3_ prefix'),
        comment_limit: z.number().int().min(1).max(100).default(10),
        comment_depth: z.number().int().min(1).max(10).default(3),
      },
    },
    guard(async ({ post_id, comment_limit, comment_depth }) => {
      const id = post_id.replace(/^t3_/, '');
      const [postListing, commentListing] = await client.get<
        Array<{ data?: { children?: RedditThing[] } }>
      >(`/comments/${id}`, { limit: comment_limit, depth: comment_depth });

      const post = postListing?.data?.children?.[0];
      return ok({
        post: post ? formatThing(post) : null,
        comments: formatThings(commentListing?.data?.children ?? []),
      });
    })
  );

  server.registerTool(
    'get_post_comments',
    {
      title: 'Get post comments',
      description: 'Get comments from a specific post.',
      inputSchema: {
        post_id: z
          .string()
          .describe('Reddit post id, with or without the t3_ prefix'),
        limit: LIMIT,
      },
    },
    guard(async ({ post_id, limit }) => {
      const id = post_id.replace(/^t3_/, '');
      const [, commentListing] = await client.get<
        Array<{ data?: { children?: RedditThing[] } }>
      >(`/comments/${id}`, { limit });
      return ok(formatThings(commentListing?.data?.children ?? []));
    })
  );

  server.registerTool(
    'search_reddit',
    {
      title: 'Search Reddit',
      description:
        'Search posts across Reddit, or within one subreddit when given.',
      inputSchema: {
        query: z.string().min(1).describe('Search terms'),
        subreddit: z
          .string()
          .optional()
          .describe('Restrict the search to this subreddit'),
        sort: z
          .enum(['relevance', 'hot', 'top', 'new', 'comments'])
          .default('relevance'),
        time: TIME,
        limit: LIMIT,
      },
    },
    guard(async ({ query, subreddit, sort, time, limit }) => {
      const path = subreddit ? `/r/${subreddit}/search` : '/search';
      const page = await client.getListing(path, {
        q: query,
        sort,
        t: time,
        limit,
        restrict_sr: subreddit ? 'true' : undefined,
      });
      return ok({
        query,
        count: page.things.length,
        after: page.after,
        items: formatThings(page.things),
      });
    })
  );

  server.registerTool(
    'get_user_profile',
    {
      title: 'Get a Reddit user profile',
      description: 'Get the public profile of any Reddit user by username.',
      inputSchema: {
        username: z.string().describe('Reddit username, without the u/ prefix'),
      },
    },
    guard(async ({ username }) => {
      const name = username.replace(/^u\//i, '');
      const thing = await client.get<RedditThing>(`/user/${name}/about`);
      return ok(formatMe(thing.data ?? {}));
    })
  );
}
