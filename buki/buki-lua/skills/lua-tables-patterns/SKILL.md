---
name: Lua Tables Patterns
description: Use when lua tables as the universal data structure including arrays, dictionaries, objects, metatables, object-oriented patterns, data structures, and advanced table manipulation for building flexible, efficient Lua applications.
allowed-tools: []
---

# Lua Tables Patterns

## Introduction

Tables are Lua's sole compound data structure, serving as arrays, dictionaries,
objects, modules, and more. This versatility makes tables fundamental to Lua
programming, enabling implementations of virtually any data structure through
creative use of table features and metatables.

Tables use associative arrays that can be indexed with any Lua value except nil
and NaN. Array-like tables use consecutive integer indices starting from 1,
while dictionary-like tables use arbitrary keys. Metatables enable operator
overloading and advanced behaviors.

This skill covers table fundamentals, array and dictionary patterns, metatables,
object-oriented programming, common data structures, performance optimization,
and idiomatic table manipulation techniques.

## Table Fundamentals

Tables combine arrays and hash maps into a single versatile data structure with
1-based indexing.

```lua
-- Empty table creation
local t1 = {}
local t2 = table.create(100)  -- Pre-allocate (LuaJIT)

-- Array-style tables (consecutive integers from 1)
local array = {10, 20, 30, 40, 50}
print(array[1])  -- 10
print(array[5])  -- 50
print(#array)    -- 5 (length operator)

-- Dictionary-style tables (any key type)
local dict = {
  name = "Alice",
  age = 30,
  email = "alice@example.com"
}

print(dict.name)     -- Dot notation
print(dict["age"])   -- Bracket notation

-- Mixed array and dictionary
local mixed = {
  10, 20, 30,  -- array part: [1]=10, [2]=20, [3]=30
  name = "Bob",
  age = 25
}

print(mixed[2])      -- 20
print(mixed.name)    -- "Bob"

-- Constructor syntax variations
local point = {x = 10, y = 20}
local point2 = {["x"] = 10, ["y"] = 20}  -- Equivalent

-- Nested tables
local nested = {
  user = {
    name = "Charlie",
    address = {
      city = "Seattle",
      zip = "98101"
    }
  }
}

print(nested.user.address.city)  -- "Seattle"

-- Table insertion and removal
local list = {}
table.insert(list, "first")
table.insert(list, "second")
table.insert(list, 2, "middle")  -- Insert at position 2

print(list[1])  -- "first"
print(list[2])  -- "middle"
print(list[3])  -- "second"

local removed = table.remove(list, 2)  -- Remove at position 2
print(removed)  -- "middle"

-- Table iteration
-- Pairs: All keys (unordered)
for key, value in pairs(dict) do
  print(key, value)
end

-- Ipairs: Integer keys in order (1, 2, 3, ...)
for index, value in ipairs(array) do
  print(index, value)
end

-- Manual iteration
for i = 1, #array do
  print(i, array[i])
end

-- Table copying (shallow)
local original = {1, 2, 3, x = 10}
local copy = {}
for k, v in pairs(original) do
  copy[k] = v
end

-- Table concatenation
local fruits = {"apple", "banana", "cherry"}
local str = table.concat(fruits, ", ")
print(str)  -- "apple, banana, cherry"

-- Sorting
local numbers = {5, 2, 8, 1, 9}
table.sort(numbers)
-- numbers is now {1, 2, 5, 8, 9}

-- Custom sort
local people = {
  {name = "Alice", age = 30},
  {name = "Bob", age = 25},
  {name = "Charlie", age = 35}
}

table.sort(people, function(a, b)
  return a.age < b.age
end)
```

Tables efficiently combine arrays and hash tables, with the implementation
automatically optimizing storage based on usage patterns.

## Array Patterns

Lua arrays use 1-based indexing and provide efficient sequential access through
the array part of tables.

```lua
-- Creating arrays
local empty = {}
local numbers = {10, 20, 30, 40, 50}
local strings = {"hello", "world", "lua"}

-- Array length
print(#numbers)  -- 5

-- Appending elements
numbers[#numbers + 1] = 60
table.insert(numbers, 70)

-- Prepending (expensive)
table.insert(numbers, 1, 0)

-- Removing elements
local last = table.remove(numbers)  -- Remove and return last
local first = table.remove(numbers, 1)  -- Remove and return first

-- Array operations
function map(array, fn)
  local result = {}
  for i = 1, #array do
    result[i] = fn(array[i])
  end
  return result
end

local doubled = map(numbers, function(x) return x * 2 end)

function filter(array, predicate)
  local result = {}
  for i = 1, #array do
    if predicate(array[i]) then
      table.insert(result, array[i])
    end
  end
  return result
end

local evens = filter(numbers, function(x) return x % 2 == 0 end)

function reduce(array, fn, initial)
  local accumulator = initial
  for i = 1, #array do
    accumulator = fn(accumulator, array[i])
  end
  return accumulator
end

local sum = reduce(numbers, function(acc, x) return acc + x end, 0)

-- Array slicing
function slice(array, start_idx, end_idx)
  local result = {}
  end_idx = end_idx or #array
  for i = start_idx, end_idx do
    table.insert(result, array[i])
  end
  return result
end

local subset = slice(numbers, 2, 4)

-- Array reversal
function reverse(array)
  local result = {}
  for i = #array, 1, -1 do
    table.insert(result, array[i])
  end
  return result
end

-- In-place reversal
function reverse_in_place(array)
  local n = #array
  for i = 1, math.floor(n / 2) do
    array[i], array[n - i + 1] = array[n - i + 1], array[i]
  end
end

-- Array flattening
function flatten(array)
  local result = {}
  for i = 1, #array do
    if type(array[i]) == "table" then
      local nested = flatten(array[i])
      for j = 1, #nested do
        table.insert(result, nested[j])
      end
    else
      table.insert(result, array[i])
    end
  end
  return result
end

local nested = {1, {2, 3}, {4, {5, 6}}}
local flat = flatten(nested)  -- {1, 2, 3, 4, 5, 6}

-- Array chunking
function chunk(array, size)
  local result = {}
  for i = 1, #array, size do
    local chunk = {}
    for j = i, math.min(i + size - 1, #array) do
      table.insert(chunk, array[j])
    end
    table.insert(result, chunk)
  end
  return result
end

local chunked = chunk({1, 2, 3, 4, 5, 6, 7}, 3)
-- {{1, 2, 3}, {4, 5, 6}, {7}}

-- Unique values
function unique(array)
  local seen = {}
  local result = {}
  for i = 1, #array do
    if not seen[array[i]] then
      seen[array[i]] = true
      table.insert(result, array[i])
    end
  end
  return result
end

-- Array intersection
function intersection(a, b)
  local set = {}
  for i = 1, #a do
    set[a[i]] = true
  end

  local result = {}
  for i = 1, #b do
    if set[b[i]] then
      table.insert(result, b[i])
    end
  end
  return result
end
```

Use arrays for sequential data with numeric indices, leveraging Lua's
optimizations for consecutive integer keys.

## Dictionary and Set Patterns

Dictionary tables use arbitrary keys for fast lookups, while sets use keys with
true values.

```lua
-- Dictionary creation
local user = {
  id = 1,
  name = "Alice",
  email = "alice@example.com",
  age = 30
}

-- Dynamic key access
local key = "name"
print(user[key])  -- "Alice"

-- Adding and modifying
user.city = "Seattle"
user.age = 31

-- Removing keys
user.age = nil

-- Checking key existence
if user.name then
  print("Name exists")
end

-- Counting keys
function table_length(t)
  local count = 0
  for _ in pairs(t) do
    count = count + 1
  end
  return count
end

print(table_length(user))

-- Merging dictionaries
function merge(t1, t2)
  local result = {}
  for k, v in pairs(t1) do
    result[k] = v
  end
  for k, v in pairs(t2) do
    result[k] = v
  end
  return result
end

-- Deep copy
function deep_copy(obj)
  if type(obj) ~= 'table' then return obj end
  local copy = {}
  for k, v in pairs(obj) do
    copy[deep_copy(k)] = deep_copy(v)
  end
  return setmetatable(copy, getmetatable(obj))
end

-- Set implementation
local Set = {}

function Set.new(list)
  local set = {}
  for i = 1, #list do
    set[list[i]] = true
  end
  return set
end

function Set.add(set, value)
  set[value] = true
end

function Set.remove(set, value)
  set[value] = nil
end

function Set.contains(set, value)
  return set[value] == true
end

function Set.union(a, b)
  local result = {}
  for k in pairs(a) do result[k] = true end
  for k in pairs(b) do result[k] = true end
  return result
end

function Set.intersection(a, b)
  local result = {}
  for k in pairs(a) do
    if b[k] then result[k] = true end
  end
  return result
end

function Set.difference(a, b)
  local result = {}
  for k in pairs(a) do
    if not b[k] then result[k] = true end
  end
  return result
end

function Set.to_list(set)
  local list = {}
  for k in pairs(set) do
    table.insert(list, k)
  end
  return list
end

-- Usage
local set1 = Set.new({1, 2, 3, 4, 5})
local set2 = Set.new({4, 5, 6, 7, 8})

Set.add(set1, 10)
print(Set.contains(set1, 3))  -- true

local union = Set.union(set1, set2)
local inter = Set.intersection(set1, set2)

-- OrderedDict pattern
local OrderedDict = {}

function OrderedDict.new()
  return {_keys = {}, _values = {}}
end

function OrderedDict.set(dict, key, value)
  if not dict._values[key] then
    table.insert(dict._keys, key)
  end
  dict._values[key] = value
end

function OrderedDict.get(dict, key)
  return dict._values[key]
end

function OrderedDict.pairs(dict)
  local i = 0
  return function()
    i = i + 1
    local key = dict._keys[i]
    if key then
      return key, dict._values[key]
    end
  end
end
```

Dictionaries provide O(1) average-case lookups and enable flexible key-value
storage patterns.

## Metatables and Metamethods

Metatables enable operator overloading, property access control, and custom
behaviors through metamethods.

```lua
-- Basic metatable
local t = {}
local mt = {
  __index = function(table, key)
    return "default value"
  end
}
setmetatable(t, mt)

print(t.anything)  -- "default value"

-- Operator overloading
local Vector = {}
Vector.__index = Vector

function Vector.new(x, y)
  return setmetatable({x = x, y = y}, Vector)
end

function Vector.__add(a, b)
  return Vector.new(a.x + b.x, a.y + b.y)
end

function Vector.__sub(a, b)
  return Vector.new(a.x - b.x, a.y - b.y)
end

function Vector.__mul(a, scalar)
  if type(scalar) == "number" then
    return Vector.new(a.x * scalar, a.y * scalar)
  end
end

function Vector.__tostring(v)
  return string.format("Vector(%d, %d)", v.x, v.y)
end

function Vector.__eq(a, b)
  return a.x == b.x and a.y == b.y
end

local v1 = Vector.new(1, 2)
local v2 = Vector.new(3, 4)
local v3 = v1 + v2
print(v3)  -- Vector(4, 6)

-- Read-only tables
function read_only(table)
  local proxy = {}
  local mt = {
    __index = table,
    __newindex = function(t, k, v)
      error("Attempt to modify read-only table")
    end
  }
  return setmetatable(proxy, mt)
end

local config = read_only({
  api_key = "secret",
  timeout = 5000
})

-- config.timeout = 10000  -- Error!

-- Lazy initialization
function lazy_table(constructor)
  local cache = {}
  local mt = {
    __index = function(t, key)
      local value = constructor(key)
      rawset(t, key, value)
      return value
    end
  }
  return setmetatable({}, mt)
end

local fibonacci = lazy_table(function(n)
  if n <= 1 then return n end
  return fibonacci[n - 1] + fibonacci[n - 2]
end)

print(fibonacci[10])  -- 55

-- Default values
function table_with_default(default)
  local mt = {
    __index = function() return default end
  }
  return setmetatable({}, mt)
end

local counts = table_with_default(0)
counts.apple = counts.apple + 1
counts.banana = counts.banana + 1

-- Method call syntax
local Object = {}
Object.__index = Object

function Object.new()
  return setmetatable({}, Object)
end

function Object:method()
  -- self refers to the instance
  print("Called on", self)
end

local obj = Object.new()
obj:method()  -- Syntactic sugar for obj.method(obj)

-- __call metamethod
local Factory = {}

function Factory.new()
  local instance = {count = 0}
  local mt = {
    __call = function(self, ...)
      self.count = self.count + 1
      return ...
    end
  }
  return setmetatable(instance, mt)
end

local f = Factory.new()
f("hello")  -- Callable like a function
print(f.count)  -- 1

-- Property tracking
function tracked_table()
  local data = {}
  local mt = {
    __index = data,
    __newindex = function(t, k, v)
      print(string.format("Set %s = %s", k, v))
      data[k] = v
    end
  }
  return setmetatable({}, mt)
end
```

Metatables enable powerful metaprogramming patterns and domain-specific
languages in Lua.

## Object-Oriented Patterns

Lua supports multiple OOP approaches through tables and metatables, from simple
prototypes to class-based systems.

```lua
-- Prototype-based OOP
local Animal = {species = "Unknown"}

function Animal:new(o)
  o = o or {}
  setmetatable(o, self)
  self.__index = self
  return o
end

function Animal:speak()
  print("Some sound")
end

local Dog = Animal:new{species = "Canine"}

function Dog:speak()
  print("Woof!")
end

function Dog:fetch()
  print("Fetching...")
end

local dog = Dog:new{name = "Buddy"}
dog:speak()  -- "Woof!"
print(dog.species)  -- "Canine"

-- Class-based OOP
local Class = {}

function Class:new(...)
  local instance = setmetatable({}, self)
  self.__index = self
  if instance.init then
    instance:init(...)
  end
  return instance
end

-- Define a class
local Person = Class:new()

function Person:init(name, age)
  self.name = name
  self.age = age
end

function Person:greet()
  return string.format("Hello, I'm %s", self.name)
end

function Person:birthday()
  self.age = self.age + 1
end

local alice = Person:new("Alice", 30)
print(alice:greet())
alice:birthday()
print(alice.age)  -- 31

-- Inheritance
local Employee = Class:new()
setmetatable(Employee, {__index = Person})

function Employee:init(name, age, company)
  Person.init(self, name, age)
  self.company = company
end

function Employee:work()
  return string.format("%s works at %s", self.name, self.company)
end

local bob = Employee:new("Bob", 25, "TechCorp")
print(bob:greet())     -- Inherited from Person
print(bob:work())

-- Encapsulation with closures
function BankAccount(initial_balance)
  local balance = initial_balance or 0

  return {
    deposit = function(amount)
      if amount > 0 then
        balance = balance + amount
        return true
      end
      return false
    end,

    withdraw = function(amount)
      if amount > 0 and amount <= balance then
        balance = balance - amount
        return true
      end
      return false
    end,

    get_balance = function()
      return balance
    end
  }
end

local account = BankAccount(100)
account.deposit(50)
account.withdraw(30)
print(account.get_balance())  -- 120

-- Mixins
local Flyable = {}

function Flyable:fly()
  print(self.name .. " is flying")
end

function Flyable:land()
  print(self.name .. " has landed")
end

function mixin(target, source)
  for k, v in pairs(source) do
    target[k] = v
  end
end

local Bird = Person:new()
mixin(Bird, Flyable)

local bird = Bird:new("Eagle", 5)
bird:fly()

-- Multiple dispatch pattern
local Shape = Class:new()

function Shape:init(type)
  self.type = type
end

local Circle = Shape:new()
function Circle:init(radius)
  Shape.init(self, "circle")
  self.radius = radius
end

local Rectangle = Shape:new()
function Rectangle:init(width, height)
  Shape.init(self, "rectangle")
  self.width = width
  self.height = height
end

-- Visitor pattern
local AreaCalculator = {}

function AreaCalculator.visit_circle(circle)
  return math.pi * circle.radius * circle.radius
end

function AreaCalculator.visit_rectangle(rect)
  return rect.width * rect.height
end

function calculate_area(shape)
  local method_name = "visit_" .. shape.type
  return AreaCalculator[method_name](shape)
end
```

Choose OOP patterns based on needs: prototypes for simple hierarchies, classes
for structured systems, closures for encapsulation.

## Common Data Structures

Implement classic data structures using tables for specific algorithmic needs.

```lua
-- Stack
local Stack = {}

function Stack.new()
  return {items = {}}
end

function Stack.push(stack, item)
  table.insert(stack.items, item)
end

function Stack.pop(stack)
  return table.remove(stack.items)
end

function Stack.peek(stack)
  return stack.items[#stack.items]
end

function Stack.is_empty(stack)
  return #stack.items == 0
end

-- Queue
local Queue = {}

function Queue.new()
  return {items = {}, head = 1, tail = 0}
end

function Queue.enqueue(queue, item)
  queue.tail = queue.tail + 1
  queue.items[queue.tail] = item
end

function Queue.dequeue(queue)
  if queue.head > queue.tail then
    return nil
  end
  local item = queue.items[queue.head]
  queue.items[queue.head] = nil
  queue.head = queue.head + 1
  return item
end

-- Linked List
local LinkedList = {}

function LinkedList.new()
  return {head = nil, tail = nil, size = 0}
end

function LinkedList.append(list, value)
  local node = {value = value, next = nil}
  if list.tail then
    list.tail.next = node
    list.tail = node
  else
    list.head = node
    list.tail = node
  end
  list.size = list.size + 1
end

function LinkedList.prepend(list, value)
  local node = {value = value, next = list.head}
  list.head = node
  if not list.tail then
    list.tail = node
  end
  list.size = list.size + 1
end

function LinkedList.to_array(list)
  local array = {}
  local current = list.head
  while current do
    table.insert(array, current.value)
    current = current.next
  end
  return array
end

-- Binary Search Tree
local BST = {}

function BST.new()
  return {root = nil}
end

function BST.insert(tree, value)
  local function insert_node(node, value)
    if not node then
      return {value = value, left = nil, right = nil}
    end

    if value < node.value then
      node.left = insert_node(node.left, value)
    elseif value > node.value then
      node.right = insert_node(node.right, value)
    end

    return node
  end

  tree.root = insert_node(tree.root, value)
end

function BST.search(tree, value)
  local function search_node(node, value)
    if not node then return false end
    if value == node.value then return true end
    if value < node.value then
      return search_node(node.left, value)
    else
      return search_node(node.right, value)
    end
  end

  return search_node(tree.root, value)
end

function BST.inorder(tree)
  local result = {}

  local function traverse(node)
    if not node then return end
    traverse(node.left)
    table.insert(result, node.value)
    traverse(node.right)
  end

  traverse(tree.root)
  return result
end

-- Priority Queue (Binary Heap)
local PriorityQueue = {}

function PriorityQueue.new(comparator)
  return {
    heap = {},
    compare = comparator or function(a, b) return a < b end
  }
end

function PriorityQueue.push(pq, item)
  table.insert(pq.heap, item)
  local i = #pq.heap

  while i > 1 do
    local parent = math.floor(i / 2)
    if pq.compare(pq.heap[i], pq.heap[parent]) then
      pq.heap[i], pq.heap[parent] = pq.heap[parent], pq.heap[i]
      i = parent
    else
      break
    end
  end
end

function PriorityQueue.pop(pq)
  if #pq.heap == 0 then return nil end

  local result = pq.heap[1]
  pq.heap[1] = pq.heap[#pq.heap]
  table.remove(pq.heap)

  local i = 1
  while true do
    local left = i * 2
    local right = i * 2 + 1
    local smallest = i

    if left <= #pq.heap and pq.compare(pq.heap[left], pq.heap[smallest]) then
      smallest = left
    end

    if right <= #pq.heap and pq.compare(pq.heap[right], pq.heap[smallest]) then
      smallest = right
    end

    if smallest == i then break end

    pq.heap[i], pq.heap[smallest] = pq.heap[smallest], pq.heap[i]
    i = smallest
  end

  return result
end

-- Graph (Adjacency List)
local Graph = {}

function Graph.new()
  return {vertices = {}}
end

function Graph.add_vertex(graph, vertex)
  if not graph.vertices[vertex] then
    graph.vertices[vertex] = {}
  end
end

function Graph.add_edge(graph, from, to, weight)
  Graph.add_vertex(graph, from)
  Graph.add_vertex(graph, to)
  table.insert(graph.vertices[from], {to = to, weight = weight or 1})
end

function Graph.neighbors(graph, vertex)
  return graph.vertices[vertex] or {}
end
```

Implement data structures as needed for specific algorithmic requirements
rather than using them universally.

## Best Practices

1. **Use local variables** for tables to improve performance and avoid global
   namespace pollution

2. **Pre-allocate tables** when size is known to reduce reallocation overhead

3. **Prefer ipairs for arrays** and pairs for dictionaries to match iteration
   semantics

4. **Use metatables sparingly** as they add overhead; reserve for when needed

5. **Avoid holes in arrays** (nil values) as they break length operator and
   iteration

6. **Cache table.insert and table.remove** in tight loops for better performance

7. **Use rawget and rawset** to bypass metamethods when building metatables

8. **Prefer weak tables** for caches to allow garbage collection of unused
   entries

9. **Document table structure** in comments for complex nested tables

10. **Use consistent key types** to avoid confusion between string and numeric
    keys

## Common Pitfalls

1. **Forgetting 1-based indexing** causes off-by-one errors when translating
   from other languages

2. **Using # on dictionaries** returns incorrect length as it only counts array
   part

3. **Creating holes in arrays** with nil values breaks length operator and
   ipairs

4. **Not checking for nil keys** in dictionaries leads to missed values

5. **Mutating tables during iteration** causes unpredictable behavior and
   missing elements

6. **Overusing metatables** adds performance overhead without clear benefits

7. **Confusing . and : syntax** for method calls causes incorrect self parameter

8. **Not handling empty tables** in recursive functions causes infinite loops

9. **Using tables as boolean** since empty tables are truthy in Lua

10. **Shallow copying nested tables** leaves references to nested structures

## When to Use This Skill

Apply table patterns throughout Lua development as tables are the primary data
structure.

Use arrays for ordered collections with numeric indices and sequential access
patterns.

Leverage dictionaries for key-value storage, lookups, and mapping between values.

Apply metatables when implementing operator overloading, property access control,
or DSLs.

Implement OOP patterns when building complex systems requiring encapsulation and
inheritance.

Use custom data structures when specific algorithmic properties are needed beyond
basic tables.

## Resources

- [Programming in Lua - Tables](<https://www.lua.org/pil/2.5.html>)
- [Lua Reference Manual - Tables](<https://www.lua.org/manual/5.4/manual.html#2.1>)
- [Lua Performance Tips](<http://lua-users.org/wiki/OptimisationTips>)
- [Lua Users Wiki - Metatables](<http://lua-users.org/wiki/MetatablesTutorial>)
- [LuaJIT Performance Guide](<http://wiki.luajit.org/Numerical-Computing-Performance-Guide>)
