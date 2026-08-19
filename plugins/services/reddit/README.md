# Reddit

Connect Claude Code to Reddit through a hosted MCP server that signs in as you, so the assistant can read your account surface (saved, upvoted, history, inbox, subscriptions) alongside the public site.

**OAuth Enabled**: Sign in to Reddit once in the browser on first use. Nothing to install, no API keys to manage, no Reddit credentials on your machine.

## What This Plugin Provides

### MCP Server: reddit

The plugin is a pointer at [thebushidocollective/reddit-mcp](https://github.com/thebushidocollective/reddit-mcp), a remote HTTP MCP server. Earlier versions ran a local Python process against Reddit's public API, which meant it could read all of Reddit except the parts that are actually yours. This version authenticates, so the account surface is available:

- **Your Account**: saved items, upvotes, downvotes, hidden posts, your posts and comments, inbox, subscriptions, multireddits
- **Frontpage**: hot posts from your logged-in frontpage
- **Subreddits**: info plus hot, new, top, and rising listings
- **Posts and Comments**: full post content and comment trees
- **Search**: search across Reddit, and search your own saved items
- **Users**: public profile for any user

## Available Tools

### Your Account

- `get_me`: the signed-in account's profile
- `get_saved`: saved posts and comments
- `search_saved`: search within saved items
- `get_upvoted`: upvoted posts
- `get_downvoted`: downvoted posts
- `get_hidden`: hidden posts
- `get_my_posts`: posts you submitted
- `get_my_comments`: comments you wrote
- `get_subscribed_subreddits`: subreddits you subscribe to
- `get_inbox`: inbox messages and replies
- `get_multireddits`: your multireddits

### Public Reddit

- `get_frontpage_posts`: hot posts from the frontpage
- `get_subreddit_info`: information about a subreddit
- `get_subreddit_hot_posts`: hot posts in a subreddit
- `get_subreddit_new_posts`: new posts in a subreddit
- `get_subreddit_rising_posts`: rising posts in a subreddit
- `get_subreddit_top_posts`: top posts in a subreddit
- `get_post_content`: full content of a post
- `get_post_comments`: comments on a post
- `search_reddit`: search posts across Reddit or within a subreddit
- `get_user_profile`: public profile for a user

Parameters for each tool are documented in the [server repository](https://github.com/thebushidocollective/reddit-mcp), which is the source of truth as tools evolve.

## Installation

```bash
han plugin install reddit
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install reddit@han
```

If not using Han, add the remote server to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "reddit": {
      "type": "http",
      "url": "https://reddit-mcp-n5sjtdvmca-uc.a.run.app/mcp"
    }
  }
}
```

There is no prerequisite to install. Previous versions required [uv](https://github.com/astral-sh/uv) and Python to run `uvx mcp-server-reddit`; that dependency is gone.

## Authentication

1. Install the plugin and use any Reddit tool.
2. Your client opens the server's authorization page in the browser.
3. Sign in to Reddit and approve the read scopes.
4. The browser returns to your client and tools start working.

Your Reddit credentials never touch this machine. You type them into Reddit, Reddit hands the server a token for your account, and the server holds it. Your client stores only a token for the MCP server itself, which you can drop by signing out in the client. To cut the server off entirely, revoke its access from the authorized applications list in your Reddit account settings.

## Read Only

Every tool reads. There is no voting, posting, commenting, saving, subscribing, or messaging, and this is structural rather than a matter of convention: the server's Reddit client exposes only GET operations, so no tool can write even by accident.

## Usage

### Example 1: Mine Your Own Saved Items

```
User: What did I save about Postgres indexing?
Claude: [uses search_saved to search your saved posts and comments]
```

### Example 2: Catch Up on Subscriptions

```
User: What's happening in the subreddits I follow?
Claude: [uses get_subscribed_subreddits, then get_subreddit_hot_posts for each]
```

### Example 3: Check Your Inbox

```
User: Did anyone reply to my comment on that thread?
Claude: [uses get_inbox to read replies]
```

### Example 4: Research a Subreddit

```
User: Tell me about r/programming - what are the hot topics?
Claude: [uses get_subreddit_info and get_subreddit_hot_posts]
```

### Example 5: Deep Dive into a Post

```
User: What are people saying about this thread?
Claude: [uses get_post_content and get_post_comments to read the discussion]
```

## Use Cases

- **Personal Recall**: search the things you saved instead of trying to remember where you saw them
- **Research**: gather community perspectives on a topic
- **Trend Analysis**: monitor what is popular in specific subreddits
- **Community Feedback**: understand discussions around products or technologies
- **Sentiment Analysis**: read comments on specific topics

## Limitations

- **Read-only**: no writes of any kind
- **Your Visibility**: account tools return what your Reddit account can see, so private subreddits you do not belong to stay invisible
- **Rate Limits**: subject to Reddit's API rate limits

## Troubleshooting

### Issue: Tools return an authentication error

**Solution**: Re-run the sign-in flow from your client's MCP authentication command. Tokens expire, and revoking the app in Reddit's settings invalidates the server's copy immediately.

### Issue: Account tools return nothing

**Solution**: Confirm you approved the read scopes during sign in, and that you are signed in as the account that owns the items. An empty saved list is a valid answer.

### Issue: Connection errors

**Solution**: Check that `https://reddit-mcp-n5sjtdvmca-uc.a.run.app/health` responds. If it does and tools still fail, open an issue on the [server repository](https://github.com/thebushidocollective/reddit-mcp).

## Related Plugins

- **github**: GitHub repository integration
