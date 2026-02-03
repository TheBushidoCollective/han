---
name: jutsu-expo:expo-modules
description: Use when working with Expo SDK modules for camera, location, notifications, file system, and other device APIs. Covers permissions, configurations, and best practices.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Expo Modules

Use this skill when working with Expo's extensive SDK modules for accessing device features and native functionality.

## Key Concepts

### Camera

```tsx
import { Camera, CameraType } from 'expo-camera';
import { useState } from 'react';
import { Button, View } from 'react-native';

export default function CameraScreen() {
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [type, setType] = useState(CameraType.back);

  if (!permission?.granted) {
    return (
      <View>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <Camera style={{ flex: 1 }} type={type}>
      <Button
        title="Flip Camera"
        onPress={() =>
          setType(type === CameraType.back ? CameraType.front : CameraType.back)
        }
      />
    </Camera>
  );
}
```

### Location

```tsx
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export function useLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();
  }, []);

  return location;
}
```

### Notifications

```tsx
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotifications() {
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log(notification);
      }
    );

    return () => subscription.remove();
  }, []);

  const sendNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Hello!',
        body: 'This is a notification',
      },
      trigger: { seconds: 2 },
    });
  };

  return { sendNotification };
}
```

### File System

```tsx
import * as FileSystem from 'expo-file-system';

export async function saveFile(data: string, filename: string) {
  const uri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, data);
  return uri;
}

export async function readFile(filename: string) {
  const uri = `${FileSystem.documentDirectory}${filename}`;
  const content = await FileSystem.readAsStringAsync(uri);
  return content;
}

export async function downloadFile(url: string, filename: string) {
  const uri = `${FileSystem.documentDirectory}${filename}`;
  const download = await FileSystem.downloadAsync(url, uri);
  return download.uri;
}
```

### Image Picker

```tsx
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Button, Image, View } from 'react-native';

export default function ImagePickerScreen() {
  const [image, setImage] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  return (
    <View>
      <Button title="Pick Image" onPress={pickImage} />
      {image && <Image source={{ uri: image }} style={{ width: 200, height: 200 }} />}
    </View>
  );
}
```

## Best Practices

### Permission Handling

```tsx
import * as Location from 'expo-location';

async function requestLocationPermission() {
  const { status: foregroundStatus } =
    await Location.requestForegroundPermissionsAsync();

  if (foregroundStatus !== 'granted') {
    console.log('Permission denied');
    return false;
  }

  // Request background permission only if needed
  const { status: backgroundStatus } =
    await Location.requestBackgroundPermissionsAsync();

  return backgroundStatus === 'granted';
}
```

### Secure Storage

```tsx
import * as SecureStore from 'expo-secure-store';

export async function saveToken(key: string, value: string) {
  await SecureStore.setItemAsync(key, value);
}

export async function getToken(key: string) {
  return await SecureStore.getItemAsync(key);
}

export async function deleteToken(key: string) {
  await SecureStore.deleteItemAsync(key);
}
```

### Device Info

```tsx
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

export function getDeviceInfo() {
  return {
    deviceName: Device.deviceName,
    deviceType: Device.deviceType,
    osName: Device.osName,
    osVersion: Device.osVersion,
    appVersion: Application.nativeApplicationVersion,
    buildVersion: Application.nativeBuildVersion,
    expoVersion: Constants.expoVersion,
  };
}
```

## Common Patterns

### Persistent Storage

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  async set(key: string, value: any) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  async get<T>(key: string): Promise<T | null> {
    const item = await AsyncStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  },

  async remove(key: string) {
    await AsyncStorage.removeItem(key);
  },

  async clear() {
    await AsyncStorage.clear();
  },
};
```

### Background Tasks

```tsx
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const BACKGROUND_FETCH_TASK = 'background-fetch';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  // Do work here
  console.log('Background task running');
  return BackgroundFetch.BackgroundFetchResult.NewData;
});

export async function registerBackgroundTask() {
  return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
    minimumInterval: 60 * 15, // 15 minutes
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
```

### Sharing Content

```tsx
import * as Sharing from 'expo-sharing';

export async function shareContent(uri: string) {
  const isAvailable = await Sharing.isAvailableAsync();

  if (!isAvailable) {
    console.log('Sharing is not available');
    return;
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'image/jpeg',
    dialogTitle: 'Share this image',
  });
}
```

## Related Skills

- **expo-config**: Configuring module permissions
- **expo-build**: Including modules in builds
