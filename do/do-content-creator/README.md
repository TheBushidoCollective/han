# do-content-creator (道)

> **道** (dō) - "the way" or "discipline"

Specialized agents for creating engaging content across various formats and target audiences. These agents embody the discipline of effective communication, storytelling, and audience engagement.

## Overview

The `do-content-creator` plugin provides expert writing agents that help you create compelling content optimized for different platforms, formats, and objectives. Each agent is specialized in a specific content discipline with deep knowledge of best practices, formulas, and proven techniques.

## Available Agents

### blog-writer

Expert at writing engaging blog posts with SEO optimization, compelling narratives, and audience-focused content.

**Use for**:

- Company blog posts
- Educational articles
- SEO-optimized content
- Thought leadership pieces
- How-to guides and tutorials

**Key capabilities**:

- SEO best practices (keywords, meta descriptions, structure)
- Multiple content types (how-to, listicles, case studies, guides)
- Engagement techniques (storytelling, questions, data)
- Blog post templates and frameworks
- Quality checklist and common pitfall avoidance

**Example usage**:

```
Write a blog post about migrating from REST to GraphQL APIs, targeting senior backend developers
```

### social-media-writer

Expert at crafting engaging, platform-optimized social media content that drives engagement, builds community, and achieves marketing goals.

**Use for**:

- Twitter/X threads and posts
- LinkedIn thought leadership
- Instagram captions and Stories
- TikTok scripts
- Facebook community posts

**Key capabilities**:

- Platform-specific optimization (character limits, format, tone)
- Hook formulas that stop the scroll
- Engagement mechanics (comments, shares, saves)
- Hashtag strategy
- Content calendar planning

**Example usage**:

```
Create a LinkedIn post about our new product launch that builds authority and drives clicks
```

### technical-writer

Expert at creating clear, comprehensive technical documentation including API docs, user guides, tutorials, and developer documentation.

**Use for**:

- API documentation and references
- User guides and how-tos
- Developer tutorials
- README files
- Concept explanations
- Knowledge base articles

**Key capabilities**:

- Multiple documentation types (API, guides, tutorials, READMEs)
- Code examples in multiple languages
- Clear structure and navigation
- Accuracy and completeness
- Troubleshooting sections

**Example usage**:

```
Write API documentation for our new REST endpoints with examples in JavaScript, Python, and Go
```

### copywriter

Expert at writing persuasive marketing copy that converts, including landing pages, ad copy, email campaigns, and sales materials.

**Use for**:

- Landing pages
- PPC and social ad copy
- Email marketing campaigns
- Sales pages
- Product descriptions
- Marketing materials

**Key capabilities**:

- Conversion-focused copywriting formulas (PAS, AIDA, Before-After-Bridge)
- Persuasion principles (social proof, scarcity, authority)
- Multiple copy types (landing pages, ads, emails, sales pages)
- A/B testing frameworks
- Industry-specific optimization (B2B, B2C, SaaS, e-commerce)

**Example usage**:

```
Write a landing page for our SaaS product targeting small business owners focused on time-savings
```

### newsletter-writer

Expert at creating engaging email newsletters that build relationships, provide value, and drive reader action through compelling storytelling and strategic content.

**Use for**:

- Regular email newsletters
- Educational email series
- Company updates
- Personal brand building
- Curated content roundups
- Community digests

**Key capabilities**:

- Multiple newsletter formats (educational, curated, story-driven, company, personal)
- Subject lines that get opens
- Engagement tactics (replies, clicks, community building)
- Content planning and calendars
- Welcome and re-engagement sequences

**Example usage**:

```
Write a weekly newsletter for our developer community highlighting new features and sharing coding tips
```

## Installation

This plugin is part of the Han marketplace and can be installed via:

```bash
npx @thebushidocollective/han install
```

Or manually add to your `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": [
    "https://github.com/thebushidocollective/han"
  ],
  "enabledPlugins": [
    "do-content-creator": true
  ]
}
```

## How to Use

Once installed, you can invoke any agent in your conversations with Claude Code:

```
/skill do-content-creator:blog-writer

Write a comprehensive blog post about the benefits of test-driven development
for developers new to the practice
```

Or reference them directly in your prompts:

```
Using the copywriter agent, create a compelling landing page for our new
mobile app focused on productivity
```

## When to Use Each Agent

### Choose `blog-writer` when

- Creating long-form educational content
- Need SEO optimization
- Building thought leadership
- Writing how-to guides or tutorials

### Choose `social-media-writer` when

- Creating platform-specific content
- Need to drive engagement (likes, shares, comments)
- Building social media presence
- Crafting viral-worthy content

### Choose `technical-writer` when

- Documenting APIs or codebases
- Writing developer-focused content
- Creating user guides or manuals
- Need clarity and technical accuracy

### Choose `copywriter` when

- Focused on conversions and sales
- Writing marketing materials
- Creating ads or landing pages
- Need persuasive, action-driving copy

### Choose `newsletter-writer` when

- Building email subscriber relationships
- Creating regular email communications
- Nurturing leads through email
- Building personal or company brand via email

## Best Practices

### 1. Be Specific About Audience

```
❌ Write a blog post about our product
✅ Write a blog post about our project management tool for remote engineering teams
```

### 2. Provide Context

```
❌ Create a LinkedIn post
✅ Create a LinkedIn post announcing our Series A funding, targeting potential customers
   and celebrating with our community
```

### 3. Specify Format and Constraints

```
❌ Write some social content
✅ Write 5 Twitter thread hooks (max 280 chars each) about common API design mistakes
```

### 4. Include Brand Voice Guidelines

```
Include brand voice:
- Professional but approachable
- Use "we" not "I"
- Avoid jargon
- Emphasize developer empowerment
```

### 5. Combine Agents for Campaigns

```
1. Use copywriter to create landing page
2. Use social-media-writer for launch announcement posts
3. Use newsletter-writer for email announcement
4. Use blog-writer for detailed feature explanation
```

## Philosophy

The `do-content-creator` agents embody the **discipline of effective communication**:

- **Audience-First**: Every piece of content serves the reader, not just the writer
- **Clarity Over Cleverness**: Clear communication trumps creative flourishes
- **Value-Driven**: Respect the audience's time by delivering genuine value
- **Platform-Aware**: Optimize for the medium and where attention lives
- **Authentic Voice**: Build trust through genuine, consistent communication
- **Measurable Impact**: Focus on outcomes (engagement, conversions, understanding)

## Examples

### Blog Post Example

**Prompt**:

```
Write a blog post about GraphQL schema design best practices for backend developers
who are familiar with REST APIs
```

**Result**: Comprehensive blog post with:

- SEO-optimized headline and meta description
- Hook addressing REST developers
- Clear structure with problem/solution
- Code examples comparing REST and GraphQL
- Practical tips and common pitfalls
- Call-to-action and next steps

### Social Media Example

**Prompt**:

```
Create a Twitter thread (5-7 tweets) about why we're migrating from microservices
back to a monolith, positioning it as a pragmatic engineering decision
```

**Result**: Twitter thread with:

- Hook tweet that stops the scroll
- Story of why microservices became problematic
- Pragmatic reasoning for monolith decision
- Lessons learned
- Invitation to discuss

### Technical Documentation Example

**Prompt**:

```
Write API documentation for our new webhooks feature, including setup, payload
structure, and error handling
```

**Result**: Complete API docs with:

- Overview and use cases
- Authentication requirements
- Webhook registration endpoints
- Payload examples with full JSON
- Error codes and handling
- Code examples in multiple languages

## Contributing

We welcome contributions! To add new agents or improve existing ones:

1. Create a new agent markdown file in `agents/`
2. Follow the existing agent structure (frontmatter + comprehensive content)
3. Include real examples and actionable guidance
4. Submit a pull request

## License

MIT

## Support

Part of [The Bushido Collective](https://thebushido.co) - Building better software through discipline and craftsmanship.

For issues or suggestions: [GitHub Issues](https://github.com/thebushidocollective/sensei/issues)
