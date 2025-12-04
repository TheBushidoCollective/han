---
name: cocoapods-publishing-workflow
description: Use when publishing CocoaPods libraries to CocoaPods Trunk. Covers pod trunk registration, podspec validation, version management, and publishing best practices for successful library distribution.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# CocoaPods - Publishing Workflow

Complete guide to publishing your CocoaPods library to the official CocoaPods Trunk.

## Publishing Overview

### Process Steps

1. **Register with CocoaPods Trunk** (one-time)
2. **Prepare your podspec**
3. **Validate locally** (`pod lib lint`)
4. **Validate for publishing** (`pod spec lint`)
5. **Tag version in git**
6. **Push to Trunk** (`pod trunk push`)

## Trunk Registration

### Register Email (One-Time)

```bash
# Register your email
pod trunk register email@example.com 'Your Name'

# Verify email (check inbox for verification link)
# Click link in email to activate account
```

### Check Registration

```bash
# Verify registration
pod trunk me

# Sample output:
# - Name:     Your Name
# - Email:    email@example.com
# - Since:    January 1st, 2024
# - Pods:     None
```

## Podspec Preparation

### Version Management

```ruby
Pod::Spec.new do |spec|
  # Semantic versioning: MAJOR.MINOR.PATCH
  spec.version = '1.0.0'

  # Must match git tag
  spec.source = {
    :git => 'https://github.com/username/MyLibrary.git',
    :tag => spec.version.to_s
  }
end
```

### Required Metadata

```ruby
Pod::Spec.new do |spec|
  # Identity (required)
  spec.name         = 'MyLibrary'
  spec.version      = '1.0.0'

  # Description (required)
  spec.summary      = 'Brief one-line description'
  spec.description  = 'Longer description with more details about what the library does'

  # Links (required)
  spec.homepage     = 'https://github.com/username/MyLibrary'
  spec.source       = { :git => 'https://github.com/username/MyLibrary.git', :tag => spec.version.to_s }

  # License (required)
  spec.license      = { :type => 'MIT', :file => 'LICENSE' }

  # Authors (required)
  spec.authors      = { 'Your Name' => 'email@example.com' }

  # Platform (required)
  spec.ios.deployment_target = '13.0'
end
```

## Local Validation

### Quick Validation

```bash
# Fast validation (skips build)
pod lib lint --quick

# Check for common issues without full build
```

### Full Validation

```bash
# Complete validation with build
pod lib lint

# With Swift version
pod lib lint --swift-version=5.9

# Verbose output
pod lib lint --verbose
```

### Handle Warnings

```bash
# Allow warnings (not recommended for new pods)
pod lib lint --allow-warnings

# Better: Fix warnings
pod lib lint
# Address each warning individually
```

## Publishing Validation

### Spec Lint

```bash
# Validate podspec for publishing
pod spec lint

# Validates against remote repository
# Simulates real-world installation
```

### Pre-Publishing Checklist

- [ ] All tests pass
- [ ] No lint warnings
- [ ] Privacy manifest included (iOS 17+)
- [ ] README is complete
- [ ] LICENSE file exists
- [ ] CHANGELOG updated
- [ ] Version number is correct
- [ ] Git repository is clean

## Git Tagging

### Create Tag

```bash
# Stage all changes
git add .

# Commit changes
git commit -m "Release version 1.0.0"

# Create tag matching podspec version
git tag 1.0.0

# Push to remote with tags
git push origin main --tags
```

### Tag Format

```bash
# Semantic versioning
git tag 1.0.0      # MAJOR.MINOR.PATCH
git tag 1.0.0-beta.1  # Pre-release
git tag 1.0.0-rc.1    # Release candidate

# Must match spec.version in podspec
```

## Publishing to Trunk

### Push Pod

```bash
# Push to CocoaPods Trunk
pod trunk push MyLibrary.podspec

# With specific Swift version
pod trunk push MyLibrary.podspec --swift-version=5.9

# Allow warnings (not recommended)
pod trunk push MyLibrary.podspec --allow-warnings
```

### Successful Publish Output

```
Validating podspec
 -> MyLibrary (1.0.0)

Updating spec repo `trunk`
 -> MyLibrary (1.0.0)

--------------------------------------------------------------------------------
 🎉  Congrats

 🚀  MyLibrary (1.0.0) successfully published
 📅  January 1st, 2024
 🌎  https://cocoapods.org/pods/MyLibrary
 👍  Tell your friends!
--------------------------------------------------------------------------------
```

## Version Updates

### Patch Release (Bug Fixes)

```ruby
# In podspec
spec.version = '1.0.1'  # Was 1.0.0
```

```bash
# Git workflow
git add .
git commit -m "Fix: Resolve crash in background mode"
git tag 1.0.1
git push origin main --tags
pod trunk push MyLibrary.podspec
```

### Minor Release (New Features)

```ruby
# In podspec
spec.version = '1.1.0'  # Was 1.0.1
```

```bash
# Git workflow
git add .
git commit -m "Add: Support for custom themes"
git tag 1.1.0
git push origin main --tags
pod trunk push MyLibrary.podspec
```

### Major Release (Breaking Changes)

```ruby
# In podspec
spec.version = '2.0.0'  # Was 1.1.0
```

```bash
# Git workflow
git add .
git commit -m "BREAKING: Refactor API for modern Swift"
git tag 2.0.0
git push origin main --tags
pod trunk push MyLibrary.podspec
```

## Managing Multiple Pods

### List Your Pods

```bash
# View all your published pods
pod trunk me

# Shows:
# - Pods:
#   - MyLibrary
#   - MyOtherLibrary
```

### Add Contributors

```bash
# Add team member to pod
pod trunk add-owner MyLibrary email@example.com

# Remove contributor
pod trunk remove-owner MyLibrary email@example.com
```

## Deprecation

### Deprecate Old Version

```bash
# Deprecate specific version
pod trunk deprecate MyLibrary --version=1.0.0

# Deprecate entire pod
pod trunk deprecate MyLibrary
```

### Deprecation with Replacement

```ruby
# In podspec
spec.deprecated = true
spec.deprecated_in_favor_of = 'NewAwesomeLibrary'
```

## Common Issues

### Issue: Tag Doesn't Match

```
ERROR | [MyLibrary] The repo has no tag for version 1.0.0
```

**Solution:**

```bash
# Create and push tag
git tag 1.0.0
git push origin --tags
```

### Issue: Validation Fails

```
ERROR | [MyLibrary] xcodebuild: Returned an unsuccessful exit code
```

**Solution:**

```bash
# Run detailed validation
pod lib lint --verbose

# Fix errors shown in output
# Re-validate until clean
```

### Issue: Missing License

```
ERROR | [MyLibrary] Missing required attribute `license`
```

**Solution:**

```ruby
# Add to podspec
spec.license = { :type => 'MIT', :file => 'LICENSE' }
```

```bash
# Create LICENSE file in repo root
```

## Best Practices

### Pre-Publish Testing

```bash
# 1. Test in example app
cd Example
pod install
# Run app, verify functionality

# 2. Test in real project
# Create test project, add pod from local path
pod 'MyLibrary', :path => '../MyLibrary'

# 3. Validate
pod lib lint
pod spec lint
```

### Version Numbering

```ruby
# Follow semantic versioning strictly
spec.version = '1.0.0'  # Initial release
spec.version = '1.0.1'  # Bug fix
spec.version = '1.1.0'  # New feature
spec.version = '2.0.0'  # Breaking change
```

### CHANGELOG

```markdown
# Changelog

## [1.1.0] - 2024-01-15
### Added
- Custom theme support
- Dark mode compatibility

### Fixed
- Memory leak in background processing

## [1.0.0] - 2024-01-01
- Initial release
```

### README

```markdown
# MyLibrary

Brief description of library.

## Installation

\`\`\`ruby
pod 'MyLibrary', '~> 1.0'
\`\`\`

## Usage

\`\`\`swift
import MyLibrary

let library = MyLibrary()
library.doSomething()
\`\`\`

## Requirements

- iOS 13.0+
- Swift 5.7+

## License

MyLibrary is available under the MIT license.
```

## Anti-Patterns

### Don't

❌ Publish without testing

```bash
pod trunk push --skip-tests  # Risky
```

❌ Use `--allow-warnings` for initial release

```bash
pod trunk push --allow-warnings  # Fix warnings instead
```

❌ Forget to tag git

```bash
# Missing git tag - publish will fail
pod trunk push
```

❌ Skip version bump

```ruby
# Still version 1.0.0 after changes - confusing
spec.version = '1.0.0'
```

### Do

✅ Test thoroughly before publishing

```bash
pod lib lint
pod spec lint
# Test in real project
```

✅ Fix all warnings

```bash
pod lib lint
# Address warnings
```

✅ Always tag git

```bash
git tag 1.0.0
git push --tags
```

✅ Bump version for every release

```ruby
spec.version = '1.0.1'  # Incremented
```

## Complete Publishing Example

```bash
# 1. Prepare podspec
vim MyLibrary.podspec
# Update version to 1.0.0

# 2. Update CHANGELOG
vim CHANGELOG.md
# Document changes

# 3. Commit and tag
git add .
git commit -m "Release 1.0.0: Initial public release"
git tag 1.0.0
git push origin main --tags

# 4. Validate locally
pod lib lint

# 5. Validate for publishing
pod spec lint

# 6. Publish
pod trunk push MyLibrary.podspec

# 7. Verify
pod search MyLibrary
# Should show your new pod
```

## Related Skills

- cocoapods-podspec-fundamentals
- cocoapods-subspecs-organization
- cocoapods-test-specs
- cocoapods-privacy-manifests
