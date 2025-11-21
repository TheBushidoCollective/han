---
name: csharp-async-patterns
description: Use when C# async/await patterns including Task, ValueTask, async streams, and cancellation. Use when writing asynchronous C# code.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# C# Async Patterns

Master asynchronous programming in C# using async/await, Task, ValueTask, async
streams, and cancellation patterns. This skill covers modern asynchronous patterns
from C# 8-12 for building responsive, scalable applications.

## Async/Await Fundamentals

The async/await pattern provides a simple way to write asynchronous code that
looks and behaves like synchronous code.

### Basic Async Method

```csharp
public async Task<string> FetchDataAsync(string url)
{
    using var client = new HttpClient();
    string result = await client.GetStringAsync(url);
    return result;
}

// Calling the async method
public async Task ProcessAsync()
{
    string data = await FetchDataAsync("https://api.example.com/data");
    Console.WriteLine(data);
}
```

### Async Method Signature Rules

```csharp
// ✅ Correct - Returns Task
public async Task ProcessDataAsync()
{
    await Task.Delay(1000);
}

// ✅ Correct - Returns Task<T>
public async Task<int> CalculateAsync()
{
    await Task.Delay(1000);
    return 42;
}

// ⚠️ Only for event handlers - Returns void
public async void Button_Click(object sender, EventArgs e)
{
    await ProcessDataAsync();
}

// ❌ Wrong - Not async but returns Task
public Task WrongAsync()
{
    // Should be async or use Task.FromResult
    return Task.CompletedTask;
}
```

## Task and Task&lt;T&gt;

Task represents an asynchronous operation. Task&lt;T&gt; represents an operation
that returns a value.

### Creating Tasks

```csharp
// Task.Run for CPU-bound work
public async Task<int> CalculateSumAsync(int[] numbers)
{
    return await Task.Run(() => numbers.Sum());
}

// Task.FromResult for already-computed values
public Task<string> GetCachedValueAsync(string key)
{
    if (_cache.TryGetValue(key, out var value))
    {
        return Task.FromResult(value);
    }
    return FetchFromDatabaseAsync(key);
}

// Task.CompletedTask for void async methods
public Task ProcessIfNeededAsync(bool condition)
{
    if (!condition)
    {
        return Task.CompletedTask;
    }
    return DoActualWorkAsync();
}
```

### Task Composition

```csharp
public async Task<Result> ProcessOrderAsync(Order order)
{
    // Sequential execution
    await ValidateOrderAsync(order);
    await ChargePaymentAsync(order);
    await ShipOrderAsync(order);

    return new Result { Success = true };
}

public async Task<Result> ProcessOrderParallelAsync(Order order)
{
    // Parallel execution
    var validationTask = ValidateOrderAsync(order);
    var inventoryTask = CheckInventoryAsync(order);
    var pricingTask = CalculatePricingAsync(order);

    await Task.WhenAll(validationTask, inventoryTask, pricingTask);

    return new Result
    {
        IsValid = await validationTask,
        InStock = await inventoryTask,
        Price = await pricingTask
    };
}
```

## ValueTask and ValueTask&lt;T&gt;

ValueTask is a performance optimization for scenarios where the result is often
available synchronously.

### When to Use ValueTask

```csharp
public class CachedRepository
{
    private readonly Dictionary<int, User> _cache = new();
    private readonly IDatabase _database;

    // ✅ Good use of ValueTask - often returns synchronously
    // from cache
    public ValueTask<User> GetUserAsync(int id)
    {
        if (_cache.TryGetValue(id, out var user))
        {
            return ValueTask.FromResult(user);
        }

        return new ValueTask<User>(FetchUserFromDatabaseAsync(id));
    }

    private async Task<User> FetchUserFromDatabaseAsync(int id)
    {
        var user = await _database.QueryAsync<User>(id);
        _cache[id] = user;
        return user;
    }
}
```

### ValueTask Best Practices

```csharp
public class BufferedReader
{
    private readonly byte[] _buffer = new byte[4096];
    private int _position;
    private int _length;

    // ValueTask for hot path optimization
    public async ValueTask<byte> ReadByteAsync()
    {
        if (_position < _length)
        {
            // Synchronous path - no allocation
            return _buffer[_position++];
        }

        // Asynchronous path - read more data
        await FillBufferAsync();
        return _buffer[_position++];
    }

    private async Task FillBufferAsync()
    {
        _length = await _stream.ReadAsync(_buffer);
        _position = 0;
    }
}

// ⚠️ ValueTask rules
public async Task ConsumeValueTaskAsync()
{
    var reader = new BufferedReader();

    // ✅ Correct - await once
    byte b = await reader.ReadByteAsync();

    // ❌ Wrong - don't store ValueTask
    var task = reader.ReadByteAsync();
    await task; // Potential issues

    // ❌ Wrong - don't await multiple times
    var vt = reader.ReadByteAsync();
    await vt;
    await vt; // NEVER do this
}
```

## Async Void vs Async Task

Understanding when to use async void (rarely) versus async Task (almost always).

### The Async Void Problem

```csharp
// ❌ Bad - Cannot await, exceptions unhandled
public async void ProcessDataBadAsync()
{
    await Task.Delay(1000);
    throw new Exception("Unhandled!"); // Crashes app
}

// ✅ Good - Can await, exceptions handled
public async Task ProcessDataGoodAsync()
{
    await Task.Delay(1000);
    throw new Exception("Handled!"); // Can be caught
}

// Usage
public async Task CallerAsync()
{
    try
    {
        // Cannot await async void
        ProcessDataBadAsync(); // Fire and forget - DANGEROUS

        // Can await async Task
        await ProcessDataGoodAsync(); // Exception caught here
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Caught: {ex.Message}");
    }
}
```

### The Only Valid Use of Async Void

```csharp
// ✅ Event handlers - the ONLY valid use case
public partial class MainWindow : Window
{
    public async void SaveButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            await SaveDataAsync();
            MessageBox.Show("Saved successfully!");
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Error: {ex.Message}");
        }
    }

    private async Task SaveDataAsync()
    {
        await _repository.SaveAsync(_data);
    }
}
```

## ConfigureAwait(false)

Control synchronization context capture for performance in library code.

### Understanding ConfigureAwait

```csharp
// Library code - use ConfigureAwait(false)
public class DataService
{
    public async Task<Data> GetDataAsync(int id)
    {
        // ConfigureAwait(false) - don't capture context
        var json = await _httpClient.GetStringAsync($"/api/data/{id}")
            .ConfigureAwait(false);

        var data = await DeserializeAsync(json)
            .ConfigureAwait(false);

        return data;
    }
}

// UI code - DON'T use ConfigureAwait(false)
public class ViewModel
{
    public async Task LoadDataAsync()
    {
        var data = await _dataService.GetDataAsync(42);
        // Need UI context here
        this.DataProperty = data; // Update UI
    }
}
```

### ConfigureAwait Patterns

```csharp
public class AsyncLibrary
{
    // ✅ Library method with ConfigureAwait(false)
    public async Task<Result> ProcessAsync(string input)
    {
        var step1 = await Step1Async(input).ConfigureAwait(false);
        var step2 = await Step2Async(step1).ConfigureAwait(false);
        var step3 = await Step3Async(step2).ConfigureAwait(false);
        return step3;
    }

    // ✅ ASP.NET Core - ConfigureAwait(false) safe everywhere
    [HttpGet]
    public async Task<IActionResult> GetData(int id)
    {
        // ASP.NET Core has no synchronization context
        var data = await _repository.GetAsync(id).ConfigureAwait(false);
        return Ok(data);
    }
}
```

## CancellationToken Patterns

Proper cancellation support for long-running operations.

### Basic Cancellation

```csharp
public async Task<List<Result>> ProcessItemsAsync(
    IEnumerable<Item> items,
    CancellationToken cancellationToken = default)
{
    var results = new List<Result>();

    foreach (var item in items)
    {
        // Check for cancellation
        cancellationToken.ThrowIfCancellationRequested();

        var result = await ProcessItemAsync(item, cancellationToken);
        results.Add(result);
    }

    return results;
}

// Usage with timeout
public async Task<List<Result>> ProcessWithTimeoutAsync(IEnumerable<Item> items)
{
    using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));

    try
    {
        return await ProcessItemsAsync(items, cts.Token);
    }
    catch (OperationCanceledException)
    {
        Console.WriteLine("Operation timed out");
        throw;
    }
}
```

### Advanced Cancellation Patterns

```csharp
public class BackgroundProcessor
{
    private CancellationTokenSource? _cts;

    public async Task StartAsync()
    {
        _cts = new CancellationTokenSource();
        await ProcessLoopAsync(_cts.Token);
    }

    public void Stop()
    {
        _cts?.Cancel();
    }

    private async Task ProcessLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(cancellationToken);
                await Task.Delay(1000, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                // Expected when cancelled
                break;
            }
        }
    }

    // Linked cancellation tokens
    public async Task ProcessWithMultipleTokensAsync(
        CancellationToken userToken,
        CancellationToken systemToken)
    {
        using var linkedCts = CancellationTokenSource
            .CreateLinkedTokenSource(userToken, systemToken);

        await DoWorkAsync(linkedCts.Token);
    }
}
```

## Async Streams (IAsyncEnumerable)

Stream data asynchronously using IAsyncEnumerable&lt;T&gt; (C# 8+).

### Basic Async Streams

```csharp
public async IAsyncEnumerable<LogEntry> ReadLogsAsync(
    string filePath,
    [EnumeratorCancellation] CancellationToken cancellationToken = default)
{
    await using var stream = File.OpenRead(filePath);
    using var reader = new StreamReader(stream);

    string? line;
    while ((line = await reader.ReadLineAsync(cancellationToken)) != null)
    {
        if (TryParseLog(line, out var entry))
        {
            yield return entry;
        }
    }
}

// Consuming async streams
public async Task ProcessLogsAsync(string filePath)
{
    await foreach (var log in ReadLogsAsync(filePath))
    {
        Console.WriteLine($"{log.Timestamp}: {log.Message}");
    }
}
```

### Advanced Async Stream Patterns

```csharp
public class DataStreamProcessor
{
    // Async stream with filtering
    public async IAsyncEnumerable<Event> GetEventsAsync(
        DateTime startDate,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        int page = 0;

        while (true)
        {
            var events = await FetchPageAsync(page++, cancellationToken);

            if (events.Count == 0)
                yield break;

            foreach (var evt in events.Where(e => e.Date >= startDate))
            {
                yield return evt;
            }
        }
    }

    // LINQ-style operations on async streams
    public async IAsyncEnumerable<TResult> SelectAsync<TSource, TResult>(
        IAsyncEnumerable<TSource> source,
        Func<TSource, TResult> selector)
    {
        await foreach (var item in source)
        {
            yield return selector(item);
        }
    }

    // Buffering async streams
    public async IAsyncEnumerable<List<T>> BufferAsync<T>(
        IAsyncEnumerable<T> source,
        int bufferSize)
    {
        var buffer = new List<T>(bufferSize);

        await foreach (var item in source)
        {
            buffer.Add(item);

            if (buffer.Count >= bufferSize)
            {
                yield return buffer;
                buffer = new List<T>(bufferSize);
            }
        }

        if (buffer.Count > 0)
        {
            yield return buffer;
        }
    }
}
```

## Parallel Async Operations

Execute multiple async operations concurrently.

### Task.WhenAll and Task.WhenAny

```csharp
public async Task<Summary> GetDashboardDataAsync()
{
    // Start all operations concurrently
    var userTask = GetUserDataAsync();
    var ordersTask = GetOrdersAsync();
    var analyticsTask = GetAnalyticsAsync();

    // Wait for all to complete
    await Task.WhenAll(userTask, ordersTask, analyticsTask);

    return new Summary
    {
        User = await userTask,
        Orders = await ordersTask,
        Analytics = await analyticsTask
    };
}

// Handle partial failures
public async Task<Results> ProcessWithPartialFailuresAsync()
{
    var tasks = new[]
    {
        ProcessTask1Async(),
        ProcessTask2Async(),
        ProcessTask3Async()
    };

    await Task.WhenAll(tasks.Select(async t =>
    {
        try
        {
            await t;
        }
        catch (Exception ex)
        {
            // Log but don't throw
            Console.WriteLine($"Task failed: {ex.Message}");
        }
    }));

    // Collect successful results
    var results = tasks
        .Where(t => t.IsCompletedSuccessfully)
        .Select(t => t.Result)
        .ToList();

    return new Results { Successful = results };
}
```

### Task.WhenAny for Timeouts and Racing

```csharp
public async Task<T> WithTimeoutAsync<T>(Task<T> task, TimeSpan timeout)
{
    var delayTask = Task.Delay(timeout);
    var completedTask = await Task.WhenAny(task, delayTask);

    if (completedTask == delayTask)
    {
        throw new TimeoutException("Operation timed out");
    }

    return await task;
}

// Racing multiple sources
public async Task<Data> GetFastestDataAsync()
{
    var primaryTask = GetFromPrimaryAsync();
    var secondaryTask = GetFromSecondaryAsync();
    var cacheTask = GetFromCacheAsync();

    var completedTask = await Task.WhenAny(primaryTask, secondaryTask, cacheTask);
    return await completedTask;
}

// Throttled parallel processing
public async Task<List<Result>> ProcessWithThrottlingAsync(
    IEnumerable<Item> items,
    int maxConcurrency)
{
    var semaphore = new SemaphoreSlim(maxConcurrency);
    var tasks = items.Select(async item =>
    {
        await semaphore.WaitAsync();
        try
        {
            return await ProcessItemAsync(item);
        }
        finally
        {
            semaphore.Release();
        }
    });

    return (await Task.WhenAll(tasks)).ToList();
}
```

## Exception Handling in Async Code

Proper exception handling patterns for async methods.

### Basic Exception Handling

```csharp
public async Task<Result> ProcessWithErrorHandlingAsync()
{
    try
    {
        var data = await FetchDataAsync();
        return await ProcessDataAsync(data);
    }
    catch (HttpRequestException ex)
    {
        _logger.LogError(ex, "Network error occurred");
        throw;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Unexpected error occurred");
        return Result.Failed(ex.Message);
    }
}

// Exception handling with Task.WhenAll
public async Task ProcessMultipleAsync()
{
    var tasks = new[] { Task1Async(), Task2Async(), Task3Async() };

    try
    {
        await Task.WhenAll(tasks);
    }
    catch (Exception ex)
    {
        // Only first exception is thrown
        _logger.LogError(ex, "At least one task failed");

        // To get all exceptions:
        var exceptions = tasks
            .Where(t => t.IsFaulted)
            .Select(t => t.Exception)
            .ToList();

        foreach (var exception in exceptions)
        {
            _logger.LogError(exception, "Task failed");
        }
    }
}
```

### AggregateException Handling

```csharp
public async Task HandleAllExceptionsAsync()
{
    var tasks = Enumerable.Range(1, 10)
        .Select(i => ProcessItemAsync(i))
        .ToArray();

    try
    {
        await Task.WhenAll(tasks);
    }
    catch
    {
        // Examine all exceptions
        var aggregateException = new AggregateException(
            tasks.Where(t => t.IsFaulted)
                .SelectMany(t => t.Exception?.InnerExceptions ?? Array.Empty<Exception>())
        );

        aggregateException.Handle(ex =>
        {
            if (ex is HttpRequestException)
            {
                _logger.LogWarning(ex, "Network error - retrying");
                return true; // Handled
            }
            return false; // Rethrow
        });
    }
}
```

## Deadlock Prevention

Avoid common deadlock scenarios in async code.

### Common Deadlock Patterns

```csharp
// ❌ DEADLOCK - blocking on async code
public void DeadlockExample()
{
    // This will deadlock in UI or ASP.NET contexts
    var result = GetDataAsync().Result;

    // This will also deadlock
    GetDataAsync().Wait();
}

// ✅ CORRECT - async all the way
public async Task CorrectExample()
{
    var result = await GetDataAsync();
}

// ✅ CORRECT - use ConfigureAwait(false) in library code
public async Task<Data> LibraryMethodAsync()
{
    var data = await FetchAsync().ConfigureAwait(false);
    return ProcessData(data);
}
```

### Avoiding Deadlocks

```csharp
public class DeadlockFreeService
{
    // ✅ Async all the way
    public async Task<Result> ProcessAsync()
    {
        var data = await GetDataAsync();
        var processed = await ProcessDataAsync(data);
        return processed;
    }

    // ✅ If you must block, use Task.Run
    public Result ProcessSync()
    {
        return Task.Run(async () => await ProcessAsync()).GetAwaiter().GetResult();
    }

    // ✅ Use async disposal
    public async Task UseResourceAsync()
    {
        await using var resource = new AsyncDisposableResource();
        await resource.ProcessAsync();
    }
}
```

## Async in ASP.NET Core

Best practices for async code in ASP.NET Core applications.

### Controller Async Patterns

```csharp
[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IProductRepository _repository;

    // ✅ Async action methods
    [HttpGet("{id}")]
    public async Task<ActionResult<Product>> GetProduct(
        int id,
        CancellationToken cancellationToken)
    {
        var product = await _repository.GetByIdAsync(id, cancellationToken);

        if (product == null)
            return NotFound();

        return Ok(product);
    }

    [HttpPost]
    public async Task<ActionResult<Product>> CreateProduct(
        [FromBody] CreateProductRequest request,
        CancellationToken cancellationToken)
    {
        var product = await _repository.CreateAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, product);
    }

    // ✅ Streaming responses with IAsyncEnumerable
    [HttpGet("stream")]
    public async IAsyncEnumerable<Product> StreamProducts(
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        await foreach (var product in _repository.GetAllStreamAsync(cancellationToken))
        {
            yield return product;
        }
    }
}
```

### Background Services

```csharp
public class DataProcessorService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DataProcessorService> _logger;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Data processor service starting");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessDataBatchAsync(stoppingToken);
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Expected when stopping
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing data batch");
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }

        _logger.LogInformation("Data processor service stopped");
    }

    private async Task ProcessDataBatchAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IDataRepository>();

        await repository.ProcessBatchAsync(cancellationToken);
    }
}
```

## Best Practices

1. **Async All the Way**: Never block on async code with .Result or .Wait()
2. **Use CancellationToken**: Always accept CancellationToken for long-running operations
3. **ConfigureAwait in Libraries**: Use ConfigureAwait(false) in library code
4. **Avoid Async Void**: Only use async void for event handlers
5. **Return Task Directly**: When possible, return the Task directly without await
6. **Use ValueTask for Hot Paths**: Consider ValueTask for frequently-called,
   often-synchronous methods
7. **Handle All Exceptions**: Always handle exceptions in async methods
8. **Don't Mix Blocking and Async**: Choose one paradigm per call chain
9. **Dispose Async Resources**: Use await using for IAsyncDisposable
10. **Test with Cancellation**: Test that cancellation works correctly

## Common Pitfalls

1. **Blocking on Async Code**: Using .Result or .Wait() causes deadlocks
2. **Forgetting ConfigureAwait**: Can cause performance issues in libraries
3. **Async Void Methods**: Cannot be awaited and swallow exceptions
4. **Not Handling Cancellation**: Ignoring CancellationToken parameter
5. **Over-using Task.Run**: Don't wrap already-async code in Task.Run
6. **Capturing Context Unnecessarily**: Wastes resources when context not needed
7. **Fire and Forget**: Starting async operations without awaiting
8. **Mixing Sync and Async**: Creates confusion and potential deadlocks
9. **Not Using ValueTask Correctly**: Awaiting ValueTask multiple times
10. **Ignoring Exceptions in Task.WhenAll**: Only catching first exception

## When to Use

Use this skill when:

- Writing asynchronous code in C#
- Implementing I/O-bound operations (database, network, file system)
- Building responsive UI applications
- Creating scalable web services
- Working with streams of data
- Implementing cancellation support
- Optimizing async performance with ValueTask
- Handling parallel async operations
- Preventing deadlocks in async code
- Working with ASP.NET Core async patterns

## Resources

- [Async/Await Best Practices](https://learn.microsoft.com/en-us/archive/msdn-magazine/2013/march/async-await-best-practices-in-asynchronous-programming) <!-- markdownlint-disable-line MD013 -->
- [ConfigureAwait FAQ](https://devblogs.microsoft.com/dotnet/configureawait-faq/)
- [Async Streams Tutorial](https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/async-streams)
- [ValueTask Overview](https://devblogs.microsoft.com/dotnet/understanding-the-whys-whats-and-whens-of-valuetask/)
- [Task-based Asynchronous Pattern](https://learn.microsoft.com/en-us/dotnet/standard/asynchronous-programming-patterns/task-based-asynchronous-pattern-tap)
