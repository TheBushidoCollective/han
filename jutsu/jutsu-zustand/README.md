# Jutsu: Zustand

Comprehensive Zustand state management skills for React applications with store patterns, middleware, TypeScript integration, and advanced techniques.

## What This Jutsu Provides

### Skills

This jutsu provides comprehensive skills for working with Zustand:

- **zustand-store-patterns**: Store creation, selectors, actions, and basic usage patterns
- **zustand-typescript**: Type-safe store creation, typed selectors, and advanced TypeScript patterns
- **zustand-middleware**: Persist, devtools, immer middleware, and custom middleware creation
- **zustand-advanced-patterns**: Transient updates, optimistic updates, undo/redo, and store composition

## Installation

### Via Han Marketplace

```bash
npx @thebushidocollective/han plugin install jutsu-zustand
```

### Via Claude Code

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install jutsu-zustand@han
```

### Manual Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/thebushidocollective/han.git
   ```

2. Install the plugin:

   ```bash
   claude plugin install /path/to/han/jutsu/jutsu-zustand@local
   ```

## Usage

This is a skills-only plugin that provides expert guidance on Zustand state management patterns. The skills are automatically available in Claude Code once installed.

### What Each Skill Covers

#### zustand-store-patterns

- Basic store creation with `create()`
- Using selectors for performance
- Organizing actions and state
- Store composition with slices
- Accessing stores outside components

#### zustand-typescript

- Type-safe store definitions
- Generic store factories
- Typed selectors and middleware
- Slice pattern with TypeScript
- Type-safe CRUD operations

#### zustand-middleware

- Persist middleware for localStorage/sessionStorage
- DevTools integration for debugging
- Immer for immutable updates
- Custom middleware creation
- Subscription management

#### zustand-advanced-patterns

- Optimistic updates with rollback
- Undo/redo functionality
- Store composition and communication
- React Context integration
- WebSocket integration
- Pagination patterns

## Requirements

- **React**: 16.8+ or 17+ or 18+
- **Zustand**: 4.0+ recommended
- **TypeScript**: 4.5+ (optional but recommended)

## Example Usage

### Basic Counter Store

```typescript
import { create } from 'zustand'

interface CounterStore {
  count: number
  increment: () => void
  decrement: () => void
}

export const useCounterStore = create<CounterStore>()((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}))

// Usage in component
function Counter() {
  const { count, increment, decrement } = useCounterStore()
  return (
    <div>
      <h1>{count}</h1>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  )
}
```

### With Persist Middleware

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => ({ items: [...state.items, item] })),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'shopping-cart',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```

## Best Practices

1. **Use Selectors**: Always select only the state you need to prevent unnecessary re-renders
2. **Type Safety**: Define explicit TypeScript interfaces for better IDE support
3. **Organize Slices**: Split large stores into logical slices for maintainability
4. **Middleware Order**: Apply middleware from inside out (devtools → persist → immer → store)
5. **Avoid Mutations**: Don't mutate state directly unless using immer middleware

## Common Patterns

- **Async Actions**: Handle API calls and loading states within store actions
- **Computed Values**: Use getters for derived state instead of storing redundant data
- **Store Communication**: Use store references or composition for inter-store communication
- **Optimistic Updates**: Update UI immediately and rollback on error
- **Persistence**: Use persist middleware for localStorage or sessionStorage

## Troubleshooting

### Re-renders on Every State Change

**Problem**: Component re-renders when any part of the store changes.

**Solution**: Use specific selectors instead of selecting the entire store:

```typescript
// ❌ Bad: Re-renders on any state change
const store = useStore()

// ✅ Good: Only re-renders when count changes
const count = useStore((state) => state.count)
```

### TypeScript Errors with Middleware

**Problem**: Type errors when using multiple middleware together.

**Solution**: Use the `()()` pattern with proper generics:

```typescript
const useStore = create<Store>()(
  devtools(
    persist(
      (set) => ({ /* ... */ }),
      { name: 'store' }
    )
  )
)
```

### Persisted State Not Loading

**Problem**: State doesn't persist across page refreshes.

**Solution**: Ensure you're using the correct storage and name:

```typescript
persist(
  (set) => ({ /* ... */ }),
  {
    name: 'unique-store-name', // Must be unique
    storage: createJSONStorage(() => localStorage), // Ensure correct storage
  }
)
```

## Related Plugins

- **jutsu-react**: React patterns and best practices
- **jutsu-typescript**: TypeScript type system mastery
- **jutsu-vite**: Vite build tooling for fast development

## Resources

- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Zustand GitHub](https://github.com/pmndrs/zustand)
- [TypeScript with Zustand](https://docs.pmnd.rs/zustand/guides/typescript)
- [Zustand Middleware](https://docs.pmnd.rs/zustand/integrations/persisting-store-data)

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
