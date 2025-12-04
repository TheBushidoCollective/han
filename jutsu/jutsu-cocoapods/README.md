# Jutsu: CocoaPods

Validation and quality enforcement for CocoaPods dependency management in iOS, macOS, tvOS, watchOS, and visionOS projects.

## What This Jutsu Provides

### Validation Hooks

- **Podspec Validation**: Automatically runs `pod lib lint` to validate podspec syntax, dependencies, and build integrity
- **Quick Validation**: Uses `--quick` flag for fast feedback during development
- **Fail-Fast**: Stops on first error to provide immediate feedback
- **Smart Caching**: Only re-validates when podspec or source files change

### Skills

This jutsu provides the following skills for CocoaPods development:

- **cocoapods-podspec-fundamentals**: Creating and maintaining podspec files with required attributes, file patterns, dependencies, and platform specifications for iOS, macOS, tvOS, watchOS, and visionOS
- **cocoapods-subspecs-organization**: Organizing complex libraries into modular subspecs with proper dependency management and default subspec patterns
- **cocoapods-test-specs**: Adding automated tests to CocoaPods libraries using test specs that run during validation
- **cocoapods-privacy-manifests**: Implementing iOS 17+ privacy manifests (PrivacyInfo.xcprivacy) for App Store compliance
- **cocoapods-publishing-workflow**: Publishing libraries to CocoaPods Trunk with proper validation, version management, and best practices

## Installation

Install via the Han marketplace:

```bash
npx @thebushidocollective/han plugin install jutsu-cocoapods
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install jutsu-cocoapods@han
```

## Usage

Once installed, this jutsu automatically validates your CocoaPods code:

- **When you finish a conversation** with Claude Code
- **When Claude Code agents complete** their work
- **Before commits** (when combined with git hooks)

### What Gets Validated

The hook runs in directories containing:

- `.podspec` files

And validates when these files change:

- `*.podspec` (podspec files)
- `**/*.{swift,h,m,mm}` (source files)
- `**/*.xcprivacy` (privacy manifests)

### Validation Command

```bash
pod lib lint --quick --fail-fast
```

This ensures:

- Podspec syntax is valid
- Required attributes are present
- Source file patterns are correct
- Dependencies resolve properly
- Platform targets are compatible
- Resources are properly configured

## Requirements

- **CocoaPods**: 1.12.0 or later (1.16.2 recommended for latest features)
- **Xcode**: 15.0 or later (for iOS 17+ privacy manifests)
- **Ruby**: 2.7 or later
- **Git**: For version control and publishing

### Installing CocoaPods

```bash
# Using gem (recommended)
sudo gem install cocoapods

# Or using Homebrew
brew install cocoapods

# Verify installation
pod --version
```

## Validation Workflow

### Automatic Validation

When you make changes to:

1. Podspec files (`*.podspec`)
2. Source code (`*.swift`, `*.h`, `*.m`, `*.mm`)
3. Privacy manifests (`*.xcprivacy`)

The jutsu automatically runs validation when you stop a conversation or complete agent work.

### Manual Validation

You can also run validation manually:

```bash
# Quick validation (recommended during development)
pod lib lint --quick

# Full validation (with build)
pod lib lint

# Validate for publishing
pod spec lint
```

## Common Validation Errors

### Missing Required Attributes

```
ERROR | [MyLibrary] Missing required attribute `license`
```

**Fix**: Add license to podspec:

```ruby
spec.license = { :type => 'MIT', :file => 'LICENSE' }
```

### Invalid Source Files Pattern

```
ERROR | [MyLibrary] The `source_files` pattern did not match any file
```

**Fix**: Update source_files pattern:

```ruby
spec.source_files = 'Source/**/*.{swift,h,m}'
```

### Platform Not Specified

```
ERROR | [MyLibrary] The platform attribute is required
```

**Fix**: Add platform deployment target:

```ruby
spec.ios.deployment_target = '13.0'
```

### Privacy Manifest Missing (iOS 17+)

```
WARNING | [MyLibrary] Missing privacy manifest for iOS 17+
```

**Fix**: Add privacy manifest:

```ruby
spec.resource_bundles = {
  'MyLibrary' => ['Resources/PrivacyInfo.xcprivacy']
}
```

## Skipping Validation

If you need to skip validation temporarily:

```bash
# Set environment variable
HAN_SKIP_HOOKS=1

# Or disable the plugin
claude plugin disable jutsu-cocoapods
```

## Advanced Configuration

### Custom Validation Options

Create `han-config.yml` in your project to customize validation:

```yaml
jutsu-cocoapods:
  lint:
    command: pod lib lint --quick --fail-fast --allow-warnings
```

### Platform-Specific Validation

```yaml
jutsu-cocoapods:
  lint:
    command: pod lib lint --platforms=ios --quick
```

## Best Practices

### Podspec Structure

```ruby
Pod::Spec.new do |spec|
  # Identity
  spec.name         = 'MyLibrary'
  spec.version      = '1.0.0'

  # Metadata
  spec.summary      = 'Brief description'
  spec.homepage     = 'https://github.com/username/MyLibrary'
  spec.license      = { :type => 'MIT', :file => 'LICENSE' }
  spec.authors      = { 'Your Name' => 'email@example.com' }

  # Source
  spec.source       = { :git => 'https://github.com/username/MyLibrary.git', :tag => spec.version.to_s }

  # Platform
  spec.ios.deployment_target = '13.0'
  spec.swift_versions = ['5.7', '5.8', '5.9']

  # Files
  spec.source_files = 'Source/**/*.swift'

  # Resources (use resource bundles)
  spec.resource_bundles = {
    'MyLibrary' => ['Resources/**/*']
  }

  # Dependencies
  spec.dependency 'Alamofire', '~> 5.0'
end
```

### Directory Structure

```
MyLibrary/
├── MyLibrary.podspec
├── LICENSE
├── README.md
├── CHANGELOG.md
├── Source/
│   └── MyLibrary/
│       ├── Core/
│       ├── Extensions/
│       └── Utilities/
├── Resources/
│   ├── Assets.xcassets
│   └── PrivacyInfo.xcprivacy
├── Tests/
│   └── MyLibraryTests/
└── Example/
    └── MyLibraryExample.xcodeproj
```

### Pre-Publish Checklist

- [ ] All validation passes without warnings
- [ ] Tests are included and passing
- [ ] Privacy manifest included (iOS 17+)
- [ ] README is comprehensive
- [ ] CHANGELOG is updated
- [ ] Version is tagged in git
- [ ] License file exists

## Troubleshooting

### CocoaPods Not Found

```bash
# Install CocoaPods
sudo gem install cocoapods

# Or update
sudo gem update cocoapods
```

### Validation Timeout

If validation takes too long, the hook will timeout after 3 minutes. To fix:

1. Use `--quick` flag (already enabled by default)
2. Skip tests during quick validation
3. Reduce dependencies
4. Check for slow network (dependency downloads)

### Cache Issues

If validation fails due to stale cache:

```bash
# Clear CocoaPods cache
pod cache clean --all

# Re-run validation
pod lib lint
```

## Resources

- [CocoaPods Guides](https://guides.cocoapods.org/)
- [Podspec Syntax Reference](https://guides.cocoapods.org/syntax/podspec.html)
- [Making a CocoaPod](https://guides.cocoapods.org/making/making-a-cocoapod.html)
- [Test Specs Guide](https://guides.cocoapods.org/using/test-specs.html)
- [Privacy Manifests](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files)

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines on contributing to this jutsu.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
