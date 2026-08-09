# @thebushidocollective/mcp-server-reddit

An MCP server for Reddit that reads **your own account**, not just the public
firehose: saved posts and comments, profile, vote history, subscriptions, and
inbox, plus the public read tools.

Built for the [Han](https://han.guru) `reddit` plugin, and usable standalone.

## Why

Most Reddit MCP servers only read public data. If you use Reddit's save button
as a reading list, that archive is the part worth querying, and Reddit provides
no search over it. This server pages your saved history and matches locally, so
"what did I save about connection pooling" is answerable.

## Install

```bash
npx -y @thebushidocollective/mcp-server-reddit
```

Requires Node.js 20 or newer.

### Claude Code

```json
{
  "mcpServers": {
    "reddit": {
      "command": "npx",
      "args": ["-y", "@thebushidocollective/mcp-server-reddit@latest"],
      "env": {
        "REDDIT_CLIENT_ID": "${REDDIT_CLIENT_ID}",
        "REDDIT_CLIENT_SECRET": "${REDDIT_CLIENT_SECRET}",
        "REDDIT_REFRESH_TOKEN": "${REDDIT_REFRESH_TOKEN}"
      }
    }
  }
}
```

## Configuration

Public tools need no configuration. For account access, create a **script** app
at <https://www.reddit.com/prefs/apps>, then set:

| Variable | Required | Purpose |
| --- | --- | --- |
| `REDDIT_CLIENT_ID` | for account access | App client id |
| `REDDIT_CLIENT_SECRET` | for account access | App secret |
| `REDDIT_REFRESH_TOKEN` | one of these two | Durable user grant, works with 2FA |
| `REDDIT_USERNAME` + `REDDIT_PASSWORD` | one of these two | Script app grant, no 2FA |
| `REDDIT_USER_AGENT` | no | Overrides the default user agent |

Scopes used: `identity`, `history`, `read`, `mysubreddits`, `privatemessages`.

### Auth modes

The server always starts and reports its mode on stderr.

| Mode | Trigger | Behavior |
| --- | --- | --- |
| `user` | client id plus a user grant | All tools |
| `app` | client id only | Public tools at app rate limits |
| `anonymous` | no credentials | Public tools |

In `app` and `anonymous` mode the account tools are still listed, and return
the exact setup steps rather than a bare failure. A missing credential should be
diagnosable, not invisible.

## Tools

**Account** (`user` mode): `get_me`, `get_saved`, `search_saved`,
`get_upvoted`, `get_downvoted`, `get_hidden`, `get_my_posts`,
`get_my_comments`, `get_subscribed_subreddits`, `get_inbox`,
`get_multireddits`.

**Public** (any mode): `get_frontpage_posts`, `get_subreddit_info`,
`get_subreddit_hot_posts`, `get_subreddit_new_posts`,
`get_subreddit_top_posts`, `get_subreddit_rising_posts`, `get_post_content`,
`get_post_comments`, `search_reddit`, `get_user_profile`.

Every tool is read only. There are no voting, posting, commenting, or saving
tools, so the server cannot modify a Reddit account.

### `search_saved`

Reddit has no server side search over saved items, so this tool pages saved
history (100 items per page, `max_pages` pages, default 10) and matches locally
across title, body, parent post title, subreddit, author, flair, and URL. Every
whitespace separated term must appear. It reports `scanned` and `matched` so a
miss is distinguishable from an incomplete scan.

## Responses

Reddit returns roughly a hundred fields per post; almost none help answer a
question and all of them cost context. Responses are normalized to compact
shapes with absolute permalinks, ISO timestamps, and bodies clamped to 1200
characters with a `truncated` flag.

## Development

```bash
npm install
npm run build
npm test          # requires bun
npm run typecheck
```

## License

Apache-2.0
