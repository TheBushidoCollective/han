---
name: csharp-async-patterns
description: Use when C# asynchronous programming with async/await, Task, ValueTask, ConfigureAwait, and async streams for responsive applications.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# C# Async Patterns

Asynchronous programming in C# enables writing responsive applications that
efficiently handle I/O-bound and CPU-bound operations without blocking
threads. The async/await pattern provides a straightforward way to write
asynchronous code that looks and behaves like synchronous code.

## Async/Await Basics

The `async` and `await` keywords transform synchronous-looking code into
state machines that handle asynchronous operations.

```csharp
using System;
using System.Net.Http;
using System.Threading.Tasks;

public class AsyncBasics
{
    // Basic async method
    public async Task<string> FetchDataAsync(string url)
    {
        using var client = new HttpClient();
        // await suspends execution until response received
        string content = await client.GetStringAsync(url);
        return content;
    }

    // Async method without return value
    public async Task ProcessDataAsync()
    {
        await Task.Delay(1000); // Simulate async work
        Console.WriteLine("Processing complete");
    }

    // Multiple awaits
    public async Task<int> CalculateSumAsync()
    {
        int value1 = await GetValueAsync(1);
        int value2 = await GetValueAsync(2);
        int value3 = await GetValueAsync(3);

        return value1 + value2 + value3;
    }

    private async Task<int> GetValueAsync(int id)
    {
        await Task.Delay(100);
        return id * 10;
    }

    // Async with exception handling
    public async Task<string> SafeFetchAsync(string url)
    {
        try
        {
            using var client = new HttpClient();
            return await client.GetStringAsync(url);
        }
        catch (HttpRequestException ex)
        {
            Console.WriteLine($"Request failed: {ex.Message}");
            return string.Empty;
        }
    }

    // Calling async methods
    public async Task DemoAsync()
    {
        // Await the result
        string data = await FetchDataAsync("https://api.example.com");

        // Fire and forget (not recommended)
        _ = ProcessDataAsync();

        // Wait for completion
        await ProcessDataAsync();
    }
}
```

## Task and Task\<T\>

`Task` represents an asynchronous operation and provides methods for
composition, continuation, and error handling.

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

public class TaskExamples
{
    // Creating tasks
    public void CreateTasks()
    {
        // Task.Run for CPU-bound work
        Task<int> task1 = Task.Run(() =>
        {
            Thread.Sleep(1000);
            return 42;
        });

        // Task.FromResult for already-known values
        Task<int> task2 = Task.FromResult(100);

        // Task.CompletedTask for void operations
        Task task3 = Task.CompletedTask;

        // TaskCompletionSource for manual control
        var tcs = new TaskCompletionSource<string>();
        Task<string> task4 = tcs.Task;
        tcs.SetResult("Done");
    }

    // Task composition
    public async Task<string> ComposeTasks()
    {
        // Sequential execution
        int result1 = await Task1Async();
        int result2 = await Task2Async(result1);

        // Parallel execution
        Task<int> t1 = Task1Async();
        Task<int> t2 = Task2Async(10);
        await Task.WhenAll(t1, t2);

        return $"Results: {t1.Result}, {t2.Result}";
    }

    // Task.WhenAll - wait for all tasks
    public async Task<int[]> WhenAllExample()
    {
        var tasks = new[]
        {
            Task.Run(() => ComputeValue(1)),
            Task.Run(() => ComputeValue(2)),
            Task.Run(() => ComputeValue(3))
        };

        int[] results = await Task.WhenAll(tasks);
        return results;
    }

    // Task.WhenAny - wait for first task
    public async Task<int> WhenAnyExample()
    {
        var task1 = DelayedValue(1000, 1);
        var task2 = DelayedValue(2000, 2);
        var task3 = DelayedValue(500, 3);

        Task<int> completed = await Task.WhenAny(task1, task2, task3);
        return await completed;
    }

    // Cancellation support
    public async Task<string> CancellableOperation(
        CancellationToken cancellationToken)
    {
        for (int i = 0; i < 10; i++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            await Task.Delay(100, cancellationToken);
            Console.WriteLine($"Step {i + 1}");
        }

        return "Completed";
    }

    // Helper methods
    private Task<int> Task1Async() => Task.FromResult(10);
    private Task<int> Task2Async(int value) =>
        Task.FromResult(value * 2);
    private int ComputeValue(int x) => x * x;
    private async Task<int> DelayedValue(int delay, int value)
    {
        await Task.Delay(delay);
        return value;
    }
}
```

## ValueTask and ValueTask\<T\>

`ValueTask` provides better performance for operations that often complete
synchronously, avoiding heap allocations.

```csharp
using System;
using System.Threading.Tasks;

public class ValueTaskExamples
{
    private readonly Dictionary<string, string> _cache =
        new Dictionary<string, string>();

    // ValueTask for cached operations
    public ValueTask<string> GetValueAsync(string key)
    {
        // Synchronous path - no allocation
        if (_cache.TryGetValue(key, out string? value))
        {
            return new ValueTask<string>(value);
        }

        // Asynchronous path
        return new ValueTask<string>(FetchFromDatabaseAsync(key));
    }

    private async Task<string> FetchFromDatabaseAsync(string key)
    {
        await Task.Delay(100); // Simulate database call
        string value = $"Value for {key}";
        _cache[key] = value;
        return value;
    }

    // Converting between Task and ValueTask
    public async ValueTask<int> ConversionExample()
    {
        // ValueTask from Task
        Task<int> task = GetTaskAsync();
        ValueTask<int> valueTask = new ValueTask<int>(task);

        return await valueTask;
    }

    private Task<int> GetTaskAsync() => Task.FromResult(42);

    // ValueTask best practices
    public async Task ValueTaskUsageAsync()
    {
        // Good: await immediately
        string value1 = await GetValueAsync("key1");

        // Bad: storing ValueTask
        // ValueTask<string> vt = GetValueAsync("key2");
        // await vt; // First await
        // await vt; // Second await - WRONG!

        // Good: convert to Task if needed multiple times
        Task<string> task = GetValueAsync("key2").AsTask();
        await task;
        await task; // OK with Task
    }

    // ConfigureAwait with ValueTask
    public async ValueTask ConfigureAwaitExample()
    {
        // Don't capture context (for library code)
        string value = await GetValueAsync("key")
            .ConfigureAwait(false);

        Console.WriteLine(value);
    }
}
```

## ConfigureAwait

`ConfigureAwait` controls whether to capture the synchronization context,
critical for library code and avoiding deadlocks.

```csharp
using System;
using System.Threading.Tasks;

public class ConfigureAwaitExamples
{
    // Library method - use ConfigureAwait(false)
    public async Task<string> LibraryMethodAsync()
    {
        // Don't capture synchronization context
        await Task.Delay(100).ConfigureAwait(false);

        // This continues on thread pool thread
        string result = await GetDataAsync()
            .ConfigureAwait(false);

        return result.ToUpper();
    }

    // UI method - use default (or ConfigureAwait(true))
    public async Task UpdateUIAsync()
    {
        string data = await LoadDataAsync();

        // This continues on UI thread
        // Can safely update UI controls
        Console.WriteLine($"Data: {data}");
    }

    // Avoiding deadlocks
    public class DeadlockExample
    {
        // This can deadlock in synchronous context
        public string BadSync()
        {
            // DON'T DO THIS
            return GetDataAsync().Result; // Deadlock!
        }

        // Fix with ConfigureAwait(false)
        public string GoodSync()
        {
            return GetDataAsync()
                .ConfigureAwait(false)
                .GetAwaiter()
                .GetResult();
        }

        // Better: make it async
        public async Task<string> BestAsync()
        {
            return await GetDataAsync();
        }
    }

    // Mixing contexts
    public async Task MixedContextAsync()
    {
        // Runs on captured context
        await Task.Delay(100);
        Console.WriteLine("On original context");

        // Runs on thread pool
        await Task.Delay(100).ConfigureAwait(false);
        Console.WriteLine("On thread pool");

        // Still on thread pool (ConfigureAwait effect persists)
        await Task.Delay(100);
        Console.WriteLine("Still on thread pool");
    }

    private async Task<string> GetDataAsync()
    {
        await Task.Delay(100);
        return "data";
    }

    private async Task<string> LoadDataAsync()
    {
        await Task.Delay(100);
        return "loaded data";
    }
}
```

## Async Streams (IAsyncEnumerable)

Async streams enable asynchronous iteration over sequences of data,
perfect for streaming APIs and large datasets.

```csharp
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Runtime.CompilerServices;
using System.Threading;
using System.Threading.Tasks;

public class AsyncStreamExamples
{
    // Basic async stream
    public async IAsyncEnumerable<int> GenerateNumbersAsync(
        int count)
    {
        for (int i = 0; i < count; i++)
        {
            await Task.Delay(100);
            yield return i;
        }
    }

    // Consuming async stream
    public async Task ConsumeStreamAsync()
    {
        await foreach (int number in GenerateNumbersAsync(10))
        {
            Console.WriteLine(number);
        }
    }

    // Async stream with cancellation
    public async IAsyncEnumerable<string> ReadLinesAsync(
        string filePath,
        [EnumeratorCancellation] CancellationToken cancellationToken =
            default)
    {
        using var reader = new System.IO.StreamReader(filePath);

        while (!reader.EndOfStream)
        {
            cancellationToken.ThrowIfCancellationRequested();

            string? line = await reader.ReadLineAsync();
            if (line != null)
            {
                yield return line;
            }
        }
    }

    // Filtering async stream
    public async IAsyncEnumerable<int> FilterEvenNumbersAsync(
        IAsyncEnumerable<int> source)
    {
        await foreach (int number in source)
        {
            if (number % 2 == 0)
            {
                yield return number;
            }
        }
    }

    // Transforming async stream
    public async IAsyncEnumerable<string> FormatNumbersAsync(
        IAsyncEnumerable<int> source)
    {
        await foreach (int number in source)
        {
            yield return $"Number: {number:D3}";
        }
    }

    // Async stream from API
    public async IAsyncEnumerable<string> FetchPagesAsync(
        string baseUrl,
        int totalPages)
    {
        using var client = new HttpClient();

        for (int page = 1; page <= totalPages; page++)
        {
            string url = $"{baseUrl}?page={page}";
            string content = await client.GetStringAsync(url);
            yield return content;
        }
    }

    // Composing async streams
    public async Task ComposeStreamsAsync()
    {
        var numbers = GenerateNumbersAsync(20);
        var evens = FilterEvenNumbersAsync(numbers);
        var formatted = FormatNumbersAsync(evens);

        await foreach (string value in formatted)
        {
            Console.WriteLine(value);
        }
    }
}
```

## Parallel Async Operations

Combining parallelism with async operations for maximum throughput.

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

public class ParallelAsyncExamples
{
    // Process items in parallel
    public async Task<List<string>> ProcessInParallelAsync(
        List<int> items)
    {
        var tasks = items.Select(async item =>
        {
            await Task.Delay(100);
            return $"Processed {item}";
        });

        string[] results = await Task.WhenAll(tasks);
        return results.ToList();
    }

    // Throttled parallel execution
    public async Task<List<string>> ThrottledParallelAsync(
        List<int> items,
        int maxConcurrency)
    {
        var semaphore = new SemaphoreSlim(maxConcurrency);
        var tasks = items.Select(async item =>
        {
            await semaphore.WaitAsync();
            try
            {
                await Task.Delay(100);
                return $"Processed {item}";
            }
            finally
            {
                semaphore.Release();
            }
        });

        string[] results = await Task.WhenAll(tasks);
        return results.ToList();
    }

    // Parallel.ForEachAsync (.NET 6+)
    public async Task ParallelForEachAsyncExample(List<int> items)
    {
        await Parallel.ForEachAsync(
            items,
            new ParallelOptions { MaxDegreeOfParallelism = 4 },
            async (item, cancellationToken) =>
            {
                await Task.Delay(100, cancellationToken);
                Console.WriteLine($"Processed {item}");
            });
    }

    // Batched processing
    public async Task<List<string>> BatchProcessAsync(
        List<int> items,
        int batchSize)
    {
        var results = new List<string>();

        for (int i = 0; i < items.Count; i += batchSize)
        {
            var batch = items.Skip(i).Take(batchSize);
            var batchResults = await ProcessInParallelAsync(
                batch.ToList());
            results.AddRange(batchResults);
        }

        return results;
    }
}
```

## Error Handling in Async Code

Proper error handling is crucial for robust asynchronous applications.

```csharp
using System;
using System.Threading.Tasks;

public class AsyncErrorHandling
{
    // Basic try-catch
    public async Task<string> BasicErrorHandlingAsync()
    {
        try
        {
            return await RiskyOperationAsync();
        }
        catch (InvalidOperationException ex)
        {
            Console.WriteLine($"Operation error: {ex.Message}");
            return "default";
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Unexpected error: {ex.Message}");
            throw;
        }
    }

    // AggregateException from WhenAll
    public async Task HandleMultipleErrorsAsync()
    {
        try
        {
            await Task.WhenAll(
                FailingTaskAsync("Task 1"),
                FailingTaskAsync("Task 2"),
                FailingTaskAsync("Task 3")
            );
        }
        catch (Exception ex)
        {
            // Only first exception caught
            Console.WriteLine($"First error: {ex.Message}");
        }
    }

    // Handling all exceptions
    public async Task HandleAllErrorsAsync()
    {
        var tasks = new[]
        {
            FailingTaskAsync("Task 1"),
            FailingTaskAsync("Task 2"),
            FailingTaskAsync("Task 3")
        };

        try
        {
            await Task.WhenAll(tasks);
        }
        catch
        {
            // Iterate through all tasks to see all exceptions
            foreach (var task in tasks)
            {
                if (task.IsFaulted && task.Exception != null)
                {
                    foreach (var ex in task.Exception.InnerExceptions)
                    {
                        Console.WriteLine($"Error: {ex.Message}");
                    }
                }
            }
        }
    }

    // finally blocks work as expected
    public async Task FinallyBlockAsync()
    {
        try
        {
            await RiskyOperationAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
        }
        finally
        {
            // Always executes
            Console.WriteLine("Cleanup code");
        }
    }

    private async Task<string> RiskyOperationAsync()
    {
        await Task.Delay(100);
        throw new InvalidOperationException("Something went wrong");
    }

    private async Task FailingTaskAsync(string name)
    {
        await Task.Delay(100);
        throw new InvalidOperationException($"{name} failed");
    }
}
```

## Best Practices

1. Use `async/await` all the way - avoid mixing async and sync code
2. Prefer `Task.Run` for CPU-bound work, native async APIs for I/O
3. Use `ValueTask<T>` for hot paths that often complete synchronously
4. Always use `ConfigureAwait(false)` in library code
5. Never use `.Result` or `.Wait()` on Tasks - causes deadlocks
6. Properly handle cancellation with `CancellationToken`
7. Use `Task.WhenAll` for parallel operations, not sequential awaits
8. Implement proper exception handling for async operations
9. Use async streams for sequences that are produced asynchronously
10. Avoid `async void` except for event handlers

## Common Pitfalls

1. Blocking on async code with `.Result` or `.Wait()` causing deadlocks
2. Not using `ConfigureAwait(false)` in library code capturing context
   unnecessarily
3. Using `async void` methods which can't be properly awaited or caught
4. Forgetting to await tasks, causing fire-and-forget behavior
5. Not handling exceptions in parallel tasks properly
6. Over-parallelizing with too many concurrent operations
7. Using `Task.Run` for already-async I/O operations (double wrapping)
8. Not passing `CancellationToken` through async call chains
9. Storing and awaiting `ValueTask` multiple times
10. Capturing large objects in async lambda closures causing memory issues

## When to Use Async Patterns

Use async patterns when you need:

- Responsive UI applications that don't freeze during I/O operations
- Web APIs and services handling many concurrent requests efficiently
- Database operations that shouldn't block threads
- File I/O operations for reading and writing large files
- Network operations including HTTP requests and socket communication
- Streaming large datasets without loading everything into memory
- CPU-bound work offloaded to thread pool with `Task.Run`
- Composable asynchronous operations with proper error handling
- Cancellable long-running operations
- Maximum scalability in server applications

## Resources

- [Async/Await Best Practices](https://docs.microsoft.com/en-us/archive/msdn-magazine/2013/march/async-await-best-practices-in-asynchronous-programming)
- [ValueTask Documentation](https://docs.microsoft.com/en-us/dotnet/api/system.threading.tasks.valuetask-1)
- [Asynchronous Programming Patterns](https://docs.microsoft.com/en-us/dotnet/standard/asynchronous-programming-patterns/)
- [Async Streams Tutorial](https://docs.microsoft.com/en-us/dotnet/csharp/tutorials/generate-consume-asynchronous-stream)
