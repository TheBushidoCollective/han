---
name: jutsu-react-native:react-native-native-modules
description: Use when building or integrating native modules in React Native. Covers creating native modules, Turbo Modules, bridging native code, and accessing platform-specific APIs.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# React Native Native Modules

Use this skill when creating custom native modules, integrating third-party native libraries, or accessing platform-specific functionality not available through JavaScript.

## Key Concepts

### Native Modules Overview

Native modules bridge JavaScript and native code:

```
JavaScript Layer
      ↕ (Bridge)
Native Layer (iOS/Android)
```

### Turbo Modules (Modern Approach)

Turbo Modules provide better performance with type safety:

```tsx
// NativeMyModule.ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getString(value: string): Promise<string>;
  getNumber(value: number): number;
  getBoolean(value: boolean): boolean;
  getArray(value: Array<any>): Array<any>;
  getObject(value: Object): Object;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MyModule');
```

### Calling Native Code from JS

```tsx
import { NativeModules } from 'react-native';

const { MyModule } = NativeModules;

// Call native method
async function callNativeMethod() {
  try {
    const result = await MyModule.getString('Hello from JS');
    console.log(result);
  } catch (error) {
    console.error('Native module error:', error);
  }
}
```

## Best Practices

### iOS Native Module (Swift)

Create a native module in Swift:

```swift
// MyModule.swift
import Foundation

@objc(MyModule)
class MyModule: NSObject {

  @objc
  func getString(_ value: String,
                 resolver: @escaping RCTPromiseResolveBlock,
                 rejecter: @escaping RCTPromiseRejectBlock) {
    // Process value
    let result = "Processed: \(value)"
    resolver(result)
  }

  @objc
  func getNumber(_ value: NSNumber) -> NSNumber {
    let doubled = value.doubleValue * 2
    return NSNumber(value: doubled)
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
```

```objc
// MyModule.m (Bridge file)
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MyModule, NSObject)

RCT_EXTERN_METHOD(getString:(NSString *)value
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getNumber:(nonnull NSNumber *)value)

@end
```

### Android Native Module (Kotlin)

Create a native module in Kotlin:

```kotlin
// MyModule.kt
package com.myapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class MyModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "MyModule"
    }

    @ReactMethod
    fun getString(value: String, promise: Promise) {
        try {
            val result = "Processed: $value"
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getNumber(value: Double): Double {
        return value * 2
    }
}
```

```kotlin
// MyModulePackage.kt
package com.myapp

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class MyModulePackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> {
        return listOf(MyModule(reactContext))
    }

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> {
        return emptyList()
    }
}
```

### TypeScript Wrapper

Create a type-safe wrapper:

```tsx
// MyModule.ts
import { NativeModules, Platform } from 'react-native';

interface MyModuleInterface {
  getString(value: string): Promise<string>;
  getNumber(value: number): number;
  getBoolean(value: boolean): boolean;
}

const LINKING_ERROR =
  `The package 'react-native-my-module' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- Run 'pod install'\n", default: '' }) +
  '- Rebuild the app';

const MyModule: MyModuleInterface = NativeModules.MyModule
  ? NativeModules.MyModule
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export default MyModule;
```

### Native Events

Send events from native to JavaScript:

```swift
// iOS - MyModule.swift
import Foundation

@objc(MyModule)
class MyModule: RCTEventEmitter {

  override func supportedEvents() -> [String]! {
    return ["onDataReceived"]
  }

  @objc
  func startListening() {
    // Simulate receiving data
    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
      self.sendEvent(withName: "onDataReceived",
                     body: ["data": "Hello from native!"])
    }
  }
}
```

```kotlin
// Android - MyModule.kt
class MyModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun startListening() {
        val params = Arguments.createMap()
        params.putString("data", "Hello from native!")
        sendEvent("onDataReceived", params)
    }
}
```

```tsx
// JavaScript
import { NativeEventEmitter, NativeModules } from 'react-native';
import { useEffect } from 'react';

function useNativeEvent() {
  useEffect(() => {
    const eventEmitter = new NativeEventEmitter(NativeModules.MyModule);

    const subscription = eventEmitter.addListener('onDataReceived', (event) => {
      console.log('Received from native:', event.data);
    });

    NativeModules.MyModule.startListening();

    return () => subscription.remove();
  }, []);
}
```

## Common Patterns

### Camera Access

```tsx
// JavaScript API
interface CameraModule {
  takePicture(): Promise<string>; // Returns image URI
  requestPermissions(): Promise<boolean>;
}
```

```swift
// iOS Implementation
import UIKit
import AVFoundation

@objc(CameraModule)
class CameraModule: NSObject {

  @objc
  func requestPermissions(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    AVCaptureDevice.requestAccess(for: .video) { granted in
      resolve(granted)
    }
  }

  @objc
  func takePicture(_ resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    // Implement camera capture
    // Return image URI
    resolve("file:///path/to/image.jpg")
  }
}
```

```kotlin
// Android Implementation
class CameraModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    @ReactMethod
    fun requestPermissions(promise: Promise) {
        // Check and request camera permission
        val hasPermission = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        promise.resolve(hasPermission)
    }

    @ReactMethod
    fun takePicture(promise: Promise) {
        // Implement camera capture
        promise.resolve("file:///path/to/image.jpg")
    }
}
```

### Biometric Authentication

```tsx
// JavaScript API
interface BiometricModule {
  authenticate(reason: string): Promise<{ success: boolean; error?: string }>;
  isAvailable(): Promise<boolean>;
}
```

```swift
// iOS Implementation
import LocalAuthentication

@objc(BiometricModule)
class BiometricModule: NSObject {

  @objc
  func isAvailable(_ resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    let context = LAContext()
    var error: NSError?

    let available = context.canEvaluatePolicy(
      .deviceOwnerAuthenticationWithBiometrics,
      error: &error
    )

    resolve(available)
  }

  @objc
  func authenticate(_ reason: String,
                   resolver resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    let context = LAContext()

    context.evaluatePolicy(
      .deviceOwnerAuthenticationWithBiometrics,
      localizedReason: reason
    ) { success, error in
      if success {
        resolve(["success": true])
      } else {
        resolve(["success": false, "error": error?.localizedDescription ?? ""])
      }
    }
  }
}
```

### Device Info Module

```tsx
// JavaScript API
interface DeviceInfoModule {
  getDeviceId(): string;
  getDeviceName(): string;
  getSystemVersion(): string;
  getBatteryLevel(): Promise<number>;
}
```

```swift
// iOS Implementation
import UIKit

@objc(DeviceInfoModule)
class DeviceInfoModule: NSObject {

  @objc
  func getDeviceId() -> String {
    return UIDevice.current.identifierForVendor?.uuidString ?? ""
  }

  @objc
  func getDeviceName() -> String {
    return UIDevice.current.name
  }

  @objc
  func getSystemVersion() -> String {
    return UIDevice.current.systemVersion
  }

  @objc
  func getBatteryLevel(_ resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    UIDevice.current.isBatteryMonitoringEnabled = true
    let level = UIDevice.current.batteryLevel
    resolve(level)
  }
}
```

### Native UI Component

```tsx
// Custom native view
import { requireNativeComponent, ViewProps } from 'react-native';

interface MapViewProps extends ViewProps {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onRegionChange?: (event: any) => void;
}

export const MapView = requireNativeComponent<MapViewProps>('MapView');

// Usage
<MapView
  region={{
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  }}
  onRegionChange={(event) => console.log(event.nativeEvent)}
/>
```

## Anti-Patterns

### Don't Block the Main Thread

```swift
// Bad - Blocking main thread
@objc
func heavyComputation(_ value: String,
                     resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
  let result = performHeavyWork(value) // Blocks UI
  resolve(result)
}

// Good - Use background thread
@objc
func heavyComputation(_ value: String,
                     resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
  DispatchQueue.global(qos: .userInitiated).async {
    let result = self.performHeavyWork(value)
    resolve(result)
  }
}
```

### Don't Forget Error Handling

```kotlin
// Bad - No error handling
@ReactMethod
fun readFile(path: String, promise: Promise) {
    val content = File(path).readText()
    promise.resolve(content)
}

// Good - Proper error handling
@ReactMethod
fun readFile(path: String, promise: Promise) {
    try {
        val file = File(path)
        if (!file.exists()) {
            promise.reject("FILE_NOT_FOUND", "File does not exist")
            return
        }
        val content = file.readText()
        promise.resolve(content)
    } catch (e: Exception) {
        promise.reject("READ_ERROR", e.message, e)
    }
}
```

### Don't Leak Memory

```swift
// Bad - Strong reference cycle
class MyModule: NSObject {
    var timer: Timer?

    @objc
    func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            self.doSomething() // Strong reference to self
        }
    }
}

// Good - Weak reference
class MyModule: NSObject {
    var timer: Timer?

    @objc
    func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.doSomething()
        }
    }

    deinit {
        timer?.invalidate()
    }
}
```

### Don't Use Synchronous Operations

```kotlin
// Bad - Synchronous network call
@ReactMethod
fun fetchData(url: String): String {
    return URL(url).readText() // Blocks thread
}

// Good - Asynchronous with promise
@ReactMethod
fun fetchData(url: String, promise: Promise) {
    Thread {
        try {
            val data = URL(url).readText()
            promise.resolve(data)
        } catch (e: Exception) {
            promise.reject("FETCH_ERROR", e.message)
        }
    }.start()
}
```

## Related Skills

- **react-native-platform**: Platform-specific code patterns
- **react-native-components**: Integrating native components
- **react-native-performance**: Native performance optimization
