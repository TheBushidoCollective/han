---
name: react-native-web-styling
description: Use when styling React Native Web components. Provides patterns for StyleSheet API, platform-specific styles, responsive design, and theming.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# React Native Web - Styling

Comprehensive styling patterns for React Native Web, including responsive design, theming, and platform-specific styles.

## Key Concepts

### StyleSheet API

Use `StyleSheet.create()` for optimized styles:

```typescript
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  text: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
});
```

### Flexbox Layout

React Native uses Flexbox for layout (defaults differ from web):

```typescript
const styles = StyleSheet.create({
  // Default flexDirection is 'column' (not 'row' like web)
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
```

### Platform-Specific Styles

Use `Platform.select()` for different styles per platform:

```typescript
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      web: {
        maxWidth: 1200,
        marginHorizontal: 'auto',
      },
      native: {
        paddingHorizontal: 16,
      },
    }),
  },
});
```

## Best Practices

### Responsive Design

✅ Use percentage-based widths and flexbox:

```typescript
const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 1200,
  },
  column: {
    flex: 1,
    minWidth: 300,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
```

### Media Queries (Web)

✅ Use `useWindowDimensions` for responsive behavior:

```typescript
import { useWindowDimensions, StyleSheet } from 'react-native';

function ResponsiveComponent() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      {/* Content */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  containerDesktop: {
    padding: 32,
    maxWidth: 1200,
  },
});
```

### Theming

✅ Create a theme context:

```typescript
import React, { createContext, useContext, ReactNode } from 'react';

interface Theme {
  colors: {
    primary: string;
    background: string;
    text: string;
    border: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}

const lightTheme: Theme = {
  colors: {
    primary: '#007AFF',
    background: '#FFFFFF',
    text: '#000000',
    border: '#E5E5E5',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={lightTheme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

## Examples

### Styled Component

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ButtonProps {
  title: string;
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  onPress: () => void;
}

export function Button({
  title,
  variant = 'primary',
  size = 'medium',
  onPress
}: ButtonProps) {
  return (
    <Pressable onPress={onPress}>
      <View style={[styles.button, styles[variant], styles[size]]}>
        <Text style={[styles.text, styles[`${variant}Text`]]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#007AFF',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  small: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  medium: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  large: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  text: {
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#007AFF',
  },
});
```

### Responsive Grid

```typescript
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

interface GridProps {
  children: React.ReactNode;
  columns?: number;
  gap?: number;
}

export function Grid({ children, columns = 3, gap = 16 }: GridProps) {
  const { width } = useWindowDimensions();

  // Responsive columns
  const responsiveColumns = width < 640 ? 1 : width < 1024 ? 2 : columns;

  return (
    <View style={[styles.grid, { gap }]}>
      {React.Children.map(children, (child) => (
        <View style={[styles.gridItem, {
          width: `${100 / responsiveColumns}%`,
          padding: gap / 2,
        }]}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: -8,
  },
  gridItem: {
    flexGrow: 0,
    flexShrink: 0,
  },
});
```

### Shadows and Elevation

```typescript
import { StyleSheet, Platform } from 'react-native';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // Android elevation
    elevation: 3,
    // Web box-shadow (handled by React Native Web)
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
});
```

## Common Patterns

### Dynamic Styles

```typescript
function DynamicComponent({ isActive, size }: { isActive: boolean; size: number }) {
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: isActive ? '#007AFF' : '#E5E5E5',
      width: size,
      height: size,
    },
  });

  return <View style={[styles.base, dynamicStyles.container]} />;
}
```

### Style Composition

```typescript
const baseStyles = StyleSheet.create({
  text: {
    fontSize: 16,
    fontFamily: 'System',
  },
});

const componentStyles = StyleSheet.create({
  heading: {
    ...baseStyles.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  body: {
    ...baseStyles.text,
    lineHeight: 24,
  },
});
```

### Absolute Positioning

```typescript
const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

## Anti-Patterns

❌ Don't use CSS classes or stylesheets:

```typescript
// Bad
<div className="container" style={{ color: 'red' }} />

// Good
<View style={styles.container} />
```

❌ Don't use pixel values for fonts (use numbers):

```typescript
// Bad
fontSize: '16px'

// Good
fontSize: 16
```

❌ Don't inline complex styles:

```typescript
// Bad
<View style={{
  padding: 16,
  backgroundColor: '#fff',
  borderRadius: 8,
  shadowColor: '#000',
  // ... many more properties
}} />

// Good
<View style={styles.container} />
```

❌ Don't use margin for spacing in lists (use gap or paddingVertical):

```typescript
// Bad
items.map((item, i) => (
  <View key={item.id} style={{ marginBottom: i === items.length - 1 ? 0 : 16 }}>
    {/* Content */}
  </View>
))

// Good
<View style={styles.list}>
  {items.map((item) => (
    <View key={item.id} style={styles.listItem}>
      {/* Content */}
    </View>
  ))}
</View>

const styles = StyleSheet.create({
  list: {
    gap: 16,
  },
});
```

## Related Skills

- **react-native-web-core**: Core React Native Web concepts
- **react-native-web-performance**: Performance optimization for styles
- **react-native-web-testing**: Testing styled components
