---
title: "Building a Full-Stack App with Han: A Real-World Journey"
description: "Follow along as we build a production-ready Next.js application using Han plugins for automated quality enforcement and specialized development workflows."
date: "2025-01-10"
author: "The Bushido Collective"
tags: ["nextjs", "react", "typescript", "full-stack", "tutorial"]
category: "Tutorial"
---

Let's build a real application—a task management SaaS—and see how Han plugins transform the development experience from "hoping it works" to "knowing it works."

## The Stack

We're building with:

- **Next.js 14** (App Router)
- **TypeScript** (strict mode)
- **Tailwind CSS** (styling)
- **Prisma** (database)
- **Playwright** (E2E tests)

## Setting Up Han Plugins

First, let's install the plugins we need:

```bash
# Core infrastructure
npx @thebushidocollective/han plugin install core
npx @thebushidocollective/han plugin install bushido

# Technology skills
npx @thebushidocollective/han plugin install jutsu-nextjs
npx @thebushidocollective/han plugin install jutsu-typescript
npx @thebushidocollective/han plugin install jutsu-tailwind
npx @thebushidocollective/han plugin install jutsu-playwright

# Development agents
npx @thebushidocollective/han plugin install do-frontend-development
npx @thebushidocollective/han plugin install do-quality-assurance
```

Now Claude Code has deep expertise in our entire stack, plus agents specialized for different aspects of development.

## Phase 1: Authentication Flow

Let's start with user authentication. Instead of just asking "add authentication," we can leverage Han's specialized workflows:

```
/bushido:develop Implement user authentication with NextAuth.js
```

The `develop` command runs a comprehensive 7-phase workflow:

### Phase 1: Planning

Claude uses its Next.js and TypeScript skills to create a detailed plan:

```markdown
## Implementation Plan

1. **Setup NextAuth.js**
   - Install dependencies
   - Configure providers (GitHub, Email)
   - Setup session handling

2. **Database Schema**
   - User, Account, Session tables (Prisma)
   - Migrations

3. **Protected Routes**
   - Middleware for authentication
   - Client-side session checks

4. **UI Components**
   - Login page
   - Sign-out button
   - Protected dashboard
```

### Phase 2-4: Implementation

Claude implements each part, guided by the Next.js and TypeScript skills:

- Type-safe API routes
- Server-side session validation
- Client components with proper hooks usage

### Phase 5: Quality Enforcement

Here's where Han really shines. After implementation, the hooks automatically run:

```bash
✓ TypeScript compilation - No errors
✓ Tailwind classes validated - All valid
✓ Next.js build - Success
✓ Playwright tests - 12/12 passed
```

Every hook passed. We know the authentication works before we even review the code.

### Phase 6: Code Review

Claude uses Bushido's code review principles to analyze its own work:

```markdown
## Code Review Findings

✅ **Security**: CSRF tokens properly configured
✅ **Type Safety**: All API routes fully typed
✅ **Error Handling**: Proper error boundaries
⚠️  **Accessibility**: Login form needs ARIA labels

Recommendation: Add aria-label to email input
```

Claude identifies and fixes the accessibility issue immediately.

### Phase 7: Documentation

```typescript
/**
 * Authentication middleware for Next.js App Router
 *
 * @description Protects routes by redirecting unauthenticated users to login
 * @example
 * ```ts
 * // middleware.ts
 * export { middleware } from '@/lib/auth-middleware'
 * export const config = { matcher: ['/dashboard/:path*'] }
 * ```
 */
export async function middleware(request: NextRequest) {
  // Implementation...
}
```

## Phase 2: Task Management UI

Now let's build the core functionality:

```
Use do-frontend-development to create a task board with drag-and-drop
```

The `do-frontend-development` agent specializes in UI/UX:

```typescript
// Claude creates a beautiful, accessible task board
import { DndContext, DragEndEvent } from '@dnd-kit/core'

export function TaskBoard({ tasks }: TaskBoardProps) {
  const [columns, setColumns] = useState<ColumnState>(/* ... */)

  // Proper keyboard navigation
  // ARIA attributes for screen readers
  // Optimistic updates for smooth UX
  // Loading states
  // Error boundaries
}
```

The Tailwind plugin ensures:

- Consistent design tokens
- Responsive breakpoints
- Dark mode support
- No unused classes

## Phase 3: E2E Testing

```
Use do-quality-assurance to add comprehensive E2E tests
```

The QA agent uses the Playwright plugin to create thorough tests:

```typescript
// tests/auth-flow.spec.ts
test.describe('Authentication Flow', () => {
  test('should login successfully with GitHub', async ({ page }) => {
    await page.goto('/login')
    await page.click('[data-testid="github-login"]')

    // Mock OAuth flow
    await page.route('**/api/auth/callback/github', /* ... */)

    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByRole('heading', { name: /dashboard/i }))
      .toBeVisible()
  })

  test('should protect dashboard when not authenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/login')
  })
})
```

Run the tests:

```bash
✓ tests/auth-flow.spec.ts - 8/8 passed
✓ tests/task-board.spec.ts - 15/15 passed
✓ tests/api.spec.ts - 12/12 passed
```

## The Results

After 2 hours of development (yes, really), we have:

- ✅ Complete authentication system
- ✅ Drag-and-drop task board
- ✅ 100% TypeScript coverage
- ✅ 35 passing E2E tests
- ✅ Fully accessible UI
- ✅ Dark mode support
- ✅ Production-ready error handling

## The Han Difference

Without Han, you'd be:

- Manually running type checks
- Hoping you remembered all the edge cases
- Writing tests after the fact (maybe)
- Googling Next.js best practices
- Debugging accessibility issues in production

With Han:

- Type errors caught immediately
- Edge cases handled by specialized agents
- Tests written alongside features
- Best practices enforced automatically
- Accessibility verified before commit

## Try It Yourself

Want to build something similar? Here's your starter setup:

```bash
# Create Next.js app
npx create-next-app@latest my-app --typescript --tailwind --app

# Install Han plugins
cd my-app
npx @thebushidocollective/han plugin install --auto

# Start developing
claude
```

Then just ask Claude to build features. Han handles the quality.

## Next Steps

In our next post, we'll add:

- Real-time collaboration (WebSockets)
- File uploads (with validation)
- Email notifications
- Stripe integration

All with the same confidence and speed.

---

*Want to explore the plugins used in this tutorial? Check out [jutsu-nextjs](/plugins/jutsu/jutsu-nextjs), [jutsu-playwright](/plugins/jutsu/jutsu-playwright), and [do-frontend-development](/plugins/do/do-frontend-development).*
