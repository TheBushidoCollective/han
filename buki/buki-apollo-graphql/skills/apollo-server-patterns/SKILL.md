---
name: apollo-server-patterns
description: Use when building GraphQL APIs with Apollo Server requiring resolvers, data sources, schema design, and federation.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# Apollo Server Patterns

Master Apollo Server for building production-ready GraphQL APIs with proper
schema design, efficient resolvers, and scalable architecture.

## Overview

Apollo Server is a spec-compliant GraphQL server that works with any GraphQL
schema. It provides features like schema stitching, federation, data sources,
and built-in monitoring for production GraphQL APIs.

## Installation and Setup

### Installing Apollo Server

```bash
# For Express
npm install @apollo/server graphql express cors body-parser

# For standalone server
npm install @apollo/server graphql

# Additional utilities
npm install graphql-tag dataloader
```

### Basic Server Setup

```javascript
// server.js
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  formatError: (formattedError, error) => {
    // Custom error formatting
    if (formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
      return {
        ...formattedError,
        message: 'An internal error occurred'
      };
    }
    return formattedError;
  },
  plugins: [
    {
      async requestDidStart() {
        return {
          async willSendResponse({ response }) {
            console.log('Response sent');
          }
        };
      }
    }
  ]
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req }) => {
    const token = req.headers.authorization || '';
    const user = await getUserFromToken(token);
    return { user };
  }
});

console.log(`Server ready at ${url}`);
```

## Core Patterns

### 1. Schema Definition

```javascript
// schema.js
import { gql } from 'graphql-tag';

export const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    name: String!
    posts: [Post!]!
    createdAt: String!
  }

  type Post {
    id: ID!
    title: String!
    body: String!
    author: User!
    comments: [Comment!]!
    published: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type Comment {
    id: ID!
    body: String!
    author: User!
    post: Post!
    createdAt: String!
  }

  input CreatePostInput {
    title: String!
    body: String!
  }

  input UpdatePostInput {
    title: String
    body: String
    published: Boolean
  }

  type Query {
    me: User
    user(id: ID!): User
    users(limit: Int, offset: Int): [User!]!
    post(id: ID!): Post
    posts(published: Boolean, authorId: ID): [Post!]!
  }

  type Mutation {
    signup(email: String!, password: String!, name: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    createPost(input: CreatePostInput!): Post!
    updatePost(id: ID!, input: UpdatePostInput!): Post!
    deletePost(id: ID!): Boolean!
    createComment(postId: ID!, body: String!): Comment!
  }

  type Subscription {
    postCreated: Post!
    commentAdded(postId: ID!): Comment!
  }

  type AuthPayload {
    token: String!
    user: User!
  }
`;
```

### 2. Resolvers

```javascript
// resolvers.js
export const resolvers = {
  Query: {
    me: (parent, args, context) => {
      if (!context.user) {
        throw new Error('Not authenticated');
      }
      return context.user;
    },

    user: async (parent, { id }, { dataSources }) => {
      return dataSources.usersAPI.getUserById(id);
    },

    users: async (parent, { limit = 10, offset = 0 }, { dataSources }) => {
      return dataSources.usersAPI.getUsers({ limit, offset });
    },

    post: async (parent, { id }, { dataSources }) => {
      return dataSources.postsAPI.getPostById(id);
    },

    posts: async (parent, { published, authorId }, { dataSources }) => {
      return dataSources.postsAPI.getPosts({ published, authorId });
    }
  },

  Mutation: {
    signup: async (parent, { email, password, name }, { dataSources }) => {
      const user = await dataSources.usersAPI.createUser({
        email,
        password,
        name
      });
      const token = generateToken(user);
      return { token, user };
    },

    login: async (parent, { email, password }, { dataSources }) => {
      const user = await dataSources.usersAPI.authenticate(email, password);
      if (!user) {
        throw new Error('Invalid credentials');
      }
      const token = generateToken(user);
      return { token, user };
    },

    createPost: async (parent, { input }, { user, dataSources }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      return dataSources.postsAPI.createPost({
        ...input,
        authorId: user.id
      });
    },

    updatePost: async (parent, { id, input }, { user, dataSources }) => {
      const post = await dataSources.postsAPI.getPostById(id);
      if (post.authorId !== user.id) {
        throw new Error('Not authorized');
      }
      return dataSources.postsAPI.updatePost(id, input);
    },

    deletePost: async (parent, { id }, { user, dataSources }) => {
      const post = await dataSources.postsAPI.getPostById(id);
      if (post.authorId !== user.id) {
        throw new Error('Not authorized');
      }
      await dataSources.postsAPI.deletePost(id);
      return true;
    }
  },

  // Field resolvers
  User: {
    posts: async (parent, args, { dataSources }) => {
      return dataSources.postsAPI.getPostsByAuthorId(parent.id);
    }
  },

  Post: {
    author: async (parent, args, { dataSources }) => {
      return dataSources.usersAPI.getUserById(parent.authorId);
    },

    comments: async (parent, args, { dataSources }) => {
      return dataSources.commentsAPI.getCommentsByPostId(parent.id);
    }
  },

  Comment: {
    author: async (parent, args, { dataSources }) => {
      return dataSources.usersAPI.getUserById(parent.authorId);
    },

    post: async (parent, args, { dataSources }) => {
      return dataSources.postsAPI.getPostById(parent.postId);
    }
  }
};
```

### 3. Data Sources

```javascript
// dataSources/UsersAPI.js
import { RESTDataSource } from '@apollo/datasource-rest';

export class UsersAPI extends RESTDataSource {
  constructor() {
    super();
    this.baseURL = 'https://api.example.com/';
  }

  async getUserById(id) {
    return this.get(`users/${id}`);
  }

  async getUsers({ limit, offset }) {
    return this.get('users', {
      params: { limit, offset }
    });
  }

  async createUser({ email, password, name }) {
    return this.post('users', {
      body: { email, password, name }
    });
  }

  async authenticate(email, password) {
    try {
      const response = await this.post('auth/login', {
        body: { email, password }
      });
      return response.user;
    } catch (error) {
      return null;
    }
  }
}

// dataSources/PostsDB.js
import DataLoader from 'dataloader';

export class PostsDB {
  constructor(db) {
    this.db = db;
    this.loader = new DataLoader(this.batchGetPosts.bind(this));
  }

  async batchGetPosts(ids) {
    const posts = await this.db
      .select('*')
      .from('posts')
      .whereIn('id', ids);

    // Return posts in same order as ids
    return ids.map(id => posts.find(post => post.id === id));
  }

  async getPostById(id) {
    return this.loader.load(id);
  }

  async getPosts({ published, authorId }) {
    let query = this.db.select('*').from('posts');

    if (published !== undefined) {
      query = query.where('published', published);
    }

    if (authorId) {
      query = query.where('author_id', authorId);
    }

    return query;
  }

  async getPostsByAuthorId(authorId) {
    return this.db
      .select('*')
      .from('posts')
      .where('author_id', authorId);
  }

  async createPost({ title, body, authorId }) {
    const [post] = await this.db('posts')
      .insert({
        title,
        body,
        author_id: authorId,
        published: false,
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return post;
  }

  async updatePost(id, updates) {
    const [post] = await this.db('posts')
      .where('id', id)
      .update({
        ...updates,
        updated_at: new Date()
      })
      .returning('*');

    return post;
  }

  async deletePost(id) {
    await this.db('posts').where('id', id).delete();
  }
}
```

### 4. Context and Authentication

```javascript
// context.js
import jwt from 'jsonwebtoken';
import { UsersAPI } from './dataSources/UsersAPI.js';
import { PostsDB } from './dataSources/PostsDB.js';
import { CommentsDB } from './dataSources/CommentsDB.js';

export async function createContext({ req }) {
  // Extract token from header
  const token = req.headers.authorization?.replace('Bearer ', '') || '';

  // Verify and decode token
  let user = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await getUserById(decoded.userId);
    } catch (error) {
      console.error('Invalid token:', error);
    }
  }

  // Create data sources
  const dataSources = {
    usersAPI: new UsersAPI(),
    postsDB: new PostsDB(db),
    commentsDB: new CommentsDB(db)
  };

  return {
    user,
    dataSources,
    db
  };
}

// Authorization helpers
export function requireAuth(user) {
  if (!user) {
    throw new Error('Not authenticated');
  }
}

export function requireRole(user, role) {
  requireAuth(user);
  if (user.role !== role) {
    throw new Error('Not authorized');
  }
}
```

### 5. Error Handling

```javascript
// errors.js
import { GraphQLError } from 'graphql';

export class AuthenticationError extends GraphQLError {
  constructor(message) {
    super(message, {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 }
      }
    });
  }
}

export class ForbiddenError extends GraphQLError {
  constructor(message) {
    super(message, {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 }
      }
    });
  }
}

export class ValidationError extends GraphQLError {
  constructor(message, fields) {
    super(message, {
      extensions: {
        code: 'BAD_USER_INPUT',
        validationErrors: fields,
        http: { status: 400 }
      }
    });
  }
}

// Usage in resolvers
import { AuthenticationError, ForbiddenError } from './errors.js';

const resolvers = {
  Mutation: {
    deletePost: async (parent, { id }, { user, dataSources }) => {
      if (!user) {
        throw new AuthenticationError('You must be logged in');
      }

      const post = await dataSources.postsDB.getPostById(id);
      if (post.authorId !== user.id) {
        throw new ForbiddenError('You can only delete your own posts');
      }

      await dataSources.postsDB.deletePost(id);
      return true;
    }
  }
};
```

### 6. Subscriptions

```javascript
// server-with-subscriptions.js
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { PubSub } from 'graphql-subscriptions';

const pubsub = new PubSub();

const typeDefs = gql`
  type Subscription {
    postCreated: Post!
    commentAdded(postId: ID!): Comment!
  }
`;

const resolvers = {
  Mutation: {
    createPost: async (parent, { input }, { user, dataSources }) => {
      const post = await dataSources.postsDB.createPost({
        ...input,
        authorId: user.id
      });

      // Publish subscription event
      pubsub.publish('POST_CREATED', { postCreated: post });

      return post;
    },

    createComment: async (parent, { postId, body }, { user, dataSources }) => {
      const comment = await dataSources.commentsDB.createComment({
        postId,
        body,
        authorId: user.id
      });

      pubsub.publish(`COMMENT_ADDED_${postId}`, { commentAdded: comment });

      return comment;
    }
  },

  Subscription: {
    postCreated: {
      subscribe: () => pubsub.asyncIterator(['POST_CREATED'])
    },

    commentAdded: {
      subscribe: (parent, { postId }) =>
        pubsub.asyncIterator([`COMMENT_ADDED_${postId}`])
    }
  }
};

// Create schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Create HTTP server
const app = express();
const httpServer = createServer(app);

// Create WebSocket server
const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql'
});

const serverCleanup = useServer({ schema }, wsServer);

// Create Apollo Server
const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          }
        };
      }
    }
  ]
});

await server.start();

app.use(
  '/graphql',
  cors(),
  express.json(),
  expressMiddleware(server, {
    context: createContext
  })
);

httpServer.listen(4000, () => {
  console.log('Server running on http://localhost:4000/graphql');
});
```

### 7. Schema Directives

```javascript
// directives.js
import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { defaultFieldResolver } from 'graphql';

// Define directive in schema
const typeDefs = gql`
  directive @auth(requires: Role = USER) on FIELD_DEFINITION | OBJECT

  enum Role {
    ADMIN
    USER
    GUEST
  }

  type Query {
    me: User @auth
    users: [User!]! @auth(requires: ADMIN)
  }
`;

// Implement directive
function authDirective(directiveName) {
  return {
    authDirectiveTypeDefs: `directive @${directiveName}(requires: Role = USER)
      on FIELD_DEFINITION | OBJECT`,
    authDirectiveTransformer: (schema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
          const authDirective = getDirective(
            schema,
            fieldConfig,
            directiveName
          )?.[0];

          if (authDirective) {
            const { requires } = authDirective;
            const { resolve = defaultFieldResolver } = fieldConfig;

            fieldConfig.resolve = async function (source, args, context, info) {
              const { user } = context;

              if (!user) {
                throw new Error('Not authenticated');
              }

              if (requires && user.role !== requires) {
                throw new Error(`Requires ${requires} role`);
              }

              return resolve(source, args, context, info);
            };
          }

          return fieldConfig;
        }
      })
  };
}

// Apply to schema
const { authDirectiveTypeDefs, authDirectiveTransformer } = authDirective('auth');

let schema = makeExecutableSchema({
  typeDefs: [authDirectiveTypeDefs, typeDefs],
  resolvers
});

schema = authDirectiveTransformer(schema);
```

### 8. Batching and Caching with DataLoader

```javascript
// loaders.js
import DataLoader from 'dataloader';

export function createLoaders(db) {
  // Batch load users
  const userLoader = new DataLoader(async (userIds) => {
    const users = await db
      .select('*')
      .from('users')
      .whereIn('id', userIds);

    return userIds.map(id => users.find(user => user.id === id));
  });

  // Batch load posts with caching
  const postLoader = new DataLoader(
    async (postIds) => {
      const posts = await db
        .select('*')
        .from('posts')
        .whereIn('id', postIds);

      return postIds.map(id => posts.find(post => post.id === id));
    },
    {
      // Cache for 5 minutes
      cacheMap: new Map(),
      cacheKeyFn: (key) => key,
      batch: true,
      maxBatchSize: 100
    }
  );

  // Load comments by post ID (one-to-many)
  const commentsByPostLoader = new DataLoader(async (postIds) => {
    const comments = await db
      .select('*')
      .from('comments')
      .whereIn('post_id', postIds);

    return postIds.map(postId =>
      comments.filter(comment => comment.post_id === postId)
    );
  });

  return {
    userLoader,
    postLoader,
    commentsByPostLoader
  };
}

// Use in context
export async function createContext({ req }) {
  const loaders = createLoaders(db);

  return {
    loaders,
    // ... other context
  };
}

// Use in resolvers
const resolvers = {
  Post: {
    author: (parent, args, { loaders }) => {
      return loaders.userLoader.load(parent.authorId);
    },

    comments: (parent, args, { loaders }) => {
      return loaders.commentsByPostLoader.load(parent.id);
    }
  }
};
```

### 9. Federation

```javascript
// subgraph-users.js
import { ApolloServer } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import gql from 'graphql-tag';

const typeDefs = gql`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0",
          import: ["@key", "@shareable"])

  type User @key(fields: "id") {
    id: ID!
    email: String!
    name: String!
  }

  type Query {
    user(id: ID!): User
    users: [User!]!
  }
`;

const resolvers = {
  Query: {
    user: (parent, { id }, { dataSources }) => {
      return dataSources.usersDB.getUserById(id);
    },

    users: (parent, args, { dataSources }) => {
      return dataSources.usersDB.getUsers();
    }
  },

  User: {
    __resolveReference: (user, { dataSources }) => {
      return dataSources.usersDB.getUserById(user.id);
    }
  }
};

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers })
});

// subgraph-posts.js
const typeDefs = gql`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0",
          import: ["@key"])

  type User @key(fields: "id") {
    id: ID!
    posts: [Post!]!
  }

  type Post @key(fields: "id") {
    id: ID!
    title: String!
    body: String!
    author: User!
  }

  type Query {
    post(id: ID!): Post
    posts: [Post!]!
  }
`;

const resolvers = {
  User: {
    posts: (user, args, { dataSources }) => {
      return dataSources.postsDB.getPostsByAuthorId(user.id);
    }
  },

  Post: {
    author: (post) => {
      return { __typename: 'User', id: post.authorId };
    }
  }
};
```

### 10. Performance Monitoring

```javascript
// plugins/monitoring.js
export const monitoringPlugin = {
  async requestDidStart() {
    const start = Date.now();

    return {
      async willSendResponse({ response, errors }) {
        const duration = Date.now() - start;

        console.log({
          duration,
          hasErrors: !!errors,
          operationName: request.operationName
        });

        // Send to monitoring service
        if (duration > 1000) {
          await metrics.recordSlowQuery({
            operation: request.operationName,
            duration
          });
        }
      },

      async didEncounterErrors({ errors }) {
        errors.forEach(error => {
          console.error('GraphQL Error:', error);
          // Send to error tracking service
          errorTracker.captureException(error);
        });
      }
    };
  }
};

// Usage
const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [monitoringPlugin]
});
```

## Best Practices

1. **Use DataLoader** - Batch and cache database queries
2. **Implement proper auth** - Secure resolvers with authentication
3. **Design schema carefully** - Think about client needs first
4. **Use input types** - Validate mutation inputs properly
5. **Handle errors gracefully** - Return meaningful error messages
6. **Implement monitoring** - Track performance and errors
7. **Use data sources** - Separate data fetching logic
8. **Leverage federation** - Split large schemas into subgraphs
9. **Cache appropriately** - Use Redis for shared cache
10. **Document schema** - Add descriptions to types and fields

## Common Pitfalls

1. **N+1 query problems** - Not using DataLoader for batching
2. **Over-fetching in resolvers** - Loading unnecessary data
3. **Missing error handling** - Not catching and formatting errors
4. **Poor schema design** - Not following GraphQL best practices
5. **No authentication** - Exposing sensitive data without auth
6. **Blocking operations** - Synchronous operations in resolvers
7. **Memory leaks** - Not cleaning up subscriptions
8. **Missing validation** - Not validating input data
9. **Exposing internals** - Leaking database errors to clients
10. **No rate limiting** - Allowing unlimited query complexity

## When to Use

- Building GraphQL APIs
- Creating microservices with federation
- Developing real-time applications
- Building mobile backends
- Creating unified API gateways
- Developing admin dashboards
- Building e-commerce platforms
- Creating content management systems
- Developing social platforms
- Building analytics APIs

## Resources

- [Apollo Server Documentation](https://www.apollographql.com/docs/apollo-server/)
- [GraphQL Specification](https://spec.graphql.org/)
- [Apollo Federation](https://www.apollographql.com/docs/federation/)
- [DataLoader GitHub](https://github.com/graphql/dataloader)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
