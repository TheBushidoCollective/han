---
name: jutsu-expo:expo-router
description: Use when implementing file-based routing in Expo with Expo Router. Covers app directory structure, navigation, layouts, dynamic routes, and deep linking.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Expo Router

Use this skill when implementing file-based routing with Expo Router, the recommended navigation solution for Expo apps.

## Key Concepts

### File-Based Routing

Routes are defined by file structure:

```
app/
  _layout.tsx          # Root layout
  index.tsx            # / route
  about.tsx            # /about route
  (tabs)/              # Group (not in URL)
    _layout.tsx        # Tabs layout
    home.tsx           # /home
    profile.tsx        # /profile
  users/
    [id].tsx           # /users/:id dynamic route
    index.tsx          # /users route
```

### Basic Routes

```tsx
// app/index.tsx
import { View, Text } from 'react-native';
import { Link } from 'expo-router';

export default function Home() {
  return (
    <View>
      <Text>Home Screen</Text>
      <Link href="/about">Go to About</Link>
    </View>
  );
}

// app/about.tsx
export default function About() {
  return (
    <View>
      <Text>About Screen</Text>
    </View>
  );
}
```

### Layouts

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Home' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
    </Stack>
  );
}
```

### Tab Navigation

```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

## Best Practices

### Dynamic Routes

```tsx
// app/users/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { View, Text } from 'react-native';

export default function UserDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View>
      <Text>User ID: {id}</Text>
    </View>
  );
}

// Navigate to /users/123
<Link href="/users/123">View User</Link>
// Or
import { router } from 'expo-router';
router.push('/users/123');
```

### Programmatic Navigation

```tsx
import { router } from 'expo-router';

function MyComponent() {
  const handlePress = () => {
    // Navigate to route
    router.push('/details');

    // Navigate with params
    router.push({
      pathname: '/users/[id]',
      params: { id: '123' },
    });

    // Replace current route
    router.replace('/login');

    // Go back
    router.back();
  };

  return <Button title="Navigate" onPress={handlePress} />;
}
```

### Type-Safe Routes

```tsx
// types/navigation.ts
export type RootStackParamList = {
  '/': undefined;
  '/about': undefined;
  '/users/[id]': { id: string };
  '/posts/[id]': { id: string; title?: string };
};

// Usage with type safety
import { router } from 'expo-router';
import type { RootStackParamList } from './types/navigation';

// TypeScript will enforce correct params
router.push({
  pathname: '/users/[id]' as const,
  params: { id: '123' },
});
```

### Route Groups

Group routes without affecting URLs:

```
app/
  (auth)/              # Group (not in URL)
    login.tsx          # /login
    register.tsx       # /register
    _layout.tsx        # Auth layout
  (app)/               # Group (not in URL)
    home.tsx           # /home
    profile.tsx        # /profile
    _layout.tsx        # App layout
```

```tsx
// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
```

## Common Patterns

### Authentication Flow

```tsx
// app/_layout.tsx
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';

export default function RootLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(app)/home');
    }
  }, [user, loading, segments]);

  return <Slot />;
}
```

### Modal Routes

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="modal"
        options={{
          presentation: 'modal',
          title: 'Modal',
        }}
      />
    </Stack>
  );
}

// app/modal.tsx
import { View, Text, Button } from 'react-native';
import { router } from 'expo-router';

export default function Modal() {
  return (
    <View>
      <Text>Modal Content</Text>
      <Button title="Close" onPress={() => router.back()} />
    </View>
  );
}
```

### Deep Linking

```json
// app.json
{
  "expo": {
    "scheme": "myapp",
    "plugins": ["expo-router"]
  }
}
```

```tsx
// Deep link: myapp://users/123
// Opens app/users/[id].tsx with id="123"

// Universal link: https://myapp.com/users/123
// Requires additional iOS/Android configuration
```

### Search Params

```tsx
import { useLocalSearchParams } from 'expo-router';

function ProductScreen() {
  const { id, category, sort } = useLocalSearchParams<{
    id: string;
    category?: string;
    sort?: string;
  }>();

  return (
    <View>
      <Text>Product: {id}</Text>
      <Text>Category: {category}</Text>
      <Text>Sort: {sort}</Text>
    </View>
  );
}

// Navigate with query params
<Link href="/products/123?category=electronics&sort=price">
  View Product
</Link>
```

## Anti-Patterns

### Don't Use React Navigation Directly

```tsx
// Bad - Mixing Expo Router with React Navigation
import { NavigationContainer } from '@react-navigation/native';

// Good - Use Expo Router only
import { Stack } from 'expo-router';
```

### Don't Nest Navigators Incorrectly

```tsx
// Bad - Multiple Stack navigators without layout
// app/home.tsx
<Stack>
  <Stack.Screen name="details" />
</Stack>

// Good - Use layouts for nested navigation
// app/home/_layout.tsx
<Stack>
  <Stack.Screen name="index" />
  <Stack.Screen name="details" />
</Stack>
```

### Don't Hardcode Routes

```tsx
// Bad - String literals everywhere
router.push('/users/123');
router.push('/prodcts/456'); // Typo won't be caught

// Good - Use constants or typed routes
const ROUTES = {
  USER_DETAILS: (id: string) => `/users/${id}` as const,
  PRODUCT_DETAILS: (id: string) => `/products/${id}` as const,
} as const;

router.push(ROUTES.USER_DETAILS('123'));
```

## Related Skills

- **expo-config**: Configuring deep linking
- **expo-modules**: Using navigation with Expo modules
