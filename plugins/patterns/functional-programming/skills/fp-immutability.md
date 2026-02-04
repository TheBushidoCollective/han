---
name: fp-immutability
description: Apply immutability principles across languages for safer, more predictable code
allowed-tools:
  - Bash
  - Read
---

# Immutability Principles

Immutability is a cornerstone of functional programming where data cannot be modified after creation. Instead of changing existing values, you create new values. This approach eliminates entire classes of bugs related to shared mutable state, makes code easier to reason about, and enables safe concurrent programming.

## Core Concepts of Immutability

Immutable data has several key benefits:

1. **Predictability**: Data doesn't change unexpectedly
2. **Thread Safety**: No race conditions with immutable data
3. **Easier Debugging**: State changes are explicit and traceable
4. **Temporal Logic**: Can keep historical versions of data
5. **Caching**: Safe to cache references to immutable data

### JavaScript: Immutability Patterns

```javascript
// MUTABLE APPROACH (avoid)
const user = {
  name: 'Alice',
  email: 'alice@example.com',
  addresses: []
};

function addAddress(user, address) {
  user.addresses.push(address);  // Mutation!
  return user;
}

// IMMUTABLE APPROACH (prefer)
const userImmutable = {
  name: 'Alice',
  email: 'alice@example.com',
  addresses: []
};

function addAddressImmutable(user, address) {
  return {
    ...user,
    addresses: [...user.addresses, address]
  };
}

// Usage
const user1 = { name: 'Bob', addresses: [] };
const user2 = addAddressImmutable(user1, '123 Main St');

console.log(user1.addresses.length);  // 0 - unchanged
console.log(user2.addresses.length);  // 1 - new object

// Updating nested structures
const state = {
  user: {
    profile: {
      name: 'Charlie',
      settings: {
        theme: 'dark',
        notifications: true
      }
    }
  }
};

// MUTABLE (avoid)
function toggleNotificationsMutable(state) {
  state.user.profile.settings.notifications = !state.user.profile.settings.notifications;
  return state;
}

// IMMUTABLE (prefer)
function toggleNotificationsImmutable(state) {
  return {
    ...state,
    user: {
      ...state.user,
      profile: {
        ...state.user.profile,
        settings: {
          ...state.user.profile.settings,
          notifications: !state.user.profile.settings.notifications
        }
      }
    }
  };
}

// Using Immer library for simpler deep updates
import { produce } from 'immer';

function toggleNotificationsImmer(state) {
  return produce(state, draft => {
    draft.user.profile.settings.notifications = !draft.user.profile.settings.notifications;
  });
}
```

### JavaScript: Immutable Collections

```javascript
// Array operations immutably
const numbers = [1, 2, 3, 4, 5];

// Adding elements
const withSix = [...numbers, 6];              // [1, 2, 3, 4, 5, 6]
const withZero = [0, ...numbers];             // [0, 1, 2, 3, 4, 5]

// Removing elements
const withoutThree = numbers.filter(n => n !== 3);  // [1, 2, 4, 5]
const withoutFirst = numbers.slice(1);              // [2, 3, 4, 5]
const withoutLast = numbers.slice(0, -1);           // [1, 2, 3, 4]

// Updating elements
const doubled = numbers.map(n => n * 2);      // [2, 4, 6, 8, 10]
const updateThird = [
  ...numbers.slice(0, 2),
  999,
  ...numbers.slice(3)
];  // [1, 2, 999, 4, 5]

// Object operations immutably
const person = {
  firstName: 'John',
  lastName: 'Doe',
  age: 30
};

// Adding/updating properties
const updated = { ...person, age: 31, city: 'Boston' };

// Removing properties
const { age, ...withoutAge } = person;

// Merging objects
const contact = { email: 'john@example.com', phone: '555-1234' };
const merged = { ...person, ...contact };

// Complex transformations
const users = [
  { id: 1, name: 'Alice', active: true },
  { id: 2, name: 'Bob', active: false },
  { id: 3, name: 'Charlie', active: true }
];

// Update specific user immutably
function updateUser(users, id, updates) {
  return users.map(user =>
    user.id === id ? { ...user, ...updates } : user
  );
}

const updatedUsers = updateUser(users, 2, { active: true });
```

### Python: Immutability with Dataclasses and NamedTuples

```python
from dataclasses import dataclass, replace
from typing import List, NamedTuple, FrozenSet
from collections import namedtuple

# Using frozen dataclasses (Python 3.7+)
@dataclass(frozen=True)
class Point:
    x: float
    y: float

    def move(self, dx: float, dy: float) -> 'Point':
        """Returns new Point, doesn't modify existing"""
        return Point(self.x + dx, self.y + dy)

    def distance_from_origin(self) -> float:
        return (self.x ** 2 + self.y ** 2) ** 0.5

# Usage
p1 = Point(3, 4)
p2 = p1.move(1, 1)  # Creates new Point(4, 5)
# p1.x = 10  # Error! Point is frozen

# Using NamedTuple
class Address(NamedTuple):
    street: str
    city: str
    zip_code: str
    country: str = 'USA'

    def update_street(self, new_street: str) -> 'Address':
        return self._replace(street=new_street)

# Immutable collections
address = Address('123 Main St', 'Boston', '02101')
new_address = address.update_street('456 Oak Ave')

# Using dataclass replace
@dataclass(frozen=True)
class User:
    id: int
    name: str
    email: str
    active: bool = True

    def deactivate(self) -> 'User':
        return replace(self, active=False)

    def update_email(self, new_email: str) -> 'User':
        return replace(self, email=new_email)

# Immutable list operations
original_list = [1, 2, 3, 4, 5]

# Add element (returns new list)
def add_item(lst: List, item) -> List:
    return [*lst, item]

# Remove element
def remove_item(lst: List, item) -> List:
    return [x for x in lst if x != item]

# Update element
def update_at_index(lst: List, index: int, value) -> List:
    return [*lst[:index], value, *lst[index + 1:]]

# Working with tuples (immutable by default)
coords = (10, 20, 30)
# coords[0] = 15  # Error! Tuples are immutable

# Using frozenset for immutable sets
immutable_set: FrozenSet[int] = frozenset([1, 2, 3, 4])
new_set = immutable_set | {5, 6}  # Creates new frozenset
```

### Python: Immutable State Management

```python
from dataclasses import dataclass, replace
from typing import List, Dict, Optional
from datetime import datetime

@dataclass(frozen=True)
class CartItem:
    product_id: str
    name: str
    price: float
    quantity: int

    def update_quantity(self, new_quantity: int) -> 'CartItem':
        return replace(self, quantity=new_quantity)

@dataclass(frozen=True)
class ShoppingCart:
    items: tuple[CartItem, ...]  # Tuple is immutable
    created_at: datetime
    discount_code: Optional[str] = None

    def add_item(self, item: CartItem) -> 'ShoppingCart':
        # Check if item exists
        existing_index = next(
            (i for i, cart_item in enumerate(self.items)
             if cart_item.product_id == item.product_id),
            None
        )

        if existing_index is not None:
            # Update quantity of existing item
            existing_item = self.items[existing_index]
            updated_item = existing_item.update_quantity(
                existing_item.quantity + item.quantity
            )
            new_items = (
                *self.items[:existing_index],
                updated_item,
                *self.items[existing_index + 1:]
            )
        else:
            # Add new item
            new_items = (*self.items, item)

        return replace(self, items=new_items)

    def remove_item(self, product_id: str) -> 'ShoppingCart':
        new_items = tuple(
            item for item in self.items
            if item.product_id != product_id
        )
        return replace(self, items=new_items)

    def update_quantity(self, product_id: str, quantity: int) -> 'ShoppingCart':
        new_items = tuple(
            item.update_quantity(quantity) if item.product_id == product_id else item
            for item in self.items
        )
        return replace(self, items=new_items)

    def apply_discount(self, code: str) -> 'ShoppingCart':
        return replace(self, discount_code=code)

    def total(self) -> float:
        return sum(item.price * item.quantity for item in self.items)

# Usage
cart = ShoppingCart(items=(), created_at=datetime.now())
cart = cart.add_item(CartItem('p1', 'Widget', 10.0, 2))
cart = cart.add_item(CartItem('p2', 'Gadget', 15.0, 1))
cart = cart.update_quantity('p1', 3)
print(f"Total: ${cart.total()}")
```

### Elixir: Built-in Immutability

```elixir
# In Elixir, ALL data is immutable by default

defmodule UserManager do
  defstruct [:id, :name, :email, :active, :created_at]

  # Creating a new user
  def new(id, name, email) do
    %__MODULE__{
      id: id,
      name: name,
      email: email,
      active: true,
      created_at: DateTime.utc_now()
    }
  end

  # Updating returns new struct
  def update_email(user, new_email) do
    %{user | email: new_email}
  end

  def deactivate(user) do
    %{user | active: false}
  end

  def update_name(user, new_name) do
    %{user | name: new_name}
  end
end

# List operations (all immutable)
defmodule ListOps do
  # Add to list
  def add_item(list, item) do
    [item | list]  # Prepend (efficient)
    # or
    list ++ [item]  # Append (less efficient)
  end

  # Remove from list
  def remove_item(list, item) do
    List.delete(list, item)
  end

  # Update at index
  def update_at_index(list, index, value) do
    List.replace_at(list, index, value)
  end

  # Transform all elements
  def double_all(list) do
    Enum.map(list, fn x -> x * 2 end)
  end
end

# Map operations (all immutable)
defmodule MapOps do
  # Add/update key
  def put_value(map, key, value) do
    Map.put(map, key, value)
  end

  # Remove key
  def remove_key(map, key) do
    Map.delete(map, key)
  end

  # Update existing key
  def update_value(map, key, fun) do
    Map.update!(map, key, fun)
  end

  # Merge maps
  def merge_maps(map1, map2) do
    Map.merge(map1, map2)
  end
end

# Usage examples
user = UserManager.new(1, "Alice", "alice@example.com")
updated_user = UserManager.update_email(user, "alice@newdomain.com")
# `user` is unchanged
# `updated_user` is a new struct

# List transformations
numbers = [1, 2, 3, 4, 5]
doubled = Enum.map(numbers, &(&1 * 2))
filtered = Enum.filter(numbers, &(&1 > 2))
# `numbers` remains [1, 2, 3, 4, 5]

# Pipe operator leverages immutability
result = [1, 2, 3, 4, 5]
  |> Enum.map(&(&1 * 2))
  |> Enum.filter(&(&1 > 5))
  |> Enum.sum()
```

### Elixir: Persistent Data Structures

```elixir
defmodule ShoppingCart do
  defstruct items: [], created_at: nil, discount_code: nil

  defmodule Item do
    defstruct [:product_id, :name, :price, :quantity]
  end

  def new do
    %__MODULE__{
      items: [],
      created_at: DateTime.utc_now()
    }
  end

  def add_item(cart, item) do
    case find_item_index(cart.items, item.product_id) do
      nil ->
        # Item doesn't exist, add it
        %{cart | items: [item | cart.items]}

      index ->
        # Item exists, update quantity
        update_item_quantity(cart, index, fn qty ->
          qty + item.quantity
        end)
    end
  end

  def remove_item(cart, product_id) do
    new_items = Enum.reject(cart.items, fn item ->
      item.product_id == product_id
    end)
    %{cart | items: new_items}
  end

  def update_quantity(cart, product_id, new_quantity) do
    new_items = Enum.map(cart.items, fn item ->
      if item.product_id == product_id do
        %{item | quantity: new_quantity}
      else
        item
      end
    end)
    %{cart | items: new_items}
  end

  def apply_discount(cart, code) do
    %{cart | discount_code: code}
  end

  def total(cart) do
    Enum.reduce(cart.items, 0, fn item, acc ->
      acc + (item.price * item.quantity)
    end)
  end

  defp find_item_index(items, product_id) do
    Enum.find_index(items, fn item ->
      item.product_id == product_id
    end)
  end

  defp update_item_quantity(cart, index, fun) do
    new_items = List.update_at(cart.items, index, fn item ->
      %{item | quantity: fun.(item.quantity)}
    end)
    %{cart | items: new_items}
  end
end

# Usage demonstrates immutability
cart1 = ShoppingCart.new()
cart2 = ShoppingCart.add_item(cart1, %ShoppingCart.Item{
  product_id: "p1",
  name: "Widget",
  price: 10.0,
  quantity: 2
})
cart3 = ShoppingCart.add_item(cart2, %ShoppingCart.Item{
  product_id: "p2",
  name: "Gadget",
  price: 15.0,
  quantity: 1
})

# cart1, cart2, cart3 are all different, immutable values
IO.inspect(ShoppingCart.total(cart1))  # 0
IO.inspect(ShoppingCart.total(cart2))  # 20.0
IO.inspect(ShoppingCart.total(cart3))  # 35.0
```

## Haskell: Pure Immutability with Type Safety

```haskell
-- All data is immutable in Haskell

-- Simple immutable data types
data Point = Point
  { pointX :: Double
  , pointY :: Double
  } deriving (Show, Eq)

movePoint :: Point -> Double -> Double -> Point
movePoint (Point x y) dx dy = Point (x + dx) (y + dy)

-- Record update syntax
updateX :: Point -> Double -> Point
updateX p newX = p { pointX = newX }

-- User data type
data User = User
  { userId :: Int
  , userName :: String
  , userEmail :: String
  , userActive :: Bool
  } deriving (Show, Eq)

updateEmail :: User -> String -> User
updateEmail user newEmail = user { userEmail = newEmail }

deactivateUser :: User -> User
deactivateUser user = user { userActive = False }

-- Immutable collections
-- Lists are immutable and persistent
addToList :: a -> [a] -> [a]
addToList x xs = x : xs

removeFromList :: Eq a => a -> [a] -> [a]
removeFromList x xs = filter (/= x) xs

updateAtIndex :: Int -> a -> [a] -> [a]
updateAtIndex _ _ [] = []
updateAtIndex 0 y (_:xs) = y : xs
updateAtIndex n y (x:xs) = x : updateAtIndex (n-1) y xs

-- Shopping cart example
data CartItem = CartItem
  { itemProductId :: String
  , itemName :: String
  , itemPrice :: Double
  , itemQuantity :: Int
  } deriving (Show, Eq)

data ShoppingCart = ShoppingCart
  { cartItems :: [CartItem]
  , cartCreatedAt :: String  -- Simplified for example
  , cartDiscountCode :: Maybe String
  } deriving (Show, Eq)

newCart :: String -> ShoppingCart
newCart timestamp = ShoppingCart
  { cartItems = []
  , cartCreatedAt = timestamp
  , cartDiscountCode = Nothing
  }

addItem :: CartItem -> ShoppingCart -> ShoppingCart
addItem item cart =
  case findItem (itemProductId item) (cartItems cart) of
    Nothing ->
      cart { cartItems = item : cartItems cart }
    Just existingItem ->
      let updatedItem = existingItem
            { itemQuantity = itemQuantity existingItem + itemQuantity item }
          updatedItems = updateItem (itemProductId item) updatedItem (cartItems cart)
      in cart { cartItems = updatedItems }

removeItem :: String -> ShoppingCart -> ShoppingCart
removeItem productId cart =
  cart { cartItems = filter (\i -> itemProductId i /= productId) (cartItems cart) }

updateQuantity :: String -> Int -> ShoppingCart -> ShoppingCart
updateQuantity productId newQty cart =
  let updatedItems = map (\i ->
        if itemProductId i == productId
        then i { itemQuantity = newQty }
        else i) (cartItems cart)
  in cart { cartItems = updatedItems }

applyDiscount :: String -> ShoppingCart -> ShoppingCart
applyDiscount code cart = cart { cartDiscountCode = Just code }

calculateTotal :: ShoppingCart -> Double
calculateTotal cart = sum $ map itemTotal (cartItems cart)
  where
    itemTotal item = itemPrice item * fromIntegral (itemQuantity item)

-- Helper functions
findItem :: String -> [CartItem] -> Maybe CartItem
findItem productId = find (\i -> itemProductId i == productId)

updateItem :: String -> CartItem -> [CartItem] -> [CartItem]
updateItem productId newItem = map (\i ->
  if itemProductId i == productId then newItem else i)
```

## Immutability with Performance

Persistent data structures share structure for efficiency:

```elixir
# Elixir's persistent data structures share memory
defmodule Performance do
  # Adding to head is O(1)
  def prepend_efficient(list, item) do
    [item | list]
  end

  # Appending to tail is O(n)
  def append_slow(list, item) do
    list ++ [item]
  end

  # Building lists efficiently: collect then reverse
  def build_list_efficiently(n) do
    0..n
    |> Enum.reduce([], fn i, acc -> [i | acc] end)
    |> Enum.reverse()
  end

  # Maps are persistent hash trees - efficient updates
  def update_map_efficiently(map, key, value) do
    Map.put(map, key, value)  # O(log n)
  end
end

# Structural sharing example
original_map = %{a: 1, b: 2, c: 3, d: 4}
updated_map = %{original_map | a: 100}
# Only the changed part is new; rest is shared
```

## When to Use This Skill

- Managing application state (Redux, state machines)
- Building concurrent or parallel systems
- Implementing undo/redo functionality
- Creating caching layers
- Developing time-travel debugging
- Writing predictable business logic
- Building reactive systems
- Implementing event sourcing
- Creating replayable operations
- Developing distributed systems

## Best Practices

1. **Default to immutability** - Make immutability the norm, mutability the exception
2. **Use language features** - Leverage frozen dataclasses, const, readonly, etc.
3. **Prefer immutable data structures** - Use libraries like Immutable.js, Immer, or pyrsistent
4. **Structural sharing** - Use persistent data structures for performance
5. **Update with new references** - Always return new objects rather than modifying
6. **Copy-on-write** - Only copy the parts that change
7. **Use builder patterns** - For complex object construction
8. **Avoid defensive copying** - Immutability eliminates the need
9. **Leverage type systems** - Use types to enforce immutability
10. **Document mutability** - If mutation is necessary, make it explicit
11. **Immutable by default** - Make immutability the path of least resistance
12. **Chain transformations** - Use pipelines with immutable steps
13. **Version your data** - Keep historical versions when needed
14. **Use lenses for deep updates** - Libraries like Ramda or Monocle
15. **Benchmark wisely** - Don't sacrifice immutability without profiling first

## Common Pitfalls

1. **Shallow copying** - Spread operator only copies one level deep
2. **Array methods confusion** - Some mutate (push, pop), others don't (map, filter)
3. **Reference sharing** - Forgetting that nested objects are still mutable
4. **Performance assumptions** - Immutability isn't always slower
5. **Over-copying** - Creating copies when references would suffice
6. **Ignoring structural sharing** - Not using persistent data structures
7. **Mixing paradigms** - Combining mutable and immutable approaches inconsistently
8. **Object.freeze() depth** - Only freezes top level in JavaScript
9. **Date/Regex mutability** - Some built-in objects are mutable in JavaScript
10. **Class instance mutation** - Methods that modify this
11. **Mutable default arguments** - In Python, mutable defaults are shared
12. **Tuple contents** - Tuples are immutable but can contain mutable objects
13. **Map/Set mutation** - Using mutating methods instead of immutable alternatives
14. **Unnecessary cloning** - Cloning when using persistent data structures
15. **Framework assumptions** - Some frameworks expect mutation (e.g., older React patterns)

## Resources

- "Functional Programming in JavaScript" by Luis Atencio
- Immutable.js documentation
- Immer library documentation
- "Persistent Data Structures" by Okasaki
- Redux documentation on immutability
- "Elixir in Action" by Saša Jurić
- "Haskell Programming from First Principles"
- ClojureScript rationale on persistent data structures
- "Purely Functional Data Structures" by Chris Okasaki
