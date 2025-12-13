# jutsu-ios

iOS development validation with Xcode build hooks for Claude Code.

## Features

- **Automatic build validation**: Ensures your iOS project compiles after agent changes
- **Smart caching**: Only builds when Swift, Objective-C, or project files have changed
- **Simulator build**: Uses iOS Simulator to avoid code signing requirements

## Installation

```bash
han plugin install jutsu-ios
```

## Hooks

### build (Stop hook)

Automatically runs when you stop Claude Code to ensure the iOS project builds:

- Detects directories containing `.xcodeproj` or `.xcworkspace`
- Only runs if Swift, Objective-C, XIB, Storyboard, or project files have changed
- Builds for iOS Simulator (no code signing required)
- Auto-detects the first available scheme

## Configuration

You can customize the hook behavior in your project's `han-config.yml`:

```yaml
jutsu-ios:
  hooks:
    build:
      enabled: true
      # Override with a specific scheme and destination
      # command: "xcodebuild -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16' build CODE_SIGNING_ALLOWED=NO"
```

To disable the hook for a specific project:

```yaml
jutsu-ios:
  hooks:
    build:
      enabled: false
```

## Requirements

- macOS with Xcode installed
- Xcode Command Line Tools (`xcode-select --install`)
- iOS Simulator runtime

## Notes

- The build uses `CODE_SIGNING_ALLOWED=NO` to skip code signing
- Build output is limited to the last 20 lines to keep hook output concise
- For workspaces with CocoaPods, ensure `pod install` has been run

## Related Plugins

- **jutsu-swift**: Swift language skills and SwiftLint validation
- **jutsu-objective-c**: Objective-C development skills

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
