---
name: typescript-async-patterns
description: Use when typeScript async patterns including Promises, async/await, and async iterators with proper typing. Use when writing asynchronous TypeScript code.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# TypeScript Async Patterns

Master asynchronous programming patterns in TypeScript, including Promises,
async/await, error handling, async iterators, and advanced patterns for
building robust async applications.

## Promises and async/await

### Basic Promise Creation

```typescript
// Creating a Promise
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Promise with value
function fetchUserData(userId: string): Promise<User> {
  return new Promise((resolve, reject) => {
    // Simulated API call
    setTimeout(() => {
      if (userId) {
        resolve({ id: userId, name: 'John Doe' });
      } else {
        reject(new Error('Invalid user ID'));
      }
    }, 1000);
  });
}

// Using the Promise
fetchUserData('123')
  .then((user) => {
    console.log(user.name);
  })
  .catch((error) => {
    console.error('Error:', error.message);
  });
```

### async/await Syntax

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

interface Post {
  id: string;
  userId: string;
  title: string;
  content: string;
}

// Async function declaration
async function getUserPosts(userId: string): Promise<Post[]> {
  try {
    const user = await fetchUserData(userId);
    const posts = await fetchPostsByUser(user.id);
    return posts;
  } catch (error) {
    console.error('Failed to fetch user posts:', error);
    throw error;
  }
}

// Async arrow function
const getUserProfile = async (userId: string): Promise<User> => {
  const user = await fetchUserData(userId);
  return user;
};

// Using async/await
async function main() {
  const posts = await getUserPosts('123');
  console.log(`Found ${posts.length} posts`);
}
```

### Type-Safe Promise Wrappers

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

async function safeAsync<T>(
  promise: Promise<T>
): Promise<Result<T>> {
  try {
    const data = await promise;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

// Usage
async function example() {
  const result = await safeAsync(fetchUserData('123'));

  if (result.success) {
    console.log(result.data.name);
  } else {
    console.error(result.error.message);
  }
}
```

## Promise Chaining and Composition

### Chaining Promises

```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
}

function fetchData<T>(url: string): Promise<ApiResponse<T>> {
  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => ({
      data,
      status: 200,
    }));
}

// Chaining multiple async operations
function processUserData(userId: string): Promise<string> {
  return fetchUserData(userId)
    .then((user) => fetchPostsByUser(user.id))
    .then((posts) => posts.filter((post) => post.title.includes('TypeScript')))
    .then((filteredPosts) => `Found ${filteredPosts.length} TypeScript posts`)
    .catch((error) => {
      console.error('Error in chain:', error);
      return 'Failed to process user data';
    });
}
```

### Composing Async Functions

```typescript
type AsyncFunction<T, R> = (input: T) => Promise<R>;

function pipe<T, A, B>(
  fn1: AsyncFunction<T, A>,
  fn2: AsyncFunction<A, B>
): AsyncFunction<T, B> {
  return async (input: T) => {
    const result1 = await fn1(input);
    return fn2(result1);
  };
}

// Usage
const getUserId = async (username: string): Promise<string> => {
  // Look up user ID
  return '123';
};

const getUserData = async (userId: string): Promise<User> => {
  return fetchUserData(userId);
};

const getUserByUsername = pipe(getUserId, getUserData);

// Use the composed function
const user = await getUserByUsername('johndoe');
```

## Error Handling in Async Code

### Try-Catch with async/await

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithErrorHandling<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new ApiError(
        `HTTP error! status: ${response.status}`,
        response.status
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`API Error ${error.statusCode}: ${error.message}`);
    } else if (error instanceof TypeError) {
      console.error('Network error:', error.message);
    } else {
      console.error('Unknown error:', error);
    }
    throw error;
  }
}
```

### Error Recovery Patterns

```typescript
async function fetchWithFallback<T>(
  primaryUrl: string,
  fallbackUrl: string
): Promise<T> {
  try {
    return await fetchWithErrorHandling<T>(primaryUrl);
  } catch (error) {
    console.warn('Primary fetch failed, trying fallback');
    return await fetchWithErrorHandling<T>(fallbackUrl);
  }
}

// Multiple fallbacks
async function fetchWithMultipleFallbacks<T>(
  urls: string[]
): Promise<T> {
  let lastError: Error | undefined;

  for (const url of urls) {
    try {
      return await fetchWithErrorHandling<T>(url);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Failed to fetch from ${url}, trying next...`);
    }
  }

  throw new Error(
    `All fetches failed. Last error: ${lastError?.message ?? 'Unknown'}`
  );
}
```

### Typed Error Handling

```typescript
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NetworkError extends Error {
  constructor(message: string, public url: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

type AppError = ValidationError | NetworkError | Error;

async function handleUserUpdate(userId: string, data: unknown): Promise<void> {
  try {
    await validateUserData(data);
    await updateUser(userId, data);
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error(`Validation error in field ${error.field}: ${error.message}`);
    } else if (error instanceof NetworkError) {
      console.error(`Network error for ${error.url}: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Unexpected error: ${error.message}`);
    }
    throw error;
  }
}
```

## Promise Combinators

### Promise.all

```typescript
interface UserData {
  profile: User;
  posts: Post[];
  comments: Comment[];
}

async function fetchUserDataParallel(userId: string): Promise<UserData> {
  const [profile, posts, comments] = await Promise.all([
    fetchUserData(userId),
    fetchPostsByUser(userId),
    fetchCommentsByUser(userId),
  ]);

  return { profile, posts, comments };
}

// Type-safe Promise.all with tuple
async function fetchMultipleResources() {
  const [users, posts, settings] = await Promise.all([
    fetchUsers(),      // Promise<User[]>
    fetchPosts(),      // Promise<Post[]>
    fetchSettings(),   // Promise<Settings>
  ] as const);

  // TypeScript infers correct types
  const firstUser: User = users[0];
  const firstPost: Post = posts[0];
}
```

### Promise.allSettled

```typescript
interface SettledResult<T> {
  status: 'fulfilled' | 'rejected';
  value?: T;
  reason?: Error;
}

async function fetchAllUserData(
  userIds: string[]
): Promise<Array<SettledResult<User>>> {
  const results = await Promise.allSettled(
    userIds.map((id) => fetchUserData(id))
  );

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return { status: 'fulfilled', value: result.value };
    } else {
      return { status: 'rejected', reason: result.reason };
    }
  });
}

// Usage
const results = await fetchAllUserData(['1', '2', '3']);
const successful = results.filter((r) => r.status === 'fulfilled');
const failed = results.filter((r) => r.status === 'rejected');

console.log(`${successful.length} succeeded, ${failed.length} failed`);
```

### Promise.race and Promise.any

```typescript
// Promise.race - first to settle (fulfill or reject)
async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
  });

  return Promise.race([promise, timeout]);
}

// Usage
const data = await fetchWithTimeout(fetchUserData('123'), 5000);

// Promise.any - first to fulfill (ignores rejections)
async function fetchFromFastestServer<T>(
  urls: string[]
): Promise<T> {
  const fetchPromises = urls.map((url) => fetchWithErrorHandling<T>(url));

  try {
    return await Promise.any(fetchPromises);
  } catch (error) {
    throw new Error('All servers failed to respond');
  }
}
```

## Async Iterators and Generators

### Basic Async Iterators

```typescript
interface AsyncIteratorResult<T> {
  value: T;
  done: boolean;
}

async function* numberGenerator(max: number): AsyncGenerator<number> {
  for (let i = 0; i < max; i++) {
    await delay(100);
    yield i;
  }
}

// Using async iterator
async function consumeNumbers() {
  for await (const num of numberGenerator(5)) {
    console.log(num);
  }
}
```

### Async Iterable Data Streams

```typescript
interface DataChunk {
  data: string;
  timestamp: number;
}

class AsyncDataStream implements AsyncIterable<DataChunk> {
  constructor(private source: string[]) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<DataChunk> {
    for (const data of this.source) {
      await delay(100);
      yield {
        data,
        timestamp: Date.now(),
      };
    }
  }
}

// Usage
async function processStream() {
  const stream = new AsyncDataStream(['chunk1', 'chunk2', 'chunk3']);

  for await (const chunk of stream) {
    console.log(`Received at ${chunk.timestamp}: ${chunk.data}`);
  }
}
```

### Transforming Async Iterables

```typescript
async function* mapAsync<T, R>(
  iterable: AsyncIterable<T>,
  mapper: (value: T) => Promise<R> | R
): AsyncGenerator<R> {
  for await (const value of iterable) {
    yield await mapper(value);
  }
}

async function* filterAsync<T>(
  iterable: AsyncIterable<T>,
  predicate: (value: T) => Promise<boolean> | boolean
): AsyncGenerator<T> {
  for await (const value of iterable) {
    if (await predicate(value)) {
      yield value;
    }
  }
}

// Usage
async function transformData() {
  const stream = new AsyncDataStream(['1', '2', '3', '4', '5']);

  const numbers = mapAsync(stream, (chunk) => parseInt(chunk.data));
  const evenNumbers = filterAsync(numbers, (n) => n % 2 === 0);

  for await (const num of evenNumbers) {
    console.log(num); // 2, 4
  }
}
```

## Observable Patterns

### Simple Observable Implementation

```typescript
type Observer<T> = (value: T) => void;
type Unsubscribe = () => void;

class Observable<T> {
  private observers: Set<Observer<T>> = new Set();

  subscribe(observer: Observer<T>): Unsubscribe {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  next(value: T): void {
    this.observers.forEach((observer) => observer(value));
  }

  pipe<R>(operator: (obs: Observable<T>) => Observable<R>): Observable<R> {
    return operator(this);
  }
}

// Operator
function map<T, R>(mapper: (value: T) => R) {
  return (source: Observable<T>): Observable<R> => {
    const result = new Observable<R>();

    source.subscribe((value) => {
      result.next(mapper(value));
    });

    return result;
  };
}

// Usage
const numbers = new Observable<number>();
const doubled = numbers.pipe(map((n) => n * 2));

doubled.subscribe((value) => console.log(value));
numbers.next(5); // 10
```

### Async Observable

```typescript
interface AsyncObserver<T> {
  next: (value: T) => Promise<void> | void;
  error?: (error: Error) => Promise<void> | void;
  complete?: () => Promise<void> | void;
}

class AsyncObservable<T> {
  private observers: Set<AsyncObserver<T>> = new Set();

  subscribe(observer: AsyncObserver<T>): Unsubscribe {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  async next(value: T): Promise<void> {
    await Promise.all(
      Array.from(this.observers).map((obs) => obs.next(value))
    );
  }

  async error(error: Error): Promise<void> {
    await Promise.all(
      Array.from(this.observers)
        .filter((obs) => obs.error)
        .map((obs) => obs.error!(error))
    );
  }

  async complete(): Promise<void> {
    await Promise.all(
      Array.from(this.observers)
        .filter((obs) => obs.complete)
        .map((obs) => obs.complete!())
    );
  }
}
```

## Cancellation Patterns

### AbortController for Cancellation

```typescript
async function fetchWithCancellation(
  url: string,
  signal: AbortSignal
): Promise<Response> {
  const response = await fetch(url, { signal });

  if (signal.aborted) {
    throw new Error('Request was cancelled');
  }

  return response;
}

// Usage
const controller = new AbortController();

// Start fetch
const fetchPromise = fetchWithCancellation(
  'https://api.example.com/data',
  controller.signal
);

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetchPromise;
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    console.log('Request was cancelled');
  }
}
```

### Cancellable Promise Wrapper

```typescript
interface CancellablePromise<T> extends Promise<T> {
  cancel: () => void;
}

function makeCancellable<T>(
  promise: Promise<T>
): CancellablePromise<T> {
  let cancelled = false;

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise
      .then((value) => {
        if (!cancelled) {
          resolve(value);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          reject(error);
        }
      });
  }) as CancellablePromise<T>;

  wrappedPromise.cancel = () => {
    cancelled = true;
  };

  return wrappedPromise;
}

// Usage
const cancellable = makeCancellable(fetchUserData('123'));

setTimeout(() => {
  cancellable.cancel();
}, 1000);
```

## Retry and Timeout Patterns

### Retry with Exponential Backoff

```typescript
interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < options.maxAttempts - 1) {
        const delayMs = Math.min(
          options.baseDelay * Math.pow(options.backoffMultiplier, attempt),
          options.maxDelay
        );

        console.log(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms`);
        await delay(delayMs);
      }
    }
  }

  throw new Error(
    `Failed after ${options.maxAttempts} attempts: ${lastError?.message ?? 'Unknown error'}`
  );
}

// Usage
const data = await retry(
  () => fetchUserData('123'),
  {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
  }
);
```

### Conditional Retry

```typescript
type RetryPredicate = (error: Error, attempt: number) => boolean;

async function retryWhen<T>(
  fn: () => Promise<T>,
  shouldRetry: RetryPredicate,
  maxAttempts: number
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts - 1 && shouldRetry(lastError, attempt)) {
        await delay(1000 * (attempt + 1));
      } else {
        throw lastError;
      }
    }
  }

  throw lastError!;
}

// Usage: Only retry on network errors
const data = await retryWhen(
  () => fetchUserData('123'),
  (error) => error instanceof NetworkError,
  3
);
```

### Timeout Pattern

```typescript
class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = 'Operation timed out'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

// Combined retry with timeout
async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  options: RetryOptions & { timeout: number }
): Promise<T> {
  return retry(
    () => withTimeout(fn(), options.timeout),
    options
  );
}
```

## Async Type Inference

### Inferring Promise Types

```typescript
// Extract Promise type
type Awaited<T> = T extends Promise<infer U> ? U : T;

// Usage
type UserPromise = Promise<User>;
type UserType = Awaited<UserPromise>; // User

// For functions
type ReturnTypeAsync<T extends (...args: any) => any> =
  Awaited<ReturnType<T>>;

async function getUser(): Promise<User> {
  return { id: '1', name: 'John', email: 'john@example.com' };
}

type UserFromFunction = ReturnTypeAsync<typeof getUser>; // User
```

### Typed Async Function Utilities

```typescript
type AsyncFn<Args extends any[], R> = (...args: Args) => Promise<R>;

// Type-safe async pipe
function composeAsync<A, B, C>(
  f: AsyncFn<[A], B>,
  g: AsyncFn<[B], C>
): AsyncFn<[A], C> {
  return async (a: A) => {
    const b = await f(a);
    return g(b);
  };
}

// Memoize async function
function memoizeAsync<Args extends any[], R>(
  fn: AsyncFn<Args, R>
): AsyncFn<Args, R> {
  const cache = new Map<string, Promise<R>>();

  return async (...args: Args) => {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const promise = fn(...args);
    cache.set(key, promise);

    try {
      return await promise;
    } catch (error) {
      cache.delete(key);
      throw error;
    }
  };
}
```

## Best Practices

1. **Always Handle Errors**: Use try-catch with async/await or .catch() with
   Promises. Never let errors go unhandled in async code.

2. **Avoid Mixing Paradigms**: Choose either Promise chains or async/await
   for a given flow. Mixing them makes code harder to read and maintain.

3. **Use Promise.all for Parallel Operations**: When operations are
   independent, use Promise.all to run them in parallel rather than
   sequentially.

4. **Type Promise Return Values**: Always explicitly type the return value
   of async functions and Promises for better type safety and IDE support.

5. **Handle Race Conditions**: Be careful with shared state in async code.
   Use proper synchronization or immutable data structures.

6. **Set Timeouts for Network Requests**: Always add timeouts to prevent
   hanging requests. Use AbortController or Promise.race.

7. **Implement Proper Cleanup**: Use finally blocks or try/finally to ensure
   cleanup code runs regardless of success or failure.

8. **Avoid Async in Constructors**: Constructors cannot be async. Use
   factory functions or initialization methods instead.

9. **Use AbortController for Cancellation**: Prefer standard AbortController
   over custom cancellation for better browser/Node.js compatibility.

10. **Document Async Behavior**: Clearly document what async functions do,
    what they return, and what errors they might throw.

## Common Pitfalls

1. **Forgetting await**: Forgetting await on async functions returns a
   Promise instead of the resolved value, causing type errors and bugs.

2. **Sequential When Parallel Is Better**: Using await in loops when
   operations could run in parallel leads to poor performance.

3. **Unhandled Promise Rejections**: Not catching errors in Promises or
   async functions can crash Node.js applications or cause silent failures.

4. **Floating Promises**: Not awaiting or handling Promises
   (fire-and-forget) can cause unhandled rejections and race conditions.

5. **Promise Constructor Anti-pattern**: Wrapping already-promisified
   functions in new Promise is unnecessary and adds complexity.

6. **Async IIFE Mistakes**: Forgetting to await or handle errors from
   immediately-invoked async functions causes silent failures.

7. **Wrong Error Type Assumptions**: Assuming all errors are Error
   instances. Use proper type checking or type guards.

8. **Memory Leaks in Async Iterators**: Not properly cleaning up async
   iterators can cause memory leaks, especially with infinite streams.

9. **Ignoring Cancellation**: Not implementing cancellation for long-running
   operations wastes resources and degrades user experience.

10. **Over-Using Async**: Making everything async when synchronous
    alternatives exist adds unnecessary complexity and performance overhead.

## When to Use This Skill

Use TypeScript async patterns when you need to:

- Make API calls or interact with external services
- Perform I/O operations (file system, database, network)
- Build real-time applications with streaming data
- Handle user interactions that trigger async operations
- Implement background tasks or scheduled jobs
- Work with WebSockets or Server-Sent Events
- Process large datasets asynchronously
- Build responsive UIs that don't block the main thread
- Implement retry logic for unreliable operations
- Create composable async workflows

This skill is essential for full-stack developers, frontend engineers
working with APIs, backend developers building services, and anyone building
modern JavaScript/TypeScript applications.

## Resources

### Documentation

- MDN Web Docs - Async/Await:
  <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function>
- TypeScript Handbook - Async Functions:
  <https://www.typescriptlang.org/docs/handbook/release-notes/typescript-1-7.html>
- JavaScript Promises - MDN:
  <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise>

### Books and Articles

- "You Don't Know JS: Async & Performance" by Kyle Simpson
- "JavaScript: The Definitive Guide" by David Flanagan
- "Async JavaScript" by Trevor Burnham

### Libraries

- RxJS: <https://rxjs.dev/> - Reactive Extensions for JavaScript
- p-limit: <https://github.com/sindresorhus/p-limit> - Promise concurrency
  control
- p-retry: <https://github.com/sindresorhus/p-retry> - Retry failed promises
- abort-controller: <https://www.npmjs.com/package/abort-controller> -
  AbortController polyfill

### Tools

- TypeScript Playground: <https://www.typescriptlang.org/play>
- Chrome DevTools - Async Stack Traces
- Node.js --trace-warnings flag for debugging unhandled rejections
