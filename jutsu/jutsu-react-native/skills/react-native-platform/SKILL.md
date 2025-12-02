---
name: jutsu-react-native:react-native-platform
description: Use when handling platform-specific code in React Native for iOS and Android. Covers Platform API, platform-specific components, native modules, and cross-platform best practices.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# React Native Platform APIs

Use this skill when writing platform-specific code for iOS and Android, handling platform differences, and accessing native functionality.

## Key Concepts

### Platform Detection

Detect the current platform:

```tsx
import { Platform } from 'react-native';

// Simple check
if (Platform.OS === 'ios') {
  console.log('Running on iOS');
} else if (Platform.OS === 'android') {
  console.log('Running on Android');
}

// Platform.select
const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        paddingTop: 20,
      },
      android: {
        paddingTop: 0,
      },
    }),
  },
});

// Get platform version
console.log(`Android API Level: ${Platform.Version}`); // Android
console.log(`iOS Version: ${Platform.Version}`); // iOS
```

### Platform-Specific Files

Create platform-specific files:

```
components/
  Button.ios.tsx      # iOS implementation
  Button.android.tsx  # Android implementation
  Button.tsx          # Shared/default implementation
```

```tsx
// Button.ios.tsx
import React from 'react';
import { View, Text } from 'react-native';

export default function Button({ title, onPress }: ButtonProps) {
  return (
    <View style={{ /* iOS-specific styles */ }}>
      <Text>{title}</Text>
    </View>
  );
}

// Button.android.tsx
import React from 'react';
import { View, Text } from 'react-native';

export default function Button({ title, onPress }: ButtonProps) {
  return (
    <View style={{ /* Android-specific styles */ }}>
      <Text>{title}</Text>
    </View>
  );
}

// Usage - React Native automatically picks the right file
import Button from './components/Button';
```

### Platform-Specific Components

Use platform-specific components:

```tsx
import {
  Platform,
  StatusBar,
  TouchableOpacity,
  TouchableNativeFeedback,
  View,
} from 'react-native';

// StatusBar
<StatusBar
  barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
  backgroundColor={Platform.OS === 'android' ? '#007AFF' : undefined}
/>

// Touchable components
const Touchable = Platform.OS === 'android'
  ? TouchableNativeFeedback
  : TouchableOpacity;

<Touchable onPress={() => console.log('Pressed')}>
  <View>
    <Text>Press Me</Text>
  </View>
</Touchable>
```

## Best Practices

### Use Platform.select for Inline Differences

```tsx
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  button: {
    padding: Platform.select({
      ios: 12,
      android: 16,
      default: 12,
    }),
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: 'System',
    }),
  },
});
```

### Handle Safe Areas

Properly handle notches and safe areas:

```tsx
import { SafeAreaView, Platform, StyleSheet } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Content */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    // Additional padding for Android status bar
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
});
```

### Permissions Handling

Request platform-specific permissions:

```tsx
import { Platform, PermissionsAndroid, Alert } from 'react-native';

async function requestCameraPermission() {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs access to your camera',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  } else {
    // iOS permissions handled via Info.plist
    return true;
  }
}
```

### Back Button Handling (Android)

Handle Android hardware back button:

```tsx
import { useEffect } from 'react';
import { BackHandler, Platform, Alert } from 'react-native';

function useBackHandler(handler: () => boolean) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handler
    );

    return () => backHandler.remove();
  }, [handler]);
}

// Usage
function MyScreen() {
  useBackHandler(() => {
    Alert.alert('Exit App', 'Are you sure you want to exit?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Exit', onPress: () => BackHandler.exitApp() },
    ]);
    return true; // Prevent default behavior
  });

  return <View />;
}
```

## Common Patterns

### Adaptive Components

Create components that adapt to platform:

```tsx
import React from 'react';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableNativeFeedback,
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
}

export default function AdaptiveButton({ title, onPress }: ButtonProps) {
  if (Platform.OS === 'android') {
    return (
      <TouchableNativeFeedback
        onPress={onPress}
        background={TouchableNativeFeedback.Ripple('#fff', false)}
      >
        <View style={styles.androidButton}>
          <Text style={styles.androidText}>{title}</Text>
        </View>
      </TouchableNativeFeedback>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={styles.iosButton}>
        <Text style={styles.iosText}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  androidButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 4,
    elevation: 4,
  },
  androidText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  iosButton: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
  },
  iosText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
});
```

### Platform-Specific Navigation

```tsx
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: Platform.select({
            ios: '#fff',
            android: '#007AFF',
          }),
        },
        headerTintColor: Platform.select({
          ios: '#007AFF',
          android: '#fff',
        }),
        headerTitleStyle: {
          fontWeight: Platform.select({
            ios: '600',
            android: 'bold',
          }),
        },
        // Android-specific
        ...(Platform.OS === 'android' && {
          animation: 'slide_from_right',
        }),
        // iOS-specific
        ...(Platform.OS === 'ios' && {
          headerLargeTitle: true,
        }),
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
}
```

### Linking to Native Apps

```tsx
import { Linking, Platform, Alert } from 'react-native';

async function openMaps(address: string) {
  const url = Platform.select({
    ios: `maps://app?address=${encodeURIComponent(address)}`,
    android: `geo:0,0?q=${encodeURIComponent(address)}`,
  });

  if (!url) return;

  const supported = await Linking.canOpenURL(url);

  if (supported) {
    await Linking.openURL(url);
  } else {
    Alert.alert('Error', 'Cannot open maps application');
  }
}

async function openPhoneDialer(phoneNumber: string) {
  const url = `tel:${phoneNumber}`;
  const supported = await Linking.canOpenURL(url);

  if (supported) {
    await Linking.openURL(url);
  } else {
    Alert.alert('Error', 'Cannot open phone dialer');
  }
}

async function openEmail(email: string, subject?: string) {
  const url = `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
  const supported = await Linking.canOpenURL(url);

  if (supported) {
    await Linking.openURL(url);
  } else {
    Alert.alert('Error', 'Cannot open email client');
  }
}
```

### Keyboard Avoiding View

```tsx
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  StyleSheet,
} from 'react-native';

export default function FormScreen() {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView>
        <TextInput
          style={styles.input}
          placeholder="Name"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginVertical: 8,
  },
});
```

### Status Bar Configuration

```tsx
import React from 'react';
import { StatusBar, Platform, SafeAreaView } from 'react-native';

export default function App() {
  return (
    <>
      <StatusBar
        barStyle={Platform.select({
          ios: 'dark-content',
          android: 'light-content',
        })}
        backgroundColor={Platform.OS === 'android' ? '#007AFF' : undefined}
        translucent={Platform.OS === 'android'}
      />
      <SafeAreaView style={{ flex: 1 }}>
        {/* App content */}
      </SafeAreaView>
    </>
  );
}
```

## Anti-Patterns

### Don't Use Platform Checks for Styling Only

```tsx
// Bad - Inline platform checks
<View style={{
  padding: Platform.OS === 'ios' ? 12 : 16,
  marginTop: Platform.OS === 'android' ? 20 : 0,
}}>
  <Text>Content</Text>
</View>

// Good - Use Platform.select in StyleSheet
const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        padding: 12,
        marginTop: 0,
      },
      android: {
        padding: 16,
        marginTop: 20,
      },
    }),
  },
});

<View style={styles.container}>
  <Text>Content</Text>
</View>
```

### Don't Forget Android Back Button

```tsx
// Bad - No back button handling
function MyScreen() {
  return <View />;
}

// Good - Handle back button
function MyScreen({ navigation }: any) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        navigation.goBack();
        return true;
      }
    );

    return () => backHandler.remove();
  }, [navigation]);

  return <View />;
}
```

### Don't Hardcode Platform Values

```tsx
// Bad - Magic numbers
<View style={{ paddingTop: 20 }}>
  <Text>Content</Text>
</View>

// Good - Use constants or safe area
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function MyComponent() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top }}>
      <Text>Content</Text>
    </View>
  );
}
```

### Don't Assume Platform Features

```tsx
// Bad - Assuming feature exists
await Linking.openURL('mailto:test@example.com');

// Good - Check if supported
const url = 'mailto:test@example.com';
const supported = await Linking.canOpenURL(url);

if (supported) {
  await Linking.openURL(url);
} else {
  Alert.alert('Error', 'Email client not available');
}
```

## Related Skills

- **react-native-components**: Building platform-aware components
- **react-native-styling**: Platform-specific styling
- **react-native-native-modules**: Building custom native modules
