---
name: Lua Coroutines
description: Use when lua coroutines for cooperative multitasking including coroutine creation, yielding and resuming, passing values, generators, iterators, asynchronous patterns, state machines, and producer-consumer implementations.
allowed-tools: []
---

# Lua Coroutines

## Introduction

Coroutines in Lua provide cooperative multitasking, enabling functions to
suspend and resume execution. Unlike threads, coroutines don't run in parallel
but yield control explicitly, making them simpler to reason about while enabling
powerful asynchronous patterns without callback complexity.

Coroutines are first-class values in Lua, created from functions and managed
through the coroutine library. They maintain their own stack, local variables,
and instruction pointer, allowing suspension at any point and resumption later.
This enables elegant implementations of generators, iterators, and state machines.

This skill covers coroutine basics, yielding and resuming with values, generators
and iterators, producer-consumer patterns, asynchronous I/O simulation, state
machines, error handling, and practical coroutine patterns.

## Coroutine Fundamentals

Coroutines enable functions to pause and resume execution, providing cooperative
multitasking without thread complexity.

```lua
-- Creating a coroutine
local function simple_task()
  print("Task started")
  coroutine.yield()
  print("Task resumed")
  coroutine.yield()
  print("Task finished")
end

local co = coroutine.create(simple_task)

-- Checking coroutine status
print(coroutine.status(co))  -- "suspended"

-- Resuming coroutine
coroutine.resume(co)  -- Prints "Task started"
print(coroutine.status(co))  -- "suspended"

coroutine.resume(co)  -- Prints "Task resumed"
coroutine.resume(co)  -- Prints "Task finished"
print(coroutine.status(co))  -- "dead"

-- Coroutine with parameters
local function greet(name)
  print("Hello, " .. name)
  local response = coroutine.yield("What's your age?")
  print(name .. " is " .. response .. " years old")
end

local co2 = coroutine.create(greet)
local success, question = coroutine.resume(co2, "Alice")
print(question)  -- "What's your age?"

coroutine.resume(co2, 30)  -- "Alice is 30 years old"

-- Coroutine returning values
local function counter()
  for i = 1, 5 do
    coroutine.yield(i)
  end
  return "done"
end

local co3 = coroutine.create(counter)
repeat
  local success, value = coroutine.resume(co3)
  print(value)
until coroutine.status(co3) == "dead"

-- Coroutine wrap (simpler interface)
local function wrapped_task()
  for i = 1, 3 do
    coroutine.yield(i * 10)
  end
end

local f = coroutine.wrap(wrapped_task)
print(f())  -- 10
print(f())  -- 20
print(f())  -- 30

-- Running coroutine
local function self_aware()
  if coroutine.running() then
    print("Running in coroutine")
  else
    print("Running in main")
  end
end

self_aware()  -- "Running in main"
coroutine.resume(coroutine.create(self_aware))  -- "Running in coroutine"

-- Yielding from nested calls
local function inner()
  print("Inner start")
  coroutine.yield("from inner")
  print("Inner end")
end

local function outer()
  print("Outer start")
  inner()
  print("Outer end")
end

local co4 = coroutine.create(outer)
coroutine.resume(co4)  -- Prints "Outer start" and "Inner start"
coroutine.resume(co4)  -- Prints "Inner end" and "Outer end"

-- Bidirectional communication
local function echo()
  while true do
    local value = coroutine.yield()
    if value == nil then break end
    print("Echo: " .. value)
  end
end

local co5 = coroutine.create(echo)
coroutine.resume(co5)
coroutine.resume(co5, "Hello")
coroutine.resume(co5, "World")
coroutine.resume(co5)  -- nil terminates

-- Error handling in coroutines
local function faulty()
  print("Before error")
  error("Something went wrong")
  print("After error")  -- Never executes
end

local co6 = coroutine.create(faulty)
local success, err = coroutine.resume(co6)
if not success then
  print("Error caught: " .. err)
end
```

Coroutines enable cooperative multitasking where functions explicitly yield
control rather than being preempted.

## Generators and Iterators

Coroutines elegantly implement generators and custom iterators for lazy
evaluation and infinite sequences.

```lua
-- Simple generator
local function range(from, to, step)
  step = step or 1
  return coroutine.wrap(function()
    for i = from, to, step do
      coroutine.yield(i)
    end
  end)
end

for n in range(1, 10, 2) do
  print(n)  -- 1, 3, 5, 7, 9
end

-- Infinite generator
local function naturals()
  return coroutine.wrap(function()
    local n = 1
    while true do
      coroutine.yield(n)
      n = n + 1
    end
  end)
end

local gen = naturals()
print(gen())  -- 1
print(gen())  -- 2
print(gen())  -- 3

-- Fibonacci generator
local function fibonacci()
  return coroutine.wrap(function()
    local a, b = 0, 1
    while true do
      coroutine.yield(a)
      a, b = b, a + b
    end
  end)
end

local fib = fibonacci()
for i = 1, 10 do
  print(fib())
end

-- Filter generator
local function filter(gen, predicate)
  return coroutine.wrap(function()
    for value in gen do
      if predicate(value) then
        coroutine.yield(value)
      end
    end
  end)
end

local evens = filter(range(1, 20), function(n) return n % 2 == 0 end)
for n in evens do
  print(n)  -- 2, 4, 6, 8, 10, 12, 14, 16, 18, 20
end

-- Map generator
local function map(gen, transform)
  return coroutine.wrap(function()
    for value in gen do
      coroutine.yield(transform(value))
    end
  end)
end

local squared = map(range(1, 5), function(n) return n * n end)
for n in squared do
  print(n)  -- 1, 4, 9, 16, 25
end

-- Take generator (limit results)
local function take(gen, n)
  return coroutine.wrap(function()
    local count = 0
    for value in gen do
      if count >= n then break end
      coroutine.yield(value)
      count = count + 1
    end
  end)
end

local first5 = take(naturals(), 5)
for n in first5 do
  print(n)  -- 1, 2, 3, 4, 5
end

-- Chain generators
local function chain(...)
  local generators = {...}
  return coroutine.wrap(function()
    for _, gen in ipairs(generators) do
      for value in gen do
        coroutine.yield(value)
      end
    end
  end)
end

local combined = chain(range(1, 3), range(10, 12))
for n in combined do
  print(n)  -- 1, 2, 3, 10, 11, 12
end

-- Zip generators
local function zip(gen1, gen2)
  return coroutine.wrap(function()
    while true do
      local v1 = gen1()
      local v2 = gen2()
      if v1 == nil or v2 == nil then break end
      coroutine.yield(v1, v2)
    end
  end)
end

local letters = coroutine.wrap(function()
  for c in string.gmatch("abc", ".") do
    coroutine.yield(c)
  end
end)

local zipped = zip(range(1, 3), letters)
for num, letter in zipped do
  print(num, letter)  -- 1 a, 2 b, 3 c
end

-- Permutation generator
local function permute(array)
  return coroutine.wrap(function()
    local function perm(arr, n)
      n = n or #arr
      if n == 1 then
        coroutine.yield(arr)
      else
        for i = 1, n do
          arr[n], arr[i] = arr[i], arr[n]
          perm(arr, n - 1)
          arr[n], arr[i] = arr[i], arr[n]
        end
      end
    end

    local copy = {}
    for i, v in ipairs(array) do
      copy[i] = v
    end
    perm(copy)
  end)
end

for perm in permute({1, 2, 3}) do
  print(table.concat(perm, ", "))
end

-- File line iterator
local function lines(filename)
  return coroutine.wrap(function()
    local file = io.open(filename, "r")
    if not file then return end

    for line in file:lines() do
      coroutine.yield(line)
    end

    file:close()
  end)
end
```

Generators enable lazy evaluation and infinite sequences with clean, readable
syntax.

## Producer-Consumer Pattern

Coroutines elegantly implement producer-consumer patterns without explicit
queues or callbacks.

```lua
-- Basic producer-consumer
local function producer()
  return coroutine.create(function()
    for i = 1, 10 do
      print("Producing " .. i)
      coroutine.yield(i)
    end
  end)
end

local function consumer(prod)
  while coroutine.status(prod) ~= "dead" do
    local success, value = coroutine.resume(prod)
    if success and value then
      print("Consuming " .. value)
    end
  end
end

local prod = producer()
consumer(prod)

-- Filtered producer-consumer
local function filtered_producer(filter_fn)
  return coroutine.create(function()
    for i = 1, 20 do
      if filter_fn(i) then
        coroutine.yield(i)
      end
    end
  end)
end

local even_prod = filtered_producer(function(n) return n % 2 == 0 end)
consumer(even_prod)

-- Multiple consumers
local function multi_consumer(prod, num_consumers)
  local consumers = {}

  for i = 1, num_consumers do
    consumers[i] = coroutine.create(function()
      while true do
        local success, value = coroutine.resume(prod)
        if not success or value == nil then break end
        print(string.format("Consumer %d got %d", i, value))
        coroutine.yield()
      end
    end)
  end

  -- Round-robin scheduling
  local active = true
  while active do
    active = false
    for _, consumer in ipairs(consumers) do
      if coroutine.status(consumer) ~= "dead" then
        coroutine.resume(consumer)
        active = true
      end
    end
  end
end

-- Pipeline pattern
local function pipeline(...)
  local stages = {...}

  return function(input)
    local current = input
    for _, stage in ipairs(stages) do
      local co = coroutine.create(stage)
      local results = {}

      for value in current do
        local success, result = coroutine.resume(co, value)
        if success and result then
          table.insert(results, result)
        end
      end

      -- Convert results to generator
      current = coroutine.wrap(function()
        for _, v in ipairs(results) do
          coroutine.yield(v)
        end
      end)
    end

    return current
  end
end

-- Data processing pipeline
local function double(n)
  coroutine.yield(n * 2)
end

local function add_ten(n)
  coroutine.yield(n + 10)
end

local process = pipeline(double, add_ten)
local result = process(range(1, 5))

for n in result do
  print(n)  -- 12, 14, 16, 18, 20
end

-- Task scheduler with priorities
local Scheduler = {}

function Scheduler.new()
  return {
    tasks = {},
    current = 1
  }
end

function Scheduler.add(scheduler, priority, task_fn)
  table.insert(scheduler.tasks, {
    priority = priority,
    coroutine = coroutine.create(task_fn)
  })

  table.sort(scheduler.tasks, function(a, b)
    return a.priority > b.priority
  end)
end

function Scheduler.run(scheduler)
  while #scheduler.tasks > 0 do
    local task = scheduler.tasks[1]

    local success, result = coroutine.resume(task.coroutine)

    if coroutine.status(task.coroutine) == "dead" then
      table.remove(scheduler.tasks, 1)
    else
      -- Move to end for round-robin
      table.remove(scheduler.tasks, 1)
      table.insert(scheduler.tasks, task)
    end
  end
end

-- Usage
local sched = Scheduler.new()

Scheduler.add(sched, 1, function()
  for i = 1, 3 do
    print("Low priority task " .. i)
    coroutine.yield()
  end
end)

Scheduler.add(sched, 10, function()
  for i = 1, 3 do
    print("High priority task " .. i)
    coroutine.yield()
  end
end)

Scheduler.run(sched)
```

Producer-consumer patterns with coroutines eliminate callback complexity and
provide clear data flow.

## Asynchronous Patterns

Coroutines enable asynchronous I/O patterns without callbacks, providing
sequential-looking code for async operations.

```lua
-- Async timer simulation
local Async = {}

function Async.sleep(seconds)
  local wake_time = os.time() + seconds
  coroutine.yield(wake_time)
end

function Async.run(tasks)
  local waiting = {}

  -- Initialize tasks
  for _, task_fn in ipairs(tasks) do
    local co = coroutine.create(task_fn)
    table.insert(waiting, {coroutine = co, wake_time = 0})
  end

  -- Event loop
  while #waiting > 0 do
    local current_time = os.time()
    local still_waiting = {}

    for _, task in ipairs(waiting) do
      if current_time >= task.wake_time then
        local success, wake_time = coroutine.resume(task.coroutine)

        if coroutine.status(task.coroutine) ~= "dead" then
          table.insert(still_waiting, {
            coroutine = task.coroutine,
            wake_time = wake_time or 0
          })
        end
      else
        table.insert(still_waiting, task)
      end
    end

    waiting = still_waiting

    if #waiting > 0 then
      -- Sleep briefly to avoid busy waiting
      os.execute("sleep 0.1")
    end
  end
end

-- Usage
Async.run({
  function()
    print("Task 1 start")
    Async.sleep(1)
    print("Task 1 middle")
    Async.sleep(1)
    print("Task 1 end")
  end,

  function()
    print("Task 2 start")
    Async.sleep(2)
    print("Task 2 end")
  end
})

-- HTTP request simulation
local function http_get(url)
  -- Simulate async HTTP request
  coroutine.yield("waiting_for_" .. url)
  return "Response from " .. url
end

local function fetch_multiple()
  local urls = {
    "http://api.example.com/users",
    "http://api.example.com/posts",
    "http://api.example.com/comments"
  }

  local results = {}
  for _, url in ipairs(urls) do
    local response = http_get(url)
    table.insert(results, response)
  end

  return results
end

-- Promise-like pattern
local Promise = {}
Promise.__index = Promise

function Promise.new(executor)
  local self = setmetatable({
    state = "pending",
    value = nil,
    callbacks = {}
  }, Promise)

  local function resolve(value)
    if self.state == "pending" then
      self.state = "fulfilled"
      self.value = value
      for _, callback in ipairs(self.callbacks) do
        callback(value)
      end
    end
  end

  coroutine.resume(coroutine.create(function()
    executor(resolve)
  end))

  return self
end

function Promise:andThen(callback)
  if self.state == "fulfilled" then
    callback(self.value)
  else
    table.insert(self.callbacks, callback)
  end
  return self
end

-- Usage
local p = Promise.new(function(resolve)
  -- Simulate async work
  coroutine.yield()
  resolve(42)
end)

p:andThen(function(value)
  print("Resolved: " .. value)
end)

-- Async/await pattern
local function async(fn)
  return function(...)
    local args = {...}
    return coroutine.create(function()
      fn(table.unpack(args))
    end)
  end
end

local function await(co)
  local success, result = coroutine.resume(co)
  return result
end

local fetch_user = async(function(id)
  print("Fetching user " .. id)
  coroutine.yield()
  return {id = id, name = "User " .. id}
end)

local main = async(function()
  local user = await(fetch_user(1))
  print("Got user: " .. user.name)
end)

coroutine.resume(main())
```

Async patterns with coroutines provide sequential code style for asynchronous
operations without callback nesting.

## State Machines

Coroutines naturally implement state machines with clean state transitions and
local state preservation.

```lua
-- Connection state machine
local function connection_state_machine()
  local state = "disconnected"

  return coroutine.wrap(function()
    while true do
      local event = coroutine.yield(state)

      if state == "disconnected" then
        if event == "connect" then
          print("Connecting...")
          state = "connecting"
        end

      elseif state == "connecting" then
        if event == "connected" then
          print("Connected!")
          state = "connected"
        elseif event == "error" then
          print("Connection failed")
          state = "disconnected"
        end

      elseif state == "connected" then
        if event == "disconnect" then
          print("Disconnecting...")
          state = "disconnecting"
        elseif event == "send" then
          print("Sending data...")
        end

      elseif state == "disconnecting" then
        if event == "disconnected" then
          print("Disconnected")
          state = "disconnected"
        end
      end
    end
  end)
end

local conn = connection_state_machine()
print(conn("connect"))      -- "connecting"
print(conn("connected"))    -- "connected"
print(conn("send"))         -- "connected"
print(conn("disconnect"))   -- "disconnecting"
print(conn("disconnected")) -- "disconnected"

-- Parser state machine
local function parse_json_string()
  return coroutine.wrap(function()
    local chars = {}
    local escaped = false

    while true do
      local char = coroutine.yield()

      if char == '"' and not escaped then
        break
      elseif char == '\\' and not escaped then
        escaped = true
      else
        table.insert(chars, char)
        escaped = false
      end
    end

    return table.concat(chars)
  end)
end

-- Game AI state machine
local function enemy_ai()
  local health = 100
  local target = nil

  return coroutine.wrap(function()
    local state = "idle"

    while health > 0 do
      local input = coroutine.yield(state)

      if state == "idle" then
        if input.event == "player_spotted" then
          target = input.player
          state = "chase"
        end

      elseif state == "chase" then
        if input.event == "player_in_range" then
          state = "attack"
        elseif input.event == "player_lost" then
          target = nil
          state = "idle"
        end

      elseif state == "attack" then
        if input.event == "attack" then
          print("Enemy attacks!")
        elseif input.event == "player_out_of_range" then
          state = "chase"
        elseif input.event == "damaged" then
          health = health - input.damage
          if health < 30 then
            state = "flee"
          end
        end

      elseif state == "flee" then
        if input.event == "safe_distance" then
          state = "idle"
        end
      end
    end

    return "dead"
  end)
end

-- Traffic light state machine
local function traffic_light()
  return coroutine.wrap(function()
    while true do
      coroutine.yield("green")
      coroutine.yield("yellow")
      coroutine.yield("red")
    end
  end)
end

local light = traffic_light()
for i = 1, 6 do
  print(light())  -- green, yellow, red, green, yellow, red
end

-- Dialog system
local function dialog_tree(tree)
  return coroutine.wrap(function()
    local current = tree.start

    while current do
      local node = tree.nodes[current]
      coroutine.yield(node.text, node.choices)

      local choice = coroutine.yield()
      if node.choices and node.choices[choice] then
        current = node.choices[choice].next
      else
        current = nil
      end
    end
  end)
end

local dialog = dialog_tree({
  start = "greeting",
  nodes = {
    greeting = {
      text = "Hello, traveler!",
      choices = {
        {text = "Hello", next = "ask_quest"},
        {text = "Goodbye", next = nil}
      }
    },
    ask_quest = {
      text = "Need a quest?",
      choices = {
        {text = "Yes", next = "give_quest"},
        {text = "No", next = nil}
      }
    },
    give_quest = {
      text = "Find the lost sword!",
      choices = {}
    }
  }
})
```

State machines with coroutines maintain state naturally without complex state
tracking structures.

## Best Practices

1. **Use coroutine.wrap for iterators** as it provides simpler interface without
   status checking

2. **Check coroutine.resume return values** to handle errors and detect
   completion

3. **Avoid yielding across C boundaries** as it's not supported in standard Lua

4. **Pass data through yield and resume** rather than using global or upvalue
   variables

5. **Use coroutine.status** to check if coroutine is dead before resuming

6. **Create generators with coroutine.wrap** for clean iteration syntax

7. **Implement proper cleanup** in coroutines using pcall for error handling

8. **Avoid nested coroutine.resume** calls as they complicate control flow

9. **Use coroutine.running** to check execution context and avoid invalid yields

10. **Document yield points** clearly to help readers understand suspension
    points

## Common Pitfalls

1. **Yielding from main thread** causes errors as main is not a coroutine

2. **Not checking resume success** misses errors thrown inside coroutines

3. **Creating new coroutines in loops** without cleanup causes memory leaks

4. **Yielding across C call boundaries** fails in standard Lua (works in LuaJIT)

5. **Assuming coroutines are threads** leads to race condition concerns that
   don't exist

6. **Not handling coroutine completion** causes errors when resuming dead
   coroutines

7. **Overusing coroutines for simple iteration** adds complexity without benefits

8. **Mixing coroutine.create and wrap** interfaces causes confusion

9. **Forgetting to resume coroutines** in schedulers leaves tasks suspended
   forever

10. **Passing wrong number of arguments** to resume causes unexpected behavior

## When to Use This Skill

Apply coroutines for cooperative multitasking where explicit control flow is
beneficial.

Use generators and iterators when implementing lazy evaluation or infinite
sequences.

Leverage coroutines for async I/O patterns to avoid callback complexity and
maintain sequential code style.

Implement state machines with coroutines for game AI, parsers, or protocol
handlers.

Use producer-consumer patterns when processing data through transformation
pipelines.

Apply coroutine-based schedulers for managing multiple concurrent operations
cooperatively.

## Resources

- [Programming in Lua - Coroutines](<https://www.lua.org/pil/9.html>)
- [Lua Reference Manual - Coroutines](<https://www.lua.org/manual/5.4/manual.html#2.6>)
- [Lua Users Wiki - Coroutines](<http://lua-users.org/wiki/CoroutinesTutorial>)
- [Revisiting Coroutines (PDF)](<https://www.inf.puc-rio.br/~roberto/docs/MCC15-04.pdf>)
- [LuaJIT Coroutines](<http://luajit.org/ext_ffi_semantics.html#callback>)
