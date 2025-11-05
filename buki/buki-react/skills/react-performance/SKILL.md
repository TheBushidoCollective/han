---
name: react-performance
description: Master React performance optimization including memoization, lazy loading,
  and virtualization. Use when optimizing React applications.
allowed-tools:
  - Bash
  - Read
---

# React Performance Optimization

Master react performance optimization for building high-performance, scalable
React applications with industry best practices.

## React.memo and Component Memoization

React.memo prevents unnecessary re-renders by memoizing component output:

```typescript
import { memo } from 'react';

interface Props {
  name: string;
  onClick: () => void;
}

// Basic memoization
const ExpensiveComponent = memo(
  function ExpensiveComponent({ name, onClick }: Props) {
  console.log('Rendering ExpensiveComponent');
  return <button onClick={onClick}>{name}</button>;
});

// Custom comparison function
const CustomMemo = memo(
  function Component({ user }: { user: User }) {
    return <div>{user.name}</div>;
  },
  (prevProps, nextProps) => {
    // Return true if passing nextProps would return the same result as prevProps
    return prevProps.user.id === nextProps.user.id;
  }
);

// When to use custom comparison
const ProductCard = memo(
  function ProductCard({ product }: { product: Product }) {
    return (
      <div>
        <h3>{product.name}</h3>
        <p>${product.price}</p>
      </div>
    );
  },
  (prev, next) => {
    // Only re-render if these specific fields change
    return (
      prev.product.id === next.product.id &&
      prev.product.name === next.product.name &&
      prev.product.price === next.product.price
    );
  }
);
```

## useMemo for Expensive Computations

```typescript
import { useMemo, useState } from 'react';

function DataTable({ items }: { items: Item[] }) {
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name');

  // Expensive filtering and sorting
  const processedItems = useMemo(() => {
    console.log('Computing filtered and sorted items');
    return items
      .filter(item => item.name.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        return a.price - b.price;
      });
  }, [items, filter, sortBy]);

  // Expensive aggregate calculation
  const statistics = useMemo(() => {
    console.log('Computing statistics');
    return {
      total: processedItems.reduce((sum, item) => sum + item.price, 0),
      average: processedItems.length
        ? processedItems.reduce((sum, item) => sum + item.price, 0) / processedItems.length
        : 0,
      count: processedItems.length
    };
  }, [processedItems]);

  return (
    <>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
        <option value="name">Name</option>
        <option value="price">Price</option>
      </select>
      <div>Total: ${statistics.total}</div>
      <div>Average: ${statistics.average.toFixed(2)}</div>
      <div>Count: {statistics.count}</div>
      {processedItems.map(item => (
        <div key={item.id}>{item.name} - ${item.price}</div>
      ))}
    </>
  );
}
```

## useCallback for Stable Function References

```typescript
import { useCallback, useState, memo } from 'react';

// Child component that only re-renders when necessary
const ListItem = memo(function ListItem({
  item,
  onDelete
}: {
  item: Item;
  onDelete: (id: string) => void;
}) {
  console.log('Rendering ListItem', item.id);
  return (
    <div>
      {item.name}
      <button onClick={() => onDelete(item.id)}>Delete</button>
    </div>
  );
});

function OptimizedList({ items }: { items: Item[] }) {
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Without useCallback, this creates a new function on every render
  // causing ListItem to re-render even with memo
  const handleDelete = useCallback((id: string) => {
    setDeletedIds(prev => new Set([...prev, id]));
    // API call to delete
    api.deleteItem(id);
  }, []); // Empty deps means function never changes

  const handleDeleteWithDeps = useCallback((id: string) => {
    console.log('Already deleted:', deletedIds.size);
    setDeletedIds(prev => new Set([...prev, id]));
  }, [deletedIds]); // Re-create when deletedIds changes

  const visibleItems = items.filter(item => !deletedIds.has(item.id));

  return (
    <>
      {visibleItems.map(item => (
        <ListItem key={item.id} item={item} onDelete={handleDelete} />
      ))}
    </>
  );
}
```

## Code Splitting with React.lazy and Suspense

```typescript
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// Lazy load route components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));

// Fallback component
function LoadingSpinner() {
  return <div className="spinner">Loading...</div>;
}

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Suspense>
  );
}

// Preload on hover for better UX
function Navigation() {
  const preloadDashboard = () => import('./pages/Dashboard');
  const preloadProfile = () => import('./pages/Profile');

  return (
    <nav>
      <a href="/dashboard" onMouseEnter={preloadDashboard}>Dashboard</a>
      <a href="/profile" onMouseEnter={preloadProfile}>Profile</a>
    </nav>
  );
}

// Nested Suspense boundaries
function DashboardLayout() {
  const Header = lazy(() => import('./components/Header'));
  const Sidebar = lazy(() => import('./components/Sidebar'));
  const Content = lazy(() => import('./components/Content'));

  return (
    <div className="dashboard">
      <Suspense fallback={<div>Loading header...</div>}>
        <Header />
      </Suspense>
      <Suspense fallback={<div>Loading sidebar...</div>}>
        <Sidebar />
      </Suspense>
      <Suspense fallback={<div>Loading content...</div>}>
        <Content />
      </Suspense>
    </div>
  );
}
```

## Virtual Scrolling for Large Lists

```typescript
import { FixedSizeList, VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

// Fixed size items
function VirtualList({ items }: { items: string[] }) {
  const Row = ({ index, style }: {
    index: number;
    style: React.CSSProperties
  }) => (
    <div style={style} className="list-item">
      {items[index]}
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={35}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}

// Variable size items
function VariableList({ items }: { items: Post[] }) {
  const getItemSize = (index: number) => {
    // Calculate height based on content
    return items[index].content.length > 100 ? 120 : 80;
  };

  const Row = ({ index, style }: any) => (
    <div style={style} className="post">
      <h3>{items[index].title}</h3>
      <p>{items[index].content}</p>
    </div>
  );

  return (
    <VariableSizeList
      height={600}
      itemCount={items.length}
      itemSize={getItemSize}
      width="100%"
    >
      {Row}
    </VariableSizeList>
  );
}

// With AutoSizer for responsive layouts
function ResponsiveList({ items }: { items: Item[] }) {
  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <AutoSizer>
        {({ height, width }) => (
          <FixedSizeList
            height={height}
            itemCount={items.length}
            itemSize={50}
            width={width}
          >
            {({ index, style }) => (
              <div style={style}>{items[index].name}</div>
            )}
          </FixedSizeList>
        )}
      </AutoSizer>
    </div>
  );
}
```

## React Profiler API for Performance Monitoring

```typescript
import { Profiler, ProfilerOnRenderCallback } from 'react';

const onRenderCallback: ProfilerOnRenderCallback = (
  id, // the "id" prop of the Profiler tree that has just committed
  phase, // either "mount" (first render) or "update" (re-render)
  actualDuration, // time spent rendering the committed update
  baseDuration, // estimated time to render the entire subtree without memoization
  startTime, // when React began rendering this update
  commitTime, // when React committed this update
  interactions // the Set of interactions belonging to this update
) => {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);

  // Send to analytics
  if (actualDuration > 100) {
    analytics.track('slow-render', {
      component: id,
      duration: actualDuration,
      phase
    });
  }
};

function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <Dashboard />
    </Profiler>
  );
}

// Nested profilers for granular monitoring
function Dashboard() {
  return (
    <div>
      <Profiler id="Sidebar" onRender={onRenderCallback}>
        <Sidebar />
      </Profiler>
      <Profiler id="Content" onRender={onRenderCallback}>
        <Content />
      </Profiler>
    </div>
  );
}
```

## Bundle Size Optimization

```typescript
// Use dynamic imports for large libraries
function ChartComponent() {
  const [Chart, setChart] = useState<any>(null);

  useEffect(() => {
    // Only load chart library when needed
    import('chart.js').then(module => {
      setChart(() => module.Chart);
    });
  }, []);

  if (!Chart) return <div>Loading chart...</div>;

  return <Chart data={data} />;
}

// Tree-shakeable imports
// GOOD: Import only what you need
import { format } from 'date-fns';

// BAD: Imports entire library
import moment from 'moment';

// Use webpack magic comments for chunk names
const AdminPanel = lazy(() =>
  import(/* webpackChunkName: "admin" */ './AdminPanel')
);

const UserDashboard = lazy(() =>
  import(/* webpackChunkName: "dashboard" */ './UserDashboard')
);
```

## Image Optimization Techniques

```typescript
import { useState, useEffect } from 'react';

// Lazy loading images
function LazyImage({ src, alt, placeholder }: {
  src: string;
  alt: string;
  placeholder?: string;
}) {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageRef) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setImageSrc(src);
          observer.unobserve(imageRef);
        }
      });
    });

    observer.observe(imageRef);

    return () => {
      if (imageRef) observer.unobserve(imageRef);
    };
  }, [imageRef, src]);

  return (
    <img
      ref={setImageRef}
      src={imageSrc}
      alt={alt}
      loading="lazy"
    />
  );
}

// Progressive image loading
function ProgressiveImage({ src, placeholder }: {
  src: string;
  placeholder: string;
}) {
  const [currentSrc, setCurrentSrc] = useState(placeholder);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setCurrentSrc(src);
      setLoading(false);
    };
  }, [src]);

  return (
    <img
      src={currentSrc}
      style={{
        filter: loading ? 'blur(10px)' : 'none',
        transition: 'filter 0.3s'
      }}
    />
  );
}
```

## Concurrent Features: useTransition and useDeferredValue

```typescript
import { useState, useTransition, useDeferredValue } from 'react';

// useTransition for non-urgent updates
function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (value: string) => {
    setQuery(value); // Urgent: update input immediately

    // Non-urgent: defer expensive search
    startTransition(() => {
      const searchResults = performExpensiveSearch(value);
      setResults(searchResults);
    });
  };

  return (
    <>
      <input
        value={query}
        onChange={e => handleSearch(e.target.value)}
        placeholder="Search..."
      />
      {isPending && <div>Searching...</div>}
      <ResultsList results={results} />
    </>
  );
}

// useDeferredValue for deferring expensive renders
function ProductList({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  // This filters with the deferred value
  // UI stays responsive while filtering
  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      p.name.toLowerCase().includes(deferredQuery.toLowerCase())
    );
  }, [products, deferredQuery]);

  return (
    <>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Filter products..."
      />
      {query !== deferredQuery && <div>Updating...</div>}
      <div>
        {filteredProducts.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </>
  );
}
```

## Debouncing and Throttling

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Usage with search
function SearchWithDebounce() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 500);

  useEffect(() => {
    if (debouncedQuery) {
      // Only search after user stops typing for 500ms
      performSearch(debouncedQuery);
    }
  }, [debouncedQuery]);

  return (
    <input
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder="Search..."
    />
  );
}

// Custom throttle hook
function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => clearTimeout(handler);
  }, [value, limit]);

  return throttledValue;
}

// Throttle scroll events
function InfiniteScroll() {
  const [scrollPosition, setScrollPosition] = useState(0);
  const throttledScroll = useThrottle(scrollPosition, 200);

  useEffect(() => {
    const handleScroll = () => setScrollPosition(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Only process scroll every 200ms
    console.log('Throttled scroll position:', throttledScroll);
  }, [throttledScroll]);

  return <div>Scroll position: {throttledScroll}</div>;
}
```

## Optimizing Context Performance

```typescript
import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

// Split context to prevent unnecessary re-renders
const StateContext = createContext<State | null>(null);
const DispatchContext = createContext<Dispatch | null>(null);

function Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initialState);

  // Memoize dispatch to keep it stable
  const dispatch = useMemo(
    () => ({
      updateUser: (user: User) => setState(s => ({ ...s, user })),
      updateSettings: (settings: Settings) => setState(s => ({ ...s, settings }))
    }),
    []
  );

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

// Components only re-render when they use state that actually changes
function UserProfile() {
  const state = useContext(StateContext); // Re-renders on any state change
  return <div>{state?.user.name}</div>;
}

function SettingsButton() {
  const dispatch = useContext(DispatchContext); // Never re-renders
  return <button onClick={() => dispatch?.updateSettings({})}>Settings</button>;
}
```

## Web Workers for Heavy Computations

```typescript
import { useEffect, useState } from 'react';

// worker.ts
// self.addEventListener('message', (e) => {
//   const result = performHeavyCalculation(e.data);
//   self.postMessage(result);
// });

function useWebWorker<T, R>(workerFn: (data: T) => R) {
  const [result, setResult] = useState<R | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = (data: T) => {
    setLoading(true);
    setError(null);

    const worker = new Worker(
      URL.createObjectURL(
        new Blob([`(${workerFn.toString()})()`], { type: 'application/javascript' })
      )
    );

    worker.postMessage(data);

    worker.onmessage = (e) => {
      setResult(e.data);
      setLoading(false);
      worker.terminate();
    };

    worker.onerror = (e) => {
      setError(new Error(e.message));
      setLoading(false);
      worker.terminate();
    };
  };

  return { result, error, loading, execute };
}

// Usage
function DataProcessor() {
  const { result, loading, execute } = useWebWorker(
    (data: number[]) => {
      // Heavy calculation runs in worker
      return data.reduce((sum, n) => sum + n * n, 0);
    }
  );

  const handleProcess = () => {
    execute(Array.from({ length: 1000000 }, (_, i) => i));
  };

  return (
    <div>
      <button onClick={handleProcess} disabled={loading}>
        Process Data
      </button>
      {loading && <div>Processing...</div>}
      {result && <div>Result: {result}</div>}
    </div>
  );
}
```

## When to Use This Skill

Use react-performance when you need to:

- Optimize slow-rendering components
- Reduce bundle size with code splitting
- Handle large lists with virtualization
- Prevent unnecessary re-renders
- Improve application load time
- Optimize expensive computations
- Build performant React applications
- Debug performance issues
- Implement lazy loading strategies
- Improve Core Web Vitals scores
- Optimize for mobile devices
- Handle real-time data efficiently

## Best Practices

1. **Profile before optimizing** - Use React DevTools Profiler to identify actual
   bottlenecks before applying optimizations.

2. **Use React.memo wisely** - Only memoize components that render often with the
   same props or have expensive render logic.

3. **Memoize callbacks and values** - Use useCallback for functions passed to
   memoized children, useMemo for expensive computations.

4. **Code split by route** - Lazy load route components to reduce initial bundle
   size and improve load time.

5. **Virtualize long lists** - Use react-window or react-virtualized for lists
   with more than 100 items.

6. **Optimize images** - Lazy load images, use appropriate formats (WebP),
   implement progressive loading.

7. **Debounce expensive operations** - Debounce search inputs, API calls, and
   other expensive operations.

8. **Split context strategically** - Separate read and write contexts to prevent
   unnecessary consumer re-renders.

9. **Monitor bundle size** - Use webpack-bundle-analyzer to identify and remove
   large dependencies.

10. **Use concurrent features** - Leverage useTransition and useDeferredValue for
    better perceived performance.

## Common Pitfalls

1. **Premature optimization** - Don't optimize without measuring. Profile first,
   then optimize bottlenecks.

2. **Overusing memo** - Memoizing everything adds overhead. Only memoize when
   there's a measurable benefit.

3. **Wrong dependencies** - Missing dependencies in useMemo/useCallback leads to
   stale closures and bugs.

4. **Not measuring impact** - Always measure performance improvements with React
   Profiler or browser tools.

5. **Ignoring bundle size** - Importing large libraries for small features
   significantly impacts load time.

6. **Memoizing primitives** - useMemo is unnecessary for primitive values or
   simple calculations.

7. **Not using key prop** - Missing or incorrect keys in lists cause unnecessary
   re-renders and bugs.

8. **Inline function definitions** - Creating functions inline in JSX prevents
   React.memo from working effectively.

9. **Not code splitting** - Loading entire app upfront increases initial load
   time dramatically.

10. **Forgetting about network** - Optimize data fetching, use pagination,
    implement proper caching strategies.

## Resources

- [React Documentation - Performance](https://react.dev/learn/render-and-commit)
- [React DevTools Profiler](https://react.dev/learn/react-developer-tools)
- [Web.dev - React Performance](https://web.dev/react/)
- [React Performance Optimization Tips](https://kentcdodds.com/blog/usememo-and-usecallback)
- [Bundle Size Optimization](https://webpack.js.org/guides/code-splitting/)
- [react-window Documentation](https://github.com/bvaughn/react-window)
