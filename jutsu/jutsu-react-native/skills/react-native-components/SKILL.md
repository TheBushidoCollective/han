---
name: jutsu-react-native:react-native-components
description: Use when building React Native UI components with core components, custom components, and component patterns. Covers View, Text, Image, ScrollView, FlatList, and component composition.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# React Native Components

Use this skill when building user interfaces with React Native's core components and creating custom reusable components.

## Key Concepts

### Core Components

React Native provides platform-agnostic components that map to native views:

```tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView>
        <View>
          <Text>Hello, React Native!</Text>
          <Image
            source={{ uri: 'https://example.com/image.jpg' }}
            style={{ width: 200, height: 200 }}
          />
          <TextInput
            placeholder="Enter text"
            style={{ borderWidth: 1, padding: 10 }}
          />
          <TouchableOpacity onPress={() => console.log('Pressed')}>
            <Text>Press Me</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

### View Component

The fundamental building block:

```tsx
import { View } from 'react-native';

function Container({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      flex: 1,
      padding: 16,
      backgroundColor: '#fff',
    }}>
      {children}
    </View>
  );
}
```

### Text Component

All text must be wrapped in `<Text>`:

```tsx
import { Text } from 'react-native';

function Heading({ children }: { children: string }) {
  return (
    <Text style={{
      fontSize: 24,
      fontWeight: 'bold',
      color: '#333',
    }}>
      {children}
    </Text>
  );
}

function Body({ children }: { children: string }) {
  return (
    <Text style={{
      fontSize: 16,
      lineHeight: 24,
      color: '#666',
    }}>
      {children}
    </Text>
  );
}
```

### Image Component

Display images from various sources:

```tsx
import { Image } from 'react-native';

// Remote image
<Image
  source={{ uri: 'https://example.com/image.jpg' }}
  style={{ width: 200, height: 200 }}
/>

// Local image
<Image
  source={require('./assets/logo.png')}
  style={{ width: 100, height: 100 }}
/>

// With resize mode
<Image
  source={{ uri: 'https://example.com/image.jpg' }}
  style={{ width: 200, height: 200 }}
  resizeMode="cover"
/>
```

## Best Practices

### Use SafeAreaView for iOS Notch

Always use SafeAreaView to handle safe areas:

```tsx
import { SafeAreaView } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Your content */}
    </SafeAreaView>
  );
}
```

### FlatList for Long Lists

Use FlatList instead of ScrollView for performance:

```tsx
import { FlatList, Text, View } from 'react-native';

interface Item {
  id: string;
  title: string;
}

function ItemList({ items }: { items: Item[] }) {
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={{ padding: 16 }}>
          <Text>{item.title}</Text>
        </View>
      )}
      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={10}
      windowSize={10}
    />
  );
}
```

### Touchable Components

Use appropriate touchables for platform:

```tsx
import { TouchableOpacity, TouchableHighlight, Pressable } from 'react-native';

// Modern approach - Pressable (recommended)
<Pressable
  onPress={() => console.log('Pressed')}
  style={({ pressed }) => [
    { padding: 12, backgroundColor: pressed ? '#ddd' : '#fff' }
  ]}
>
  {({ pressed }) => (
    <Text style={{ color: pressed ? '#000' : '#333' }}>Press Me</Text>
  )}
</Pressable>

// TouchableOpacity - simple fade effect
<TouchableOpacity
  onPress={() => console.log('Pressed')}
  activeOpacity={0.7}
>
  <Text>Press Me</Text>
</TouchableOpacity>
```

### Component Composition

Build complex UIs from simple components:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface CardProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

function Card({ title, subtitle, children }: CardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {children && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  content: {
    marginTop: 8,
  },
});

export default Card;
```

## Common Patterns

### List with Pull-to-Refresh

```tsx
import React, { useState, useCallback } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

interface Item {
  id: string;
  title: string;
}

function RefreshableList({ items, onRefresh }: {
  items: Item[];
  onRefresh: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={{ padding: 16 }}>
          <Text>{item.title}</Text>
        </View>
      )}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    />
  );
}
```

### Infinite Scroll List

```tsx
import React from 'react';
import { FlatList, ActivityIndicator, View } from 'react-native';

interface Item {
  id: string;
  title: string;
}

function InfiniteList({
  items,
  loading,
  onEndReached
}: {
  items: Item[];
  loading: boolean;
  onEndReached: () => void;
}) {
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={{ padding: 16 }}>
          <Text>{item.title}</Text>
        </View>
      )}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        loading ? (
          <View style={{ padding: 16 }}>
            <ActivityIndicator size="large" />
          </View>
        ) : null
      }
    />
  );
}
```

### Modal Component

```tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

interface CustomModalProps {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

function CustomModal({ visible, title, children, onClose }: CustomModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.content}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  content: {
    marginTop: 8,
  },
});

export default CustomModal;
```

### Form Input Component

```tsx
import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
} from 'react-native';

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
}

function FormInput({ label, error, ...props }: FormInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: '#007AFF',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  error: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
});

export default FormInput;
```

## Anti-Patterns

### Don't Nest ScrollViews

```tsx
// Bad - Nested ScrollViews cause issues
<ScrollView>
  <ScrollView>
    <Text>Content</Text>
  </ScrollView>
</ScrollView>

// Good - Use single ScrollView
<ScrollView>
  <View>
    <Text>Content</Text>
  </View>
</ScrollView>
```

### Don't Use Inline Styles for Static Values

```tsx
// Bad - Creates new object on every render
<View style={{ padding: 16, backgroundColor: '#fff' }}>
  <Text>Content</Text>
</View>

// Good - Use StyleSheet
const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
});

<View style={styles.container}>
  <Text>Content</Text>
</View>
```

### Don't Forget to Set keyExtractor

```tsx
// Bad - May cause rendering issues
<FlatList
  data={items}
  renderItem={({ item }) => <Text>{item.title}</Text>}
/>

// Good - Provide unique key
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <Text>{item.title}</Text>}
/>
```

### Don't Use Index as Key

```tsx
// Bad - Index as key causes issues with reordering
<FlatList
  data={items}
  keyExtractor={(item, index) => index.toString()}
  renderItem={({ item }) => <Text>{item.title}</Text>}
/>

// Good - Use unique identifier
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <Text>{item.title}</Text>}
/>
```

## Related Skills

- **react-native-styling**: Styling components with StyleSheet
- **react-native-navigation**: Navigation between screens
- **react-native-performance**: Optimizing component performance
