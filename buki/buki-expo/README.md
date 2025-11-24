# Buki: Expo

Validation and quality enforcement for Expo React Native projects.

## What This Buki Provides

### Validation Hooks

- **TypeScript Type Check**: Runs TypeScript compiler to validate types in Expo projects
- **Fast Validation**: Provides quick feedback on type errors before commits
- **Expo Project Detection**: Validates only directories with app.json files

### Skills

This buki provides the following skills:

- **expo-config**: Configuring Expo apps with app.json, app.config.js/ts, and EAS configuration including plugins, build settings, and environment variables
- **expo-router**: Implementing file-based routing with Expo Router including layouts, dynamic routes, navigation, and deep linking
- **expo-modules**: Working with Expo SDK modules for camera, location, notifications, file system, and other device APIs
- **expo-updates**: Implementing over-the-air (OTA) updates with Expo Updates for deploying changes without app store releases
- **expo-build**: Building and deploying Expo apps with EAS Build including development builds, production builds, and app store submission

## Installation

Install via the Han marketplace:

```bash
npx @thebushidocollective/han install
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install buki-expo@han
```

## Usage

Once installed, this buki automatically validates your Expo code:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work
- Before commits (when combined with git hooks)

The validation runs `tsc --noEmit` to check for TypeScript type errors without generating output files.

## Requirements

- Expo SDK 50 or higher
- TypeScript 5.0 or higher
- Node.js 18 or higher

## Why Expo?

Expo is a framework and platform for React Native that makes mobile development faster and easier:

- **Managed Workflow**: Build apps without touching native code
- **EAS (Expo Application Services)**: Cloud build, updates, and submission
- **Expo Router**: File-based routing system
- **Rich SDK**: 50+ modules for device features (camera, location, etc.)
- **OTA Updates**: Deploy updates instantly without app store review
- **Universal Apps**: Share code across iOS, Android, and web
- **Developer Experience**: Fast refresh, debugging tools, and documentation

## Features Covered by Skills

### Configuration (app.json/app.config.ts)
- App metadata and settings
- Platform-specific configuration
- Plugin system
- Environment variables
- Build profiles
- Deep linking setup

### Expo Router
- File-based routing
- Stack, tab, and drawer navigation
- Dynamic routes with parameters
- Layouts and nested routes
- Route groups
- Authentication flows
- Modal routes
- Type-safe navigation

### Expo Modules (SDK)
- Camera and image picker
- Location and maps
- Push notifications
- File system and storage
- Secure storage
- Device information
- Background tasks
- Sharing and permissions

### OTA Updates
- Automatic update checking
- Manual update triggers
- Update channels
- Runtime versions
- Silent updates
- Update UI patterns

### EAS Build
- Development builds
- Preview and production builds
- Environment configuration
- Secrets management
- Version management
- App store submission
- Build monitoring

## Quick Start Examples

### Create New Expo App

```bash
npx create-expo-app@latest my-app
cd my-app
```

### Basic Expo Router App

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack />;
}

// app/index.tsx
import { Link } from 'expo-router';
import { View, Text } from 'react-native';

export default function Home() {
  return (
    <View>
      <Text>Home Screen</Text>
      <Link href="/details">Go to Details</Link>
    </View>
  );
}

// app/details.tsx
export default function Details() {
  return (
    <View>
      <Text>Details Screen</Text>
    </View>
  );
}
```

### Using Expo Modules

```tsx
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

// Request permissions and use modules
const [cameraPermission] = Camera.useCameraPermissions();
```

### Configure for Production

```typescript
// app.config.ts
export default {
  name: 'MyApp',
  slug: 'my-app',
  version: '1.0.0',
  extra: {
    apiUrl: process.env.API_URL,
  },
  plugins: [
    'expo-router',
    'expo-camera',
    'expo-location',
  ],
};
```

### Build with EAS

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

## Project Structure

Recommended structure for Expo apps with Expo Router:

```
my-app/
├── app/                  # Routes (file-based routing)
│   ├── (tabs)/          # Tab navigation group
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   └── profile.tsx
│   ├── _layout.tsx      # Root layout
│   └── index.tsx        # Home route
├── components/          # Reusable components
├── hooks/               # Custom hooks
├── utils/               # Utility functions
├── assets/              # Images, fonts, etc.
├── app.json             # Expo configuration
├── eas.json             # EAS Build configuration
├── package.json
└── tsconfig.json
```

## Common Expo Modules

Essential modules for most Expo apps:

- **expo-router**: File-based navigation
- **expo-camera**: Camera access
- **expo-location**: Location services
- **expo-notifications**: Push notifications
- **expo-image-picker**: Select images/videos
- **expo-file-system**: File operations
- **expo-secure-store**: Encrypted storage
- **expo-constants**: App and device info
- **expo-linking**: Deep linking
- **expo-updates**: OTA updates

## Development Workflow

Typical Expo development workflow:

1. **Development**: `npx expo start` - Start dev server
2. **Testing**: Test on iOS Simulator, Android Emulator, or physical devices
3. **Preview Build**: `eas build --profile preview` - Internal testing
4. **Production Build**: `eas build --profile production` - App store release
5. **OTA Updates**: `eas update` - Deploy JS updates instantly

## Testing

Expo apps can be tested with:

- **Jest**: Unit testing (included by default)
- **Detox**: End-to-end testing
- **Expo Go**: Quick testing without builds
- **Development Builds**: Test with native code

## Expo vs Bare React Native

Expo provides:
- Managed workflow (no native code needed)
- EAS cloud services
- Rich module ecosystem
- Faster development
- OTA updates out of the box

Choose bare React Native when you need:
- Custom native modules not in Expo
- Full control over native code
- Specific third-party native libraries

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
