---
name: angular-dependency-injection
user-invocable: false
description: Use when building modular Angular applications requiring dependency injection with providers, injectors, and services.
allowed-tools:
  - Bash
  - Read
---

# Angular Dependency Injection

Master Angular's dependency injection system for building modular,
testable applications with proper service architecture.

## DI Fundamentals

Angular's DI uses the `inject()` function (Angular 14+) as the preferred
injection mechanism — no constructor parameters needed:

```typescript
import { Injectable, inject } from '@angular/core';

// Service injectable at root level
@Injectable({
  providedIn: 'root'
})
export class UserService {
  private users: User[] = [];

  getUsers(): User[] {
    return this.users;
  }

  addUser(user: User): void {
    this.users.push(user);
  }
}

// Standalone component injection via inject()
import { Component } from '@angular/core';

@Component({
  selector: 'app-user-list',
  standalone: true,
  template: `
    @for (user of users; track user.id) {
      <div>{{ user.name }}</div>
    }
  `
})
export class UserListComponent {
  private readonly userService = inject(UserService);
  users = this.userService.getUsers();
}
```

## Provider Types

### useClass - Class Provider

```typescript
import { Injectable, Provider, Component, inject } from '@angular/core';

// Interface
interface Logger {
  log(message: string): void;
}

// Implementations
@Injectable()
export class ConsoleLogger implements Logger {
  log(message: string): void {
    console.log(message);
  }
}

@Injectable()
export class FileLogger implements Logger {
  log(message: string): void {
    // Write to file
  }
}

// Provider configuration
const loggerProvider: Provider = {
  provide: Logger,
  useClass: ConsoleLogger
};

// Standalone component — providers go here, not in NgModule
@Component({
  selector: 'app-my-component',
  standalone: true,
  providers: [loggerProvider],
  template: `...`
})
export class MyComponent {
  private readonly logger = inject(Logger);

  constructor() {
    this.logger.log('Component initialized');
  }
}
```

### useValue - Value Provider

```typescript
import { InjectionToken, Component, inject } from '@angular/core';

// Configuration object
export interface AppConfig {
  apiUrl: string;
  timeout: number;
  retries: number;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('app.config');

// Provider
const configProvider = {
  provide: APP_CONFIG,
  useValue: {
    apiUrl: 'https://api.example.com',
    timeout: 5000,
    retries: 3
  }
};

// bootstrapApplication (standalone)
bootstrapApplication(AppComponent, {
  providers: [configProvider]
});

// Usage via inject()
export class ApiService {
  private readonly config = inject(APP_CONFIG);

  constructor() {
    console.log(this.config.apiUrl);
  }
}
```

### useFactory - Factory Provider

```typescript
import { Injectable, InjectionToken, inject } from '@angular/core';

export const API_URL = new InjectionToken<string>('api.url');

// Use inject() inside the factory — no deps array needed
const apiUrlProvider = {
  provide: API_URL,
  useFactory: () => {
    const config = inject(AppConfig);
    return config.production
      ? 'https://api.prod.example.com'
      : 'https://api.dev.example.com';
  }
};

// Complex factory — all deps resolved via inject()
const httpClientProvider = {
  provide: HttpClient,
  useFactory: () => {
    const handler = inject(HttpHandler);
    const logger = inject(Logger);
    logger.log('Creating HTTP client');
    return new HttpClient(handler);
  }
};
```

### useExisting - Alias Provider

```typescript
import { Injectable, inject } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class NewLogger {
  log(message: string): void {
    console.log('[NEW]', message);
  }
}

// Alias an abstract token to the concrete implementation
export abstract class Logger {
  abstract log(message: string): void;
}

const loggerAlias: Provider = {
  provide: Logger,
  useExisting: NewLogger
};

// Usage
export class MyComponent {
  private readonly logger = inject(Logger);

  constructor() {
    this.logger.log('Using aliased logger');
  }
}
```

## Injection Tokens

### InjectionToken - Type-Safe Tokens

```typescript
import { InjectionToken, inject } from '@angular/core';

// Primitive token
export const MAX_RETRIES = new InjectionToken<number>('max.retries', {
  providedIn: 'root',
  factory: () => 3 // Default value
});

// Object token
export interface FeatureFlags {
  enableNewUI: boolean;
  enableBeta: boolean;
}

export const FEATURE_FLAGS = new InjectionToken<FeatureFlags>(
  'feature.flags',
  {
    providedIn: 'root',
    factory: () => ({
      enableNewUI: false,
      enableBeta: false
    })
  }
);

// Usage via inject()
@Injectable()
export class ApiService {
  private readonly maxRetries = inject(MAX_RETRIES);
  private readonly flags = inject(FEATURE_FLAGS);
}
```

## Hierarchical Injectors

### Root Injector

```typescript
// Singleton across entire app
@Injectable({
  providedIn: 'root'
})
export class GlobalService {
  private state = {};
}
```

### Component Injector

```typescript
@Injectable()
export class ComponentService {
  private data = [];
}

@Component({
  selector: 'app-my-component',
  standalone: true,
  template: '...',
  providers: [ComponentService] // New instance per component
})
export class MyComponent {
  private readonly service = inject(ComponentService);
}

// Each component instance gets its own service instance
```

### Element Injector

```typescript
@Directive({
  selector: '[appHighlight]',
  standalone: true,
  providers: [DirectiveService]
})
export class HighlightDirective {
  private readonly service = inject(DirectiveService);
}
```

## ProvidedIn Options

```typescript
// Root - singleton across entire app
@Injectable({
  providedIn: 'root'
})
export class RootService {}

// Platform - shared across multiple apps
@Injectable({
  providedIn: 'platform'
})
export class PlatformService {}
```

## Optional and Scoped Injection

Use `inject()` options instead of `@Optional`, `@Self`, `@SkipSelf`, `@Host`:

```typescript
import { inject } from '@angular/core';

export class MyService {
  // @Optional() equivalent
  private readonly logger = inject(Logger, { optional: true });

  // @Self() equivalent — only from this component's injector
  private readonly local = inject(LocalService, { self: true });

  // @SkipSelf() equivalent — skip this injector, look up the tree
  private readonly parent = inject(SharedService, { skipSelf: true });

  // @Host() equivalent — stop at host element
  private readonly host = inject(ParentComponent, { host: true });

  // Combine options
  readonly #dep = inject(Dep, {
    optional: true,
    self: true,
  });

  constructor() {
    this.logger?.log('Service created');
  }
}
```

## Environment Providers (replaces ForRoot/ForChild)

Use `makeEnvironmentProviders` and `provideX()` functions instead of
`NgModule.forRoot()` / `NgModule.forChild()`:

```typescript
import { makeEnvironmentProviders, EnvironmentProviders } from '@angular/core';

export interface SharedConfig {
  apiUrl: string;
}

export const SHARED_CONFIG = new InjectionToken<SharedConfig>('shared.config');

// Replace forRoot() with a provideX() function
export function provideShared(config: SharedConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    SharedService,
    {
      provide: SHARED_CONFIG,
      useValue: config
    }
  ]);
}

// In bootstrapApplication (app root)
bootstrapApplication(AppComponent, {
  providers: [
    provideShared({ apiUrl: 'https://api.example.com' }),
    provideRouter(routes),
    provideHttpClient()
  ]
});

// In lazy-loaded routes — child-scope providers
export const routes: Routes = [
  {
    path: 'feature',
    loadComponent: () => import('./feature.component'),
    providers: [FeatureScopedService]
  }
];
```

## Multi-Providers

```typescript
import { InjectionToken, inject } from '@angular/core';

export const HTTP_INTERCEPTORS =
  new InjectionToken<HttpInterceptor[]>('http.interceptors');

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    return next.handle(req);
  }
}

@Injectable()
export class LoggingInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) {
    return next.handle(req);
  }
}

// Register as multi-providers
const providers: Provider[] = [
  {
    provide: HTTP_INTERCEPTORS,
    useClass: AuthInterceptor,
    multi: true
  },
  {
    provide: HTTP_INTERCEPTORS,
    useClass: LoggingInterceptor,
    multi: true
  }
];

// Inject as array
export class HttpService {
  private readonly interceptors = inject(HTTP_INTERCEPTORS);
}
```

## Tree-Shakable Providers

```typescript
// Tree-shakable (preferred) — service is removed if never injected
@Injectable({
  providedIn: 'root'
})
export class NewService {}
```

## Testing with DI

### TestBed Provider Overrides

```typescript
import { TestBed } from '@angular/core/testing';

describe('MyComponent', () => {
  let mockUserService: jasmine.SpyObj<UserService>;

  beforeEach(() => {
    mockUserService = jasmine.createSpyObj('UserService', ['getUsers']);

    TestBed.configureTestingModule({
      imports: [MyComponent], // standalone component
      providers: [
        { provide: UserService, useValue: mockUserService }
      ]
    });
  });

  it('should get users', () => {
    mockUserService.getUsers.and.returnValue([]);
    const fixture = TestBed.createComponent(MyComponent);
    // Test component with mock
  });
});
```

### Spy on Dependencies

```typescript
import { TestBed } from '@angular/core/testing';

describe('UserService', () => {
  let service: UserService;
  let httpMock: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    httpMock = jasmine.createSpyObj('HttpClient', ['get', 'post']);

    TestBed.configureTestingModule({
      providers: [
        UserService,
        { provide: HttpClient, useValue: httpMock }
      ]
    });

    service = TestBed.inject(UserService);
  });

  it('should fetch users', () => {
    httpMock.get.and.returnValue(of([]));
    service.getUsers().subscribe();
    expect(httpMock.get).toHaveBeenCalled();
  });
});
```

## When to Use This Skill

Use angular-dependency-injection when building modern, production-ready
applications that require:

- Modular service architecture
- Testable components and services
- Configuration management
- Plugin/extension systems
- Multi-provider patterns (interceptors, validators)
- Complex service hierarchies
- Lazy-loaded route isolation
- Tree-shakable code

## Angular DI Best Practices

1. **Use `inject()`** — Cleaner than constructor injection, works in class fields
2. **Use `providedIn: 'root'`** — Tree-shakable and singleton
3. **Use InjectionToken** — Type-safe tokens, no string tokens
4. **Use standalone components** — Providers in `@Component`, not `@NgModule`
5. **Use `provideX()` functions** — Replaces `forRoot()`/`forChild()`
6. **Use `inject()` in factories** — No `deps` array needed
7. **Use `inject()` options** — Replaces `@Optional`, `@Self`, `@SkipSelf`, `@Host`
8. **Favor composition** — Inject small, focused services
9. **Test with mocks** — Override providers in TestBed
10. **Avoid circular dependencies** — Refactor to a common service

## Resources

- [Angular Dependency Injection Guide](https://angular.dev/guide/di)
- [inject() function](https://angular.dev/api/core/inject)
- [Environment Injectors](https://angular.dev/guide/di/environment-injectors)
- [Injectable Services](https://angular.dev/guide/di/creating-injectable-service)
- [Testing with DI](https://angular.dev/guide/testing/services)
