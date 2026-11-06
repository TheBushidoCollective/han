# Nextjs

Advanced Next.js skills for App Router, Server Components, and data fetching.

## Skills

This plugin provides the following skills:

- **Nextjs App Router**
- **Nextjs Data Fetching**
- **Nextjs Server Components**

## Usage

Once enabled, Claude will automatically apply these skills when working with relevant code. The plugin provides context and expertise that Claude uses to:

- Write idiomatic code following best practices
- Suggest appropriate patterns and architectures
- Catch common mistakes and anti-patterns
- Provide framework-specific guidance

## Lint hook

On Stop, the plugin runs `npm run lint` in each project that declares `next`
in `dependencies` or `devDependencies` and has an `app`, `pages`, `src/app`,
or `src/pages` directory, or a `next.config.js`, `.mjs`, or `.ts` file.
The project's lint script selects its linter and should check without modifying
files. A missing or failing script fails the hook. Projects previously relying
on the implicit `next lint` command must add a lint script or configure a Han
command override.

## Installation

Install via the han CLI:

```bash
han plugin install nextjs
```
