# Buki: React Native

Validation and quality enforcement for React Native mobile applications.

## What This Buki Provides

### Validation Hooks

- **TypeScript Type Check**: Runs TypeScript compiler to validate types in React Native projects
- **Fast Validation**: Provides quick feedback on type errors before commits
- **Monorepo Support**: Validates only directories with package.json files

### Skills

This buki provides the following skills:

- **react-native-components**: Building UI components with core components (View, Text, Image, FlatList) and component composition patterns
- **react-native-navigation**: Implementing navigation with React Navigation including stack, tab, drawer navigation, and deep linking
- **react-native-styling**: Styling components with StyleSheet, Flexbox layout, responsive design, and theming
- **react-native-platform**: Handling platform-specific code for iOS and Android with Platform API and native modules
- **react-native-performance**: Optimizing app performance with FlatList optimization, memoization, and bundle size reduction
- **react-native-native-modules**: Building and integrating native modules, Turbo Modules, and bridging native code

## Installation

Install via the Han marketplace:

```bash
npx @thebushidocollective/han install
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install buki-react-native@han
```

## Usage

Once installed, this buki automatically validates your React Native code:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work
- Before commits (when combined with git hooks)

The validation runs `tsc --noEmit` to check for TypeScript type errors without generating output files.

## Requirements

- React Native 0.70 or higher
- TypeScript 4.5 or higher
- Node.js 16 or higher

## Why React Native?

React Native enables building native mobile apps using React and JavaScript/TypeScript:

- **Cross-Platform**: Write once, run on iOS and Android
- **Native Performance**: Uses native components and APIs
- **Hot Reload**: See changes instantly without rebuilding
- **Large Ecosystem**: Thousands of packages and community support
- **Shared Codebase**: Share code with React web applications
- **Native Modules**: Extend with platform-specific functionality

## Features Covered by Skills

### Core Components
- View, Text, Image, ScrollView
- FlatList and SectionList for performance
- TextInput, Button, Pressable
- Modal, SafeAreaView
- Platform-specific components

### Navigation
- Stack navigation with type safety
- Tab navigation with icons
- Drawer navigation
- Nested navigators
- Deep linking configuration
- Authentication flows

### Styling
- StyleSheet API for optimized styles
- Flexbox layout system
- Responsive design with Dimensions
- Platform-specific styling
- Design tokens and theming
- Dark mode support

### Platform APIs
- Platform detection (iOS/Android)
- Platform-specific files (.ios.tsx, .android.tsx)
- Permissions handling
- Back button (Android)
- Status bar configuration
- Linking to native apps

### Performance Optimization
- FlatList virtualization
- React.memo and useMemo
- Image optimization
- Bundle size reduction
- Code splitting
- Debouncing and throttling
- Animation optimization

### Native Modules
- Creating native modules (Swift/Kotlin)
- Turbo Modules for better performance
- Native events
- Custom native UI components
- Biometric authentication
- Camera and device APIs

## Philosophy

This buki embodies the Bushido virtues:

- **Integrity (誠 - Makoto)**: Ensures code meets quality standards through type checking
- **Respect (礼 - Rei)**: Validates work thoroughly across both platforms
- **Courage (勇 - Yū)**: Fails fast when issues are found to maintain quality

## Quick Start Examples

### Simple App

```tsx
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Hello React Native!</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
```

### List with Navigation

```tsx
import React from 'react';
import { FlatList, TouchableOpacity, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface Item {
  id: string;
  title: string;
}

function ListScreen({ items }: { items: Item[] }) {
  const navigation = useNavigation();

  return (
    <FlatList
      data={items}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Details', { itemId: item.id })}
        >
          <Text>{item.title}</Text>
        </TouchableOpacity>
      )}
    />
  );
}
```

### Platform-Specific Code

```tsx
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
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
});
```

## Common Libraries

This buki works well with popular React Native libraries:

- **React Navigation**: Navigation library (covered in skills)
- **React Native Reanimated**: Smooth animations
- **React Native Gesture Handler**: Touch gesture system
- **Expo**: Managed workflow and additional APIs
- **Redux/MobX/Zustand**: State management
- **React Query**: Data fetching and caching
- **Fast Image**: Optimized image loading

## Project Structure

Recommended structure for React Native apps:

```
my-app/
├── src/
│   ├── components/       # Reusable components
│   ├── screens/          # Screen components
│   ├── navigation/       # Navigation configuration
│   ├── hooks/            # Custom hooks
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript types
│   ├── theme/            # Design tokens and styles
│   └── App.tsx           # Root component
├── android/              # Android native code
├── ios/                  # iOS native code
├── package.json
└── tsconfig.json
```

## Testing

React Native apps can be tested with:

- **Jest**: Unit testing (included by default)
- **React Native Testing Library**: Component testing
- **Detox**: End-to-end testing
- **Maestro**: Mobile UI testing

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
