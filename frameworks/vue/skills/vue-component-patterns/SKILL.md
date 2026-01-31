---
name: vue-component-patterns
description: Use when Vue component patterns including props, emits, slots, and provide/inject. Use when building reusable Vue components.
allowed-tools:
  - Bash
  - Read
---

# Vue Component Patterns

Master Vue component patterns to build reusable, maintainable components
with proper prop validation, events, and composition.

## Props Patterns

### Basic Props with TypeScript

```typescript
<script setup lang="ts">
interface Props {
  title: string;
  count?: number;
  items: string[];
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  items: () => []
});
</script>

<template>
  <div>
    <h2>{{ title }}</h2>
    <p>Count: {{ count }}</p>
    <ul>
      <li v-for="item in items" :key="item">{{ item }}</li>
    </ul>
  </div>
</template>
```

### Advanced Prop Types

```typescript
<script setup lang="ts">
import type { PropType } from 'vue';

type Status = 'pending' | 'success' | 'error';

interface User {
  id: number;
  name: string;
  email: string;
}

interface Props {
  // Literal types
  status: Status;

  // Complex objects
  user: User;

  // Functions
  onUpdate: (value: string) => void;

  // Generic arrays
  tags: string[];

  // Object arrays
  users: User[];

  // Nullable
  description: string | null;

  // Union types
  value: string | number;
}

const props = defineProps<Props>();
</script>
```

### Runtime Props Validation

```typescript
<script setup lang="ts">
import type { PropType } from 'vue';

type ButtonSize = 'sm' | 'md' | 'lg';

const props = defineProps({
  // Type checking
  title: {
    type: String,
    required: true
  },

  // Default values
  count: {
    type: Number,
    default: 0
  },

  // Multiple types
  value: {
    type: [String, Number],
    required: true
  },

  // Object with type
  user: {
    type: Object as PropType<{ name: string; age: number }>,
    required: true
  },

  // Array with type
  tags: {
    type: Array as PropType<string[]>,
    default: () => []
  },

  // Custom validator
  size: {
    type: String as PropType<ButtonSize>,
    default: 'md',
    validator: (value: string) => ['sm', 'md', 'lg'].includes(value)
  },

  // Complex validator
  email: {
    type: String,
    validator: (value: string) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }
  },

  // Function prop
  onClick: {
    type: Function as PropType<(id: number) => void>,
    required: false
  }
});
</script>
```

### Props with Defaults

```typescript
<script setup lang="ts">
interface Props {
  title?: string;
  count?: number;
  items?: string[];
  user?: {
    name: string;
    email: string;
  };
  options?: {
    enabled: boolean;
    timeout: number;
  };
}

// Simple defaults
const props = withDefaults(defineProps<Props>(), {
  title: 'Default Title',
  count: 0
});

// Function defaults for objects/arrays
const propsWithComplex = withDefaults(defineProps<Props>(), {
  title: 'Default',
  count: 0,
  items: () => [],
  user: () => ({ name: 'Guest', email: 'guest@example.com' }),
  options: () => ({ enabled: true, timeout: 5000 })
});
</script>
```

## Emits Patterns

### TypeScript Emits

```typescript
<script setup lang="ts">
// Define emit types
const emit = defineEmits<{
  // No payload
  close: [];

  // Single payload
  update: [value: string];

  // Multiple payloads
  change: [id: number, value: string];

  // Object payload
  submit: [data: { name: string; email: string }];
}>();

function handleClose() {
  emit('close');
}

function handleUpdate(value: string) {
  emit('update', value);
}

function handleChange(id: number, value: string) {
  emit('change', id, value);
}

function handleSubmit() {
  emit('submit', { name: 'John', email: 'john@example.com' });
}
</script>
```

### Runtime Emits Validation

```typescript
<script setup lang="ts">
const emit = defineEmits({
  // Basic event
  click: null,

  // Validation
  update: (value: number) => {
    return value >= 0;
  },

  // Complex validation
  submit: (payload: { email: string; password: string }) => {
    if (!payload.email || !payload.password) {
      console.warn('Invalid submit payload');
      return false;
    }
    return true;
  }
});
</script>
```

### Custom v-model

```typescript
<!-- CustomInput.vue -->
<script setup lang="ts">
interface Props {
  modelValue: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

function handleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <input
    :value="modelValue"
    @input="handleInput"
    type="text"
  />
</template>

<!-- Usage -->
<script setup lang="ts">
import { ref } from 'vue';
import CustomInput from './CustomInput.vue';

const text = ref('');
</script>

<template>
  <CustomInput v-model="text" />
</template>
```

### Multiple v-models

```typescript
<!-- RangeSlider.vue -->
<script setup lang="ts">
interface Props {
  min: number;
  max: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:min': [value: number];
  'update:max': [value: number];
}>();
</script>

<template>
  <div>
    <input
      type="range"
      :value="min"
      @input="emit('update:min', Number($event.target.value))"
    />
    <input
      type="range"
      :value="max"
      @input="emit('update:max', Number($event.target.value))"
    />
  </div>
</template>

<!-- Usage -->
<script setup lang="ts">
import { ref } from 'vue';

const minValue = ref(0);
const maxValue = ref(100);
</script>

<template>
  <RangeSlider v-model:min="minValue" v-model:max="maxValue" />
</template>
```

## Slots Patterns

### Basic Slots

```typescript
<!-- Card.vue -->
<template>
  <div class="card">
    <header v-if="$slots.header">
      <slot name="header" />
    </header>
    <main>
      <slot />
    </main>
    <footer v-if="$slots.footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<!-- Usage -->
<template>
  <Card>
    <template #header>
      <h1>Card Title</h1>
    </template>

    <p>Card content goes here</p>

    <template #footer>
      <button>Action</button>
    </template>
  </Card>
</template>
```

### Scoped Slots

```typescript
<!-- List.vue -->
<script setup lang="ts" generic="T">
interface Props {
  items: T[];
}

const props = defineProps<Props>();
</script>

<template>
  <div>
    <div v-for="(item, index) in items" :key="index">
      <slot :item="item" :index="index" />
    </div>
  </div>
</template>

<!-- Usage -->
<script setup lang="ts">
interface User {
  id: number;
  name: string;
  email: string;
}

const users: User[] = [
  { id: 1, name: 'John', email: 'john@example.com' },
  { id: 2, name: 'Jane', email: 'jane@example.com' }
];
</script>

<template>
  <List :items="users">
    <template #default="{ item, index }">
      <div>
        {{ index + 1 }}. {{ item.name }} - {{ item.email }}
      </div>
    </template>
  </List>
</template>
```

### Fallback Slot Content

```typescript
<!-- Button.vue -->
<template>
  <button>
    <slot>
      Click Me
    </slot>
  </button>
</template>

<!-- Custom content -->
<Button>Custom Text</Button>

<!-- Uses fallback -->
<Button />
```

### Dynamic Slots

```typescript
<!-- DynamicSlots.vue -->
<script setup lang="ts">
import { useSlots } from 'vue';

const slots = useSlots();

// Check if slot exists
const hasHeader = !!slots.header;

// Access slot props
const headerProps = slots.header?.();
</script>

<template>
  <div>
    <div v-if="hasHeader" class="header">
      <slot name="header" />
    </div>
    <slot />
  </div>
</template>
```

### Renderless Components with Slots

```typescript
<!-- Mouse.vue - Renderless component -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const x = ref(0);
const y = ref(0);

function update(event: MouseEvent) {
  x.value = event.pageX;
  y.value = event.pageY;
}

onMounted(() => {
  window.addEventListener('mousemove', update);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', update);
});
</script>

<template>
  <slot :x="x" :y="y" />
</template>

<!-- Usage -->
<template>
  <Mouse v-slot="{ x, y }">
    <p>Mouse position: {{ x }}, {{ y }}</p>
  </Mouse>
</template>
```

## Provide and Inject for Deep Passing

### Basic Provide/Inject

```typescript
<!-- Parent.vue -->
<script setup lang="ts">
import { provide, ref } from 'vue';

const theme = ref('dark');

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
}

provide('theme', theme);
provide('toggleTheme', toggleTheme);
</script>

<!-- Child.vue (any depth) -->
<script setup lang="ts">
import { inject, type Ref } from 'vue';

const theme = inject<Ref<string>>('theme');
const toggleTheme = inject<() => void>('toggleTheme');
</script>

<template>
  <div :class="theme">
    <button @click="toggleTheme">Toggle Theme</button>
  </div>
</template>
```

### Type-Safe Provide/Inject

```typescript
// types.ts
import type { InjectionKey, Ref } from 'vue';

export interface AppConfig {
  apiUrl: string;
  timeout: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export const ConfigKey: InjectionKey<AppConfig> = Symbol('config');
export const UserKey: InjectionKey<Ref<User | null>> = Symbol('user');

// Provider
<script setup lang="ts">
import { provide, ref } from 'vue';
import { ConfigKey, UserKey } from './types';

const config: AppConfig = {
  apiUrl: 'https://api.example.com',
  timeout: 5000
};

const user = ref<User | null>(null);

provide(ConfigKey, config);
provide(UserKey, user);
</script>

// Consumer
<script setup lang="ts">
import { inject } from 'vue';
import { ConfigKey, UserKey } from './types';

const config = inject(ConfigKey);
const user = inject(UserKey);

// Fully typed!
console.log(config?.apiUrl);
console.log(user?.value?.name);
</script>
```

### Provide/Inject with Reactivity

```typescript
<!-- App.vue -->
<script setup lang="ts">
import { provide, reactive, readonly } from 'vue';

interface State {
  count: number;
  user: { name: string };
}

const state = reactive<State>({
  count: 0,
  user: { name: 'John' }
});

function increment() {
  state.count++;
}

// Provide readonly to prevent mutations
provide('state', readonly(state));
provide('increment', increment);
</script>

<!-- Consumer -->
<script setup lang="ts">
import { inject } from 'vue';

const state = inject('state');
const increment = inject('increment');
</script>

<template>
  <div>
    <p>Count: {{ state.count }}</p>
    <button @click="increment">Increment</button>
  </div>
</template>
```

## Component Registration

### Global Registration

```typescript
// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import BaseButton from './components/BaseButton.vue';
import BaseInput from './components/BaseInput.vue';

const app = createApp(App);

// Register globally
app.component('BaseButton', BaseButton);
app.component('BaseInput', BaseInput);

app.mount('#app');

// Use anywhere without importing
<template>
  <BaseButton>Click</BaseButton>
  <BaseInput v-model="text" />
</template>
```

### Local Registration

```typescript
<script setup lang="ts">
import BaseButton from './components/BaseButton.vue';
import BaseInput from './components/BaseInput.vue';

// Automatically registered in this component
</script>

<template>
  <BaseButton>Click</BaseButton>
  <BaseInput v-model="text" />
</template>
```

### Auto-Import Components

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';

export default defineConfig({
  plugins: [
    vue(),
    Components({
      // Auto import from components directory
      dirs: ['src/components'],
      // Generate types
      dts: true
    })
  ]
});

// Now use components without importing
<template>
  <BaseButton>No import needed!</BaseButton>
</template>
```

## Async Components

```typescript
<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

// Basic async component
const AsyncComponent = defineAsyncComponent(() =>
  import('./components/Heavy.vue')
);

// With loading and error states
const AsyncWithOptions = defineAsyncComponent({
  loader: () => import('./components/Heavy.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorDisplay,
  delay: 200,
  timeout: 3000
});
</script>

<template>
  <Suspense>
    <AsyncComponent />
    <template #fallback>
      <div>Loading...</div>
    </template>
  </Suspense>
</template>
```

## Teleport for Modals and Portals

```typescript
<!-- Modal.vue -->
<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  show: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="modal-backdrop" @click="emit('close')">
      <div class="modal" @click.stop>
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: white;
  padding: 2rem;
  border-radius: 8px;
}
</style>

<!-- Usage -->
<script setup lang="ts">
import { ref } from 'vue';
import Modal from './Modal.vue';

const showModal = ref(false);
</script>

<template>
  <button @click="showModal = true">Open Modal</button>

  <Modal :show="showModal" @close="showModal = false">
    <h2>Modal Content</h2>
    <p>This is teleported to body!</p>
  </Modal>
</template>
```

## KeepAlive for Component Caching

```typescript
<script setup lang="ts">
import { ref } from 'vue';
import TabA from './TabA.vue';
import TabB from './TabB.vue';
import TabC from './TabC.vue';

const currentTab = ref('TabA');

const tabs = {
  TabA,
  TabB,
  TabC
};
</script>

<template>
  <div>
    <button
      v-for="(_, tab) in tabs"
      :key="tab"
      @click="currentTab = tab"
    >
      {{ tab }}
    </button>

    <!-- Cache inactive components -->
    <KeepAlive>
      <component :is="tabs[currentTab]" />
    </KeepAlive>

    <!-- Include/exclude specific components -->
    <KeepAlive :include="['TabA', 'TabB']">
      <component :is="tabs[currentTab]" />
    </KeepAlive>

    <!-- Max cached instances -->
    <KeepAlive :max="3">
      <component :is="tabs[currentTab]" />
    </KeepAlive>
  </div>
</template>
```

## Higher-Order Components

```typescript
// withLoading.ts
import { defineComponent, h, ref, onMounted } from 'vue';

export function withLoading(Component: any, loadFn: () => Promise<void>) {
  return defineComponent({
    setup(props, { attrs, slots }) {
      const loading = ref(true);
      const error = ref<Error | null>(null);

      onMounted(async () => {
        try {
          await loadFn();
        } catch (e) {
          error.value = e as Error;
        } finally {
          loading.value = false;
        }
      });

      return () => {
        if (loading.value) {
          return h('div', 'Loading...');
        }
        if (error.value) {
          return h('div', `Error: ${error.value.message}`);
        }
        return h(Component, { ...props, ...attrs }, slots);
      };
    }
  });
}

// Usage
const UserProfile = withLoading(
  UserProfileComponent,
  async () => {
    // Load user data
  }
);
```

## When to Use This Skill

Use vue-component-patterns when building modern, production-ready
applications that require:

- Reusable component libraries
- Complex component communication
- Type-safe component APIs
- Flexible content projection with slots
- Deep prop passing without prop drilling
- Modal and portal management
- Component performance optimization
- Large-scale component architectures

## Component Design Best Practices

1. **Single Responsibility** - Each component should do one thing well
2. **Props down, events up** - Data flows down via props, changes flow up via events
3. **Use TypeScript** - Type-safe props and emits prevent bugs
4. **Validate props** - Use runtime validation for critical props
5. **Provide defaults** - Use `withDefaults` for optional props
6. **Use scoped slots** - Share component state with consumers
7. **Avoid prop drilling** - Use provide/inject for deep passing
8. **Use `v-model` for two-way binding** - Especially for form inputs
9. **Compose with slots** - Make components flexible and reusable
10. **Keep components small** - Extract complex logic to composables

## Component Anti-Patterns

1. **Mutating props** - Props are readonly, emit events instead
2. **Tight coupling** - Components shouldn't know about their parents
3. **Global state in components** - Use composables or stores instead
4. **Too many props** - Consider slots or composition
5. **Nested v-model** - Can cause confusion, be explicit
6. **Not using TypeScript** - Loses type safety and DX
7. **Overusing provide/inject** - Use for app-level state, not everything
8. **No prop validation** - Can lead to runtime errors
9. **Mixing concerns** - Separate UI, logic, and data fetching
10. **Not cleaning up** - Remove event listeners in `onUnmounted`

## Common Component Patterns

### Form Input Component

```typescript
<script setup lang="ts">
interface Props {
  modelValue: string;
  label?: string;
  error?: string;
  placeholder?: string;
  required?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  blur: [];
}>();
</script>

<template>
  <div class="form-field">
    <label v-if="label">
      {{ label }}
      <span v-if="required" class="required">*</span>
    </label>
    <input
      :value="modelValue"
      :placeholder="placeholder"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @blur="emit('blur')"
    />
    <span v-if="error" class="error">{{ error }}</span>
  </div>
</template>
```

### Data Table Component

```typescript
<script setup lang="ts" generic="T">
interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
}

interface Props {
  data: T[];
  columns: Column<T>[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  sort: [column: keyof T];
  rowClick: [item: T];
}>();
</script>

<template>
  <table>
    <thead>
      <tr>
        <th
          v-for="col in columns"
          :key="String(col.key)"
          @click="col.sortable && emit('sort', col.key)"
        >
          {{ col.label }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(item, index) in data"
        :key="index"
        @click="emit('rowClick', item)"
      >
        <td v-for="col in columns" :key="String(col.key)">
          <slot :name="`cell-${String(col.key)}`" :item="item">
            {{ item[col.key] }}
          </slot>
        </td>
      </tr>
    </tbody>
  </table>
</template>
```

## Resources

- [Vue 3 Component Documentation](https://vuejs.org/guide/essentials/component-basics.html)
- [Props Documentation](https://vuejs.org/guide/components/props.html)
- [Events Documentation](https://vuejs.org/guide/components/events.html)
- [Slots Documentation](https://vuejs.org/guide/components/slots.html)
- [Provide/Inject Documentation](https://vuejs.org/guide/components/provide-inject.html)
- [TypeScript with Vue](https://vuejs.org/guide/typescript/composition-api.html)
