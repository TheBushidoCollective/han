# Hashi: Reddit

MCP server integration for Reddit, enabling Claude Code to fetch frontpage posts, subreddit information, hot/new/top/rising posts, post content, and comments directly from Reddit's public API.

## What This Hashi Provides

### MCP Server: reddit

This hashi connects Claude Code to Reddit and provides read-only access to Reddit content:

- **Frontpage Posts**: Fetch hot posts from Reddit's frontpage
- **Subreddit Information**: Get details about any subreddit
- **Post Listings**: Retrieve hot, new, top, and rising posts from subreddits
- **Post Content**: Get detailed content of specific posts
- **Comments**: Fetch comments from any post with configurable depth

### Available Tools

Once installed, Claude Code gains access to these tools:

- `get_frontpage_posts`: Get hot posts from Reddit frontpage
- `get_subreddit_info`: Get information about a subreddit
- `get_subreddit_hot_posts`: Get hot posts from a specific subreddit
- `get_subreddit_new_posts`: Get new posts from a specific subreddit
- `get_subreddit_top_posts`: Get top posts from a specific subreddit
- `get_subreddit_rising_posts`: Get rising posts from a specific subreddit
- `get_post_content`: Get detailed content of a specific post
- `get_post_comments`: Get comments from a post

## Installation

### Prerequisites

- [uv](https://github.com/astral-sh/uv) (Astral's Python package manager)

Install uv if you don't have it:

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### Via Han Marketplace

```bash
han plugin install hashi-reddit
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install hashi-reddit@han
```

### Manual Installation

If not using Han, add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "reddit": {
      "command": "uvx",
      "args": ["mcp-server-reddit"]
    }
  }
}
```

## Usage

### Example 1: Check What's Popular on Reddit

```
User: What's trending on Reddit's frontpage right now?
Claude: [uses get_frontpage_posts tool to fetch current hot posts]
```

### Example 2: Research a Subreddit

```
User: Tell me about r/programming - what are the hot topics?
Claude: [uses get_subreddit_info and get_subreddit_hot_posts tools]
```

### Example 3: Deep Dive into a Post

```
User: I want to see what people are saying about post xyz123
Claude: [uses get_post_content and get_post_comments tools to fetch full discussion]
```

### Example 4: Find Top Posts of All Time

```
User: What are the top posts of all time on r/learnprogramming?
Claude: [uses get_subreddit_top_posts with time='all' parameter]
```

## Tool Reference

### `get_frontpage_posts`

**Purpose**: Get hot posts from Reddit frontpage

**Parameters**:

- `limit` (optional, 1-100, default: 10): Number of posts to return

### `get_subreddit_info`

**Purpose**: Get information about a subreddit

**Parameters**:

- `subreddit_name` (required): Name of the subreddit (without r/ prefix)

### `get_subreddit_hot_posts`

**Purpose**: Get hot posts from a specific subreddit

**Parameters**:

- `subreddit_name` (required): Name of the subreddit
- `limit` (optional, 1-100, default: 10): Number of posts to return

### `get_subreddit_new_posts`

**Purpose**: Get new posts from a specific subreddit

**Parameters**:

- `subreddit_name` (required): Name of the subreddit
- `limit` (optional, 1-100, default: 10): Number of posts to return

### `get_subreddit_top_posts`

**Purpose**: Get top posts from a specific subreddit

**Parameters**:

- `subreddit_name` (required): Name of the subreddit
- `limit` (optional, 1-100, default: 10): Number of posts to return
- `time` (optional): Time filter - 'hour', 'day', 'week', 'month', 'year', 'all'

### `get_subreddit_rising_posts`

**Purpose**: Get rising posts from a specific subreddit

**Parameters**:

- `subreddit_name` (required): Name of the subreddit
- `limit` (optional, 1-100, default: 10): Number of posts to return

### `get_post_content`

**Purpose**: Get detailed content of a specific post

**Parameters**:

- `post_id` (required): Reddit post ID
- `comment_limit` (optional, 1-100, default: 10): Number of comments to include
- `comment_depth` (optional, 1-10, default: 3): Depth of comment replies

### `get_post_comments`

**Purpose**: Get comments from a post

**Parameters**:

- `post_id` (required): Reddit post ID
- `limit` (optional, 1-100, default: 10): Number of comments to return

## Use Cases

- **Research**: Gather community perspectives on topics
- **Trend Analysis**: Monitor what's popular in specific subreddits
- **Community Feedback**: Understand discussions around products or technologies
- **Content Discovery**: Find relevant posts and discussions
- **Sentiment Analysis**: Analyze comments on specific topics

## Limitations

- **Read-only**: This MCP server only provides read access to Reddit
- **Public Content Only**: Can only access publicly available posts and comments
- **No Authentication**: Uses Reddit's public API without authentication
- **Rate Limits**: Subject to Reddit's API rate limits

## Troubleshooting

### Issue: uvx command not found

**Solution**: Install uv following the prerequisites section above.

### Issue: Connection errors

**Solution**: Verify you have internet access and Reddit is reachable. The MCP server uses the redditwarp library which accesses Reddit's public API.

### Issue: Empty responses

**Solution**: Some subreddits may be private or have restrictions. Try with a popular public subreddit like r/programming.

## Related Plugins

- **hashi-github**: GitHub repository integration
- **do-content-creator**: Content creation agents that could use Reddit research
