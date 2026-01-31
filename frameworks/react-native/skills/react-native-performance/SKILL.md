---
name: jutsu-react-native:react-native-performance
description: Use when optimizing React Native app performance. Covers FlatList optimization, memoization, image optimization, bundle size reduction, and profiling techniques.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# React Native Performance

Use this skill when optimizing React Native applications for better performance, faster load times, and smoother user experiences.

## Key Concepts

### List Performance

Optimize FlatList for large datasets:

```tsx
import React, { useCallback } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';

interface Item {
  id: string;
  title: string;
}

const ItemComponent = React.memo(({ item }: { item: Item }) => (
  <View style={styles.item}>
    <Text>{item.title}</Text>
  </View>
));

function OptimizedList({ data }: { data: Item[] }) {
  const renderItem = useCallback(
    ({ item }: { item: Item }) => <ItemComponent item={item} />,
    []
  );

  const keyExtractor = useCallback((item: Item) => item.id, []);

  const getItemLayout = useCallback(
    (data: any, index: number) => ({
      length: 80, // Fixed item height
      offset: 80 * index,
      index,
    }),
    []
  );

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={10}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  item: {
    height: 80,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
});
```

### Component Memoization

Use React.memo and useMemo:

```tsx
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';

interface UserCardProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
  onPress: () => void;
}

// Memoize component to prevent unnecessary re-renders
const UserCard = React.memo(({ user, onPress }: UserCardProps) => {
  return (
    <View>
      <Text>{user.name}</Text>
      <Text>{user.email}</Text>
    </View>
  );
});

// Memoize expensive computations
function UserList({ users }: { users: User[] }) {
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  return (
    <View>
      {sortedUsers.map(user => (
        <UserCard key={user.id} user={user} onPress={() => {}} />
      ))}
    </View>
  );
}
```

### Image Optimization

Optimize image loading and caching:

```tsx
import React from 'react';
import { Image, View } from 'react-native';
import FastImage from 'react-native-fast-image';

// Use FastImage for better performance
function OptimizedImage({ uri }: { uri: string }) {
  return (
    <FastImage
      style={{ width: 200, height: 200 }}
      source={{
        uri,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.immutable,
      }}
      resizeMode={FastImage.resizeMode.cover}
    />
  );
}

// Lazy load images
function LazyImage({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      style={{ width: 200, height: 200 }}
      resizeMode="cover"
      loadingIndicatorSource={require('./placeholder.png')}
    />
  );
}
```

## Best Practices

### Use useCallback for Event Handlers

Prevent unnecessary re-renders:

```tsx
import React, { useCallback, useState } from 'react';
import { View, Button, Text } from 'react-native';

function Counter() {
  const [count, setCount] = useState(0);

  // Bad - Creates new function on every render
  // const increment = () => setCount(count + 1);

  // Good - Memoized callback
  const increment = useCallback(() => {
    setCount(c => c + 1);
  }, []);

  return (
    <View>
      <Text>{count}</Text>
      <Button title="Increment" onPress={increment} />
    </View>
  );
}
```

### Virtualized Lists Only

Use FlatList/SectionList for scrollable content:

```tsx
// Bad - ScrollView with map (renders all items)
<ScrollView>
  {items.map(item => (
    <ItemComponent key={item.id} item={item} />
  ))}
</ScrollView>

// Good - FlatList (virtualizes items)
<FlatList
  data={items}
  keyExtractor={item => item.id}
  renderItem={({ item }) => <ItemComponent item={item} />}
/>
```

### Avoid Anonymous Functions in Render

```tsx
// Bad - Creates new function on every render
<FlatList
  data={items}
  renderItem={({ item }) => (
    <TouchableOpacity onPress={() => console.log(item.id)}>
      <Text>{item.title}</Text>
    </TouchableOpacity>
  )}
/>

// Good - Memoized render function
const renderItem = useCallback(({ item }: { item: Item }) => (
  <ItemRow item={item} onPress={handleItemPress} />
), [handleItemPress]);

<FlatList
  data={items}
  renderItem={renderItem}
/>
```

### Optimize Bundle Size

Reduce JavaScript bundle size:

```bash
# Analyze bundle
npx react-native-bundle-visualizer

# Enable Hermes engine (app.json for Expo)
{
  "expo": {
    "jsEngine": "hermes"
  }
}

# Enable Hermes (android/app/build.gradle for bare React Native)
project.ext.react = [
  enableHermes: true
]

# Use ProGuard for Android (android/app/build.gradle)
def enableProguardInReleaseBuilds = true
```

### Code Splitting

Split code for faster initial load:

```tsx
import React, { lazy, Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native';

// Lazy load heavy components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<ActivityIndicator />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

## Common Patterns

### Debounced Search

```tsx
import React, { useState, useCallback, useEffect } from 'react';
import { TextInput, FlatList } from 'react-native';

function SearchableList({ data }: { data: Item[] }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const filteredData = useMemo(() => {
    if (!debouncedQuery) return data;
    return data.filter(item =>
      item.title.toLowerCase().includes(debouncedQuery.toLowerCase())
    );
  }, [data, debouncedQuery]);

  return (
    <>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search..."
      />
      <FlatList
        data={filteredData}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ItemComponent item={item} />}
      />
    </>
  );
}
```

### Optimized Animations

Use react-native-reanimated for smooth animations:

```tsx
import React from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';

function AnimatedButton() {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.button, animatedStyle]}>
        <Text>Press Me</Text>
      </Animated.View>
    </Pressable>
  );
}
```

### Pagination

Implement efficient pagination:

```tsx
import React, { useState, useCallback } from 'react';
import { FlatList, ActivityIndicator } from 'react-native';

function PaginatedList() {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const loadMore = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    const newData = await fetchData(page);
    setData(prev => [...prev, ...newData]);
    setPage(p => p + 1);
    setLoading(false);
  }, [loading, page]);

  const renderItem = useCallback(
    ({ item }: { item: Item }) => <ItemComponent item={item} />,
    []
  );

  const renderFooter = () => {
    if (!loading) return null;
    return <ActivityIndicator style={{ margin: 16 }} />;
  };

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={renderFooter}
    />
  );
}
```

### Memoized Selector

```tsx
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';

interface User {
  id: string;
  name: string;
  age: number;
  active: boolean;
}

function UserStats({ users }: { users: User[] }) {
  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(u => u.active).length,
      averageAge: users.reduce((sum, u) => sum + u.age, 0) / users.length,
    };
  }, [users]);

  return (
    <View>
      <Text>Total: {stats.total}</Text>
      <Text>Active: {stats.active}</Text>
      <Text>Average Age: {stats.averageAge.toFixed(1)}</Text>
    </View>
  );
}
```

### Image Preloading

```tsx
import { Image } from 'react-native';

async function preloadImages(imageUrls: string[]) {
  const promises = imageUrls.map(url =>
    Image.prefetch(url)
  );

  await Promise.all(promises);
}

// Usage
useEffect(() => {
  preloadImages([
    'https://example.com/image1.jpg',
    'https://example.com/image2.jpg',
  ]);
}, []);
```

## Anti-Patterns

### Don't Use console.log in Production

```tsx
// Bad - Logs slow down production
console.log('User data:', user);

// Good - Remove or use __DEV__
if (__DEV__) {
  console.log('User data:', user);
}
```

### Don't Inline Large Objects

```tsx
// Bad - Creates new object on every render
<Component
  style={{ width: 100, height: 100, backgroundColor: '#fff' }}
  config={{ option1: true, option2: false }}
/>

// Good - Use StyleSheet and constants
const styles = StyleSheet.create({
  component: { width: 100, height: 100, backgroundColor: '#fff' },
});

const config = { option1: true, option2: false };

<Component style={styles.component} config={config} />
```

### Don't Forget to Clean Up

```tsx
// Bad - Memory leak
useEffect(() => {
  const timer = setInterval(() => {
    console.log('Tick');
  }, 1000);
}, []);

// Good - Clean up
useEffect(() => {
  const timer = setInterval(() => {
    console.log('Tick');
  }, 1000);

  return () => clearInterval(timer);
}, []);
```

### Don't Use setState in Loops

```tsx
// Bad - Multiple re-renders
items.forEach(item => {
  setData(prev => [...prev, item]);
});

// Good - Single update
setData(prev => [...prev, ...items]);
```

## Profiling Tools

### React DevTools Profiler

```tsx
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number
) {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}

<Profiler id="MyComponent" onRender={onRenderCallback}>
  <MyComponent />
</Profiler>
```

### Performance Monitor

```tsx
import { PerformanceObserver, performance } from 'perf_hooks';

// Enable performance monitor
if (__DEV__) {
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      console.log(`${entry.name}: ${entry.duration}ms`);
    });
  });

  observer.observe({ entryTypes: ['measure'] });
}
```

## Related Skills

- **react-native-components**: Building performant components
- **react-native-navigation**: Optimizing navigation performance
- **react-native-native-modules**: Native performance optimization
