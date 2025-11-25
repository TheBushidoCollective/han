# Buki: React Native Web

Validation and quality enforcement for React Native Web projects, ensuring code quality through TypeScript type checking and React Native Web best practices.

## What This Buki Provides

### Validation Hooks

- **TypeScript Validation**: Runs `tsc --noEmit` to ensure type safety
- **Type Checking**: Validates React Native Web component types and prop types
- **Cross-Platform Validation**: Ensures code follows React Native Web cross-platform patterns

### Skills

This buki provides the following skills:

- **react-native-web-core**: Core React Native Web concepts, components, and cross-platform patterns
- **react-native-web-styling**: Styling patterns using StyleSheet API, platform-specific styles, and responsive design
- **react-native-web-navigation**: Navigation patterns with React Navigation for web and native platforms
- **react-native-web-performance**: Performance optimization, code splitting, and bundle optimization for web
- **react-native-web-testing**: Testing patterns with Jest, React Native Testing Library, and web-specific testing

## Installation

Install via the Han marketplace:

```bash
npx @thebushidocollective/han install
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install buki-react-native-web@han
```

## Usage

Once installed, this buki automatically validates your React Native Web code:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work
- Before commits (when combined with git hooks)

## Requirements

- React Native Web 0.18+
- React 18+
- TypeScript 5.0+
- Node.js 18+

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
