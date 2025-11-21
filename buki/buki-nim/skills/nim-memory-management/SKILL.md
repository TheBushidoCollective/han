---
name: Nim Memory Management
description: Use when nim's memory management including garbage collection strategies, manual memory control, destructors, move semantics, ref/ptr types, memory safety, and optimization techniques for performance-critical systems programming.
allowed-tools: []
---

# Nim Memory Management

## Introduction

Nim provides flexible memory management combining automatic garbage collection
with manual control options. This hybrid approach enables safe high-level programming
while allowing low-level optimization for performance-critical code. Understanding
memory management is crucial for systems programming and embedded applications.

Nim supports multiple garbage collectors (GC), move semantics for efficiency,
destructors for resource cleanup, and manual memory management through pointers.
The compiler's static analysis prevents many memory errors at compile time,
while runtime checks catch others during development.

This skill covers garbage collection strategies, ref vs ptr types, move semantics,
destructors and hooks, manual memory management, memory safety patterns, and
optimization techniques for minimal allocations and predictable performance.

## Garbage Collection Strategies

Nim offers multiple GC implementations with different trade-offs for throughput,
latency, and memory usage.

```nim
# Default GC (--gc:refc)
# Reference counting with cycle detection
type Node = ref object
  value: int
  next: Node

var head = Node(value: 1)
head.next = Node(value: 2)
head.next.next = Node(value: 3)

# Arc GC (--gc:arc)
# Automatic reference counting without cycle detection
# Fastest but requires breaking cycles manually
{.experimental: "strictFuncs".}

proc processData() =
  var data = @[1, 2, 3, 4, 5]  # Heap allocated
  # Automatically freed when out of scope
  echo data

# ORC GC (--gc:orc)
# Arc with cycle collection
proc createCycle() =
  type
    Node = ref object
      next: Node

  var a = Node()
  var b = Node()
  a.next = b
  b.next = a  # Cycle collected by ORC

# Manual GC control
proc lowLatencyOperation() =
  GC_disable()  # Disable GC during critical section
  # Time-sensitive code here
  GC_enable()

# GC statistics
proc checkMemory() =
  echo "GC Memory: ", getOccupiedMem()
  echo "GC Total: ", getTotalMem()
  echo "GC Free: ", getFreeMem()

# Forcing collection
proc cleanupMemory() =
  GC_fullCollect()  # Force full collection

# GC hints
proc allocateLarge() =
  var data: ref array[1000000, int]
  new(data)
  GC_ref(data)  # Add external reference
  # Use data
  GC_unref(data)  # Remove reference

# Region-based allocation
proc useRegion() =
  var region: MemRegion
  region = newMemRegion()
  # Allocations in region
  freeMemRegion(region)

# Stack allocation for value types
proc stackAlloc() =
  var data: array[1000, int]  # Stack allocated
  # Automatically freed on scope exit

# Compile-time GC selection
when defined(gcArc):
  echo "Using Arc GC"
elif defined(gcOrc):
  echo "Using ORC GC"
else:
  echo "Using default GC"

# GC-safe operations
{.push gcsafe.}
proc threadSafeProc() =
  echo "No global GC state accessed"
{.pop.}
```

Choose GC strategy based on application needs: Arc for speed, ORC for safety,
refc for compatibility.

## Ref and Ptr Types

Ref types use garbage collection while ptr types require manual memory management.

```nim
# Ref types (GC-managed)
type
  Person = ref object
    name: string
    age: int

proc createPerson(): Person =
  Person(name: "Alice", age: 30)

var p = createPerson()
# Automatically freed by GC

# Ptr types (manual management)
type
  Buffer = ptr object
    data: array[1024, byte]
    size: int

proc createBuffer(): Buffer =
  cast[Buffer](alloc0(sizeof(Buffer)))

proc destroyBuffer(buf: Buffer) =
  dealloc(buf)

# Using ptr types
proc useBuffer() =
  var buf = createBuffer()
  # Use buffer
  destroyBuffer(buf)

# Ref vs ptr performance
proc refExample() =
  var items: seq[ref int]
  for i in 0..<1000:
    var x: ref int
    new(x)
    x[] = i
    items.add(x)

proc ptrExample() =
  var items: seq[ptr int]
  for i in 0..<1000:
    var x = cast[ptr int](alloc(sizeof(int)))
    x[] = i
    items.add(x)

  # Manual cleanup required
  for item in items:
    dealloc(item)

# Shared pointers
type SharedPtr[T] = ref object
  data: T
  refCount: int

proc newShared[T](value: T): SharedPtr[T] =
  SharedPtr[T](data: value, refCount: 1)

# Weak references
type
  WeakRef[T] = object
    target: ptr T

proc newWeakRef[T](target: ref T): WeakRef[T] =
  WeakRef[T](target: cast[ptr T](target))

# Pointer arithmetic
proc ptrArithmetic() =
  var arr = [1, 2, 3, 4, 5]
  var p = addr arr[0]
  p = cast[ptr int](cast[int](p) + sizeof(int))
  echo p[]  # 2

# Safe pointer usage
proc safePtrUsage() =
  var x = 42
  var p = addr x  # Stack address
  echo p[]  # Safe while x in scope
  # p becomes invalid after scope

# Pointer aliasing
proc aliasing() =
  var x = 10
  var p1 = addr x
  var p2 = addr x
  p1[] = 20
  echo p2[]  # 20
```

Use ref for automatic memory management, ptr for manual control and C interop.

## Move Semantics and Ownership

Move semantics transfer ownership without copying, improving performance for
large data structures.

```nim
# Move vs copy
proc moveExample() =
  var s1 = @[1, 2, 3, 4, 5]
  var s2 = s1  # Copy by default

  var s3 = @[10, 20, 30]
  var s4 = move(s3)  # Move ownership
  # s3 is now empty

# Sink parameters (consume ownership)
proc consume(s: sink seq[int]) =
  echo s.len
  # s automatically moved

proc producer(): seq[int] =
  result = @[1, 2, 3]
  # result moved to caller

# Lent parameters (borrow)
proc borrow(s: lent seq[int]) =
  echo s.len
  # s cannot be modified or moved

# Move in containers
proc containerMoves() =
  var items: seq[string]
  var s = "large string" & "x".repeat(1000)
  items.add(move(s))  # Moved, not copied

# Move assignment
proc moveAssignment() =
  var s1 = @[1, 2, 3]
  var s2: seq[int]
  s2 = move(s1)  # s1 becomes empty

# Destructive move
proc destructiveMove[T](src: var T): T =
  result = move(src)
  reset(src)

# Move optimization
proc optimizedMove() =
  var data = newSeq[int](1000000)
  # Fill data
  var result = move(data)  # O(1) instead of O(n)
  return result

# Move with destructors
type
  Resource = object
    handle: int

proc `=destroy`(r: var Resource) =
  if r.handle != 0:
    echo "Closing resource: ", r.handle
    r.handle = 0

proc `=copy`(dest: var Resource, src: Resource) =
  dest.handle = src.handle

proc `=sink`(dest: var Resource, src: Resource) =
  dest.handle = src.handle

# Using move semantics
proc useMove() =
  var r1 = Resource(handle: 42)
  var r2 = move(r1)  # Moved, r1.handle = 0
  # r2 destroyed on scope exit
```

Move semantics eliminate unnecessary copies for significant performance gains.

## Destructors and Hooks

Destructors provide deterministic cleanup while hooks customize copy and move
behavior.

```nim
# Basic destructor
type
  File = object
    path: string
    handle: int

proc `=destroy`(f: var File) =
  if f.handle != 0:
    echo "Closing file: ", f.path
    # Close file handle
    f.handle = 0

# Copy hook
proc `=copy`(dest: var File, src: File) =
  dest.path = src.path
  # Duplicate file handle
  dest.handle = src.handle

# Sink/Move hook
proc `=sink`(dest: var File, src: File) =
  if dest.handle != 0:
    echo "Cleaning up dest"
  dest.path = src.path
  dest.handle = src.handle

# RAII pattern
proc useFile() =
  var f = File(path: "data.txt", handle: 123)
  # Use file
  # Automatically closed on scope exit

# Scope guards
template defer(cleanup: untyped): untyped =
  try:
    body
  finally:
    cleanup

proc scopedResource() =
  var resource = acquireResource()
  defer:
    releaseResource(resource)
  # Use resource
  # Cleaned up even if exception

# Custom allocator with destructor
type
  Pool = object
    buffer: ptr UncheckedArray[byte]
    size: int
    used: int

proc `=destroy`(p: var Pool) =
  if p.buffer != nil:
    dealloc(p.buffer)
    p.buffer = nil

proc newPool(size: int): Pool =
  result.size = size
  result.buffer = cast[ptr UncheckedArray[byte]](alloc(size))
  result.used = 0

# Reference counting with destructor
type
  Counted = ref object
    value: int
    count: int

proc `=destroy`(c: var Counted) =
  dec c.count
  if c.count == 0:
    echo "Freeing counted resource"

# Explicit cleanup
proc cleanup[T](x: var T) =
  `=destroy`(x)
  reset(x)

# Preventing copies
type
  NoCopy = object
    data: int

proc `=copy`(dest: var NoCopy, src: NoCopy) {.error.}
# Attempting to copy causes compile error

# Move-only types
type
  UniquePtr[T] = object
    data: ptr T

proc `=copy`(dest: var UniquePtr, src: UniquePtr) {.error.}

proc `=sink`(dest: var UniquePtr, src: UniquePtr) =
  if dest.data != nil:
    dealloc(dest.data)
  dest.data = src.data
```

Destructors enable RAII patterns and deterministic resource cleanup.

## Manual Memory Management

Manual allocation and deallocation provide maximum control for performance-critical
code.

```nim
# Basic allocation
proc allocExample() =
  var p = cast[ptr int](alloc(sizeof(int)))
  p[] = 42
  echo p[]
  dealloc(p)

# Array allocation
proc allocArray() =
  var arr = cast[ptr UncheckedArray[int]](alloc(100 * sizeof(int)))
  arr[0] = 1
  arr[99] = 100
  dealloc(arr)

# Zeroed allocation
proc allocZero() =
  var p = cast[ptr int](alloc0(sizeof(int)))
  echo p[]  # 0
  dealloc(p)

# Reallocation
proc reallocExample() =
  var size = 10
  var p = cast[ptr UncheckedArray[int]](alloc(size * sizeof(int)))

  # Need more space
  size = 20
  p = cast[ptr UncheckedArray[int]](realloc(p, size * sizeof(int)))

  dealloc(p)

# Memory pool
type
  MemPool = object
    buffer: ptr UncheckedArray[byte]
    size: int
    offset: int

proc newPool(size: int): MemPool =
  result.size = size
  result.buffer = cast[ptr UncheckedArray[byte]](alloc(size))
  result.offset = 0

proc poolAlloc(pool: var MemPool, size: int): pointer =
  if pool.offset + size > pool.size:
    return nil
  result = addr pool.buffer[pool.offset]
  pool.offset += size

proc freePool(pool: var MemPool) =
  dealloc(pool.buffer)

# Arena allocator
type
  Arena = object
    blocks: seq[pointer]
    currentBlock: ptr UncheckedArray[byte]
    blockSize: int
    offset: int

proc newArena(blockSize: int): Arena =
  result.blockSize = blockSize
  result.currentBlock = cast[ptr UncheckedArray[byte]](alloc(blockSize))
  result.blocks.add(result.currentBlock)

proc arenaAlloc(arena: var Arena, size: int): pointer =
  if arena.offset + size > arena.blockSize:
    arena.currentBlock = cast[ptr UncheckedArray[byte]](alloc(arena.blockSize))
    arena.blocks.add(arena.currentBlock)
    arena.offset = 0

  result = addr arena.currentBlock[arena.offset]
  arena.offset += size

proc freeArena(arena: var Arena) =
  for blk in arena.blocks:
    dealloc(blk)

# Stack allocator
proc stackAllocator() =
  var stack: array[1024, byte]
  var offset = 0

  proc alloc(size: int): pointer =
    if offset + size > stack.len:
      return nil
    result = addr stack[offset]
    offset += size

  proc reset() =
    offset = 0

# Custom new/delete
proc newObject[T](): ptr T =
  result = cast[ptr T](alloc(sizeof(T)))

proc deleteObject[T](p: ptr T) =
  dealloc(p)
```

Manual management provides control but requires careful tracking to prevent leaks.

## Memory Safety Patterns

Nim provides compile-time and runtime checks to prevent memory errors.

```nim
# Bounds checking
proc boundsCheck() =
  var arr = @[1, 2, 3]
  # echo arr[10]  # Runtime error with -d:release

# Nil checking
proc nilCheck() =
  var p: ref int = nil
  if p != nil:
    echo p[]

# Safe array access
proc safeAccess() =
  var arr = @[1, 2, 3]
  if arr.len > 5:
    echo arr[5]

# Not nil annotation
type
  NonNil = not nil ref int

proc requireNonNil(p: NonNil) =
  echo p[]  # Guaranteed not nil

# Overflow checking
proc overflowCheck() {.push overflowChecks: on.} =
  var x: int8 = 127
  # x += 1  # Overflow caught
  {.pop.}

# Range types
type
  Percentage = range[0..100]

proc setPercentage(p: Percentage) =
  echo p

# Memory tagging
when defined(memTracker):
  proc allocTracked(size: int): pointer =
    result = alloc(size)
    # Track allocation

# Valgrind integration
when defined(valgrind):
  {.passC: "-g".}
  {.passL: "-g".}

# Address sanitizer
when defined(sanitize):
  {.passC: "-fsanitize=address".}
  {.passL: "-fsanitize=address".}

# Memory profiling
proc profile() =
  let start = getOccupiedMem()
  # Code to profile
  let end = getOccupiedMem()
  echo "Memory used: ", end - start

# Thread-local storage
var counter {.threadvar.}: int

proc incrementCounter() =
  inc counter
```

Safety checks prevent memory corruption during development and testing.

## Best Practices

1. **Use Arc/ORC GC** for new projects as they provide better performance and
   predictability

2. **Prefer ref types** over ptr for automatic memory management unless manual
   control needed

3. **Use move semantics** for large objects to avoid expensive copying

4. **Implement destructors** for types managing resources like files or sockets

5. **Avoid cycles with Arc** by using weak references or breaking cycles manually

6. **Profile memory usage** before optimizing to identify actual bottlenecks

7. **Use stack allocation** for fixed-size data when possible to avoid heap
   overhead

8. **Disable GC temporarily** for time-critical sections with known memory
   behavior

9. **Test with different GCs** to find best fit for application characteristics

10. **Enable checks in debug** builds but optimize for release with appropriate
    flags

## Common Pitfalls

1. **Creating reference cycles** with Arc causes memory leaks as no cycle
   detection

2. **Not deallocating ptr types** causes memory leaks requiring careful tracking

3. **Using ptr after free** causes undefined behavior and crashes

4. **Copying large objects** instead of moving wastes time and memory

5. **Holding GC references** in C code prevents collection causing leaks

6. **Not implementing all hooks** (destroy, copy, sink) leads to incorrect
   behavior

7. **Assuming GC runs immediately** causes memory spikes; force collection if
   needed

8. **Using global GC state** in threads breaks thread safety

9. **Mixing GC types** (ref and ptr) incorrectly causes crashes or leaks

10. **Not testing with different GCs** misses performance issues specific to GC
    choice

## When to Use This Skill

Apply Arc/ORC for new applications requiring low latency and predictable
performance.

Use manual management for embedded systems or real-time applications with strict
requirements.

Leverage move semantics when working with large data structures like sequences
or strings.

Implement destructors for any type managing external resources beyond memory.

Use custom allocators for allocation-heavy code requiring specific memory
patterns.

Profile and optimize memory usage in performance-critical applications.

## Resources

- [Nim Memory Management](<https://nim-lang.org/docs/mm.html>)
- [Destructors and Move Semantics](<https://nim-lang.org/docs/destructors.html>)
- [Nim GC Guide](<https://nim-lang.org/docs/gc.html>)
- [Arc/ORC Documentation](<https://nim-lang.org/blog/2020/10/15/introduction-to-arc-orc.html>)
- [Memory Profiling in Nim](<https://nim-lang.org/docs/memprof.html>)
