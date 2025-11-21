---
name: apollo-caching-strategies
description: Use when implementing Apollo caching strategies including cache policies, optimistic UI, cache updates, and normalization.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# Apollo Caching Strategies

Master Apollo Client's caching mechanisms for building performant applications
with optimal data fetching and state management strategies.

## Overview

Apollo Client's intelligent cache is a normalized, in-memory data store that
allows for efficient data fetching and updates. Understanding cache policies
and management strategies is crucial for building high-performance apps.

## Installation and Setup

### Cache Configuration

```javascript
// apollo/cache.js
import { InMemoryCache, makeVar } from '@apollo/client';

export const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        posts: {
          // Pagination with offset
          keyArgs: ['filter'],
          merge(existing = [], incoming, { args }) {
            const merged = existing.slice(0);
            const offset = args?.offset || 0;

            for (let i = 0; i < incoming.length; i++) {
              merged[offset + i] = incoming[i];
            }

            return merged;
          }
        }
      }
    },
    Post: {
      keyFields: ['id'],
      fields: {
        comments: {
          merge(existing = [], incoming) {
            return [...existing, ...incoming];
          }
        }
      }
    },
    User: {
      keyFields: ['email'],
      fields: {
        fullName: {
          read(_, { readField }) {
            return `${readField('firstName')} ${readField('lastName')}`;
          }
        }
      }
    }
  }
});
```

## Core Patterns

### 1. Fetch Policies

```javascript
// Different fetch policies for different use cases
import { useQuery } from '@apollo/client';
import { GET_POSTS } from './queries';

// cache-first (default): Check cache first, network if not found
function CacheFirstPosts() {
  const { data } = useQuery(GET_POSTS, {
    fetchPolicy: 'cache-first'
  });
  return <PostsList posts={data?.posts} />;
}

// cache-only: Never make network request, cache or error
function CacheOnlyPosts() {
  const { data } = useQuery(GET_POSTS, {
    fetchPolicy: 'cache-only'
  });
  return <PostsList posts={data?.posts} />;
}

// cache-and-network: Return cache immediately, update with network
function CacheAndNetworkPosts() {
  const { data, loading, networkStatus } = useQuery(GET_POSTS, {
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true
  });

  return (
    <div>
      {networkStatus === 1 && <Spinner />}
      <PostsList posts={data?.posts} />
    </div>
  );
}

// network-only: Always make network request, update cache
function NetworkOnlyPosts() {
  const { data } = useQuery(GET_POSTS, {
    fetchPolicy: 'network-only'
  });
  return <PostsList posts={data?.posts} />;
}

// no-cache: Always make network request, don't update cache
function NoCachePosts() {
  const { data } = useQuery(GET_POSTS, {
    fetchPolicy: 'no-cache'
  });
  return <PostsList posts={data?.posts} />;
}

// standby: Like cache-first but doesn't auto-update
function StandbyPosts() {
  const { data, refetch } = useQuery(GET_POSTS, {
    fetchPolicy: 'standby'
  });

  return (
    <div>
      <button onClick={() => refetch()}>Refresh</button>
      <PostsList posts={data?.posts} />
    </div>
  );
}
```

### 2. Cache Reads and Writes

```javascript
// apollo/cacheOperations.js
import { gql } from '@apollo/client';

// Read from cache
export function readPostFromCache(client, postId) {
  try {
    const data = client.readQuery({
      query: gql`
        query GetPost($id: ID!) {
          post(id: $id) {
            id
            title
            body
          }
        }
      `,
      variables: { id: postId }
    });
    return data?.post;
  } catch (error) {
    console.error('Post not in cache:', error);
    return null;
  }
}

// Write to cache
export function writePostToCache(client, post) {
  client.writeQuery({
    query: gql`
      query GetPost($id: ID!) {
        post(id: $id) {
          id
          title
          body
        }
      }
    `,
    variables: { id: post.id },
    data: { post }
  });
}

// Read fragment
export function readPostFragment(client, postId) {
  return client.readFragment({
    id: `Post:${postId}`,
    fragment: gql`
      fragment PostFields on Post {
        id
        title
        body
        likesCount
      }
    `
  });
}

// Write fragment
export function updatePostLikes(client, postId, likesCount) {
  client.writeFragment({
    id: `Post:${postId}`,
    fragment: gql`
      fragment PostLikes on Post {
        likesCount
      }
    `,
    data: {
      likesCount
    }
  });
}

// Modify cache fields
export function incrementPostLikes(client, postId) {
  client.cache.modify({
    id: client.cache.identify({ __typename: 'Post', id: postId }),
    fields: {
      likesCount(currentCount = 0) {
        return currentCount + 1;
      },
      isLiked() {
        return true;
      }
    }
  });
}
```

### 3. Optimistic Updates

```javascript
// components/OptimisticLike.js
import { useMutation } from '@apollo/client';
import { LIKE_POST } from '../mutations';

function OptimisticLike({ post }) {
  const [likePost] = useMutation(LIKE_POST, {
    variables: { postId: post.id },

    // Optimistic response
    optimisticResponse: {
      __typename: 'Mutation',
      likePost: {
        __typename: 'Post',
        id: post.id,
        likesCount: post.likesCount + 1,
        isLiked: true
      }
    },

    // Update cache
    update(cache, { data: { likePost } }) {
      cache.modify({
        id: cache.identify(post),
        fields: {
          likesCount() {
            return likePost.likesCount;
          },
          isLiked() {
            return likePost.isLiked;
          }
        }
      });
    },

    // Handle errors
    onError(error) {
      console.error('Like failed, reverting:', error);
      // Optimistic update automatically reverted
    }
  });

  return (
    <button onClick={() => likePost()}>
      {post.isLiked ? 'Unlike' : 'Like'} ({post.likesCount})
    </button>
  );
}

// Complex optimistic update with multiple changes
function OptimisticCreateComment({ postId }) {
  const [createComment] = useMutation(CREATE_COMMENT, {
    optimisticResponse: ({ body }) => ({
      __typename: 'Mutation',
      createComment: {
        __typename: 'Comment',
        id: `temp-${Date.now()}`,
        body,
        createdAt: new Date().toISOString(),
        author: {
          __typename: 'User',
          id: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar
        }
      }
    }),

    update(cache, { data: { createComment } }) {
      // Add comment to post
      cache.modify({
        id: cache.identify({ __typename: 'Post', id: postId }),
        fields: {
          comments(existing = []) {
            const newCommentRef = cache.writeFragment({
              data: createComment,
              fragment: gql`
                fragment NewComment on Comment {
                  id
                  body
                  createdAt
                  author {
                    id
                    name
                    avatar
                  }
                }
              `
            });
            return [...existing, newCommentRef];
          },
          commentsCount(count = 0) {
            return count + 1;
          }
        }
      });
    }
  });

  return <CommentForm onSubmit={createComment} />;
}
```

### 4. Cache Eviction

```javascript
// apollo/eviction.js
export function evictPost(client, postId) {
  // Evict specific post
  client.cache.evict({
    id: client.cache.identify({ __typename: 'Post', id: postId })
  });

  // Garbage collect
  client.cache.gc();
}

export function evictField(client, postId, fieldName) {
  // Evict specific field
  client.cache.evict({
    id: client.cache.identify({ __typename: 'Post', id: postId }),
    fieldName
  });
}

export function evictAllPosts(client) {
  // Evict all posts from cache
  client.cache.modify({
    fields: {
      posts(existing, { DELETE }) {
        return DELETE;
      }
    }
  });

  client.cache.gc();
}

// Usage in delete mutation
function DeletePost({ postId }) {
  const [deletePost] = useMutation(DELETE_POST, {
    variables: { id: postId },

    update(cache) {
      // Remove from posts list
      cache.modify({
        fields: {
          posts(existingPosts = [], { readField }) {
            return existingPosts.filter(
              ref => postId !== readField('id', ref)
            );
          }
        }
      });

      // Evict post and related data
      cache.evict({ id: cache.identify({ __typename: 'Post', id: postId }) });
      cache.gc();
    }
  });

  return <button onClick={() => deletePost()}>Delete</button>;
}
```

### 5. Reactive Variables

```javascript
// apollo/reactiveVars.js
import { makeVar, useReactiveVar } from '@apollo/client';

// Create reactive variables
export const cartItemsVar = makeVar([]);
export const themeVar = makeVar('light');
export const isModalOpenVar = makeVar(false);
export const notificationsVar = makeVar([]);

// Helper functions
export function addToCart(item) {
  const cart = cartItemsVar();
  cartItemsVar([...cart, item]);
}

export function removeFromCart(itemId) {
  const cart = cartItemsVar();
  cartItemsVar(cart.filter(item => item.id !== itemId));
}

export function clearCart() {
  cartItemsVar([]);
}

export function toggleTheme() {
  const current = themeVar();
  themeVar(current === 'light' ? 'dark' : 'light');
}

export function addNotification(notification) {
  const notifications = notificationsVar();
  notificationsVar([...notifications, {
    id: Date.now(),
    ...notification
  }]);
}

// React component usage
function Cart() {
  const cartItems = useReactiveVar(cartItemsVar);

  return (
    <div>
      <h2>Cart ({cartItems.length})</h2>
      {cartItems.map(item => (
        <div key={item.id}>
          {item.name}
          <button onClick={() => removeFromCart(item.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}

// Use in cache configuration
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        cartItems: {
          read() {
            return cartItemsVar();
          }
        },
        theme: {
          read() {
            return themeVar();
          }
        }
      }
    }
  }
});
```

### 6. Pagination Strategies

```javascript
// Offset-based pagination
const POSTS_QUERY = gql`
  query GetPosts($limit: Int!, $offset: Int!) {
    posts(limit: $limit, offset: $offset) {
      id
      title
      body
    }
  }
`;

function OffsetPagination() {
  const { data, fetchMore } = useQuery(POSTS_QUERY, {
    variables: { limit: 10, offset: 0 }
  });

  return (
    <div>
      <PostsList posts={data?.posts} />
      <button
        onClick={() =>
          fetchMore({
            variables: { offset: data.posts.length }
          })
        }
      >
        Load More
      </button>
    </div>
  );
}

// Cursor-based pagination
const CURSOR_POSTS_QUERY = gql`
  query GetPosts($first: Int!, $after: String) {
    posts(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          title
          body
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

function CursorPagination() {
  const { data, fetchMore } = useQuery(CURSOR_POSTS_QUERY, {
    variables: { first: 10 }
  });

  return (
    <div>
      {data?.posts.edges.map(({ node }) => (
        <Post key={node.id} post={node} />
      ))}

      {data?.posts.pageInfo.hasNextPage && (
        <button
          onClick={() =>
            fetchMore({
              variables: {
                after: data.posts.pageInfo.endCursor
              }
            })
          }
        >
          Load More
        </button>
      )}
    </div>
  );
}

// Cache configuration for pagination
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        posts: {
          keyArgs: ['filter'],
          merge(existing, incoming, { args }) {
            if (!existing) return incoming;

            const { offset = 0 } = args;
            const merged = existing.slice(0);

            for (let i = 0; i < incoming.length; i++) {
              merged[offset + i] = incoming[i];
            }

            return merged;
          }
        }
      }
    }
  }
});

// Relay-style pagination with offsetLimitPagination
import { offsetLimitPagination } from '@apollo/client/utilities';

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        posts: offsetLimitPagination()
      }
    }
  }
});
```

### 7. Cache Persistence

```javascript
// apollo/persistedCache.js
import { InMemoryCache } from '@apollo/client';
import { persistCache, LocalStorageWrapper } from 'apollo3-cache-persist';

export async function createPersistedCache() {
  const cache = new InMemoryCache({
    typePolicies: {
      // Your type policies
    }
  });

  await persistCache({
    cache,
    storage: new LocalStorageWrapper(window.localStorage),
    maxSize: 1048576, // 1 MB
    debug: true,
    trigger: 'write', // or 'background'
  });

  return cache;
}

// Usage in client setup
import { ApolloClient } from '@apollo/client';

async function initApollo() {
  const cache = await createPersistedCache();

  const client = new ApolloClient({
    uri: 'http://localhost:4000/graphql',
    cache
  });

  return client;
}

// Clear persisted cache
export function clearPersistedCache(client) {
  client.clearStore(); // Clears cache
  localStorage.clear(); // Clears persistence
}

// Selective persistence
const cache = new InMemoryCache({
  typePolicies: {
    User: {
      fields: {
        // Don't persist sensitive data
        authToken: {
          read() {
            return null;
          }
        }
      }
    }
  }
});
```

### 8. Cache Warming

```javascript
// apollo/cacheWarming.js
import { gql } from '@apollo/client';

export async function warmCache(client) {
  // Preload critical queries
  await Promise.all([
    client.query({
      query: gql`
        query GetCurrentUser {
          me {
            id
            name
            email
          }
        }
      `
    }),

    client.query({
      query: gql`
        query GetRecentPosts {
          posts(limit: 20) {
            id
            title
            excerpt
          }
        }
      `
    })
  ]);
}

// Prefetch on hover
function PostLink({ postId }) {
  const client = useApolloClient();

  const prefetch = () => {
    client.query({
      query: GET_POST,
      variables: { id: postId }
    });
  };

  return (
    <Link
      to={`/posts/${postId}`}
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
    >
      View Post
    </Link>
  );
}
```

### 9. Cache Redirects

```javascript
// apollo/cache.js
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        post: {
          read(_, { args, toReference }) {
            // Redirect to cached object
            return toReference({
              __typename: 'Post',
              id: args.id
            });
          }
        }
      }
    },

    User: {
      fields: {
        // Computed field from cache
        fullName: {
          read(_, { readField }) {
            const firstName = readField('firstName');
            const lastName = readField('lastName');
            return `${firstName} ${lastName}`;
          }
        },

        // Field with arguments
        posts: {
          read(existing, { args, readField }) {
            if (args?.published !== undefined) {
              return existing?.filter(ref =>
                readField('published', ref) === args.published
              );
            }
            return existing;
          }
        }
      }
    }
  }
});
```

### 10. Cache Monitoring and Debugging

```javascript
// apollo/monitoring.js
export function logCacheContents(client) {
  const cache = client.extract();
  console.log('Cache contents:', cache);
}

export function watchCacheChanges(client) {
  const observer = client.cache.watch({
    query: gql`
      query GetAllData {
        posts {
          id
          title
        }
      }
    `,
    callback: (data) => {
      console.log('Cache changed:', data);
    }
  });

  return observer;
}

// Development helpers
if (process.env.NODE_ENV === 'development') {
  window.apolloClient = client;
  window.logCache = () => logCacheContents(client);

  // Cache size monitoring
  setInterval(() => {
    const cacheSize = JSON.stringify(client.extract()).length;
    console.log(`Cache size: ${(cacheSize / 1024).toFixed(2)} KB`);
  }, 10000);
}

// React DevTools integration
import { ApolloClient } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';

function App() {
  return (
    <ApolloProvider client={client}>
      {/* Enable Apollo DevTools */}
      <YourApp />
    </ApolloProvider>
  );
}

// Custom cache inspector
function CacheInspector() {
  const client = useApolloClient();
  const [cacheData, setCacheData] = useState({});

  useEffect(() => {
    const data = client.extract();
    setCacheData(data);
  }, [client]);

  return (
    <div>
      <h2>Cache Inspector</h2>
      <pre>{JSON.stringify(cacheData, null, 2)}</pre>
      <button onClick={() => client.clearStore()}>Clear Cache</button>
    </div>
  );
}
```

## Best Practices

1. **Choose appropriate fetch policies** - Match policy to data freshness needs
2. **Use optimistic updates** - Improve perceived performance
3. **Normalize cache properly** - Configure keyFields correctly
4. **Implement pagination** - Handle large datasets efficiently
5. **Persist critical data** - Cache auth state and user preferences
6. **Monitor cache size** - Prevent memory bloat
7. **Use reactive variables** - Manage local state efficiently
8. **Warm cache strategically** - Prefetch critical data
9. **Evict unused data** - Clean up after deletions
10. **Debug cache issues** - Use Apollo DevTools effectively

## Common Pitfalls

1. **Wrong fetch policy** - Using cache-first for real-time data
2. **Cache denormalization** - Missing or incorrect keyFields
3. **Memory leaks** - Not evicting deleted items
4. **Over-caching** - Caching too much data
5. **Stale data** - Not invalidating cache properly
6. **Missing updates** - Forgetting to update cache after mutations
7. **Incorrect merges** - Wrong pagination merge logic
8. **Cache thrashing** - Too many cache writes
9. **Persistence issues** - Storing sensitive data
10. **No error handling** - Not handling cache read failures

## When to Use

- Building data-intensive applications
- Implementing offline-first features
- Creating real-time collaborative apps
- Developing mobile applications
- Building e-commerce platforms
- Creating social media applications
- Implementing complex state management
- Developing admin dashboards
- Building content management systems
- Creating analytics applications

## Resources

- [Apollo Cache Documentation](https://www.apollographql.com/docs/react/caching/overview/)
- [Advanced Cache Patterns](https://www.apollographql.com/docs/react/caching/advanced-topics/)
- [Cache Persistence](https://github.com/apollographql/apollo-cache-persist)
- [Apollo DevTools](https://www.apollographql.com/docs/react/development-testing/developer-tooling/)
- [Optimistic UI Guide](https://www.apollographql.com/docs/react/performance/optimistic-ui/)
