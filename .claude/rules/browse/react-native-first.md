# React Native Web First (CRITICAL)

## NEVER Use HTML Tags

The browse-client is built with **react-native-web** and **Gluestack UI**. This enables future cross-platform support (iOS, Android, web).

### FORBIDDEN - HTML Tags

```typescript
// NEVER DO THIS:
<div style={{ ... }}>
<span>text</span>
<button onClick={...}>
<input type="text" />
<p>paragraph</p>
<h1>heading</h1>
<ul><li>item</li></ul>
<img src="..." />
<a href="...">link</a>
```

### REQUIRED - Gluestack / React Native Components

```typescript
// ALWAYS USE THESE:
import { Box, HStack, VStack } from '@/components/atoms/Box';
import { Text, Heading } from '@/components/atoms/Text';
import { Button, Pressable } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { Image } from '@/components/atoms/Image';
import { Link } from '@/components/atoms/Link';
import { Center, Spinner } from '@/components/atoms';
```

### Component Mapping

| HTML Tag | Use Instead |
|----------|-------------|
| `<div>` | `<Box>`, `<VStack>`, `<HStack>` |
| `<span>`, `<p>` | `<Text>` |
| `<h1>`-`<h6>` | `<Heading size="...">` |
| `<button>` | `<Button>`, `<Pressable>` |
| `<input>` | `<Input>` |
| `<img>` | `<Image>` |
| `<a>` | `<Link>` |
| `<ul>`, `<ol>` | `<VStack>` with items |
| `<li>` | `<HStack>` or `<Box>` |

### Styling

```typescript
// WRONG - CSS properties directly
<div style={{ display: 'flex', flexDirection: 'column', padding: '16px' }}>

// RIGHT - Gluestack props or theme tokens
<VStack space="md" p="$4">
// or
<Box style={{ padding: spacing.md }}>
```

### Why This Matters

1. **Cross-platform**: React Native Web compiles to native on mobile
2. **Consistency**: Gluestack provides unified component API
3. **Accessibility**: Gluestack handles a11y across platforms
4. **Theming**: Proper token-based design system
5. **Future-proof**: Can ship to App Store without rewrite

### Exceptions

The ONLY acceptable HTML usage:

1. **`<style>` tags** for CSS animations (keyframes)
2. **`createPortal`** target (`document.body`) - but portal CONTENT must use Gluestack
3. **Third-party library integration** that requires DOM (should be wrapped)

### If You Add HTML Tags

You will:
- Break React Native compatibility
- Create technical debt for mobile support
- Bypass the design system
- Cause accessibility regressions
- Undo architectural decisions

**This is a react-native-web codebase. Respect the architecture.**
