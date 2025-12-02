---
name: jutsu-react-native:react-native-styling
description: Use when styling React Native components with StyleSheet, Flexbox layout, responsive design, and theming. Covers platform-specific styling and design systems.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# React Native Styling

Use this skill when styling React Native components using StyleSheet API, Flexbox layout, and creating responsive, platform-aware designs.

## Key Concepts

### StyleSheet API

Create optimized styles with StyleSheet:

```tsx
import { View, Text, StyleSheet } from 'react-native';

export default function Card() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Title</Text>
      <Text style={styles.body}>Body text</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android shadow
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
```

### Flexbox Layout

React Native uses Flexbox by default:

```tsx
import { View, StyleSheet } from 'react-native';

// Column layout (default)
const styles = StyleSheet.create({
  column: {
    flex: 1,
    flexDirection: 'column', // default
    justifyContent: 'flex-start', // default
    alignItems: 'stretch', // default
  },
});

// Row layout
const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
});

// Centered content
const centeredStyles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

### Responsive Design

Use Dimensions for responsive layouts:

```tsx
import { View, Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    width: width * 0.9, // 90% of screen width
    height: height * 0.5, // 50% of screen height
  },
  card: {
    width: width > 768 ? 400 : width * 0.9, // Tablet vs phone
  },
});
```

### Platform-Specific Styles

Apply platform-specific styles:

```tsx
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 20 : 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  text: {
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
    }),
  },
});
```

## Best Practices

### Use StyleSheet.create()

Always use StyleSheet for performance:

```tsx
// Bad - Creates new object on every render
<View style={{ padding: 16, backgroundColor: '#fff' }}>
  <Text>Content</Text>
</View>

// Good - Optimized with StyleSheet
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

### Combine Styles with Array

Compose styles using arrays:

```tsx
import { View, Text, StyleSheet } from 'react-native';

function Button({ primary, disabled }: { primary?: boolean; disabled?: boolean }) {
  return (
    <View style={[
      styles.button,
      primary && styles.buttonPrimary,
      disabled && styles.buttonDisabled,
    ]}>
      <Text style={[
        styles.buttonText,
        primary && styles.buttonTextPrimary,
      ]}>
        Press Me
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    textAlign: 'center',
    color: '#333',
    fontWeight: '600',
  },
  buttonTextPrimary: {
    color: '#fff',
  },
});
```

### Design Tokens

Create reusable design tokens:

```tsx
// theme.ts
export const colors = {
  primary: '#007AFF',
  secondary: '#5856D6',
  success: '#34C759',
  error: '#FF3B30',
  warning: '#FF9500',
  background: '#FFFFFF',
  surface: '#F2F2F7',
  text: {
    primary: '#000000',
    secondary: '#3C3C43',
    tertiary: '#8E8E93',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    lineHeight: 32,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
  },
};

export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

// Usage
import { colors, spacing, typography, shadows } from './theme';

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.h1,
    color: colors.text.primary,
  },
  card: {
    ...shadows.medium,
    borderRadius: 8,
  },
});
```

### Theme Context

Implement theme switching:

```tsx
import React, { createContext, useContext, useState } from 'react';

type Theme = {
  colors: {
    background: string;
    text: string;
    primary: string;
  };
};

const lightTheme: Theme = {
  colors: {
    background: '#FFFFFF',
    text: '#000000',
    primary: '#007AFF',
  },
};

const darkTheme: Theme = {
  colors: {
    background: '#000000',
    text: '#FFFFFF',
    primary: '#0A84FF',
  },
};

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({
  theme: lightTheme,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider
      value={{
        theme: isDark ? darkTheme : lightTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

// Usage
function MyComponent() {
  const { theme } = useTheme();

  return (
    <View style={{ backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.text }}>Themed Text</Text>
    </View>
  );
}
```

## Common Patterns

### Card Component with Variants

```tsx
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

interface CardProps {
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
}

export default function Card({ title, children, variant = 'default' }: CardProps) {
  const variantStyle = variant === 'outlined'
    ? styles.outlined
    : variant === 'elevated'
    ? styles.elevated
    : styles.default;

  return (
    <View style={[styles.card, variantStyle]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  default: {
    backgroundColor: '#F2F2F7',
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C6C6C8',
  },
  elevated: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  content: {
    marginTop: 8,
  },
});
```

### Responsive Grid

```tsx
import React from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';

const { width } = Dimensions.get('window');
const columns = width > 768 ? 3 : 2;
const gap = 16;
const itemWidth = (width - (columns + 1) * gap) / columns;

function Grid({ items }: { items: React.ReactNode[] }) {
  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <View key={index} style={styles.item}>
          {item}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: gap,
    gap: gap,
  },
  item: {
    width: itemWidth,
  },
});
```

### Animated Button

```tsx
import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  Animated,
  PressableStateCallbackType,
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
}

export default function AnimatedButton({ title, onPress }: ButtonProps) {
  const scale = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.button,
            { transform: [{ scale }] },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.text}>{title}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  pressed: {
    backgroundColor: '#0051D5',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

## Anti-Patterns

### Don't Use Percentages for Dimensions

```tsx
// Bad - Percentages don't work as expected
<View style={{ width: '50%' }}>
  <Text>Half width</Text>
</View>

// Good - Use flex or specific dimensions
<View style={{ flex: 1 }}>
  <Text>Full width</Text>
</View>
```

### Don't Forget Platform-Specific Shadows

```tsx
// Bad - Only iOS shadow
<View style={{
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
}}>
  <Text>Card</Text>
</View>

// Good - Both iOS and Android
<View style={{
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 4, // Android
}}>
  <Text>Card</Text>
</View>
```

### Don't Use Transform for Layout

```tsx
// Bad - Transform doesn't affect layout
<View style={{ transform: [{ translateX: 100 }] }}>
  <Text>Moved</Text>
</View>

// Good - Use margin/padding for layout
<View style={{ marginLeft: 100 }}>
  <Text>Moved</Text>
</View>
```

### Don't Hardcode Colors

```tsx
// Bad - Hardcoded colors
<View style={{ backgroundColor: '#007AFF' }}>
  <Text style={{ color: '#FFFFFF' }}>Text</Text>
</View>

// Good - Use design tokens
import { colors } from './theme';

<View style={{ backgroundColor: colors.primary }}>
  <Text style={{ color: colors.text.onPrimary }}>Text</Text>
</View>
```

## Related Skills

- **react-native-components**: Styling core components
- **react-native-platform**: Platform-specific styling considerations
- **react-native-performance**: Optimizing style performance
