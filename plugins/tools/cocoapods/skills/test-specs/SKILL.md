---
name: cocoapods-test-specs
description: Use when adding automated tests to CocoaPods libraries using test specs. Covers test spec configuration, app host requirements, and testing patterns that integrate with pod lib lint validation.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# CocoaPods - Test Specs

Integrate automated tests into your CocoaPods library that run during validation.

## What Are Test Specs?

Test specs define test targets that CocoaPods builds and runs automatically during `pod lib lint` and `pod spec lint` validation.

### Benefits

- **Automatic Testing**: Tests run during every lint validation
- **Confidence**: Validates library works as expected before publishing
- **CI Integration**: Consistent testing across all environments
- **Documentation**: Tests serve as usage examples

## Basic Test Spec

```ruby
Pod::Spec.new do |spec|
  spec.name = 'MyLibrary'
  spec.version = '1.0.0'

  # Main library source
  spec.source_files = 'Source/**/*.swift'

  # Test spec
  spec.test_spec 'Tests' do |test_spec|
    test_spec.source_files = 'Tests/**/*.swift'

    # Test dependencies
    test_spec.dependency 'Quick', '~> 7.0'
    test_spec.dependency 'Nimble', '~> 12.0'
  end
end
```

## App Host Requirements

### Tests Without App Host

```ruby
spec.test_spec 'Tests' do |test_spec|
  test_spec.source_files = 'Tests/**/*.swift'

  # Unit tests that don't need app environment
  test_spec.requires_app_host = false  # Default
end
```

### Tests With App Host

```ruby
spec.test_spec 'UITests' do |test_spec|
  test_spec.source_files = 'Tests/UITests/**/*.swift'

  # Tests that need app environment (UIKit, storyboards, etc.)
  test_spec.requires_app_host = true

  test_spec.dependency 'MyLibrary'
end
```

## Multiple Test Specs

```ruby
Pod::Spec.new do |spec|
  spec.name = 'MyLibrary'

  # Unit tests (no app host)
  spec.test_spec 'UnitTests' do |unit|
    unit.source_files = 'Tests/Unit/**/*.swift'
    unit.dependency 'Quick'
    unit.dependency 'Nimble'
  end

  # Integration tests (with app host)
  spec.test_spec 'IntegrationTests' do |integration|
    integration.source_files = 'Tests/Integration/**/*.swift'
    integration.requires_app_host = true
    integration.dependency 'MyLibrary'
  end

  # UI tests (with app host)
  spec.test_spec 'UITests' do |ui|
    ui.source_files = 'Tests/UI/**/*.swift'
    ui.requires_app_host = true
    ui.dependency 'MyLibrary'
    ui.ios.frameworks = 'XCTest'
  end
end
```

## Platform-Specific Test Specs

```ruby
spec.test_spec 'Tests' do |test_spec|
  # Shared test files
  test_spec.source_files = 'Tests/Shared/**/*.swift'

  # iOS-specific tests
  test_spec.ios.source_files = 'Tests/iOS/**/*.swift'
  test_spec.ios.frameworks = 'XCTest'

  # macOS-specific tests
  test_spec.osx.source_files = 'Tests/macOS/**/*.swift'
  test_spec.osx.frameworks = 'XCTest'
end
```

## Test Dependencies

### Testing Frameworks

```ruby
spec.test_spec 'Tests' do |test_spec|
  # Quick/Nimble (BDD style)
  test_spec.dependency 'Quick', '~> 7.0'
  test_spec.dependency 'Nimble', '~> 12.0'

  # Or traditional XCTest (no additional dependencies)
  test_spec.frameworks = 'XCTest'
end
```

### Mocking Frameworks

```ruby
spec.test_spec 'Tests' do |test_spec|
  test_spec.source_files = 'Tests/**/*.swift'

  # OCMock for Objective-C
  test_spec.dependency 'OCMock', '~> 3.9'

  # Cuckoo for Swift
  test_spec.dependency 'Cuckoo', '~> 2.0'

  # MockingKit for Swift
  test_spec.dependency 'MockingKit', '~> 1.0'
end
```

## Test Resources

```ruby
spec.test_spec 'Tests' do |test_spec|
  test_spec.source_files = 'Tests/**/*.swift'

  # Test resources (JSON fixtures, images, etc.)
  test_spec.resources = 'Tests/Fixtures/**/*'

  # Or test resource bundle
  test_spec.resource_bundles = {
    'MyLibraryTests' => ['Tests/Fixtures/**/*']
  }
end
```

## Scheme Configuration

```ruby
spec.test_spec 'Tests' do |test_spec|
  test_spec.source_files = 'Tests/**/*.swift'

  # Scheme name (optional - auto-generated if not specified)
  test_spec.scheme = { :name => 'MyLibrary-Tests' }

  # Code coverage
  test_spec.scheme = {
    :code_coverage => true
  }
end
```

## Testing Subspecs

```ruby
Pod::Spec.new do |spec|
  spec.name = 'MyLibrary'

  # Core subspec
  spec.subspec 'Core' do |core|
    core.source_files = 'Source/Core/**/*.swift'

    # Tests for Core subspec
    core.test_spec 'Tests' do |test_spec|
      test_spec.source_files = 'Tests/Core/**/*.swift'
      test_spec.dependency 'Quick'
      test_spec.dependency 'Nimble'
    end
  end

  # Networking subspec
  spec.subspec 'Networking' do |net|
    net.source_files = 'Source/Networking/**/*.swift'
    net.dependency 'MyLibrary/Core'

    # Tests for Networking subspec
    net.test_spec 'Tests' do |test_spec|
      test_spec.source_files = 'Tests/Networking/**/*.swift'
      test_spec.dependency 'OHHTTPStubs', '~> 9.0'
    end
  end
end
```

## Common Testing Patterns

### XCTest Pattern

```ruby
spec.test_spec 'Tests' do |test_spec|
  test_spec.source_files = 'Tests/**/*.swift'
  test_spec.frameworks = 'XCTest'

  # No additional dependencies needed
  # Tests use import XCTest
end
```

### Quick/Nimble Pattern

```ruby
spec.test_spec 'Tests' do |test_spec|
  test_spec.source_files = 'Tests/**/*.swift'

  test_spec.dependency 'Quick', '~> 7.0'
  test_spec.dependency 'Nimble', '~> 12.0'

  # Tests use QuickSpec and expect()
end
```

### Network Mocking Pattern

```ruby
spec.test_spec 'NetworkTests' do |test_spec|
  test_spec.source_files = 'Tests/Network/**/*.swift'

  # Mock HTTP responses
  test_spec.dependency 'OHHTTPStubs', '~> 9.0'

  # Or URLProtocol-based mocking
  test_spec.dependency 'Mocker', '~> 3.0'
end
```

### Snapshot Testing Pattern

```ruby
spec.test_spec 'SnapshotTests' do |test_spec|
  test_spec.source_files = 'Tests/Snapshots/**/*.swift'
  test_spec.requires_app_host = true

  # Snapshot testing framework
  test_spec.dependency 'SnapshotTesting', '~> 1.15'

  # Reference images
  test_spec.resources = 'Tests/Snapshots/__Snapshots__/**/*'
end
```

## Running Tests

### During Lint Validation

```bash
# Tests run automatically
pod lib lint

# Skip tests (faster, but not recommended)
pod lib lint --skip-tests

# Verbose test output
pod lib lint --verbose
```

### Standalone Test Execution

```bash
# In Example app
cd Example
pod install
xcodebuild test -workspace MyLibrary.xcworkspace -scheme MyLibrary-Tests
```

## Best Practices

### Directory Structure

```
MyLibrary/
├── MyLibrary.podspec
├── Source/
│   └── MyLibrary/
├── Tests/
│   ├── Unit/           # Unit tests
│   ├── Integration/    # Integration tests
│   ├── UI/            # UI tests
│   └── Fixtures/      # Test data
└── Example/
    └── MyLibraryExample.xcodeproj
```

### Test Organization

```ruby
# Organize by test type
spec.test_spec 'UnitTests' do |unit|
  unit.source_files = 'Tests/Unit/**/*.swift'
  unit.dependency 'Quick'
  unit.dependency 'Nimble'
end

spec.test_spec 'IntegrationTests' do |integration|
  integration.source_files = 'Tests/Integration/**/*.swift'
  integration.requires_app_host = true
end
```

### Dependency Management

```ruby
spec.test_spec 'Tests' do |test_spec|
  # Only test dependencies here
  test_spec.dependency 'Quick'
  test_spec.dependency 'Nimble'

  # Main library dependencies go in main spec
  # Not in test spec
end
```

## Anti-Patterns

### Don't

❌ Skip tests during validation

```bash
pod lib lint --skip-tests  # Defeats purpose of test specs
```

❌ Mix test and production code

```ruby
spec.source_files = 'Source/**/*.swift', 'Tests/**/*.swift'  # BAD
```

❌ Include test dependencies in main spec

```ruby
# In main spec
spec.dependency 'Quick'  # Should be in test_spec only
```

❌ Use requires_app_host unnecessarily

```ruby
spec.test_spec 'Tests' do |test_spec|
  # Pure unit tests don't need app host
  test_spec.requires_app_host = true  # Slower, unnecessary
end
```

### Do

✅ Run tests during every validation

```bash
pod lib lint  # Includes tests by default
```

✅ Separate test and production code

```ruby
spec.source_files = 'Source/**/*.swift'

spec.test_spec 'Tests' do |test_spec|
  test_spec.source_files = 'Tests/**/*.swift'
end
```

✅ Keep test dependencies in test spec

```ruby
spec.test_spec 'Tests' do |test_spec|
  test_spec.dependency 'Quick'  # Only for tests
end
```

✅ Use app host only when needed

```ruby
spec.test_spec 'Tests' do |test_spec|
  # Only if tests need UIKit, storyboards, etc.
  test_spec.requires_app_host = true
end
```

## Example: Complete Test Spec Setup

```ruby
Pod::Spec.new do |spec|
  spec.name         = 'MyAwesomeLibrary'
  spec.version      = '1.0.0'
  spec.summary      = 'An awesome library'
  spec.homepage     = 'https://github.com/username/MyAwesomeLibrary'
  spec.license      = { :type => 'MIT', :file => 'LICENSE' }
  spec.authors      = { 'Your Name' => 'email@example.com' }
  spec.source       = { :git => 'https://github.com/username/MyAwesomeLibrary.git', :tag => spec.version.to_s }

  spec.ios.deployment_target = '13.0'
  spec.swift_versions = ['5.7', '5.8', '5.9']

  spec.source_files = 'Source/**/*.swift'

  # Unit tests
  spec.test_spec 'UnitTests' do |unit|
    unit.source_files = 'Tests/Unit/**/*.swift'
    unit.dependency 'Quick', '~> 7.0'
    unit.dependency 'Nimble', '~> 12.0'
  end

  # Integration tests with app host
  spec.test_spec 'IntegrationTests' do |integration|
    integration.source_files = 'Tests/Integration/**/*.swift'
    integration.requires_app_host = true
    integration.dependency 'OHHTTPStubs', '~> 9.0'
  end
end
```

## Related Skills

- cocoapods-podspec-fundamentals
- cocoapods-subspecs-organization
- cocoapods-publishing-workflow
