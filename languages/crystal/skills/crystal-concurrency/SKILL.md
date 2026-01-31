---
name: crystal-concurrency
description: Use when implementing concurrent programming in Crystal using fibers, channels, and parallel execution patterns for high-performance, non-blocking applications.
allowed-tools: [Bash, Read]
---

# Crystal Concurrency

You are Claude Code, an expert in Crystal's concurrency model. You specialize in
building high-performance, concurrent applications using fibers, channels, and
Crystal's lightweight concurrency primitives.

Your core responsibilities:

- Implement fiber-based concurrent operations for non-blocking execution
- Design channel-based communication patterns for inter-fiber coordination
- Build parallel processing pipelines with proper synchronization
- Implement worker pools and task distribution systems
- Handle concurrent resource access with mutexes and atomic operations
- Design fault-tolerant concurrent systems with proper error handling
- Optimize fiber scheduling and resource utilization
- Implement backpressure and flow control mechanisms
- Build real-time data processing systems
- Design concurrent I/O operations for network and file systems

## Fibers: Lightweight Concurrency

Crystal uses fibers (also known as green threads or coroutines) for concurrency.
Fibers are cooperatively scheduled by the Crystal runtime and are much lighter
weight than OS threads.

### Basic Fiber Spawning

```crystal
# Simple fiber spawning
spawn do
  puts "Running in a fiber"
  sleep 1
  puts "Fiber completed"
end

# Fiber with arguments
def process_data(id : Int32, data : String)
  puts "Processing #{data} with id #{id}"
  sleep 0.5
  puts "Completed #{id}"
end

spawn process_data(1, "task A")
spawn process_data(2, "task B")

# Wait for fibers to complete
sleep 1
```

### Fiber with Return Values via Channels

```crystal
# Fibers don't return values directly, use channels instead
result_channel = Channel(Int32).new

spawn do
  result = expensive_computation(42)
  result_channel.send(result)
end

# Do other work...
puts "Doing other work"

# Wait for result
result = result_channel.receive
puts "Got result: #{result}"

def expensive_computation(n : Int32) : Int32
  sleep 1
  n * 2
end
```

### Named Fibers for Debugging

```crystal
# Give fibers descriptive names for debugging
spawn(name: "data-processor") do
  process_large_dataset
end

spawn(name: "cache-updater") do
  update_cache_periodically
end

# Fiber names appear in exception backtraces
spawn(name: "failing-worker") do
  raise "Something went wrong"
end
```

## Channels: Inter-Fiber Communication

Channels are the primary mechanism for communication between fibers. They provide
thread-safe message passing with optional buffering.

### Unbuffered Channels

```crystal
# Unbuffered channel - blocks until both sender and receiver are ready
channel = Channel(String).new

spawn do
  puts "Sending message"
  channel.send("Hello")
  puts "Message sent"
end

spawn do
  sleep 0.1  # Small delay
  puts "Receiving message"
  msg = channel.receive
  puts "Received: #{msg}"
end

sleep 1
```

### Buffered Channels

```crystal
# Buffered channel - allows sending without blocking up to buffer size
channel = Channel(Int32).new(capacity: 3)

# These sends won't block
channel.send(1)
channel.send(2)
channel.send(3)

# This would block until someone receives
# channel.send(4)

# Receive values
puts channel.receive  # 1
puts channel.receive  # 2
puts channel.receive  # 3
```

### Channel Closing and Iteration

```crystal
# Producer-consumer with channel closing
channel = Channel(Int32).new

# Producer
spawn do
  5.times do |i|
    channel.send(i)
    sleep 0.1
  end
  channel.close  # Signal no more values
end

# Consumer - iterate until channel is closed
spawn do
  channel.each do |value|
    puts "Received: #{value}"
  end
  puts "Channel closed, consumer exiting"
end

sleep 1
```

### Checking if Channel is Closed

```crystal
channel = Channel(String).new

spawn do
  channel.send("message 1")
  channel.send("message 2")
  channel.close
end

sleep 0.1

# Check before receiving
unless channel.closed?
  puts channel.receive
end

# Or handle the exception
begin
  puts channel.receive
  puts channel.receive
  puts channel.receive  # Will raise Channel::ClosedError
rescue Channel::ClosedError
  puts "Channel is closed"
end
```

## Select: Multiplexing Channels

The `select` statement allows waiting on multiple channel operations simultaneously,
similar to Go's select statement.

### Basic Select with Multiple Channels

```crystal
ch1 = Channel(String).new
ch2 = Channel(Int32).new

spawn do
  sleep 0.2
  ch1.send("from channel 1")
end

spawn do
  sleep 0.1
  ch2.send(42)
end

# Wait for whichever channel is ready first
select
when msg = ch1.receive
  puts "Got string: #{msg}"
when num = ch2.receive
  puts "Got number: #{num}"
end

sleep 1
```

### Select with Timeout

```crystal
channel = Channel(String).new

spawn do
  sleep 2  # Takes too long
  channel.send("delayed message")
end

# Wait with timeout
select
when msg = channel.receive
  puts "Received: #{msg}"
when timeout(1.second)
  puts "Timed out waiting for message"
end
```

### Select with Default Case (Non-blocking)

```crystal
channel = Channel(Int32).new

# Non-blocking receive
select
when value = channel.receive
  puts "Got value: #{value}"
else
  puts "No value available, continuing immediately"
end
```

### Select in a Loop

```crystal
results = Channel(String).new
done = Channel(Nil).new
output = [] of String

# Multiple workers sending results
3.times do |i|
  spawn do
    sleep rand(0.5..1.5)
    results.send("Worker #{i} done")
  end
end

# Collector fiber
spawn do
  3.times do
    output << results.receive
  end
  done.send(nil)
end

# Wait for completion with timeout
select
when done.receive
  puts "All workers completed"
  output.each { |msg| puts msg }
when timeout(5.seconds)
  puts "Timeout - not all workers completed"
end
```

## Worker Pools

Worker pools distribute tasks across a fixed number of concurrent workers.

### Basic Worker Pool

```crystal
class WorkerPool(T, R)
  def initialize(@size : Int32)
    @tasks = Channel(T).new
    @results = Channel(R).new
    @workers = [] of Fiber

    @size.times do |i|
      @workers << spawn(name: "worker-#{i}") do
        worker_loop
      end
    end
  end

  private def worker_loop
    @tasks.each do |task|
      result = process(task)
      @results.send(result)
    end
  end

  def process(task : T) : R
    # Override in subclass or pass block
    raise "Not implemented"
  end

  def submit(task : T)
    @tasks.send(task)
  end

  def get_result : R
    @results.receive
  end

  def shutdown
    @tasks.close
  end
end

# Usage example
class IntSquarePool < WorkerPool(Int32, Int32)
  def process(task : Int32) : Int32
    sleep 0.1  # Simulate work
    task * task
  end
end

pool = IntSquarePool.new(size: 3)

# Submit tasks
10.times { |i| pool.submit(i) }

# Collect results
results = [] of Int32
10.times { results << pool.get_result }

pool.shutdown
puts results.sort
```

### Worker Pool with Error Handling

```crystal
struct Task
  property id : Int32
  property data : String

  def initialize(@id, @data)
  end
end

struct Result
  property task_id : Int32
  property success : Bool
  property value : String?
  property error : String?

  def initialize(@task_id, @success, @value = nil, @error = nil)
  end
end

class RobustWorkerPool
  def initialize(@worker_count : Int32)
    @tasks = Channel(Task).new(capacity: 100)
    @results = Channel(Result).new(capacity: 100)

    @worker_count.times do |i|
      spawn(name: "worker-#{i}") do
        process_tasks
      end
    end
  end

  private def process_tasks
    @tasks.each do |task|
      begin
        result_value = process_task(task)
        @results.send(Result.new(
          task_id: task.id,
          success: true,
          value: result_value
        ))
      rescue ex
        @results.send(Result.new(
          task_id: task.id,
          success: false,
          error: ex.message
        ))
      end
    end
  end

  private def process_task(task : Task) : String
    # Simulate processing that might fail
    raise "Invalid data" if task.data.empty?
    sleep 0.1
    "Processed: #{task.data}"
  end

  def submit(task : Task)
    @tasks.send(task)
  end

  def get_result : Result
    @results.receive
  end

  def shutdown
    @tasks.close
  end
end
```

## Parallel Map and Reduce

Implement parallel processing of collections.

### Parallel Map

```crystal
def parallel_map(collection : Array(T), workers : Int32 = 4, &block : T -> R) : Array(R) forall T, R
  tasks = Channel(Tuple(Int32, T)).new
  results = Channel(Tuple(Int32, R)).new

  # Spawn workers
  workers.times do
    spawn do
      tasks.each do |index, item|
        result = yield item
        results.send({index, result})
      end
    end
  end

  # Send tasks
  spawn do
    collection.each_with_index do |item, index|
      tasks.send({index, item})
    end
    tasks.close
  end

  # Collect results in order
  result_map = {} of Int32 => R
  collection.size.times do
    index, result = results.receive
    result_map[index] = result
  end

  collection.indices.map { |i| result_map[i] }
end

# Usage
numbers = (1..100).to_a
squares = parallel_map(numbers, workers: 8) do |n|
  sleep 0.01  # Simulate work
  n * n
end

puts squares.first(10)
```

### Parallel Reduce with Pipeline

```crystal
def parallel_reduce(collection : Array(T), workers : Int32 = 4, initial : R, &block : R, T -> R) : R forall T, R
  chunk_size = (collection.size / workers.to_f).ceil.to_i
  chunks = collection.each_slice(chunk_size).to_a

  results = Channel(R).new

  chunks.each do |chunk|
    spawn do
      chunk_result = chunk.reduce(initial) { |acc, item| yield acc, item }
      results.send(chunk_result)
    end
  end

  # Reduce the partial results
  final_result = initial
  chunks.size.times do
    final_result = yield final_result, results.receive
  end

  final_result
end

# Usage - sum of squares
numbers = (1..1000).to_a
sum = parallel_reduce(numbers, initial: 0) do |acc, n|
  acc + n * n
end

puts "Sum of squares: #{sum}"
```

## Mutex: Protecting Shared State

When fibers need to share mutable state, use mutexes to prevent race conditions.

### Basic Mutex Usage

```crystal
require "mutex"

class Counter
  def initialize
    @count = 0
    @mutex = Mutex.new
  end

  def increment
    @mutex.synchronize do
      current = @count
      sleep 0.001  # Simulate some work
      @count = current + 1
    end
  end

  def value : Int32
    @mutex.synchronize { @count }
  end
end

counter = Counter.new

# Spawn 100 fibers that each increment 10 times
100.times do
  spawn do
    10.times { counter.increment }
  end
end

sleep 2
puts "Final count: #{counter.value}"  # Should be 1000
```

### Read-Write Lock Pattern

```crystal
require "mutex"

class CachedData
  def initialize
    @data = {} of String => String
    @mutex = Mutex.new
    @version = 0
  end

  def read(key : String) : String?
    @mutex.synchronize do
      @data[key]?
    end
  end

  def write(key : String, value : String)
    @mutex.synchronize do
      @data[key] = value
      @version += 1
    end
  end

  def batch_update(updates : Hash(String, String))
    @mutex.synchronize do
      updates.each do |key, value|
        @data[key] = value
      end
      @version += 1
    end
  end

  def snapshot : Hash(String, String)
    @mutex.synchronize do
      @data.dup
    end
  end
end
```

## Atomic Operations

For simple counters and flags, atomic operations are more efficient than mutexes.

### Atomic Counter

```crystal
require "atomic"

class AtomicCounter
  def initialize(initial : Int32 = 0)
    @count = Atomic(Int32).new(initial)
  end

  def increment : Int32
    @count.add(1)
  end

  def decrement : Int32
    @count.sub(1)
  end

  def value : Int32
    @count.get
  end

  def compare_and_set(expected : Int32, new_value : Int32) : Bool
    @count.compare_and_set(expected, new_value)
  end
end

counter = AtomicCounter.new

# Safe concurrent increments without mutex
1000.times do
  spawn { counter.increment }
end

sleep 1
puts "Count: #{counter.value}"
```

### Atomic Flag for Coordination

```crystal
require "atomic"

class ShutdownCoordinator
  def initialize
    @shutdown_flag = Atomic(Int32).new(0)
  end

  def shutdown!
    @shutdown_flag.set(1)
  end

  def shutdown? : Bool
    @shutdown_flag.get == 1
  end

  def run_until_shutdown(&block)
    until shutdown?
      yield
      sleep 0.1
    end
  end
end

coordinator = ShutdownCoordinator.new

# Worker that checks shutdown flag
spawn(name: "worker") do
  coordinator.run_until_shutdown do
    puts "Working..."
  end
  puts "Worker shutdown gracefully"
end

sleep 1
coordinator.shutdown!
sleep 0.5
```

## When to Use This Skill

Use the crystal-concurrency skill when you need to:

- Process multiple I/O operations concurrently (network requests, file operations)
- Implement real-time data processing pipelines
- Build worker pools for parallel task processing
- Handle multiple client connections simultaneously (web servers, chat systems)
- Perform background processing without blocking main execution
- Aggregate results from multiple concurrent operations
- Implement producer-consumer patterns
- Build rate limiters and backpressure mechanisms
- Process large datasets in parallel
- Coordinate multiple asynchronous operations
- Implement timeout and cancellation patterns
- Build concurrent caches with synchronized access
- Stream data processing with multiple stages
- Implement fan-out/fan-in patterns

## Best Practices

1. **Always Close Channels**: Close channels when done sending to signal completion to receivers
2. **Use Buffered Channels for Performance**: Buffer channels when producers/consumers run at different speeds
3. **Limit Fiber Count**: Don't spawn unlimited fibers; use worker pools for bounded concurrency
4. **Handle Channel Closure**: Always handle `Channel::ClosedError` or check `closed?` before operations
5. **Use Select for Timeouts**: Implement timeouts with `select` and `timeout()` to prevent infinite blocking
6. **Prefer Channels Over Shared State**: Use message passing (channels) instead of shared memory when possible
7. **Synchronize Shared State**: Always use `Mutex` or atomics when sharing mutable state between fibers
8. **Clean Up Resources**: Use `ensure` blocks to guarantee resource cleanup even on errors
9. **Name Your Fibers**: Give fibers descriptive names for easier debugging and profiling
10. **Avoid Blocking Operations in Fibers**: Use non-blocking I/O; blocking operations prevent other fibers from running
11. **Use Atomic Operations for Counters**: Atomics are more efficient than mutexes for simple counters and flags
12. **Implement Graceful Shutdown**: Design systems to shut down cleanly, draining channels and waiting for fibers
13. **Handle Fiber Panics**: Wrap fiber code in exception handlers to prevent silent failures
14. **Size Channel Buffers Appropriately**: Too small causes blocking; too large wastes memory
15. **Use Select Default for Polling**: Non-blocking checks with `select ... else` for polling patterns

## Common Pitfalls

1. **Forgetting to Close Channels**: Receivers will wait forever if channels aren't closed after sending completes
2. **Deadlocks from Unbuffered Channels**: Sending to unbuffered channel blocks until receiver is ready
3. **Race Conditions on Shared State**: Not using mutexes/atomics when multiple fibers access same data
4. **Channel Buffer Overflow**: Sending more items than buffer capacity without receivers causes blocking
5. **Not Handling Closed Channels**: Receiving from closed channel raises exception; always handle it
6. **Spawning Too Many Fibers**: Unlimited fiber spawning exhausts memory; use worker pools instead
7. **Blocking the Scheduler**: CPU-intensive work in fibers prevents other fibers from running
8. **Resource Leaks**: Not closing channels, files, or connections in all code paths including errors
9. **Order Assumptions**: Fibers execute in non-deterministic order; don't assume execution sequence
10. **Timeout Too Short**: Aggressive timeouts cause false failures; balance responsiveness with reliability
11. **Mutex Held Too Long**: Long critical sections reduce concurrency; minimize mutex hold time
12. **Send/Receive Mismatch**: Imbalanced producers/consumers leads to memory buildup or starvation
13. **Ignoring Fiber Exceptions**: Exceptions in fibers don't propagate to spawner; handle explicitly
14. **Nested Mutex Locks**: Can cause deadlocks; avoid acquiring multiple mutexes or use consistent order
15. **Not Using `synchronize`**: Forgetting to wrap mutex usage in `synchronize` block causes race conditions

## Resources

- [Crystal Concurrency Guide](https://crystal-lang.org/reference/guides/concurrency.html)
- [Crystal API - Fiber](https://crystal-lang.org/api/Fiber.html)
- [Crystal API - Channel](https://crystal-lang.org/api/Channel.html)
- [Crystal API - Mutex](https://crystal-lang.org/api/Mutex.html)
- [Crystal API - Atomic](https://crystal-lang.org/api/Atomic.html)
- [Crystal Book - Concurrency](https://crystal-lang.org/reference/guides/concurrency.html)
- [Effective Crystal - Concurrency Patterns](https://crystal-lang.org/reference/)
