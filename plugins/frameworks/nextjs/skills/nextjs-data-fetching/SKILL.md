---
name: nextjs-data-fetching
user-invocable: false
description: Use when next.js data fetching patterns including SSG, SSR, and ISR. Use when building data-driven Next.js applications.
allowed-tools:
  - Bash
  - Read
---

# Next.js Data Fetching

Master data fetching in Next.js with static generation, server-side
rendering, and incremental static regeneration.

## Fetch with Caching Strategies

```typescript
// Default: 'force-cache' (similar to SSG)
export default async function Page() {
  const data = await fetch('https://api.example.com/data');
  const json = await data.json();

  return <div>{json.title}</div>;
}

// No caching: 'no-store' (similar to SSR)
export default async function DynamicPage() {
  const data = await fetch('https://api.example.com/data', {
    cache: 'no-store'
  });
  const json = await data.json();

  return <div>{json.title}</div>;
}

// Revalidate every 60 seconds (ISR)
export default async function RevalidatedPage() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 60 }
  });
  const json = await data.json();

  return <div>{json.title}</div>;
}

// Per-route caching config
export const revalidate = 3600; // Revalidate every hour

export default async function Page() {
  const data = await fetch('https://api.example.com/data');
  return <div>{data.title}</div>;
}

// Dynamic rendering
export const dynamic = 'force-dynamic'; // Equivalent to cache: 'no-store'
export const dynamic = 'force-static';  // Equivalent to cache: 'force-cache'
export const dynamic = 'error';         // Error if dynamic functions used
export const dynamic = 'auto';          // Default behavior
```

## Static Generation with generateStaticParams

```typescript
// app/posts/[id]/page.tsx
interface Post {
  id: string;
  title: string;
  content: string;
}

// Generate static paths at build time
export async function generateStaticParams() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());

  return posts.map((post: Post) => ({
    id: post.id.toString()
  }));
}

export default async function Post({ params }: { params: { id: string } }) {
  const post = await fetch(`https://api.example.com/posts/${params.id}`, {
    next: { revalidate: 3600 } // Revalidate hourly
  }).then(r => r.json());

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  );
}

// Multiple dynamic segments
// app/shop/[category]/[product]/page.tsx
export async function generateStaticParams() {
  const categories = await getCategories();

  const paths = await Promise.all(
    categories.map(async (category) => {
      const products = await getProducts(category.slug);
      return products.map((product) => ({
        category: category.slug,
        product: product.slug
      }));
    })
  );

  return paths.flat();
}

export default async function Product({
  params
}: {
  params: { category: string; product: string }
}) {
  const product = await getProduct(params.category, params.product);

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
    </div>
  );
}

// Limit static generation for large datasets
export const dynamicParams = true; // Default: generate on-demand
export const dynamicParams = false; // Return 404 for ungenerated paths

export async function generateStaticParams() {
  // Only generate top 100 posts at build time
  const posts = await getPosts({ limit: 100 });

  return posts.map((post) => ({
    id: post.id
  }));
}
```

## Time-Based Revalidation (ISR)

```typescript
// Page-level revalidation
export const revalidate = 60; // Revalidate every 60 seconds

export default async function Page() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());

  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
        </article>
      ))}
    </div>
  );
}

// Per-request revalidation
export default async function Page() {
  const staticData = await fetch('https://api.example.com/static', {
    next: { revalidate: 3600 } // Cache for 1 hour
  }).then(r => r.json());

  const dynamicData = await fetch('https://api.example.com/dynamic', {
    next: { revalidate: 10 } // Cache for 10 seconds
  }).then(r => r.json());

  return (
    <div>
      <div>Static: {staticData.value}</div>
      <div>Dynamic: {dynamicData.value}</div>
    </div>
  );
}

// Mixed caching strategies
export default async function Dashboard() {
  // Never cache (always fresh)
  const liveData = await fetch('https://api.example.com/live', {
    cache: 'no-store'
  }).then(r => r.json());

  // Cache indefinitely (build-time only)
  const staticData = await fetch('https://api.example.com/static', {
    cache: 'force-cache'
  }).then(r => r.json());

  // Revalidate periodically
  const periodicData = await fetch('https://api.example.com/periodic', {
    next: { revalidate: 300 }
  }).then(r => r.json());

  return (
    <div>
      <LiveStats data={liveData} />
      <StaticContent data={staticData} />
      <PeriodicUpdates data={periodicData} />
    </div>
  );
}
```

## On-Demand Revalidation

```typescript
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');

  // Verify secret token
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  const path = request.nextUrl.searchParams.get('path');

  if (path) {
    // Revalidate specific path
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  }

  return NextResponse.json({ error: 'Missing path' }, { status: 400 });
}

// app/posts/[slug]/page.tsx - Using cache tags
export default async function Post({ params }: { params: { slug: string } }) {
  const post = await fetch(`https://api.example.com/posts/${params.slug}`, {
    next: { tags: ['posts', `post-${params.slug}`] }
  }).then(r => r.json());

  return <article>{post.content}</article>;
}

// app/api/revalidate-tag/route.ts
export async function POST(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag');

  if (tag) {
    revalidateTag(tag);
    return NextResponse.json({ revalidated: true, tag });
  }

  return NextResponse.json({ error: 'Missing tag' }, { status: 400 });
}

// Server Action for revalidation
'use server';
import { revalidatePath } from 'next/cache';

export async function updatePost(id: string, data: FormData) {
  await db.post.update({ where: { id }, data });

  // Revalidate the post page
  revalidatePath(`/posts/${id}`);

  // Revalidate the posts list
  revalidatePath('/posts');
}
```

## Parallel Data Fetching

```typescript
// Fetch multiple resources in parallel
export default async function Page() {
  const [posts, categories, tags] = await Promise.all([
    fetch('https://api.example.com/posts').then(r => r.json()),
    fetch('https://api.example.com/categories').then(r => r.json()),
    fetch('https://api.example.com/tags').then(r => r.json())
  ]);

  return (
    <div>
      <PostList posts={posts} />
      <CategoryList categories={categories} />
      <TagCloud tags={tags} />
    </div>
  );
}

// Parallel fetching with different cache strategies
export default async function Dashboard() {
  const [stats, recentActivity, settings] = await Promise.all([
    fetch('https://api.example.com/stats', {
      next: { revalidate: 60 }
    }).then(r => r.json()),

    fetch('https://api.example.com/activity', {
      cache: 'no-store'
    }).then(r => r.json()),

    fetch('https://api.example.com/settings', {
      cache: 'force-cache'
    }).then(r => r.json())
  ]);

  return (
    <div>
      <Stats data={stats} />
      <Activity data={recentActivity} />
      <Settings data={settings} />
    </div>
  );
}

// Fetching with fallbacks
export default async function Page() {
  const results = await Promise.allSettled([
    fetch('https://api.example.com/required').then(r => r.json()),
    fetch('https://api.example.com/optional1').then(r => r.json()),
    fetch('https://api.example.com/optional2').then(r => r.json())
  ]);

  const [required, optional1, optional2] = results;

  return (
    <div>
      {required.status === 'fulfilled' && <Required data={required.value} />}
      {optional1.status === 'fulfilled' && <Optional1 data={optional1.value} />}
      {optional2.status === 'fulfilled' && <Optional2 data={optional2.value} />}
    </div>
  );
}
```

## Streaming and Suspense

```typescript
// app/posts/page.tsx
import { Suspense } from 'react';

export default function PostsPage() {
  return (
    <div>
      <h1>Blog Posts</h1>

      {/* Stream featured posts */}
      <Suspense fallback={<FeaturedSkeleton />}>
        <FeaturedPosts />
      </Suspense>

      {/* Stream all posts */}
      <Suspense fallback={<PostsSkeleton />}>
        <AllPosts />
      </Suspense>

      {/* Stream comments */}
      <Suspense fallback={<CommentsSkeleton />}>
        <RecentComments />
      </Suspense>
    </div>
  );
}

async function FeaturedPosts() {
  const posts = await fetch('https://api.example.com/posts/featured', {
    next: { revalidate: 300 }
  }).then(r => r.json());

  return (
    <div className="featured">
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

async function AllPosts() {
  const posts = await fetch('https://api.example.com/posts', {
    next: { revalidate: 60 }
  }).then(r => r.json());

  return (
    <div className="posts">
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

async function RecentComments() {
  const comments = await fetch('https://api.example.com/comments/recent', {
    cache: 'no-store'
  }).then(r => r.json());

  return (
    <div className="comments">
      {comments.map(comment => (
        <Comment key={comment.id} comment={comment} />
      ))}
    </div>
  );
}
```

## Loading States

```typescript
// app/posts/loading.tsx
export default function Loading() {
  return (
    <div className="loading">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-text" />
      <div className="skeleton skeleton-text" />
      <div className="skeleton skeleton-text" />
    </div>
  );
}

// Custom loading component with Suspense
export default function Page() {
  return (
    <div>
      <Suspense fallback={<CustomLoading message="Loading posts..." />}>
        <Posts />
      </Suspense>

      <Suspense fallback={<CustomLoading message="Loading comments..." />}>
        <Comments />
      </Suspense>
    </div>
  );
}

function CustomLoading({ message }: { message: string }) {
  return (
    <div className="custom-loading">
      <Spinner />
      <p>{message}</p>
    </div>
  );
}

// Progressive enhancement with instant loading UI
export default function Page() {
  return (
    <div>
      {/* Shows immediately */}
      <InstantHeader />

      {/* Streams in as ready */}
      <Suspense fallback={<FastSkeleton />}>
        <FastContent />
      </Suspense>

      <Suspense fallback={<SlowSkeleton />}>
        <SlowContent />
      </Suspense>
    </div>
  );
}
```

## Error Handling

```typescript
// app/posts/error.tsx
'use client';

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error">
      <h2>Failed to load posts</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}

// Handling fetch errors
export default async function Page() {
  try {
    const data = await fetch('https://api.example.com/data', {
      next: { revalidate: 60 }
    });

    if (!data.ok) {
      throw new Error(`Failed to fetch: ${data.status}`);
    }

    const json = await data.json();

    return <Content data={json} />;
  } catch (error) {
    console.error('Fetch error:', error);
    return <ErrorFallback />;
  }
}

// Graceful degradation
export default async function Page() {
  let data;

  try {
    const res = await fetch('https://api.example.com/data');
    data = await res.json();
  } catch (error) {
    console.error('Failed to fetch data:', error);
    data = null;
  }

  return (
    <div>
      {data ? (
        <Content data={data} />
      ) : (
        <div>
          <p>Unable to load content</p>
          <StaticFallback />
        </div>
      )}
    </div>
  );
}

// Error boundaries with retry logic
'use client';
import { useState } from 'react';

export default function ErrorWithRetry({
  error,
  reset
}: {
  error: Error;
  reset: () => void;
}) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    reset();
    setRetrying(false);
  };

  return (
    <div>
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={handleRetry} disabled={retrying}>
        {retrying ? 'Retrying...' : 'Retry'}
      </button>
    </div>
  );
}
```

## Server Actions for Mutations

```typescript
// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  try {
    const res = await fetch('https://api.example.com/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });

    if (!res.ok) {
      throw new Error('Failed to create post');
    }

    const post = await res.json();

    // Revalidate the posts page
    revalidatePath('/posts');

    return { success: true, post };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function updatePost(id: string, formData: FormData) {
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  await fetch(`https://api.example.com/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content })
  });

  revalidatePath(`/posts/${id}`);
  revalidatePath('/posts');
}

export async function deletePost(id: string) {
  await fetch(`https://api.example.com/posts/${id}`, {
    method: 'DELETE'
  });

  revalidatePath('/posts');
}

// app/posts/new/page.tsx
import { createPost } from '../actions';

export default function NewPost() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="Title" required />
      <textarea name="content" placeholder="Content" required />
      <button type="submit">Create Post</button>
    </form>
  );
}

// With client-side validation
'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { createPost } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Creating...' : 'Create Post'}
    </button>
  );
}

export default function CreatePostForm() {
  const [state, formAction] = useFormState(createPost, null);

  return (
    <form action={formAction}>
      <input name="title" required />
      <textarea name="content" required />
      {state?.error && <p className="error">{state.error}</p>}
      {state?.success && <p className="success">Post created!</p>}
      <SubmitButton />
    </form>
  );
}
```

## Request Memoization

```typescript
// Automatic deduplication within a single render pass
async function getUser(id: string) {
  const res = await fetch(`https://api.example.com/users/${id}`);
  return res.json();
}

export default async function Page() {
  // These calls are automatically deduplicated
  const user1 = await getUser('1');
  const user2 = await getUser('1'); // Uses cached result
  const user3 = await getUser('1'); // Uses cached result

  return <div>{user1.name}</div>;
}

// Works across component boundaries
async function UserHeader() {
  const user = await getUser('1');
  return <header>{user.name}</header>;
}

async function UserProfile() {
  const user = await getUser('1'); // Same request, deduplicated
  return <div>{user.bio}</div>;
}

export default function Page() {
  return (
    <div>
      <UserHeader />
      <UserProfile />
    </div>
  );
}

// Manual caching with React cache
import { cache } from 'react';

const getUser = cache(async (id: string) => {
  const res = await fetch(`https://api.example.com/users/${id}`);
  return res.json();
});

// Now getUser is memoized across the entire request
```

## Database Queries

```typescript
// Direct database access in Server Components
import { db } from '@/lib/db';

export default async function Posts() {
  const posts = await db.post.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}

// With relations
export default async function Post({ params }: { params: { id: string } }) {
  const post = await db.post.findUnique({
    where: { id: params.id },
    include: {
      author: true,
      comments: {
        include: {
          user: true
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!post) {
    notFound();
  }

  return (
    <article>
      <h1>{post.title}</h1>
      <p>By {post.author.name}</p>
      <div>{post.content}</div>
      <Comments comments={post.comments} />
    </article>
  );
}

// Aggregations and analytics
export default async function Dashboard() {
  const [totalPosts, totalUsers, recentActivity] = await Promise.all([
    db.post.count(),
    db.user.count(),
    db.activity.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return (
    <div>
      <StatsCard title="Total Posts" value={totalPosts} />
      <StatsCard title="Total Users" value={totalUsers} />
      <ActivityFeed items={recentActivity} />
    </div>
  );
}
```

## Pagination Patterns

```typescript
// Cursor-based pagination
export default async function Posts({
  searchParams
}: {
  searchParams: { cursor?: string }
}) {
  const cursor = searchParams.cursor;

  const posts = await db.post.findMany({
    take: 10,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' }
  });

  const lastPost = posts[posts.length - 1];
  const nextCursor = lastPost?.id;

  return (
    <div>
      <PostList posts={posts} />
      {nextCursor && (
        <Link href={`/posts?cursor=${nextCursor}`}>Load More</Link>
      )}
    </div>
  );
}

// Page-based pagination
export default async function Posts({
  searchParams
}: {
  searchParams: { page?: string }
}) {
  const page = parseInt(searchParams.page || '1');
  const perPage = 10;

  const [posts, total] = await Promise.all([
    db.post.findMany({
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: 'desc' }
    }),
    db.post.count()
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <PostList posts={posts} />
      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  );
}

// Infinite scroll with Server Actions
'use client';
import { useState } from 'react';
import { loadMorePosts } from './actions';

export function InfinitePostList({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    setLoading(true);
    const lastId = posts[posts.length - 1].id;
    const newPosts = await loadMorePosts(lastId);
    setPosts([...posts, ...newPosts]);
    setLoading(false);
  };

  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
      <button onClick={loadMore} disabled={loading}>
        {loading ? 'Loading...' : 'Load More'}
      </button>
    </div>
  );
}
```

## When to Use This Skill

Use nextjs-data-fetching when you need to:

- Build static sites with dynamic data
- Implement SSR for dynamic content
- Use ISR for best of both worlds
- Optimize for SEO and performance
- Cache and revalidate data
- Build e-commerce sites
- Create content-heavy applications
- Implement real-time updates
- Build scalable applications
- Handle large datasets efficiently
- Implement pagination and infinite scroll
- Optimize Core Web Vitals

## Best Practices

1. **Use static generation by default** - Leverage SSG for pages that can be
   pre-rendered at build time for optimal performance.

2. **Implement ISR for frequently updated content** - Use time-based or on-demand
   revalidation for dynamic content that doesn't need real-time updates.

3. **Cache API responses appropriately** - Set proper revalidate times based on
   how frequently data changes.

4. **Use TypeScript for data types** - Define proper types for API responses and
   database queries to catch errors early.

5. **Handle loading and error states** - Implement loading.tsx and error.tsx files
   for better user experience.

6. **Implement proper revalidation strategies** - Use on-demand revalidation with
   webhooks for immediate updates when data changes.

7. **Optimize for Core Web Vitals** - Use streaming and Suspense to improve
   perceived performance and loading times.

8. **Use parallel data fetching** - Fetch independent data sources simultaneously
   to reduce waterfall effects.

9. **Test data fetching patterns** - Verify caching behavior, revalidation, and
   error handling in tests.

10. **Monitor performance metrics** - Track cache hit rates, revalidation
    frequency, and page load times.

## Common Pitfalls

1. **Not caching data appropriately** - Using cache: 'no-store' for everything
   defeats the performance benefits of SSG/ISR.

2. **Overusing SSR for static content** - Rendering static content on every
   request wastes server resources.

3. **Not implementing error boundaries** - Missing error.tsx files cause poor
   user experience when data fetching fails.

4. **Ignoring revalidation strategies** - Not setting revalidate times leads to
   stale data or too many unnecessary requests.

5. **Not handling race conditions** - Parallel requests without proper ordering
   can cause inconsistent UI state.

6. **Missing loading states** - Not implementing loading.tsx or Suspense boundaries
   creates jarring loading experiences.

7. **Not optimizing bundle size** - Fetching too much data or including unnecessary
   fields increases payload size.

8. **Exposing sensitive API keys** - Accidentally exposing secrets in client
   components or client-side fetches.

9. **Not testing edge cases** - Skipping tests for error states, empty data, and
   loading states leads to poor UX.

10. **Misunderstanding caching behavior** - Not knowing when Next.js caches requests
    can lead to stale data or performance issues.

## Resources

- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Caching in Next.js](https://nextjs.org/docs/app/building-your-application/caching)
- [Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Incremental Static Regeneration](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration)
- [Revalidating Data](https://nextjs.org/docs/app/building-your-application/data-fetching/revalidating)
- [Fetching Patterns](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching)
