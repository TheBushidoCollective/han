---
name: typescript-type-system
description: Use when working with TypeScript's type system including strict mode, advanced types, generics, type guards, and compiler configuration.
allowed-tools:
  - Bash
  - Read
---

# TypeScript Type System

Master TypeScript's type system features to write type-safe code. This
skill focuses exclusively on TypeScript language capabilities.

## TypeScript Compiler

```bash
# Type check without emitting files
tsc --noEmit

# Type check with specific config
tsc --noEmit -p tsconfig.json

# Show compiler version
tsc --version

# Watch mode for development
tsc --noEmit --watch
```

## Strict Mode Configuration

**tsconfig.json strict mode options:**

```json
{
  "compilerOptions": {
    "strict": true,                           // Enables all strict
    "noImplicitAny": true,                    // Error on 'any'
    "strictNullChecks": true,                 // null must be explicit
    "strictFunctionTypes": true,              // Stricter function types
    "strictBindCallApply": true,              // Strict bind/call/apply
    "strictPropertyInitialization": true,     // Class init required
    "noImplicitThis": true,                   // Error on 'this' any
    "alwaysStrict": true,                     // Parse strict mode
    "useUnknownInCatchVariables": true        // Catch is 'unknown'
  }
}
```

## Essential Compiler Options

```json
{
  "compilerOptions": {
    // Type Checking
    "exactOptionalPropertyTypes": true,       // Distinguish undefined from missing
    "noFallthroughCasesInSwitch": true,      // Prevent fallthrough in switch
    "noImplicitOverride": true,               // Require 'override' keyword
    "noImplicitReturns": true,                // All code paths must return
    "noPropertyAccessFromIndexSignature": true, // Require bracket notation for index
    "noUncheckedIndexedAccess": true,         // Index signatures return T | undefined
    "noUnusedLocals": true,                   // Error on unused local variables
    "noUnusedParameters": true,               // Error on unused parameters

    // Module Resolution
    "moduleResolution": "bundler",            // Modern bundler resolution
    "resolveJsonModule": true,                // Import JSON files
    "allowImportingTsExtensions": true,       // Import .ts/.tsx files
    "allowSyntheticDefaultImports": true,     // Allow default imports from modules
    "esModuleInterop": true,                  // Emit helpers for CommonJS interop

    // Emit
    "declaration": true,                      // Generate .d.ts files
    "declarationMap": true,                   // Source maps for .d.ts
    "sourceMap": true,                        // Generate .map files
    "removeComments": false,                  // Preserve comments in output
    "importHelpers": true,                    // Import helpers from tslib

    // Interop Constraints
    "isolatedModules": true,                  // Each file can be transpiled separately
    "allowArbitraryExtensions": true,         // Allow imports with any extension
    "verbatimModuleSyntax": false,            // Preserve import/export syntax

    // Skip Checks
    "skipLibCheck": true                      // Skip .d.ts file checking
  }
}
```

## Advanced Type Patterns

### Union and Intersection Types

```typescript
// Union types (OR)
type Status = "pending" | "active" | "completed";
type ID = string | number;
type Result = Success | Error;

// Intersection types (AND)
type User = Person & Employee;
type Props = BaseProps & { extended: true };

// Discriminated unions
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; size: number }
  | { kind: "rectangle"; width: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "square":
      return shape.size ** 2;
    case "rectangle":
      return shape.width * shape.height;
  }
}
```

### Generics

```typescript
// Basic generics
function identity<T>(value: T): T {
  return value;
}

// Generic constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Multiple type parameters
function merge<T, U>(obj1: T, obj2: U): T & U {
  return { ...obj1, ...obj2 };
}

// Generic interfaces
interface Repository<T> {
  find(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
}

// Generic classes
class DataStore<T extends { id: string }> {
  private items = new Map<string, T>();

  add(item: T): void {
    this.items.set(item.id, item);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }
}

// Default type parameters
type Response<T = unknown> = {
  data: T;
  status: number;
};
```

### Conditional Types

```typescript
// Basic conditional type
type IsString<T> = T extends string ? true : false;

// Distributive conditional types
type Extract<T, U> = T extends U ? T : never;
type Exclude<T, U> = T extends U ? never : T;

// Infer keyword
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type Parameters<T> = T extends (...args: infer P) => any ? P : never;

// Nested conditionals
type Flatten<T> = T extends Array<infer U> ? U : T;
type DeepFlatten<T> = T extends Array<infer U> ? DeepFlatten<U> : T;

// Conditional type with constraints
type NonNullable<T> = T extends null | undefined ? never : T;
```

### Mapped Types

```typescript
// Make all properties optional
type Partial<T> = {
  [P in keyof T]?: T[P];
};

// Make all properties required
type Required<T> = {
  [P in keyof T]-?: T[P];
};

// Make all properties readonly
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

// Pick specific properties
type Pick<T, K extends keyof T> = {
  [P in K]: T[P];
};

// Omit specific properties
type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// Transform property types
type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

// Key remapping in mapped types
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

// Filter properties by type
type PickByType<T, U> = {
  [P in keyof T as T[P] extends U ? P : never]: T[P];
};
```

### Template Literal Types

```typescript
// Basic template literals
type EventName = "click" | "focus" | "blur";
type Handler = `on${Capitalize<EventName>}`; // "onClick" | "onFocus" | "onBlur"

// Combining template literals
type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE";
type Endpoint = `/api/${string}`;
type Route = `${HTTPMethod} ${Endpoint}`;

// Extract pattern from template
type ExtractRouteParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractRouteParams<Rest>
    : T extends `${string}:${infer Param}`
    ? Param
    : never;

type Params = ExtractRouteParams<"/users/:userId/posts/:postId">; // "userId" | "postId"

// Uppercase/Lowercase/Capitalize/Uncapitalize
type UppercaseKeys<T> = {
  [K in keyof T as Uppercase<string & K>]: T[K];
};
```

## Type Narrowing

### Type Guards

```typescript
// typeof type guards
function process(value: string | number) {
  if (typeof value === "string") {
    return value.toUpperCase(); // value is string
  }
  return value.toFixed(2); // value is number
}

// instanceof type guards
class Dog {
  bark() {}
}
class Cat {
  meow() {}
}

function makeSound(animal: Dog | Cat) {
  if (animal instanceof Dog) {
    animal.bark(); // animal is Dog
  } else {
    animal.meow(); // animal is Cat
  }
}

// in operator narrowing
type Fish = { swim: () => void };
type Bird = { fly: () => void };

function move(animal: Fish | Bird) {
  if ("swim" in animal) {
    animal.swim(); // animal is Fish
  } else {
    animal.fly(); // animal is Bird
  }
}

// Custom type guards
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isUser(obj: unknown): obj is { name: string; age: number } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    "age" in obj &&
    typeof obj.name === "string" &&
    typeof obj.age === "number"
  );
}

// Assertion functions
function assert(condition: unknown, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}

function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    throw new Error("Not a string");
  }
}
```

### Discriminated Unions

```typescript
// Using literal types as discriminators
type NetworkState =
  | { status: "loading" }
  | { status: "success"; data: string }
  | { status: "error"; error: Error };

function handleNetwork(state: NetworkState) {
  switch (state.status) {
    case "loading":
      return "Loading...";
    case "success":
      return state.data; // data is available
    case "error":
      return state.error.message; // error is available
  }
}

// Multiple discriminants
type Response =
  | { kind: "ok"; status: 200; data: string }
  | { kind: "redirect"; status: 301 | 302; location: string }
  | { kind: "error"; status: 400 | 500; message: string };
```

### Truthiness Narrowing

```typescript
function printAll(strs: string | string[] | null) {
  if (strs && typeof strs === "object") {
    // strs is string[]
    for (const s of strs) {
      console.log(s);
    }
  } else if (typeof strs === "string") {
    // strs is string
    console.log(strs);
  }
}
```

## Utility Types

### Built-in Utility Types

```typescript
// Partial - Make all properties optional
type User = { name: string; age: number };
type PartialUser = Partial<User>; // { name?: string; age?: number }

// Required - Make all properties required
type RequiredUser = Required<PartialUser>; // { name: string; age: number }

// Readonly - Make all properties readonly
type ReadonlyUser = Readonly<User>;
// { readonly name: string; readonly age: number }

// Record - Construct object type with keys K and values T
type PageInfo = Record<"home" | "about" | "contact", { title: string }>;

// Pick - Pick properties from type
type UserName = Pick<User, "name">; // { name: string }

// Omit - Omit properties from type
type UserWithoutAge = Omit<User, "age">; // { name: string }

// Exclude - Exclude types from union
type T = Exclude<"a" | "b" | "c", "a">; // "b" | "c"

// Extract - Extract types from union
type T2 = Extract<"a" | "b" | "c", "a" | "f">; // "a"

// NonNullable - Remove null and undefined
type T3 = NonNullable<string | null | undefined>; // string

// ReturnType - Get return type of function
function f() { return { x: 10, y: 3 }; }
type P = ReturnType<typeof f>; // { x: number; y: number }

// Parameters - Get parameter types as tuple
function f2(a: string, b: number) {}
type P2 = Parameters<typeof f2>; // [string, number]

// ConstructorParameters - Get constructor parameter types
class C {
  constructor(a: string, b: number) {}
}
type CP = ConstructorParameters<typeof C>; // [string, number]

// InstanceType - Get instance type of constructor
type CT = InstanceType<typeof C>; // C

// Awaited - Get type returned by Promise
type A = Awaited<Promise<string>>; // string
type B = Awaited<Promise<Promise<number>>>; // number
```

## Type Assertions and Casting

```typescript
// Type assertions (angle-bracket syntax - avoid in JSX)
let someValue: unknown = "this is a string";
let strLength: number = (<string>someValue).length;

// Type assertions (as syntax - preferred)
let strLength2: number = (someValue as string).length;

// Non-null assertion operator
function liveDangerously(x?: number | null) {
  console.log(x!.toFixed()); // x is definitely not null/undefined
}

// Const assertions
let x = "hello" as const; // type is "hello", not string
let y = [10, 20] as const; // type is readonly [10, 20]
let z = { text: "hello" } as const; // type is { readonly text: "hello" }

// Double assertion (escape hatch - use sparingly)
const a = (expr as unknown) as T;

// Satisfies operator (check type without widening)
type Color = { r: number; g: number; b: number } | string;

const red = { r: 255, g: 0, b: 0 } satisfies Color;
const blue = "#0000FF" satisfies Color;
```

## Type-Only Imports and Exports

```typescript
// Import only types (erased at runtime)
import type { User, Product } from "./types";
import type * as Types from "./types";

// Mixed imports
import { type User, createUser } from "./user";

// Export only types
export type { User, Product };
export type * from "./types";

// Inline type imports (verbatimModuleSyntax: false)
import { type User } from "./user";
```

## Index Signatures and Mapped Types

```typescript
// Basic index signature
interface StringMap {
  [key: string]: string;
}

// Numeric index signature
interface NumberArray {
  [index: number]: number;
}

// Index signature with known properties
interface Dictionary {
  [key: string]: string;
  name: string; // OK: string is assignable to string
}

// Template literal in index signature
interface Events {
  [key: `on${string}`]: (event: Event) => void;
}

// Accessing with index signatures (with noUncheckedIndexedAccess)
interface Data {
  [key: string]: number;
}

const data: Data = {};
const value = data["key"]; // type is number | undefined

// Avoiding index signature with Record
type SafeData = Record<string, number>;
```

## Advanced Patterns

### Branded Types

```typescript
// Nominal typing via branding
type Brand<K, T> = K & { __brand: T };

type UserId = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;

function createUserId(id: string): UserId {
  return id as UserId;
}

function getUserById(id: UserId) {
  // id must be a UserId
}

const userId = createUserId("123");
const orderId = "456" as OrderId;

getUserById(userId); // OK
// getUserById(orderId); // Error: OrderId not assignable to UserId
```

### Builder Pattern with Fluent API

```typescript
class QueryBuilder<T> {
  private filters: Array<(item: T) => boolean> = [];

  where(predicate: (item: T) => boolean): this {
    this.filters.push(predicate);
    return this;
  }

  execute(items: T[]): T[] {
    return items.filter(item =>
      this.filters.every(filter => filter(item))
    );
  }
}

// Usage with type inference
const users = new QueryBuilder<{ name: string; age: number }>()
  .where(u => u.age > 18)
  .where(u => u.name.startsWith("A"))
  .execute(allUsers);
```

### Variadic Tuple Types

```typescript
// Spread in tuple types
type Tuple1 = [string, number];
type Tuple2 = [boolean, ...Tuple1]; // [boolean, string, number]

// Generic rest parameters
function concat<T extends unknown[], U extends unknown[]>(
  arr1: [...T],
  arr2: [...U]
): [...T, ...U] {
  return [...arr1, ...arr2];
}

// Labeled tuple elements
type Range = [start: number, end: number];
type Point = [x: number, y: number, z?: number];
```

## Common Type Patterns

### Recursive Types

```typescript
// Recursive object type
type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

// Recursive tuple
type NestedArray<T> = T | NestedArray<T>[];

// Deep partial
type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;
```

### Function Overloads

```typescript
// Function overload signatures
function createElement(tag: "div"): HTMLDivElement;
function createElement(tag: "span"): HTMLSpanElement;
function createElement(tag: "canvas"): HTMLCanvasElement;
function createElement(tag: string): HTMLElement {
  return document.createElement(tag);
}

// Method overloads
class EventEmitter {
  on(event: "data", handler: (data: string) => void): void;
  on(event: "error", handler: (error: Error) => void): void;
  on(event: string, handler: (arg: any) => void): void {
    // Implementation
  }
}
```

### Type Predicates with Generics

```typescript
// Generic type guard
function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

const values = [1, null, 2, undefined, 3];
const numbers = values.filter(isDefined); // number[]

// Array element type guard
function isArrayOf<T>(
  arr: unknown,
  check: (item: unknown) => item is T
): arr is T[] {
  return Array.isArray(arr) && arr.every(check);
}
```

## tsconfig.json Best Practices

### Project References

```json
{
  "compilerOptions": {
    "composite": true,                        // Enable project references
    "declarationMap": true,                   // Source maps for declarations
    "incremental": true,                      // Incremental compilation
    "tsBuildInfoFile": "./buildinfo"          // Build info cache location
  },
  "references": [
    { "path": "../shared" },
    { "path": "../utils" }
  ]
}
```

### Path Mapping

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@app/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"],
      "@types/*": ["src/types/*"]
    }
  }
}
```

### Multiple Configurations

```json
// tsconfig.json (base)
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true
  }
}

// tsconfig.build.json (extends base)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts"]
}
```

## Type System Limitations

### Things TypeScript Cannot Do

```typescript
// Cannot check at runtime (types are erased)
function process<T>(value: T) {
  // Error: Cannot use 'T' at runtime
  // if (value instanceof T) {}
}

// Cannot use type as value
type User = { name: string };
// const user = new User(); // Error: User is a type, not a value

// Nominal typing (TypeScript uses structural typing)
type USD = number;
type EUR = number;
const usd: USD = 100;
const eur: EUR = usd; // OK in TypeScript (both are numbers)

// Exact types (TypeScript allows excess properties in some cases)
type Point = { x: number; y: number };
const p: Point = { x: 1, y: 2, z: 3 }; // Error (object literal)
const obj = { x: 1, y: 2, z: 3 };
const p2: Point = obj; // OK (not object literal)
```

## Resources

- Official TypeScript Handbook: <https://www.typescriptlang.org/docs/handbook/>
- TypeScript Deep Dive: <https://basarat.gitbook.io/typescript/>
- Type Challenges: <https://github.com/type-challenges/type-challenges>
