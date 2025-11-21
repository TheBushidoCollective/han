---
name: angular-signals
description: Use when building Angular 16+ applications requiring fine-grained reactive state management and zone-less change detection.
allowed-tools:
  - Bash
  - Read
---

# Angular Signals

Master Angular Signals for building reactive applications with
fine-grained reactivity and improved performance.

## Signal Basics

### Creating and Using Signals

```typescript
import { Component, signal, computed, effect } from '@angular/core';

@Component({
  selector: 'app-counter',
  template: `
    <div>
      <p>Count: {{ count() }}</p>
      <p>Double: {{ doubleCount() }}</p>
      <button (click)="increment()">+</button>
      <button (click)="decrement()">-</button>
      <button (click)="reset()">Reset</button>
    </div>
  `
})
export class CounterComponent {
  // Writable signal
  count = signal(0);

  // Computed signal
  doubleCount = computed(() => this.count() * 2);

  constructor() {
    // Effect runs when count changes
    effect(() => {
      console.log(`Count is: ${this.count()}`);
    });
  }

  increment() {
    this.count.update(value => value + 1);
  }

  decrement() {
    this.count.update(value => value - 1);
  }

  reset() {
    this.count.set(0);
  }
}
```

### Signal Methods

```typescript
import { signal } from '@angular/core';

// Create signal
const count = signal(0);

// set - replace value
count.set(5);

// update - transform current value
count.update(value => value + 1);

// mutate - modify object (experimental)
const user = signal({ name: 'John', age: 30 });
user.mutate(value => {
  value.age = 31; // Mutate in place
});

// Read value
const current = count(); // Call as function
```

## Computed Signals

### Basic Computed

```typescript
import { signal, computed } from '@angular/core';

const firstName = signal('John');
const lastName = signal('Doe');

// Computed signal
const fullName = computed(() => {
  return `${firstName()} ${lastName()}`;
});

console.log(fullName()); // John Doe

firstName.set('Jane');
console.log(fullName()); // Jane Doe (automatically updates)
```

### Complex Computed

```typescript
interface Product {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

@Component({
  selector: 'app-cart'
})
export class CartComponent {
  items = signal<Product[]>([]);

  // Computed: total items
  itemCount = computed(() => {
    return this.items().reduce((sum, item) => sum + item.quantity, 0);
  });

  // Computed: subtotal
  subtotal = computed(() => {
    return this.items().reduce((sum, item) =>
      sum + (item.price * item.quantity), 0
    );
  });

  // Computed: tax
  tax = computed(() => this.subtotal() * 0.08);

  // Computed: total
  total = computed(() => this.subtotal() + this.tax());

  // Computed: formatted total
  formattedTotal = computed(() => {
    return `$${this.total().toFixed(2)}`;
  });
}
```

### Chained Computed

```typescript
const count = signal(1);
const doubled = computed(() => count() * 2);
const quadrupled = computed(() => doubled() * 2);
const formatted = computed(() => `Count: ${quadrupled()}`);

console.log(formatted()); // Count: 4
count.set(2);
console.log(formatted()); // Count: 8
```

## Effects

### Basic Effects

```typescript
import { Component, signal, effect } from '@angular/core';

@Component({
  selector: 'app-logger'
})
export class LoggerComponent {
  count = signal(0);

  constructor() {
    // Effect runs when count changes
    effect(() => {
      console.log(`Count changed to: ${this.count()}`);
    });
  }

  increment() {
    this.count.update(v => v + 1); // Triggers effect
  }
}
```

### Effect Cleanup

```typescript
import { effect } from '@angular/core';

const count = signal(0);

effect((onCleanup) => {
  const timer = setInterval(() => {
    console.log(count());
  }, 1000);

  // Cleanup function
  onCleanup(() => {
    clearInterval(timer);
  });
});
```

### Conditional Effects

```typescript
import { effect, signal } from '@angular/core';

const enabled = signal(true);
const count = signal(0);

effect(() => {
  // Only run if enabled
  if (!enabled()) return;

  console.log(`Count: ${count()}`);
});
```

## Signal Inputs

### Component Inputs as Signals

```typescript
import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-user-profile',
  template: `
    <div>
      <h2>{{ displayName() }}</h2>
      <p>Age: {{ age() }}</p>
      <p>Is adult: {{ isAdult() }}</p>
    </div>
  `
})
export class UserProfileComponent {
  // Signal inputs (Angular 17.1+)
  firstName = input.required<string>();
  lastName = input.required<string>();
  age = input(0); // Optional with default

  // Computed from inputs
  displayName = computed(() =>
    `${this.firstName()} ${this.lastName()}`
  );

  isAdult = computed(() => this.age() >= 18);
}

// Usage
<app-user-profile
  [firstName]="'John'"
  [lastName]="'Doe'"
  [age]="30"
/>
```

### Transform Input Signals

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-formatted-text'
})
export class FormattedTextComponent {
  // Transform input
  text = input('', {
    transform: (value: string) => value.toUpperCase()
  });

  // Alias input
  label = input('', { alias: 'labelText' });
}

// Usage
<app-formatted-text
  [text]="'hello'"
  [labelText]="'Name'"
/>
```

## Signal Outputs

### Component Outputs as Signals

```typescript
import { Component, output } from '@angular/core';

@Component({
  selector: 'app-button',
  template: `
    <button (click)="handleClick()">
      {{ label() }}
    </button>
  `
})
export class ButtonComponent {
  label = input('Click me');

  // Signal output (Angular 17.1+)
  clicked = output<void>();
  valueChanged = output<number>();

  private clickCount = signal(0);

  handleClick() {
    this.clickCount.update(v => v + 1);
    this.clicked.emit();
    this.valueChanged.emit(this.clickCount());
  }
}

// Usage
<app-button
  (clicked)="onClicked()"
  (valueChanged)="onValueChanged($event)"
/>
```

## Signal Queries

### ViewChild with Signals

```typescript
import { Component, viewChild, ElementRef, afterNextRender } from '@angular/core';

@Component({
  selector: 'app-input-focus',
  template: `
    <input #inputElement type="text" />
    <button (click)="focusInput()">Focus</button>
  `
})
export class InputFocusComponent {
  // Signal-based viewChild
  inputElement = viewChild<ElementRef>('inputElement');

  constructor() {
    afterNextRender(() => {
      // Access element after render
      const element = this.inputElement()?.nativeElement;
      if (element) {
        element.focus();
      }
    });
  }

  focusInput() {
    this.inputElement()?.nativeElement.focus();
  }
}
```

### ViewChildren with Signals

```typescript
import { Component, viewChildren, ElementRef } from '@angular/core';

@Component({
  selector: 'app-list',
  template: `
    <div #item *ngFor="let item of items()">
      {{ item }}
    </div>
    <p>Item count: {{ itemElements().length }}</p>
  `
})
export class ListComponent {
  items = signal(['A', 'B', 'C']);

  // Signal-based viewChildren
  itemElements = viewChildren<ElementRef>('item');

  logItemCount() {
    console.log(`Count: ${this.itemElements().length}`);
  }
}
```

### ContentChild with Signals

```typescript
import { Component, contentChild, Directive } from '@angular/core';

@Directive({
  selector: '[appHeader]'
})
export class HeaderDirective {}

@Component({
  selector: 'app-card',
  template: `
    <div class="card">
      <ng-content select="[appHeader]" />
      <ng-content />
      <p *ngIf="hasHeader()">Has custom header</p>
    </div>
  `
})
export class CardComponent {
  // Signal-based contentChild
  header = contentChild(HeaderDirective);

  hasHeader = computed(() => !!this.header());
}

// Usage
<app-card>
  <h2 appHeader>Title</h2>
  <p>Content</p>
</app-card>
```

## Signals vs Observables

### When to Use Signals

```typescript
// Use signals for synchronous state
@Component({
  selector: 'app-counter'
})
export class CounterComponent {
  count = signal(0); // Signal for synchronous state

  increment() {
    this.count.update(v => v + 1);
  }
}
```

### When to Use Observables

```typescript
// Use observables for async operations
@Component({
  selector: 'app-user-list'
})
export class UserListComponent {
  private http = inject(HttpClient);

  users$: Observable<User[]> = this.http.get<User[]>('/api/users');
}
```

### Combining Signals and Observables

```typescript
import { Component, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-search'
})
export class SearchComponent {
  private http = inject(HttpClient);

  // Signal for search query
  searchQuery = signal('');

  // Convert signal to observable
  searchQuery$ = toObservable(this.searchQuery);

  // Use observable operators
  results$ = this.searchQuery$.pipe(
    debounceTime(300),
    switchMap(query => this.http.get(`/api/search?q=${query}`))
  );

  // Convert back to signal
  results = toSignal(this.results$, { initialValue: [] });
}
```

## toSignal and toObservable

### toSignal - Observable to Signal

```typescript
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-user-list',
  template: `
    <div *ngIf="users()">
      <div *ngFor="let user of users()">
        {{ user.name }}
      </div>
    </div>
  `
})
export class UserListComponent {
  private http = inject(HttpClient);

  // Convert observable to signal
  users = toSignal(
    this.http.get<User[]>('/api/users'),
    { initialValue: [] as User[] }
  );
}
```

### toObservable - Signal to Observable

```typescript
import { Component, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-search'
})
export class SearchComponent {
  searchTerm = signal('');

  // Convert signal to observable
  searchTerm$ = toObservable(this.searchTerm);

  constructor() {
    // Use observable operators
    this.searchTerm$.pipe(
      debounceTime(300)
    ).subscribe(term => {
      console.log('Searching for:', term);
    });
  }
}
```

## Signal Equality and Change Detection

### Custom Equality Function

```typescript
import { signal } from '@angular/core';

interface User {
  id: number;
  name: string;
}

// Custom equality check
const user = signal<User>(
  { id: 1, name: 'John' },
  {
    equal: (a, b) => a.id === b.id // Only compare IDs
  }
);

user.set({ id: 1, name: 'Jane' }); // No update (same ID)
user.set({ id: 2, name: 'John' }); // Updates (different ID)
```

### Zone-less Change Detection

```typescript
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';

@Component({
  selector: 'app-counter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>Count: {{ count() }}</p>
    <button (click)="increment()">+</button>
  `
})
export class CounterComponent {
  count = signal(0);

  increment() {
    // Signal updates trigger change detection automatically
    this.count.update(v => v + 1);
  }
}
```

## Migration from Observables

### Before - Observables

```typescript
import { Component } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-cart'
})
export class CartComponentOld {
  private items$ = new BehaviorSubject<Product[]>([]);
  private discount$ = new BehaviorSubject<number>(0);

  total$ = combineLatest([this.items$, this.discount$]).pipe(
    map(([items, discount]) => {
      const subtotal = items.reduce((sum, item) =>
        sum + item.price * item.quantity, 0
      );
      return subtotal * (1 - discount);
    })
  );

  addItem(item: Product) {
    this.items$.next([...this.items$.value, item]);
  }
}
```

### After - Signals

```typescript
import { Component, signal, computed } from '@angular/core';

@Component({
  selector: 'app-cart'
})
export class CartComponent {
  items = signal<Product[]>([]);
  discount = signal(0);

  total = computed(() => {
    const subtotal = this.items().reduce((sum, item) =>
      sum + item.price * item.quantity, 0
    );
    return subtotal * (1 - this.discount());
  });

  addItem(item: Product) {
    this.items.update(items => [...items, item]);
  }
}
```

## When to Use This Skill

Use angular-signals when building modern, production-ready
applications that require:

- Fine-grained reactivity without RxJS
- Simpler state management
- Zone-less change detection
- Better performance for synchronous state
- Cleaner component code
- Angular 16+ applications
- Migrating from observables for sync state
- Component input/output as signals

## Signal Best Practices

1. **Use signals for synchronous state** - Perfect for component state
2. **Use computed for derived values** - Automatic dependency tracking
3. **Prefer signals over observables for state** - Simpler mental model
4. **Use effects sparingly** - Only for side effects
5. **Signal inputs for better types** - Type-safe component props
6. **Combine with observables when needed** - Use toSignal/toObservable
7. **Use custom equality for objects** - Optimize updates
8. **Leverage zone-less change detection** - Better performance
9. **Keep signals focused** - Small, single-purpose signals
10. **Use mutate carefully** - Prefer update for immutability

## Signal Pitfalls

1. **Overusing effects** - Can create complex dependencies
2. **Mutating signal values directly** - Use update/mutate methods
3. **Not understanding equality** - Objects update by reference
4. **Mixing patterns** - Choose signals OR observables per feature
5. **Effects in loops** - Can cause performance issues
6. **Not cleaning up effects** - Memory leaks
7. **Computed with side effects** - Should be pure functions
8. **Reading signals outside tracking context** - Won't track dependencies
9. **Complex effect dependencies** - Hard to debug
10. **Forgetting to call signal** - `count` vs `count()`

## Advanced Signal Patterns

### State Management Pattern

```typescript
import { signal, computed } from '@angular/core';

interface TodoState {
  items: Todo[];
  filter: 'all' | 'active' | 'completed';
}

@Injectable({
  providedIn: 'root'
})
export class TodoStore {
  // Private state
  private state = signal<TodoState>({
    items: [],
    filter: 'all'
  });

  // Public selectors
  items = computed(() => this.state().items);
  filter = computed(() => this.state().filter);

  filteredItems = computed(() => {
    const items = this.items();
    const filter = this.filter();

    switch (filter) {
      case 'active':
        return items.filter(item => !item.completed);
      case 'completed':
        return items.filter(item => item.completed);
      default:
        return items;
    }
  });

  // Actions
  addTodo(text: string) {
    this.state.update(state => ({
      ...state,
      items: [...state.items, { id: Date.now(), text, completed: false }]
    }));
  }

  toggleTodo(id: number) {
    this.state.update(state => ({
      ...state,
      items: state.items.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    }));
  }

  setFilter(filter: TodoState['filter']) {
    this.state.update(state => ({ ...state, filter }));
  }
}
```

### Signal-based Forms

```typescript
import { Component, signal, computed } from '@angular/core';

@Component({
  selector: 'app-login-form'
})
export class LoginFormComponent {
  email = signal('');
  password = signal('');

  emailError = computed(() => {
    const email = this.email();
    if (!email) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Invalid email format';
    }
    return null;
  });

  passwordError = computed(() => {
    const password = this.password();
    if (!password) return 'Password is required';
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    return null;
  });

  isValid = computed(() =>
    !this.emailError() && !this.passwordError() &&
    this.email() && this.password()
  );

  submit() {
    if (!this.isValid()) return;
    // Submit form
  }
}
```

## Resources

- [Angular Signals Documentation](https://angular.io/guide/signals)
- [Signal Inputs](https://angular.io/guide/signal-inputs)
- [Signal Queries](https://angular.io/guide/signal-queries)
- [Angular RxJS Interop](https://angular.io/guide/rxjs-interop)
- [Signals RFC](https://github.com/angular/angular/discussions/49090)
- [Angular Blog - Signals](https://blog.angular.io/angular-v16-is-here-4d7a28ec680d)
