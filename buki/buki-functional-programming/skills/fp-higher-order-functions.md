---
name: fp-higher-order-functions
description: Master higher-order functions, map/filter/reduce patterns for expressive data transformations
allowed-tools:
  - Bash
  - Read
---

# Higher-Order Functions and Functional Patterns

Higher-order functions are functions that take other functions as arguments or return functions as results. They enable powerful abstractions, code reuse, and declarative programming styles. The classic trio of map, filter, and reduce form the foundation of functional data transformation.

## Understanding Higher-Order Functions

A higher-order function is any function that does at least one of the following:

1. **Accepts functions as parameters**
2. **Returns a function as its result**

This enables composition, abstraction, and powerful declarative patterns.

### JavaScript: Basic Higher-Order Functions

```javascript
// Function that takes a function as argument
function applyOperation(x, y, operation) {
  return operation(x, y);
}

const sum = applyOperation(5, 3, (a, b) => a + b);        // 8
const product = applyOperation(5, 3, (a, b) => a * b);    // 15

// Function that returns a function
function createMultiplier(factor) {
  return function(number) {
    return number * factor;
  };
}

const double = createMultiplier(2);
const triple = createMultiplier(3);

console.log(double(5));   // 10
console.log(triple(5));   // 15

// Practical example: Event handler creator
function createClickHandler(message) {
  return function(event) {
    console.log(message, event.target);
  };
}

const submitHandler = createClickHandler('Form submitted from:');
const cancelHandler = createClickHandler('Cancelled from:');

// Higher-order function for timing
function measureTime(fn) {
  return function(...args) {
    const start = performance.now();
    const result = fn(...args);
    const end = performance.now();
    console.log(`Execution time: ${end - start}ms`);
    return result;
  };
}

function slowCalculation(n) {
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += i;
  }
  return sum;
}

const timedCalculation = measureTime(slowCalculation);
timedCalculation(1000000);  // Logs execution time
```

## Map: Transforming Collections

Map applies a function to each element in a collection, returning a new collection.

### JavaScript Map Patterns

```javascript
const numbers = [1, 2, 3, 4, 5];

// Basic map
const doubled = numbers.map(n => n * 2);
// [2, 4, 6, 8, 10]

// Map with objects
const users = [
  { id: 1, firstName: 'John', lastName: 'Doe' },
  { id: 2, firstName: 'Jane', lastName: 'Smith' },
  { id: 3, firstName: 'Bob', lastName: 'Johnson' }
];

const fullNames = users.map(user => `${user.firstName} ${user.lastName}`);
// ['John Doe', 'Jane Smith', 'Bob Johnson']

const userIds = users.map(user => user.id);
// [1, 2, 3]

// Map to different structure
const userCards = users.map(user => ({
  id: user.id,
  displayName: `${user.firstName} ${user.lastName}`,
  initials: `${user.firstName[0]}${user.lastName[0]}`
}));

// Map with index
const indexed = numbers.map((n, i) => ({ value: n, index: i }));

// Chaining maps
const result = numbers
  .map(n => n * 2)
  .map(n => n + 1)
  .map(n => n.toString());
// ['3', '5', '7', '9', '11']

// Practical: Price calculation
const products = [
  { name: 'Widget', price: 10, quantity: 2 },
  { name: 'Gadget', price: 15, quantity: 1 },
  { name: 'Doohickey', price: 7, quantity: 5 }
];

const lineItems = products.map(product => ({
  name: product.name,
  total: product.price * product.quantity
}));
```

### Python Map Examples

```python
from typing import List, Callable, Dict

# Basic map
numbers = [1, 2, 3, 4, 5]
doubled = list(map(lambda x: x * 2, numbers))
# [2, 4, 6, 8, 10]

# Map with named function
def square(x: int) -> int:
    return x ** 2

squared = list(map(square, numbers))
# [1, 4, 9, 16, 25]

# List comprehension (more Pythonic)
doubled_lc = [x * 2 for x in numbers]
squared_lc = [x ** 2 for x in numbers]

# Map with objects
users = [
    {'id': 1, 'first_name': 'John', 'last_name': 'Doe'},
    {'id': 2, 'first_name': 'Jane', 'last_name': 'Smith'},
    {'id': 3, 'first_name': 'Bob', 'last_name': 'Johnson'}
]

full_names = [f"{u['first_name']} {u['last_name']}" for u in users]

# Map to dataclass
from dataclasses import dataclass

@dataclass
class UserCard:
    id: int
    display_name: str
    initials: str

def create_user_card(user: Dict) -> UserCard:
    return UserCard(
        id=user['id'],
        display_name=f"{user['first_name']} {user['last_name']}",
        initials=f"{user['first_name'][0]}{user['last_name'][0]}"
    )

user_cards = list(map(create_user_card, users))

# Or with list comprehension
user_cards_lc = [create_user_card(u) for u in users]
```

### Elixir Map Patterns

```elixir
# Map with Enum.map
numbers = [1, 2, 3, 4, 5]
doubled = Enum.map(numbers, fn x -> x * 2 end)
# [2, 4, 6, 8, 10]

# Using capture syntax
doubled_capture = Enum.map(numbers, &(&1 * 2))

# Map with structs
defmodule User do
  defstruct [:id, :first_name, :last_name]
end

users = [
  %User{id: 1, first_name: "John", last_name: "Doe"},
  %User{id: 2, first_name: "Jane", last_name: "Smith"},
  %User{id: 3, first_name: "Bob", last_name: "Johnson"}
]

full_names = Enum.map(users, fn user ->
  "#{user.first_name} #{user.last_name}"
end)

# Map to different structure
user_cards = Enum.map(users, fn user ->
  %{
    id: user.id,
    display_name: "#{user.first_name} #{user.last_name}",
    initials: "#{String.first(user.first_name)}#{String.first(user.last_name)}"
  }
end)

# Pipe operator for chaining
result = [1, 2, 3, 4, 5]
  |> Enum.map(&(&1 * 2))
  |> Enum.map(&(&1 + 1))
  |> Enum.map(&Integer.to_string/1)
# ["3", "5", "7", "9", "11"]
```

## Filter: Selecting Elements

Filter creates a new collection containing only elements that satisfy a predicate.

### JavaScript Filter Patterns

```javascript
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Basic filter
const evens = numbers.filter(n => n % 2 === 0);
// [2, 4, 6, 8, 10]

const greaterThanFive = numbers.filter(n => n > 5);
// [6, 7, 8, 9, 10]

// Filter with objects
const users = [
  { id: 1, name: 'Alice', age: 25, active: true },
  { id: 2, name: 'Bob', age: 30, active: false },
  { id: 3, name: 'Charlie', age: 35, active: true },
  { id: 4, name: 'Diana', age: 28, active: true }
];

const activeUsers = users.filter(user => user.active);
const youngUsers = users.filter(user => user.age < 30);

// Complex predicates
const activeYoungUsers = users.filter(user =>
  user.active && user.age < 30
);

// Filter with negation
const inactiveUsers = users.filter(user => !user.active);

// Combining map and filter
const activeUserNames = users
  .filter(user => user.active)
  .map(user => user.name);
// ['Alice', 'Charlie', 'Diana']

// Practical: Search functionality
function searchUsers(users, query) {
  const lowerQuery = query.toLowerCase();
  return users.filter(user =>
    user.name.toLowerCase().includes(lowerQuery)
  );
}

// Remove nulls/undefined
const values = [1, null, 2, undefined, 3, null, 4];
const defined = values.filter(v => v != null);
// [1, 2, 3, 4]

// Or more strictly
const truthy = values.filter(Boolean);
```

### Python Filter Examples

```python
from typing import List, Callable

numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

# Filter with lambda
evens = list(filter(lambda x: x % 2 == 0, numbers))
# [2, 4, 6, 8, 10]

# List comprehension (more Pythonic)
evens_lc = [x for x in numbers if x % 2 == 0]
greater_than_five = [x for x in numbers if x > 5]

# Filter objects
users = [
    {'id': 1, 'name': 'Alice', 'age': 25, 'active': True},
    {'id': 2, 'name': 'Bob', 'age': 30, 'active': False},
    {'id': 3, 'name': 'Charlie', 'age': 35, 'active': True},
    {'id': 4, 'name': 'Diana', 'age': 28, 'active': True}
]

active_users = [u for u in users if u['active']]
young_users = [u for u in users if u['age'] < 30]

# Complex predicates
active_young_users = [
    u for u in users
    if u['active'] and u['age'] < 30
]

# Combining filter and map
active_user_names = [
    u['name'] for u in users
    if u['active']
]

# Named predicate functions
def is_active(user: dict) -> bool:
    return user['active']

def is_young(user: dict) -> bool:
    return user['age'] < 30

active_users_func = list(filter(is_active, users))

# Remove None values
values = [1, None, 2, None, 3, None, 4]
defined = [v for v in values if v is not None]
```

### Elixir Filter Patterns

```elixir
numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

# Basic filter
evens = Enum.filter(numbers, fn x -> rem(x, 2) == 0 end)
# [2, 4, 6, 8, 10]

# Capture syntax
evens_capture = Enum.filter(numbers, &(rem(&1, 2) == 0))

# Filter structs
defmodule User do
  defstruct [:id, :name, :age, :active]
end

users = [
  %User{id: 1, name: "Alice", age: 25, active: true},
  %User{id: 2, name: "Bob", age: 30, active: false},
  %User{id: 3, name: "Charlie", age: 35, active: true},
  %User{id: 4, name: "Diana", age: 28, active: true}
]

active_users = Enum.filter(users, fn user -> user.active end)
young_users = Enum.filter(users, fn user -> user.age < 30 end)

# Complex predicates
active_young_users = Enum.filter(users, fn user ->
  user.active and user.age < 30
end)

# Combining filter and map
active_user_names = users
  |> Enum.filter(&(&1.active))
  |> Enum.map(&(&1.name))

# Reject (opposite of filter)
inactive_users = Enum.reject(users, &(&1.active))

# Remove nils
values = [1, nil, 2, nil, 3, nil, 4]
defined = Enum.filter(values, &(!is_nil(&1)))
# Or more concisely
defined = Enum.reject(values, &is_nil/1)
```

## Reduce: Aggregating Values

Reduce (also called fold) processes a collection to produce a single value.

### JavaScript Reduce Patterns

```javascript
const numbers = [1, 2, 3, 4, 5];

// Sum
const sum = numbers.reduce((acc, n) => acc + n, 0);
// 15

// Product
const product = numbers.reduce((acc, n) => acc * n, 1);
// 120

// Maximum
const max = numbers.reduce((acc, n) => Math.max(acc, n), -Infinity);

// Minimum
const min = numbers.reduce((acc, n) => Math.min(acc, n), Infinity);

// Building objects from arrays
const users = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' }
];

const userMap = users.reduce((acc, user) => {
  acc[user.id] = user;
  return acc;
}, {});
// { 1: {id: 1, name: 'Alice'}, 2: {...}, 3: {...} }

// Grouping
const transactions = [
  { category: 'food', amount: 50 },
  { category: 'transport', amount: 30 },
  { category: 'food', amount: 25 },
  { category: 'entertainment', amount: 100 },
  { category: 'transport', amount: 15 }
];

const byCategory = transactions.reduce((acc, transaction) => {
  const category = transaction.category;
  if (!acc[category]) {
    acc[category] = [];
  }
  acc[category].push(transaction);
  return acc;
}, {});

// Count occurrences
const fruits = ['apple', 'banana', 'apple', 'orange', 'banana', 'apple'];
const counts = fruits.reduce((acc, fruit) => {
  acc[fruit] = (acc[fruit] || 0) + 1;
  return acc;
}, {});
// { apple: 3, banana: 2, orange: 1 }

// Flatten arrays
const nested = [[1, 2], [3, 4], [5, 6]];
const flattened = nested.reduce((acc, arr) => acc.concat(arr), []);
// [1, 2, 3, 4, 5, 6]

// Or use flat()
const flattenedModern = nested.flat();

// Composing functions
const compose = (...fns) =>
  fns.reduce((f, g) => (...args) => f(g(...args)));

const addOne = x => x + 1;
const double = x => x * 2;
const square = x => x * x;

const composed = compose(square, double, addOne);
console.log(composed(3));  // ((3 + 1) * 2)^2 = 64

// Pipeline (left to right)
const pipe = (...fns) =>
  fns.reduce((f, g) => (...args) => g(f(...args)));

const piped = pipe(addOne, double, square);
console.log(piped(3));  // ((3 + 1) * 2)^2 = 64
```

### Python Reduce Examples

```python
from functools import reduce
from typing import List, Dict, Any

numbers = [1, 2, 3, 4, 5]

# Sum (but use built-in sum())
total = reduce(lambda acc, x: acc + x, numbers, 0)
# 15

# Better: use built-in
total_builtin = sum(numbers)

# Product
product = reduce(lambda acc, x: acc * x, numbers, 1)
# 120

# Maximum (but use max())
maximum = reduce(lambda acc, x: max(acc, x), numbers)

# Building dictionaries
users = [
    {'id': 1, 'name': 'Alice'},
    {'id': 2, 'name': 'Bob'},
    {'id': 3, 'name': 'Charlie'}
]

# As dictionary
user_map = {user['id']: user for user in users}

# Or with reduce
user_map_reduce = reduce(
    lambda acc, user: {**acc, user['id']: user},
    users,
    {}
)

# Grouping
transactions = [
    {'category': 'food', 'amount': 50},
    {'category': 'transport', 'amount': 30},
    {'category': 'food', 'amount': 25},
    {'category': 'entertainment', 'amount': 100},
    {'category': 'transport', 'amount': 15}
]

def group_by_category(acc: Dict, transaction: Dict) -> Dict:
    category = transaction['category']
    if category not in acc:
        acc[category] = []
    acc[category].append(transaction)
    return acc

by_category = reduce(group_by_category, transactions, {})

# Better: use itertools.groupby or collections.defaultdict
from collections import defaultdict

by_category_dd = defaultdict(list)
for t in transactions:
    by_category_dd[t['category']].append(t)

# Count occurrences
fruits = ['apple', 'banana', 'apple', 'orange', 'banana', 'apple']

# With reduce
counts = reduce(
    lambda acc, fruit: {**acc, fruit: acc.get(fruit, 0) + 1},
    fruits,
    {}
)

# Better: use Counter
from collections import Counter
counts_counter = Counter(fruits)

# Flatten lists
nested = [[1, 2], [3, 4], [5, 6]]

# With reduce
flattened = reduce(lambda acc, lst: acc + lst, nested, [])

# Better: use itertools.chain or list comprehension
from itertools import chain
flattened_chain = list(chain.from_iterable(nested))
flattened_lc = [item for sublist in nested for item in sublist]
```

### Elixir Reduce Patterns

```elixir
numbers = [1, 2, 3, 4, 5]

# Sum
sum = Enum.reduce(numbers, 0, fn x, acc -> acc + x end)
# 15

# Or use Enum.sum
sum_builtin = Enum.sum(numbers)

# Product
product = Enum.reduce(numbers, 1, fn x, acc -> acc * x end)
# 120

# Maximum
max = Enum.reduce(numbers, fn x, acc -> max(x, acc) end)

# Or use Enum.max
max_builtin = Enum.max(numbers)

# Building maps from lists
users = [
  %{id: 1, name: "Alice"},
  %{id: 2, name: "Bob"},
  %{id: 3, name: "Charlie"}
]

user_map = Enum.reduce(users, %{}, fn user, acc ->
  Map.put(acc, user.id, user)
end)

# Or use Map.new
user_map_simple = Map.new(users, fn user -> {user.id, user} end)

# Grouping
transactions = [
  %{category: "food", amount: 50},
  %{category: "transport", amount: 30},
  %{category: "food", amount: 25},
  %{category: "entertainment", amount: 100},
  %{category: "transport", amount: 15}
]

by_category = Enum.reduce(transactions, %{}, fn transaction, acc ->
  Map.update(acc, transaction.category, [transaction], fn existing ->
    [transaction | existing]
  end)
end)

# Or use Enum.group_by
by_category_simple = Enum.group_by(transactions, & &1.category)

# Count occurrences
fruits = ["apple", "banana", "apple", "orange", "banana", "apple"]

counts = Enum.reduce(fruits, %{}, fn fruit, acc ->
  Map.update(acc, fruit, 1, &(&1 + 1))
end)

# Or use Enum.frequencies
counts_simple = Enum.frequencies(fruits)

# Flatten lists
nested = [[1, 2], [3, 4], [5, 6]]

flattened = Enum.reduce(nested, [], fn list, acc ->
  acc ++ list
end)

# Or use List.flatten
flattened_simple = List.flatten(nested)

# Function composition with reduce
compose = fn fns ->
  Enum.reduce(fns, fn f, g ->
    fn x -> f.(g.(x)) end
  end)
end

add_one = fn x -> x + 1 end
double = fn x -> x * 2 end
square = fn x -> x * x end

composed = compose.([square, double, add_one])
IO.inspect composed.(3)  # 64
```

## Advanced Higher-Order Function Patterns

### Currying and Partial Application

```javascript
// Currying: Transform f(a, b, c) into f(a)(b)(c)
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    } else {
      return function(...nextArgs) {
        return curried.apply(this, args.concat(nextArgs));
      };
    }
  };
}

// Example usage
function add(a, b, c) {
  return a + b + c;
}

const curriedAdd = curry(add);
console.log(curriedAdd(1)(2)(3));  // 6
console.log(curriedAdd(1, 2)(3));  // 6
console.log(curriedAdd(1)(2, 3));  // 6

// Partial application
function partial(fn, ...fixedArgs) {
  return function(...remainingArgs) {
    return fn(...fixedArgs, ...remainingArgs);
  };
}

function greet(greeting, name) {
  return `${greeting}, ${name}!`;
}

const sayHello = partial(greet, 'Hello');
console.log(sayHello('Alice'));  // Hello, Alice!
console.log(sayHello('Bob'));    // Hello, Bob!

// Practical example: API helpers
function apiCall(method, endpoint, data) {
  return fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

const get = partial(apiCall, 'GET');
const post = partial(apiCall, 'POST');
const put = partial(apiCall, 'PUT');

// Usage
post('/api/users', { name: 'Alice' });
get('/api/users/1', null);
```

### Function Composition

```javascript
// Compose: right to left
const compose = (...fns) =>
  x => fns.reduceRight((acc, fn) => fn(acc), x);

// Pipe: left to right
const pipe = (...fns) =>
  x => fns.reduce((acc, fn) => fn(acc), x);

// Example functions
const addOne = x => x + 1;
const double = x => x * 2;
const square = x => x * x;

const composedCalc = compose(square, double, addOne);
console.log(composedCalc(3));  // square(double(addOne(3))) = 64

const pipedCalc = pipe(addOne, double, square);
console.log(pipedCalc(3));  // square(double(addOne(3))) = 64

// Practical example: Data processing pipeline
const users = [
  { name: 'alice', age: 25, active: true },
  { name: 'bob', age: 30, active: false },
  { name: 'charlie', age: 35, active: true }
];

const processUsers = pipe(
  users => users.filter(u => u.active),
  users => users.map(u => ({ ...u, name: u.name.toUpperCase() })),
  users => users.sort((a, b) => a.age - b.age)
);

console.log(processUsers(users));
```

### Haskell: Function Composition

```haskell
-- Function composition is built into Haskell with (.)
addOne :: Int -> Int
addOne x = x + 1

double :: Int -> Int
double x = x * 2

square :: Int -> Int
square x = x * x

-- Compose with (.) - right to left
composed :: Int -> Int
composed = square . double . addOne

-- Usage
result = composed 3  -- 64

-- Dollar operator ($) for function application
result2 = square $ double $ addOne 3  -- 64

-- Pipeline with (&) from Data.Function
import Data.Function ((&))

result3 = 3 & addOne & double & square  -- 64

-- Partial application (automatic currying)
add :: Int -> Int -> Int
add x y = x + y

addFive :: Int -> Int
addFive = add 5

result4 = addFive 10  -- 15

-- Map, filter, fold
numbers = [1, 2, 3, 4, 5]

doubled = map (*2) numbers
evens = filter even numbers
total = foldl (+) 0 numbers

-- Composing list operations
process :: [Int] -> Int
process = foldl (+) 0 . filter even . map (*2)

result5 = process [1, 2, 3, 4, 5]  -- 2*2 + 2*4 = 12
```

## When to Use This Skill

- Transforming collections of data
- Building data processing pipelines
- Implementing business logic declaratively
- Creating reusable function utilities
- Abstracting common patterns
- Event handling and callbacks
- Middleware and plugin systems
- State management transformations
- API data processing
- Functional reactive programming

## Best Practices

1. **Prefer built-in functions** - Use language/library map, filter, reduce when available
2. **Chain operations** - Combine map, filter, reduce for clear data flows
3. **Keep functions pure** - Higher-order functions work best with pure functions
4. **Name intermediate functions** - Makes pipelines more readable
5. **Use meaningful parameter names** - Even in lambdas, clarity matters
6. **Compose small functions** - Build complex operations from simple ones
7. **Consider performance** - Multiple passes might be less efficient than reduce
8. **Use type signatures** - Document input/output types of higher-order functions
9. **Avoid deep nesting** - Extract lambdas to named functions when complex
10. **Leverage currying** - Create specialized functions from general ones
11. **Think declaratively** - Focus on what, not how
12. **Use consistent ordering** - Data last (point-free style) or data first
13. **Document side effects** - If unavoidable, make them explicit
14. **Test thoroughly** - Higher-order functions should have comprehensive tests
15. **Use appropriate abstractions** - Don't over-engineer simple iterations

## Common Pitfalls

1. **Overusing reduce** - Map/filter may be clearer for many operations
2. **Missing initial value** - Reduce without initial value can fail on empty arrays
3. **Mutating in callbacks** - Keep map/filter/reduce callbacks pure
4. **Performance negligence** - Multiple passes can be expensive on large datasets
5. **Over-chaining** - Too many operations reduce readability
6. **Ignoring short-circuits** - Some, every, find can be more efficient than filter
7. **Wrong composition order** - Compose is right-to-left, pipe is left-to-right
8. **Callback complexity** - Extract complex logic to named functions
9. **Type confusion** - Track types through transformation chains
10. **Side effects in predicates** - Filter/some/every predicates should be pure
11. **Reassigning accumulator** - In reduce, return new value, don't mutate
12. **Forgetting to return** - In reduce/map callbacks, must return value
13. **Mixing paradigms** - Inconsistent functional/imperative mixing
14. **Premature abstraction** - Don't create higher-order functions too early
15. **Ignoring alternatives** - Sometimes a for loop is clearer

## Resources

- "Functional-Light JavaScript" by Kyle Simpson
- "Professor Frisby's Mostly Adequate Guide to Functional Programming"
- MDN Web Docs: Array methods
- "JavaScript Allongé" by Reginald Braithwaite
- Ramda.js documentation
- Lodash/FP documentation
- "Haskell Programming from First Principles"
- "Learn You a Haskell for Great Good"
- "Programming Elixir" by Dave Thomas
- Python functools documentation
- "Functional Programming in Python" by David Mertz
