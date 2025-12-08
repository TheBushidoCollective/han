# jutsu-android

Android development validation with Gradle build hooks for Claude Code.

## Features

- **Automatic build validation**: Ensures your Android project compiles after agent changes
- **Smart caching**: Only builds when Kotlin, Java, XML, or Gradle files have changed
- **Debug build**: Uses `assembleDebug` for faster builds without signing

## Installation

```bash
han plugin install jutsu-android
```

## Hooks

### android-build (Stop hook)

Automatically runs when you stop Claude Code to ensure the Android project builds:

- Detects directories containing `build.gradle` or `build.gradle.kts` with Android plugin
- Only runs if Kotlin, Java, XML layout, or Gradle configuration files have changed
- Runs `./gradlew assembleDebug` for fast compilation checking
- Uses `--no-daemon` to avoid lingering processes

## Configuration

You can customize the hook behavior in your project's `han-config.yml`:

```yaml
jutsu-android:
  hooks:
    android-build:
      enabled: true
      # Override with a specific build variant
      # command: "./gradlew assembleRelease --no-daemon -q"
```

To disable the hook for a specific project:

```yaml
jutsu-android:
  hooks:
    android-build:
      enabled: false
```

## Requirements

- Android SDK installed and configured
- Java 17+ (for modern Android projects)
- Gradle wrapper (`gradlew`) in project root

## Notes

- The hook only runs in directories that have Android Gradle plugin configured
- Build output is limited to the last 30 lines to keep hook output concise
- Uses `--no-daemon` to prevent Gradle daemon accumulation during development

## Related Plugins

- **jutsu-kotlin**: Kotlin language skills
- **jutsu-java**: Java language skills
- **jutsu-expo**: React Native with Expo

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
