---
name: python-async-patterns
description: Master Python asynchronous programming with asyncio, async/await,
  and concurrent.futures. Use for async code and concurrency patterns.
allowed-tools:
  - Bash
  - Read
---

# Python Async Patterns

Master asynchronous programming in Python using asyncio, async/await syntax,
and concurrent execution patterns for I/O-bound and CPU-bound tasks.

## Basic Async/Await

**Core async syntax:**

```python
import asyncio

# Define async function with async def
async def fetch_data(url: str) -> str:
    print(f"Fetching {url}...")
    await asyncio.sleep(1)  # Simulate I/O operation
    return f"Data from {url}"

# Call async function
async def main() -> None:
    result = await fetch_data("https://api.example.com")
    print(result)

# Run async function
asyncio.run(main())
```

**Multiple concurrent operations:**

```python
import asyncio

async def fetch_url(url: str) -> str:
    await asyncio.sleep(1)
    return f"Content from {url}"

async def main() -> None:
    # Run concurrently with gather
    results = await asyncio.gather(
        fetch_url("https://example.com/1"),
        fetch_url("https://example.com/2"),
        fetch_url("https://example.com/3")
    )
    for result in results:
        print(result)

asyncio.run(main())
```

## asyncio.create_task

**Creating and managing tasks:**

```python
import asyncio

async def process_item(item: str, delay: float) -> str:
    await asyncio.sleep(delay)
    return f"Processed {item}"

async def main() -> None:
    # Create tasks for concurrent execution
    task1 = asyncio.create_task(process_item("A", 2.0))
    task2 = asyncio.create_task(process_item("B", 1.0))
    task3 = asyncio.create_task(process_item("C", 1.5))

    # Do other work while tasks run
    print("Tasks started")

    # Wait for tasks to complete
    result1 = await task1
    result2 = await task2
    result3 = await task3

    print(result1, result2, result3)

asyncio.run(main())
```

**Task with name and context:**

```python
import asyncio

async def background_task(name: str) -> None:
    print(f"Task {name} starting")
    await asyncio.sleep(2)
    print(f"Task {name} completed")

async def main() -> None:
    # Create named task
    task = asyncio.create_task(
        background_task("worker"),
        name="background-worker"
    )

    # Check task status
    print(f"Task name: {task.get_name()}")
    print(f"Task done: {task.done()}")

    await task

asyncio.run(main())
```

## asyncio.gather vs asyncio.wait

**Using gather for results:**

```python
import asyncio

async def fetch(n: int) -> int:
    await asyncio.sleep(1)
    return n * 2

async def main() -> None:
    # gather returns results in order
    results = await asyncio.gather(
        fetch(1),
        fetch(2),
        fetch(3)
    )
    print(results)  # [2, 4, 6]

    # Return exceptions instead of raising
    results = await asyncio.gather(
        fetch(1),
        fetch(2),
        return_exceptions=True
    )

asyncio.run(main())
```

**Using wait for more control:**

```python
import asyncio

async def worker(n: int) -> int:
    await asyncio.sleep(n)
    return n

async def main() -> None:
    tasks = [
        asyncio.create_task(worker(1)),
        asyncio.create_task(worker(2)),
        asyncio.create_task(worker(3))
    ]

    # Wait for first task to complete
    done, pending = await asyncio.wait(
        tasks,
        return_when=asyncio.FIRST_COMPLETED
    )

    print(f"Done: {len(done)}, Pending: {len(pending)}")

    # Cancel pending tasks
    for task in pending:
        task.cancel()

    # Wait for all with timeout
    done, pending = await asyncio.wait(
        tasks,
        timeout=2.0
    )

asyncio.run(main())
```

## Async Context Managers

**Creating async context managers:**

```python
import asyncio
from typing import AsyncIterator

class AsyncResource:
    async def __aenter__(self) -> "AsyncResource":
        print("Acquiring resource")
        await asyncio.sleep(0.1)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        print("Releasing resource")
        await asyncio.sleep(0.1)

    async def query(self) -> str:
        return "data"

async def main() -> None:
    async with AsyncResource() as resource:
        result = await resource.query()
        print(result)

asyncio.run(main())
```

**Using asynccontextmanager decorator:**

```python
from contextlib import asynccontextmanager
import asyncio

@asynccontextmanager
async def get_connection(url: str) -> AsyncIterator[str]:
    # Setup
    print(f"Connecting to {url}")
    await asyncio.sleep(0.1)
    conn = f"connection-{url}"

    try:
        yield conn
    finally:
        # Teardown
        print(f"Closing connection to {url}")
        await asyncio.sleep(0.1)

async def main() -> None:
    async with get_connection("localhost") as conn:
        print(f"Using {conn}")

asyncio.run(main())
```

## Async Iterators

**Creating async iterators:**

```python
import asyncio
from typing import AsyncIterator

class AsyncRange:
    def __init__(self, count: int) -> None:
        self.count = count

    def __aiter__(self) -> AsyncIterator[int]:
        return self

    async def __anext__(self) -> int:
        if self.count <= 0:
            raise StopAsyncIteration
        await asyncio.sleep(0.1)
        self.count -= 1
        return self.count

async def main() -> None:
    async for i in AsyncRange(5):
        print(i)

asyncio.run(main())
```

**Async generator functions:**

```python
import asyncio
from typing import AsyncIterator

async def async_range(count: int) -> AsyncIterator[int]:
    for i in range(count):
        await asyncio.sleep(0.1)
        yield i

async def fetch_pages(urls: list[str]) -> AsyncIterator[str]:
    for url in urls:
        await asyncio.sleep(0.5)
        yield f"Page content from {url}"

async def main() -> None:
    async for num in async_range(5):
        print(num)

    urls = ["url1", "url2", "url3"]
    async for page in fetch_pages(urls):
        print(page)

asyncio.run(main())
```

## Async Queues

**Producer-consumer pattern with Queue:**

```python
import asyncio
from asyncio import Queue

async def producer(queue: Queue[int], n: int) -> None:
    for i in range(n):
        await asyncio.sleep(0.1)
        await queue.put(i)
        print(f"Produced {i}")
    await queue.put(None)  # Sentinel value

async def consumer(queue: Queue[int], name: str) -> None:
    while True:
        item = await queue.get()
        if item is None:
            queue.task_done()
            break
        await asyncio.sleep(0.2)
        print(f"Consumer {name} processed {item}")
        queue.task_done()

async def main() -> None:
    queue: Queue[int] = Queue(maxsize=5)

    # Start producer and consumers
    prod = asyncio.create_task(producer(queue, 10))
    cons1 = asyncio.create_task(consumer(queue, "A"))
    cons2 = asyncio.create_task(consumer(queue, "B"))

    await prod
    await queue.join()  # Wait for all tasks to be processed

    # Signal consumers to exit
    await queue.put(None)
    await queue.put(None)

    await cons1
    await cons2

asyncio.run(main())
```

## Semaphore and Lock

**Limiting concurrent operations:**

```python
import asyncio

async def fetch_with_limit(
    url: str,
    semaphore: asyncio.Semaphore
) -> str:
    async with semaphore:
        print(f"Fetching {url}")
        await asyncio.sleep(1)
        return f"Data from {url}"

async def main() -> None:
    # Limit to 3 concurrent operations
    semaphore = asyncio.Semaphore(3)

    urls = [f"https://example.com/{i}" for i in range(10)]

    tasks = [
        fetch_with_limit(url, semaphore)
        for url in urls
    ]

    results = await asyncio.gather(*tasks)
    print(f"Fetched {len(results)} URLs")

asyncio.run(main())
```

**Using Lock for mutual exclusion:**

```python
import asyncio

class Counter:
    def __init__(self) -> None:
        self.value = 0
        self.lock = asyncio.Lock()

    async def increment(self) -> None:
        async with self.lock:
            # Critical section
            current = self.value
            await asyncio.sleep(0.01)
            self.value = current + 1

async def main() -> None:
    counter = Counter()

    # Run increments concurrently
    await asyncio.gather(*[
        counter.increment()
        for _ in range(100)
    ])

    print(f"Final value: {counter.value}")  # Should be 100

asyncio.run(main())
```

## Timeouts and Cancellation

**Using timeout:**

```python
import asyncio

async def slow_operation() -> str:
    await asyncio.sleep(5)
    return "completed"

async def main() -> None:
    # Timeout after 2 seconds
    try:
        result = await asyncio.wait_for(
            slow_operation(),
            timeout=2.0
        )
        print(result)
    except asyncio.TimeoutError:
        print("Operation timed out")

asyncio.run(main())
```

**Handling cancellation:**

```python
import asyncio

async def cancellable_task() -> None:
    try:
        while True:
            print("Working...")
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        print("Task was cancelled")
        # Cleanup
        raise

async def main() -> None:
    task = asyncio.create_task(cancellable_task())

    await asyncio.sleep(3)
    task.cancel()

    try:
        await task
    except asyncio.CancelledError:
        print("Task cancellation confirmed")

asyncio.run(main())
```

## Event Loop Management

**Direct event loop control:**

```python
import asyncio

async def task1() -> None:
    print("Task 1")

async def task2() -> None:
    print("Task 2")

# Create new event loop
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)

try:
    # Schedule callbacks
    loop.call_soon(lambda: print("Callback"))

    # Schedule delayed callback
    loop.call_later(1.0, lambda: print("Delayed"))

    # Run coroutine
    loop.run_until_complete(task1())

    # Run multiple tasks
    loop.run_until_complete(
        asyncio.gather(task1(), task2())
    )
finally:
    loop.close()
```

## concurrent.futures

**ThreadPoolExecutor for I/O-bound tasks:**

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor
import time

def blocking_io_task(n: int) -> int:
    print(f"Task {n} starting")
    time.sleep(2)  # Blocking I/O
    return n * 2

async def main() -> None:
    loop = asyncio.get_event_loop()

    with ThreadPoolExecutor(max_workers=3) as executor:
        # Run blocking function in thread pool
        tasks = [
            loop.run_in_executor(executor, blocking_io_task, i)
            for i in range(5)
        ]

        results = await asyncio.gather(*tasks)
        print(results)

asyncio.run(main())
```

**ProcessPoolExecutor for CPU-bound tasks:**

```python
import asyncio
from concurrent.futures import ProcessPoolExecutor

def cpu_intensive_task(n: int) -> int:
    # CPU-intensive computation
    result = sum(i * i for i in range(n))
    return result

async def main() -> None:
    loop = asyncio.get_event_loop()

    with ProcessPoolExecutor(max_workers=4) as executor:
        # Run CPU-bound function in process pool
        tasks = [
            loop.run_in_executor(
                executor,
                cpu_intensive_task,
                10_000_000
            )
            for _ in range(4)
        ]

        results = await asyncio.gather(*tasks)
        print(f"Completed {len(results)} tasks")

asyncio.run(main())
```

## Async HTTP with aiohttp

**Making async HTTP requests:**

```python
import asyncio
import aiohttp

async def fetch_url(
    session: aiohttp.ClientSession,
    url: str
) -> str:
    async with session.get(url) as response:
        return await response.text()

async def main() -> None:
    async with aiohttp.ClientSession() as session:
        urls = [
            "https://example.com/1",
            "https://example.com/2",
            "https://example.com/3"
        ]

        tasks = [fetch_url(session, url) for url in urls]
        results = await asyncio.gather(*tasks)

        print(f"Fetched {len(results)} pages")

asyncio.run(main())
```

## Error Handling

**Handling exceptions in async code:**

```python
import asyncio

async def failing_task() -> None:
    await asyncio.sleep(1)
    raise ValueError("Task failed")

async def main() -> None:
    # Handle exception in single task
    try:
        await failing_task()
    except ValueError as e:
        print(f"Caught: {e}")

    # Handle exceptions with gather
    results = await asyncio.gather(
        failing_task(),
        failing_task(),
        return_exceptions=True
    )

    for result in results:
        if isinstance(result, Exception):
            print(f"Task failed: {result}")

asyncio.run(main())
```

## When to Use This Skill

Use python-async-patterns when you need to:

- Handle multiple I/O operations concurrently (API calls, database queries)
- Build async web servers or clients
- Process data streams asynchronously
- Implement producer-consumer patterns with async queues
- Run blocking I/O operations without blocking the event loop
- Create async context managers for resource management
- Implement async iterators for streaming data
- Control concurrency with semaphores and locks
- Handle timeouts and cancellation in async operations
- Mix CPU-bound and I/O-bound operations efficiently

## Best Practices

- Use asyncio.run() for the main entry point
- Create tasks with asyncio.create_task() for concurrent execution
- Use gather() when you need all results
- Use wait() when you need fine-grained control
- Always handle CancelledError in long-running tasks
- Use semaphores to limit concurrent operations
- Prefer async context managers for resource management
- Use asyncio.Queue for producer-consumer patterns
- Run blocking I/O in thread pool with run_in_executor()
- Run CPU-bound tasks in process pool
- Set appropriate timeouts for network operations
- Use structured concurrency patterns (nurseries)

## Common Pitfalls

- Forgetting to await coroutines (creates coroutine object, doesn't run)
- Blocking the event loop with CPU-intensive work
- Not handling task cancellation properly
- Using time.sleep() instead of asyncio.sleep()
- Creating too many concurrent tasks without limits
- Not closing resources properly in async context
- Mixing blocking and async code incorrectly
- Not handling exceptions in background tasks
- Forgetting to call task_done() with Queue
- Using global event loop instead of asyncio.run()

## Resources

- [asyncio Documentation](https://docs.python.org/3/library/asyncio.html)
- [aiohttp Documentation](https://docs.aiohttp.org/)
- [PEP 492 - Coroutines](https://peps.python.org/pep-0492/)
- [PEP 525 - Async Generators](https://peps.python.org/pep-0525/)
- [concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html)
