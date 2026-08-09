# Reddit

MCP server integration for Reddit. With a Reddit app configured it reaches
**your own account**: saved posts and comments, profile, vote history,
subscriptions, and inbox. Without one it still serves the public read tools.

## What This Plugin Provides

### MCP Server: reddit

Backed by `@thebushidocollective/mcp-server-reddit`.

**Your account** (requires authentication):

- **Saved items**: everything you saved to follow up on, posts and comments
- **Saved search**: keyword search across your saved archive, which Reddit
  itself does not offer
- **Profile**: username, karma, account age
- **History**: your posts, your comments, upvoted, downvoted, hidden
- **Subscriptions**: the subreddits you follow
- **Inbox**: replies, mentions, and private messages, read only

**Public** (works with or without authentication):

- Frontpage posts, subreddit info, hot/new/top/rising listings
- Post content and comment threads
- Reddit-wide and per-subreddit search
- Any user's public profile

### Available Tools

| Tool | Auth | Purpose |
| --- | --- | --- |
| `get_me` | user | Your profile and karma |
| `get_saved` | user | Your saved posts and comments |
| `search_saved` | user | Keyword search across your saved archive |
| `get_upvoted` | user | Posts you upvoted |
| `get_downvoted` | user | Posts you downvoted |
| `get_hidden` | user | Posts you hid |
| `get_my_posts` | user | Posts you submitted |
| `get_my_comments` | user | Comments you wrote |
| `get_subscribed_subreddits` | user | Subreddits you follow |
| `get_inbox` | user | Replies, mentions, private messages |
| `get_multireddits` | user | Your multireddits |
| `get_frontpage_posts` | public | Hot posts from the frontpage |
| `get_subreddit_info` | public | Details about a subreddit |
| `get_subreddit_hot_posts` | public | Hot posts in a subreddit |
| `get_subreddit_new_posts` | public | New posts in a subreddit |
| `get_subreddit_top_posts` | public | Top posts, with a time filter |
| `get_subreddit_rising_posts` | public | Rising posts in a subreddit |
| `get_post_content` | public | A post plus its comments |
| `get_post_comments` | public | Comments on a post |
| `search_reddit` | public | Search posts, optionally in one subreddit |
| `get_user_profile` | public | Any user's public profile |

Every tool is read only. The server exposes no voting, posting, commenting, or
saving tools, so it cannot change anything in your Reddit account.

## Installation

```bash
han plugin install reddit
```

Or:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install reddit@han
```

Requires Node.js 20 or newer. The server is fetched on demand with `npx`, so
there is nothing to install separately.

## Configuration

Public tools work with no configuration at all. To reach your own account:

1. Go to <https://www.reddit.com/prefs/apps> and click **create another app**.
2. Choose **script**, give it any name, and set the redirect URI to
   `http://localhost:8080` (unused for the script flow).
3. Note the client id (the string under the app name) and the secret.

Then set:

```bash
export REDDIT_CLIENT_ID="your-client-id"
export REDDIT_CLIENT_SECRET="your-client-secret"
```

Plus **one** of the following.

**Refresh token** (preferred, survives password changes and works with 2FA):

```bash
export REDDIT_REFRESH_TOKEN="your-refresh-token"
```

**Script app login** (simplest, but does not work on accounts with 2FA):

```bash
export REDDIT_USERNAME="your-username"
export REDDIT_PASSWORD="your-password"
```

Optional:

```bash
export REDDIT_USER_AGENT="my-app/1.0 (by /u/yourname)"
```

Scopes used: `identity`, `history`, `read`, `mysubreddits`, `privatemessages`.

## Usage

### Find something you saved

```
User: What did I save about Postgres connection pooling?
Claude: [uses search_saved with query "postgres connection pooling"]
```

### Review the backlog

```
User: Show me the last 20 things I saved on Reddit.
Claude: [uses get_saved]
```

### Narrow by subreddit

```
User: What have I saved from r/rust?
Claude: [uses get_saved with subreddit "rust"]
```

### Still works for public research

```
User: What's hot in r/programming today?
Claude: [uses get_subreddit_hot_posts]
```

## Modes

The server starts in one of three modes and reports which on stderr:

| Mode | Trigger | Behavior |
| --- | --- | --- |
| `user` | client id plus refresh token, or client id plus username and password | All tools |
| `app` | client id only | Public tools at app rate limits; account tools explain the missing setup |
| `anonymous` | no credentials | Public tools; account tools explain the missing setup |

Account tools never fail silently. When the server is not signed in they return
the exact environment variables to set and where to get them.

## Migrating from 1.x

Version 1.x ran `uvx mcp-server-reddit`, which was public and unauthenticated.
Version 2.x replaces it with an authenticated server and:

- Keeps all eight previous tool names and their parameters, so existing prompts
  and memory providers continue to work.
- Drops the `uv` and Python prerequisite in favor of Node.
- Adds the account tools listed above.

## Troubleshooting

**Account tools say authentication is missing.** The server only sees
environment variables present in the Claude Code process. Export them in the
shell that launches Claude Code, or set them in your Claude Code settings.

**HTTP 401 from Reddit.** The client id and secret are mismatched, or the
password grant is being used on an account with 2FA enabled. Use a refresh
token instead.

**HTTP 403 from Reddit.** Reddit blocks unauthenticated traffic from many
datacenter and VPN addresses. Configuring credentials usually resolves it.

**Empty saved results.** `get_saved` only sees the account the credentials
belong to. Confirm with `get_me` that it is the account you expect.

## Related Plugins

- **github**: GitHub repository integration
