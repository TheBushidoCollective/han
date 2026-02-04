---
name: fp-pure-functions
description: Write pure functions and avoid side effects for predictable, testable code
allowed-tools:
  - Bash
  - Read
---

# Pure Functions and Side Effect Management

Pure functions are the foundation of functional programming. A pure function is a function where the return value is determined only by its input values, without observable side effects. This predictability makes code easier to test, reason about, and parallelize.

## Core Characteristics of Pure Functions

A pure function must satisfy two key properties:

1. **Deterministic**: Given the same inputs, it always returns the same output
2. **No Side Effects**: It doesn't modify external state or interact with the outside world

### Example: Pure vs Impure Functions (JavaScript)

```javascript
// IMPURE: Depends on external state
let discount = 0.1;
function calculatePrice(price) {
  return price - (price * discount);
}

// PURE: All inputs are parameters
function calculatePriceWithDiscount(price, discount) {
  return price - (price * discount);
}

// IMPURE: Modifies external state
let total = 0;
function addToTotal(amount) {
  total += amount;
  return total;
}

// PURE: Returns new value without mutation
function add(a, b) {
  return a + b;
}

// Usage of pure function
const currentTotal = 100;
const newTotal = add(currentTotal, 50); // 150
// currentTotal is still 100
```

### Example: Pure Functions in Python

```python
from datetime import datetime
from typing import List, Dict

# IMPURE: Uses current time (non-deterministic)
def get_greeting():
    hour = datetime.now().hour
    if hour < 12:
        return "Good morning"
    return "Good afternoon"

# PURE: Time is passed as parameter
def get_greeting_at_time(hour: int) -> str:
    if hour < 12:
        return "Good morning"
    return "Good afternoon"

# IMPURE: Modifies input list
def add_item_impure(items: List[str], item: str) -> List[str]:
    items.append(item)
    return items

# PURE: Returns new list
def add_item_pure(items: List[str], item: str) -> List[str]:
    return [*items, item]

# IMPURE: Reads from file system
def load_config():
    with open('config.json', 'r') as f:
        return json.load(f)

# PURE: Config is passed as parameter
def process_config(config: Dict) -> Dict:
    return {
        **config,
        'processed': True,
        'timestamp': config.get('timestamp', 0)
    }
```

## Pure Functions in Elixir

Elixir's immutable data structures make it naturally suited for pure functions:

```elixir
# All functions in Elixir are pure by default
defmodule Calculator do
  # Pure: No side effects, deterministic
  def add(a, b), do: a + b

  def multiply(a, b), do: a * b

  # Pure: Returns new list without mutation
  def double_list(list) do
    Enum.map(list, fn x -> x * 2 end)
  end

  # Pure: Transforms data without side effects
  def calculate_total(items) do
    items
    |> Enum.map(& &1.price * &1.quantity)
    |> Enum.sum()
  end
end

defmodule UserTransformer do
  # Pure: Returns new struct
  def update_email(user, new_email) do
    %{user | email: new_email}
  end

  # Pure: Filters and transforms
  def get_active_users(users) do
    users
    |> Enum.filter(& &1.active)
    |> Enum.map(&format_user/1)
  end

  defp format_user(user) do
    %{
      id: user.id,
      name: "#{user.first_name} #{user.last_name}",
      email: user.email
    }
  end
end

# Usage demonstrates immutability
original_list = [1, 2, 3]
doubled = Calculator.double_list(original_list)
# original_list is still [1, 2, 3]
# doubled is [2, 4, 6]
```

## Pure Functions in Haskell

Haskell enforces purity at the type system level:

```haskell
-- Pure functions (the default in Haskell)
add :: Int -> Int -> Int
add x y = x + y

multiply :: Int -> Int -> Int
multiply x y = x * y

-- Pure: List transformation
doubleList :: [Int] -> [Int]
doubleList xs = map (*2) xs

-- Pure: Complex transformation
calculateDiscount :: Double -> Double -> Double
calculateDiscount price discountPercent =
  price * (1 - discountPercent / 100)

-- Pure: Working with custom types
data User = User
  { userId :: Int
  , userName :: String
  , userEmail :: String
  , userActive :: Bool
  }

updateEmail :: User -> String -> User
updateEmail user newEmail = user { userEmail = newEmail }

getActiveUsers :: [User] -> [User]
getActiveUsers = filter userActive

formatUser :: User -> String
formatUser user = userName user ++ " <" ++ userEmail user ++ ">"

-- Impure operations are explicitly marked with IO
-- This is NOT a pure function
readConfig :: IO String
readConfig = readFile "config.json"

-- Pure function that processes the config
parseConfig :: String -> Maybe Config
parseConfig = ... -- parsing logic
```

## Isolating Side Effects

When side effects are necessary, isolate them at the boundaries:

### JavaScript: Functional Core, Imperative Shell

```javascript
// PURE CORE: Business logic
function calculateOrderTotal(items, taxRate, shippingCost) {
  const subtotal = items.reduce((sum, item) =>
    sum + (item.price * item.quantity), 0
  );
  const tax = subtotal * taxRate;
  return subtotal + tax + shippingCost;
}

function validateOrder(order, inventory) {
  const errors = [];

  for (const item of order.items) {
    const stock = inventory[item.id];
    if (!stock || stock < item.quantity) {
      errors.push(`Insufficient stock for ${item.name}`);
    }
  }

  if (order.items.length === 0) {
    errors.push('Order must contain at least one item');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function createInvoice(order, total) {
  return {
    orderId: order.id,
    customerId: order.customerId,
    items: order.items,
    total,
    createdAt: order.timestamp
  };
}

// IMPERATIVE SHELL: Side effects isolated here
async function processOrder(orderId) {
  // Side effect: Database read
  const order = await db.orders.findById(orderId);
  const inventory = await db.inventory.getAll();

  // Pure function call
  const validation = validateOrder(order, inventory);

  if (!validation.valid) {
    // Side effect: Logging
    console.error('Order validation failed:', validation.errors);
    return { success: false, errors: validation.errors };
  }

  // Pure function call
  const total = calculateOrderTotal(
    order.items,
    order.taxRate,
    order.shippingCost
  );

  // Pure function call
  const invoice = createInvoice(order, total);

  // Side effects: Database writes
  await db.invoices.create(invoice);
  await db.orders.update(orderId, { status: 'processed' });

  // Side effect: Email
  await emailService.send(order.customerEmail, invoice);

  return { success: true, invoice };
}
```

### Python: Dependency Injection for Purity

```python
from dataclasses import dataclass
from typing import List, Dict, Callable
from datetime import datetime

@dataclass
class Order:
    id: str
    items: List[Dict]
    customer_id: str
    tax_rate: float
    shipping_cost: float

# PURE: All dependencies are parameters
def calculate_order_total(
    items: List[Dict],
    tax_rate: float,
    shipping_cost: float
) -> float:
    subtotal = sum(item['price'] * item['quantity'] for item in items)
    tax = subtotal * tax_rate
    return subtotal + tax + shipping_cost

def validate_order(order: Order, inventory: Dict[str, int]) -> Dict:
    errors = []

    for item in order.items:
        stock = inventory.get(item['id'], 0)
        if stock < item['quantity']:
            errors.append(f"Insufficient stock for {item['name']}")

    if not order.items:
        errors.append('Order must contain at least one item')

    return {
        'valid': len(errors) == 0,
        'errors': errors
    }

def create_invoice(order: Order, total: float, timestamp: datetime) -> Dict:
    return {
        'order_id': order.id,
        'customer_id': order.customer_id,
        'items': order.items,
        'total': total,
        'created_at': timestamp.isoformat()
    }

# IMPURE: But dependencies injected for testability
class OrderProcessor:
    def __init__(self, db, email_service, logger, clock: Callable[[], datetime]):
        self.db = db
        self.email_service = email_service
        self.logger = logger
        self.clock = clock  # Inject time dependency

    async def process_order(self, order_id: str) -> Dict:
        # Side effect: Database read
        order = await self.db.orders.find_by_id(order_id)
        inventory = await self.db.inventory.get_all()

        # Pure function call
        validation = validate_order(order, inventory)

        if not validation['valid']:
            # Side effect: Logging (injected)
            self.logger.error(f"Order validation failed: {validation['errors']}")
            return {'success': False, 'errors': validation['errors']}

        # Pure function calls
        total = calculate_order_total(
            order.items,
            order.tax_rate,
            order.shipping_cost
        )

        # Time is injected, making this testable
        invoice = create_invoice(order, total, self.clock())

        # Side effects: Database writes
        await self.db.invoices.create(invoice)
        await self.db.orders.update(order_id, {'status': 'processed'})

        # Side effect: Email
        await self.email_service.send(order.customer_email, invoice)

        return {'success': True, 'invoice': invoice}
```

## Referential Transparency

A pure function exhibits referential transparency: you can replace a function call with its return value without changing program behavior.

```javascript
// Pure function
function add(a, b) {
  return a + b;
}

// These are equivalent due to referential transparency
const result1 = add(2, 3) * add(4, 5);
const result2 = 5 * 9;  // Can replace function calls with values
const result3 = 45;

// Impure function (random)
function getRandomNumber() {
  return Math.random();
}

// These are NOT equivalent
const value1 = getRandomNumber() + getRandomNumber();
const value2 = 0.5 + 0.5;  // Wrong! Can't replace with specific value
```

## Testing Pure Functions

Pure functions are trivial to test:

```python
import pytest
from decimal import Decimal

# Pure function
def calculate_compound_interest(
    principal: Decimal,
    rate: Decimal,
    years: int,
    compounds_per_year: int
) -> Decimal:
    return principal * (1 + rate / compounds_per_year) ** (compounds_per_year * years)

# Tests are simple - no mocking needed
def test_compound_interest_basic():
    result = calculate_compound_interest(
        principal=Decimal('1000'),
        rate=Decimal('0.05'),
        years=1,
        compounds_per_year=12
    )
    assert result == pytest.approx(Decimal('1051.16'), rel=1e-2)

def test_compound_interest_zero_rate():
    result = calculate_compound_interest(
        principal=Decimal('1000'),
        rate=Decimal('0'),
        years=5,
        compounds_per_year=4
    )
    assert result == Decimal('1000')

def test_compound_interest_multiple_years():
    result = calculate_compound_interest(
        principal=Decimal('5000'),
        rate=Decimal('0.06'),
        years=10,
        compounds_per_year=4
    )
    assert result == pytest.approx(Decimal('9070.09'), rel=1e-2)

# No need for:
# - Database setup/teardown
# - Mocking external services
# - Clearing global state
# - Time manipulation
```

## When to Use This Skill

- Writing business logic that requires testing
- Implementing data transformations
- Building calculation engines
- Creating reusable utility functions
- Developing concurrent or parallel systems
- Refactoring legacy code for testability
- Implementing domain models
- Building composable abstractions
- Creating predictable APIs
- Optimizing for memoization or caching

## Best Practices

1. **Make all inputs explicit** - Pass every dependency as a parameter
2. **Avoid hidden dependencies** - Don't access global variables, environment, or system state
3. **Return new values** - Never mutate input parameters
4. **Keep functions focused** - Single responsibility makes purity easier
5. **Inject time dependencies** - Pass timestamps rather than calling Date.now() or datetime.now()
6. **Use immutable data structures** - Choose languages/libraries that support immutability
7. **Separate pure from impure code** - Keep business logic pure, isolate I/O at boundaries
8. **Document side effects explicitly** - Use type systems (like Haskell's IO) or naming conventions
9. **Prefer expressions over statements** - Return values instead of modifying state
10. **Make functions total** - Handle all possible inputs, avoid throwing exceptions when possible
11. **Use pure data transformations** - Map, filter, reduce instead of loops with mutations
12. **Avoid object-oriented patterns that encourage mutation** - Prefer functional composition
13. **Test pure functions extensively** - They're easy to test, take advantage of it
14. **Use pure functions for memoization** - Cache results since output depends only on input
15. **Document assumptions** - Make preconditions clear in types or documentation

## Common Pitfalls

1. **Hidden I/O dependencies** - Reading files, environment variables, or system time
2. **Mutating input parameters** - Modifying arrays, objects, or other references
3. **Depending on closure variables** - Using variables from outer scopes that can change
4. **Non-deterministic operations** - Random numbers, timestamps, UUIDs without injection
5. **Logging inside pure functions** - Even console.log is a side effect
6. **Throwing exceptions** - Exceptions are side effects; use Result/Option types instead
7. **Accessing this or self** - Often leads to hidden state dependencies
8. **Using impure standard library functions** - Math.random(), Date.now(), etc.
9. **Relying on execution order** - Pure functions should be order-independent
10. **Database or network calls** - These are side effects that must be isolated
11. **Modifying global state** - Including class variables, singletons, or registries
12. **DOM manipulation** - Any interaction with external systems
13. **Side effects in getters** - Properties should be pure computations
14. **Premature optimization** - Don't sacrifice purity for minor performance gains
15. **Ignoring language constraints** - Some languages make purity harder; use appropriate patterns

## Resources

- "Functional Programming in JavaScript" by Luis Atencio
- "Grokking Simplicity" by Eric Normand
- "Functional Programming in Scala" by Paul Chiusano and Rúnar Bjarnason
- Haskell Wiki: Referential Transparency
- "Professor Frisby's Mostly Adequate Guide to Functional Programming"
- "Domain Modeling Made Functional" by Scott Wlaschin
- Martin Fowler: "Functional Core, Imperative Shell"
- "Clojure for the Brave and True" by Daniel Higginbotham
