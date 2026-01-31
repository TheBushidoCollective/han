---
name: typescript-utility-types
description: Use when typeScript utility types, mapped types, and advanced type manipulation. Use when creating flexible, type-safe TypeScript code.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# TypeScript Utility Types

Master TypeScript's powerful type system including built-in utility types,
mapped types, conditional types, and advanced type manipulation techniques
for creating flexible, type-safe code.

## Built-in Utility Types

### Partial and Required

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

// Partial makes all properties optional
type PartialUser = Partial<User>;
// { id?: string; name?: string; email?: string; age?: number; }

function updateUser(id: string, updates: Partial<User>): User {
  const existingUser = getUser(id);
  return { ...existingUser, ...updates };
}

updateUser('123', { name: 'John' }); // Valid
updateUser('123', { age: 30 }); // Valid

// Required makes all properties required
interface OptionalConfig {
  host?: string;
  port?: number;
  timeout?: number;
}

type RequiredConfig = Required<OptionalConfig>;
// { host: string; port: number; timeout: number; }

function validateConfig(config: Required<OptionalConfig>): boolean {
  return config.host.length > 0 && config.port > 0;
}
```

### Pick and Omit

```typescript
interface Article {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  views: number;
}

// Pick selects specific properties
type ArticlePreview = Pick<Article, 'id' | 'title' | 'author'>;
// { id: string; title: string; author: string; }

function displayPreview(article: ArticlePreview): void {
  console.log(`${article.title} by ${article.author}`);
}

// Omit removes specific properties
type ArticleWithoutDates = Omit<Article, 'createdAt' | 'updatedAt'>;
// { id: string; title: string; content: string; author: string; views: number; }

// Combining Pick and Omit
type ArticleMetadata = Pick<Article, 'id' | 'author' | 'createdAt'>;
type ArticleData = Omit<Article, 'id' | 'createdAt' | 'updatedAt'>;
```

### Readonly and Record

```typescript
// Readonly makes all properties readonly
type ReadonlyUser = Readonly<User>;

const user: ReadonlyUser = {
  id: '1',
  name: 'John',
  email: 'john@example.com',
  age: 30,
};

// user.name = 'Jane'; // Error: Cannot assign to 'name' because it is a read-only property

// Deep readonly for nested objects
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P];
};

// Record creates an object type with specific keys and value type
type UserRole = 'admin' | 'editor' | 'viewer';

type RolePermissions = Record<UserRole, string[]>;
// { admin: string[]; editor: string[]; viewer: string[]; }

const permissions: RolePermissions = {
  admin: ['read', 'write', 'delete'],
  editor: ['read', 'write'],
  viewer: ['read'],
};

// Record with complex types
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type RouteHandler = (req: Request) => Response;

type RouteHandlers = Record<HttpMethod, RouteHandler>;
```

### Extract and Exclude

```typescript
type Status = 'pending' | 'approved' | 'rejected' | 'cancelled';

// Extract types that are assignable to a condition
type CompletedStatus = Extract<Status, 'approved' | 'rejected'>;
// 'approved' | 'rejected'

// Exclude types that are assignable to a condition
type ActiveStatus = Exclude<Status, 'approved' | 'rejected' | 'cancelled'>;
// 'pending'

// Practical example
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number }
  | { kind: 'rectangle'; width: number; height: number };

type CircularShape = Extract<Shape, { kind: 'circle' }>;
// { kind: 'circle'; radius: number }

type NonCircularShape = Exclude<Shape, { kind: 'circle' }>;
// { kind: 'square'; side: number } | { kind: 'rectangle'; width: number; height: number }
```

### ReturnType and Parameters

```typescript
function createUser(name: string, age: number): User {
  return {
    id: generateId(),
    name,
    age,
    email: `${name.toLowerCase()}@example.com`,
  };
}

// ReturnType extracts the return type of a function
type UserFromFunction = ReturnType<typeof createUser>;
// User

// Parameters extracts parameter types as a tuple
type CreateUserParams = Parameters<typeof createUser>;
// [name: string, age: number]

// Using with generic functions
function processData<T>(data: T[]): { count: number; items: T[] } {
  return { count: data.length, items: data };
}

type ProcessResult = ReturnType<typeof processData<User>>;
// { count: number; items: User[] }
```

## Mapped Types

### Basic Mapped Types

```typescript
// Create a type where all properties are boolean
type Flags<T> = {
  [P in keyof T]: boolean;
};

type UserFlags = Flags<User>;
// { id: boolean; name: boolean; email: boolean; age: boolean; }

// Create a type where all properties are nullable
type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

type NullableUser = Nullable<User>;
// { id: string | null; name: string | null; email: string | null; age: number | null; }

// Create a type where all properties are functions
type Getters<T> = {
  [P in keyof T as `get${Capitalize<string & P>}`]: () => T[P];
};

type UserGetters = Getters<User>;
// { getId: () => string; getName: () => string; getEmail: () => string; getAge: () => number; }
```

### Mapped Type Modifiers

```typescript
// Remove readonly modifier
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

interface ReadonlyPerson {
  readonly name: string;
  readonly age: number;
}

type MutablePerson = Mutable<ReadonlyPerson>;
// { name: string; age: number; }

// Remove optional modifier
type Concrete<T> = {
  [P in keyof T]-?: T[P];
};

interface OptionalUser {
  name?: string;
  age?: number;
}

type ConcreteUser = Concrete<OptionalUser>;
// { name: string; age: number; }

// Add optional modifier
type Optional<T> = {
  [P in keyof T]+?: T[P];
};
```

### Advanced Mapped Types

```typescript
// Transform property types
type Promisify<T> = {
  [P in keyof T]: Promise<T[P]>;
};

type AsyncUser = Promisify<User>;
// { id: Promise<string>; name: Promise<string>; email: Promise<string>; age: Promise<number>; }

// Wrap values in objects
type Boxed<T> = {
  [P in keyof T]: { value: T[P] };
};

type BoxedUser = Boxed<User>;
// { id: { value: string }; name: { value: string }; ... }

// Create proxy type
type Proxy<T> = {
  get(): T;
  set(value: T): void;
};

type ProxiedProperties<T> = {
  [P in keyof T]: Proxy<T[P]>;
};
```

## Conditional Types

### Basic Conditional Types

```typescript
// T extends U ? X : Y
type IsString<T> = T extends string ? true : false;

type Test1 = IsString<string>; // true
type Test2 = IsString<number>; // false

// Nested conditionals
type TypeName<T> =
  T extends string ? 'string' :
  T extends number ? 'number' :
  T extends boolean ? 'boolean' :
  T extends undefined ? 'undefined' :
  T extends Function ? 'function' :
  'object';

type T0 = TypeName<string>; // 'string'
type T1 = TypeName<number>; // 'number'
type T2 = TypeName<() => void>; // 'function'
```

### Distributive Conditional Types

```typescript
// Conditional types distribute over union types
type ToArray<T> = T extends any ? T[] : never;

type StrOrNumArray = ToArray<string | number>;
// string[] | number[] (not (string | number)[])

// Non-distributive version
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;

type StrOrNumArrayNonDist = ToArrayNonDist<string | number>;
// (string | number)[]

// Filter out null and undefined
type NonNullable<T> = T extends null | undefined ? never : T;

type MaybeString = string | null | undefined;
type DefinitelyString = NonNullable<MaybeString>; // string
```

### Inferring Types with infer

```typescript
// Infer return type
type GetReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

function example(): { x: number } {
  return { x: 42 };
}

type ExampleReturn = GetReturnType<typeof example>;
// { x: number }

// Infer array element type
type Flatten<T> = T extends Array<infer U> ? U : T;

type Str = Flatten<string[]>; // string
type Num = Flatten<number>; // number

// Infer Promise type
type Awaited<T> = T extends Promise<infer U> ? U : T;

type PromiseString = Awaited<Promise<string>>; // string
type RegularString = Awaited<string>; // string

// Multiple infer usage
type GetFirstArg<T> = T extends (first: infer F, ...args: any[]) => any
  ? F
  : never;

function multi(a: string, b: number, c: boolean): void {}

type FirstArgType = GetFirstArg<typeof multi>; // string
```

## Template Literal Types

### Basic Template Literals

```typescript
type World = 'world';
type Greeting = `hello ${World}`; // 'hello world'

// With unions
type Color = 'red' | 'blue' | 'green';
type Quantity = 'one' | 'two';

type ColoredQuantity = `${Quantity} ${Color}`;
// 'one red' | 'one blue' | 'one green' | 'two red' | 'two blue' | 'two green'

// Event names
type EventName = 'click' | 'focus' | 'blur';
type EventHandler = `on${Capitalize<EventName>}`;
// 'onClick' | 'onFocus' | 'onBlur'
```

### String Manipulation Types

```typescript
// Built-in string manipulation types
type UppercaseGreeting = Uppercase<'hello'>; // 'HELLO'
type LowercaseGreeting = Lowercase<'HELLO'>; // 'hello'
type CapitalizedGreeting = Capitalize<'hello'>; // 'Hello'
type UncapitalizedGreeting = Uncapitalize<'Hello'>; // 'hello'

// Combining with template literals
type GetterName<T extends string> = `get${Capitalize<T>}`;
type SetterName<T extends string> = `set${Capitalize<T>}`;

type UserNameGetter = GetterName<'name'>; // 'getName'
type UserNameSetter = SetterName<'name'>; // 'setName'

// Generate accessor methods
type Accessors<T> = {
  [K in keyof T as GetterName<string & K>]: () => T[K];
} & {
  [K in keyof T as SetterName<string & K>]: (value: T[K]) => void;
};

type UserAccessors = Accessors<User>;
// { getName: () => string; setName: (value: string) => void; ... }
```

### Pattern Matching with Template Literals

```typescript
// Extract parts from string patterns
type ExtractRouteParams<T extends string> =
  T extends `${infer Start}/:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractRouteParams<`/${Rest}`>]: string }
    : T extends `${infer Start}/:${infer Param}`
    ? { [K in Param]: string }
    : {};

type Route1 = ExtractRouteParams<'/users/:userId/posts/:postId'>;
// { userId: string; postId: string; }

type Route2 = ExtractRouteParams<'/posts/:id'>;
// { id: string; }

// Parse CSS properties
type CSSProperty =
  | 'color'
  | 'background-color'
  | 'font-size'
  | 'margin-top';

type CamelCase<S extends string> = S extends `${infer P1}-${infer P2}${infer P3}`
  ? `${P1}${Uppercase<P2>}${CamelCase<P3>}`
  : S;

type CSSPropertyCamel = CamelCase<CSSProperty>;
// 'color' | 'backgroundColor' | 'fontSize' | 'marginTop'
```

## Key Remapping

### Remapping Keys in Mapped Types

```typescript
// Filter out specific keys
type OmitByType<T, U> = {
  [P in keyof T as T[P] extends U ? never : P]: T[P];
};

interface Mixed {
  name: string;
  age: number;
  isActive: boolean;
  count: number;
}

type OnlyStrings = OmitByType<Mixed, number | boolean>;
// { name: string; }

// Rename keys with a prefix
type Prefix<T, P extends string> = {
  [K in keyof T as `${P}${string & K}`]: T[K];
};

type PrefixedUser = Prefix<User, 'user_'>;
// { user_id: string; user_name: string; user_email: string; user_age: number; }

// Convert to getter methods
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type UserGetters = Getters<User>;
```

### Conditional Key Remapping

```typescript
// Only include keys that match a condition
type PickByType<T, U> = {
  [P in keyof T as T[P] extends U ? P : never]: T[P];
};

type NumberProperties = PickByType<Mixed, number>;
// { age: number; count: number; }

// Rename keys based on type
type RenameByType<T> = {
  [K in keyof T as T[K] extends string
    ? `str_${string & K}`
    : T[K] extends number
    ? `num_${string & K}`
    : K]: T[K];
};

type RenamedMixed = RenameByType<Mixed>;
// { str_name: string; num_age: number; isActive: boolean; num_count: number; }
```

## Advanced Type Manipulation

### Recursive Types

```typescript
// JSON type
type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

const json: JSONValue = {
  name: 'John',
  age: 30,
  hobbies: ['reading', 'coding'],
  address: {
    city: 'New York',
    coordinates: [40.7128, -74.006],
  },
};

// Recursive path type
type Path<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? K | `${K}.${Path<T[K]>}`
          : K
        : never;
    }[keyof T]
  : never;

type UserPath = Path<User>;
// 'id' | 'name' | 'email' | 'age' | ...

// Deep partial
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```

### Union and Intersection Utilities

```typescript
// Union to intersection
type UnionToIntersection<U> = (
  U extends any ? (x: U) => void : never
) extends (x: infer I) => void
  ? I
  : never;

type Union = { a: string } | { b: number };
type Intersection = UnionToIntersection<Union>;
// { a: string } & { b: number }

// Get required keys
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

interface PartialRequired {
  required: string;
  optional?: number;
}

type Required = RequiredKeys<PartialRequired>; // 'required'

// Get optional keys
type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

type Optional = OptionalKeys<PartialRequired>; // 'optional'
```

### Function Type Utilities

```typescript
// Make function async
type Asyncify<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => Promise<ReturnType<T>>;

function syncFunction(x: number): string {
  return x.toString();
}

type AsyncFunction = Asyncify<typeof syncFunction>;
// (x: number) => Promise<string>

// Curry function type
type Curry<T> = T extends (
  arg: infer A,
  ...args: infer R
) => infer Return
  ? (arg: A) => R extends []
    ? Return
    : Curry<(...args: R) => Return>
  : never;

type CurriedFunction = Curry<(a: string, b: number, c: boolean) => void>;
// (arg: string) => (arg: number) => (arg: boolean) => void
```

### Builder Pattern Types

```typescript
// Type-safe builder pattern
type Builder<T, R = {}> = {
  [K in keyof T]: (
    value: T[K]
  ) => Builder<Omit<T, K>, R & Pick<T, K>>;
} & (R extends T ? { build(): T } : {});

interface Config {
  host: string;
  port: number;
  ssl: boolean;
}

function createBuilder<T>(): Builder<T> {
  const values: Partial<T> = {};

  const builder = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'build') {
          return () => values as T;
        }
        return (value: any) => {
          values[prop as keyof T] = value;
          return builder;
        };
      },
    }
  ) as Builder<T>;

  return builder;
}

// Usage with full type safety
const config = createBuilder<Config>()
  .host('localhost')
  .port(3000)
  .ssl(true)
  .build(); // Only available when all properties are set
```

## Type Inference Helpers

### Const Assertions

```typescript
// Without const assertion
const colors1 = ['red', 'blue', 'green'];
type Colors1 = typeof colors1; // string[]

// With const assertion
const colors2 = ['red', 'blue', 'green'] as const;
type Colors2 = typeof colors2; // readonly ['red', 'blue', 'green']
type Color = Colors2[number]; // 'red' | 'blue' | 'green'

// Object with const assertion
const config = {
  api: {
    url: 'https://api.example.com',
    timeout: 5000,
  },
} as const;

type ConfigUrl = typeof config.api.url; // 'https://api.example.com'
```

### Type Guards with User-Defined Type Guards

```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'email' in value
  );
}

// Generic type guard factory
function hasProperty<K extends string>(
  key: K
): <T>(obj: T) => obj is T & Record<K, unknown> {
  return (obj): obj is T & Record<K, unknown> => {
    return typeof obj === 'object' && obj !== null && key in obj;
  };
}

const hasName = hasProperty('name');

if (hasName(someObject)) {
  console.log(someObject.name); // Type-safe access
}
```

## Best Practices

1. **Prefer Built-in Utility Types**: Use TypeScript's built-in utility
   types (Partial, Pick, Omit, etc.) before creating custom ones for better
   readability.

2. **Use Const Assertions**: Apply const assertions to arrays and objects
   when you need literal types instead of widened types.

3. **Keep Types Simple**: Avoid overly complex type transformations. If a
   type becomes hard to understand, consider refactoring or using multiple
   simpler types.

4. **Document Complex Types**: Add comments to explain non-obvious type
   transformations, especially for mapped and conditional types.

5. **Leverage Type Inference**: Let TypeScript infer types when possible
   rather than explicitly declaring them everywhere.

6. **Use Template Literal Types for Strings**: For string patterns and
   concatenation, template literal types provide type safety that plain
   strings cannot.

7. **Prefer Type over Interface for Utilities**: Use type aliases for
   utility types and mapped types, as they're more flexible than interfaces.

8. **Test Your Types**: Write test cases for complex types using type
   assertions to ensure they behave as expected.

9. **Avoid Type Gymnastics**: Don't create complex types just because you
   can. Focus on types that add value and clarity to your code.

10. **Use Discriminated Unions**: For variant types, use discriminated
    unions with a literal type field for better type narrowing.

## Common Pitfalls

1. **Excessive Type Complexity**: Creating overly complex types makes code
   harder to understand and can slow down the TypeScript compiler.

2. **Ignoring Type Distribution**: Forgetting that conditional types
   distribute over unions can lead to unexpected type results.

3. **Misusing ReturnType with Generics**: Using ReturnType on generic
   functions without providing type arguments loses type information.

4. **Circular Type References**: Creating circular type dependencies can
   cause TypeScript errors or infinite type recursion.

5. **Over-using any**: Using any in utility types defeats their purpose and
   loses type safety benefits.

6. **Not Understanding Mapped Type Modifiers**: Misusing + and - modifiers
   or forgetting them can produce unexpected readonly/optional behavior.

7. **Template Literal Performance**: Complex template literal types with
   many unions can significantly slow down type checking.

8. **Forgetting as const**: Not using const assertions when you need literal
   types results in widened types that lose specificity.

9. **Mismatched Conditional Types**: Writing conditional type conditions
   that never match or always match makes types useless.

10. **Utility Type Overkill**: Creating utility types for simple operations
    that could be expressed directly makes code harder to read.

## When to Use This Skill

Use TypeScript utility types when you need to:

- Transform existing types without duplication
- Create type-safe APIs and libraries
- Build generic, reusable type utilities
- Enforce type constraints at compile time
- Generate types from runtime values
- Create type-safe builders and fluent APIs
- Model complex domain logic with types
- Implement design patterns with type safety
- Reduce type maintenance burden
- Provide better IDE autocomplete and error messages

This skill is essential for library authors, framework developers,
TypeScript experts, and anyone building type-safe, maintainable TypeScript
applications.

## Resources

### Official Documentation

- TypeScript Handbook - Utility Types:
  <https://www.typescriptlang.org/docs/handbook/utility-types.html>
- TypeScript Handbook - Mapped Types:
  <https://www.typescriptlang.org/docs/handbook/2/mapped-types.html>
- TypeScript Handbook - Conditional Types:
  <https://www.typescriptlang.org/docs/handbook/2/conditional-types.html>
- TypeScript Handbook - Template Literal Types:
  <https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html>

### Learning Resources

- Type Challenges: <https://github.com/type-challenges/type-challenges>
- TypeScript Deep Dive: <https://basarat.gitbook.io/typescript/>
- Total TypeScript: <https://www.totaltypescript.com/>
- Effective TypeScript by Dan Vanderkam

### Tools and Libraries

- ts-toolbelt: <https://github.com/millsp/ts-toolbelt> - Advanced type
  utilities
- type-fest: <https://github.com/sindresorhus/type-fest> - Essential
  TypeScript types
- utility-types: <https://github.com/piotrwitek/utility-types> - Collection
  of utility types
- TypeScript Playground: <https://www.typescriptlang.org/play> - Interactive
  type exploration

### Community

- TypeScript GitHub Discussions:
  <https://github.com/microsoft/TypeScript/discussions>
- Stack Overflow TypeScript Tag:
  <https://stackoverflow.com/questions/tagged/typescript>
- r/typescript: <https://www.reddit.com/r/typescript/>
