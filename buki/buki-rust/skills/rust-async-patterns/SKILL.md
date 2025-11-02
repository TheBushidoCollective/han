---
name: rust-async-patterns
description: Master Rust async programming with tokio, async/await, and futures.
  Use when writing asynchronous Rust code.
allowed-tools:
  - Bash
  - Read
---

# Rust Async Patterns

Master asynchronous programming in Rust using async/await syntax, tokio
runtime, and the futures ecosystem for concurrent I/O operations.

## Async/Await Basics

**Basic async function:**

```rust
async fn fetch_data() -> String {
    String::from("data")
}

#[tokio::main]
async fn main() {
    let data = fetch_data().await;
    println!("{}", data);
}
```

**Cargo.toml setup:**

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
```

## Tokio Runtime

**Different runtime configurations:**

```rust
// Multi-threaded runtime (default)
#[tokio::main]
async fn main() {
    // Code here
}

// Single-threaded runtime
#[tokio::main(flavor = "current_thread")]
async fn main() {
    // Code here
}

// Manual runtime creation
use tokio::runtime::Runtime;

fn main() {
    let rt = Runtime::new().unwrap();
    rt.block_on(async {
        println!("Running async code");
    });
}
```

## Spawning Tasks

**Creating concurrent tasks:**

```rust
use tokio::task;

#[tokio::main]
async fn main() {
    let task1 = task::spawn(async {
        println!("Task 1");
        42
    });

    let task2 = task::spawn(async {
        println!("Task 2");
        100
    });

    let result1 = task1.await.unwrap();
    let result2 = task2.await.unwrap();

    println!("Results: {}, {}", result1, result2);
}
```

**Spawning with move:**

```rust
#[tokio::main]
async fn main() {
    let data = String::from("hello");

    let handle = task::spawn(async move {
        println!("{}", data);
    });

    handle.await.unwrap();
}
```

## Async HTTP with reqwest

**Install reqwest:**

```toml
[dependencies]
reqwest = { version = "0.11", features = ["json"] }
serde = { version = "1.0", features = ["derive"] }
```

**Making HTTP requests:**

```rust
use reqwest;

#[tokio::main]
async fn main() -> Result<(), reqwest::Error> {
    let response = reqwest::get("https://api.github.com/users/rust-lang")
        .await?
        .text()
        .await?;

    println!("{}", response);
    Ok(())
}
```

**Concurrent requests:**

```rust
use reqwest;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let urls = vec![
        "https://api.github.com/users/rust-lang",
        "https://api.github.com/users/tokio-rs",
    ];

    let mut handles = vec![];

    for url in urls {
        let handle = tokio::spawn(async move {
            reqwest::get(url).await?.text().await
        });
        handles.push(handle);
    }

    for handle in handles {
        let response = handle.await??;
        println!("{}", response);
    }

    Ok(())
}
```

## Select and Join

**tokio::select! for racing futures:**

```rust
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    tokio::select! {
        _ = sleep(Duration::from_secs(1)) => {
            println!("Timer finished first");
        }
        _ = async_operation() => {
            println!("Operation finished first");
        }
    }
}

async fn async_operation() {
    sleep(Duration::from_secs(2)).await;
}
```

**tokio::join! for concurrent execution:**

```rust
use tokio::time::{sleep, Duration};

#[tokio::main]
async fn main() {
    let (r1, r2, r3) = tokio::join!(
        async { sleep(Duration::from_secs(1)).await; 1 },
        async { sleep(Duration::from_secs(1)).await; 2 },
        async { sleep(Duration::from_secs(1)).await; 3 },
    );

    println!("Results: {}, {}, {}", r1, r2, r3);
}
```

## Channels

**mpsc channel for message passing:**

```rust
use tokio::sync::mpsc;

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel(32);

    tokio::spawn(async move {
        for i in 0..10 {
            tx.send(i).await.unwrap();
        }
    });

    while let Some(value) = rx.recv().await {
        println!("Received: {}", value);
    }
}
```

**Multiple producers:**

```rust
use tokio::sync::mpsc;

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel(32);

    for i in 0..3 {
        let tx = tx.clone();
        tokio::spawn(async move {
            tx.send(format!("Message from {}", i)).await.unwrap();
        });
    }

    drop(tx); // Close channel when all senders dropped

    while let Some(msg) = rx.recv().await {
        println!("{}", msg);
    }
}
```

**oneshot channel:**

```rust
use tokio::sync::oneshot;

#[tokio::main]
async fn main() {
    let (tx, rx) = oneshot::channel();

    tokio::spawn(async move {
        tx.send("result").unwrap();
    });

    let result = rx.await.unwrap();
    println!("{}", result);
}
```

## Synchronization Primitives

**Mutex for shared state:**

```rust
use tokio::sync::Mutex;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        let handle = tokio::spawn(async move {
            let mut num = counter.lock().await;
            *num += 1;
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.await.unwrap();
    }

    println!("Result: {}", *counter.lock().await);
}
```

**RwLock for read-write access:**

```rust
use tokio::sync::RwLock;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    let data = Arc::new(RwLock::new(vec![1, 2, 3]));

    // Multiple readers
    let data1 = Arc::clone(&data);
    let data2 = Arc::clone(&data);

    let reader1 = tokio::spawn(async move {
        let d = data1.read().await;
        println!("Reader 1: {:?}", *d);
    });

    let reader2 = tokio::spawn(async move {
        let d = data2.read().await;
        println!("Reader 2: {:?}", *d);
    });

    // One writer
    let data3 = Arc::clone(&data);
    let writer = tokio::spawn(async move {
        let mut d = data3.write().await;
        d.push(4);
    });

    reader1.await.unwrap();
    reader2.await.unwrap();
    writer.await.unwrap();
}
```

**Semaphore for limiting concurrency:**

```rust
use tokio::sync::Semaphore;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    let semaphore = Arc::new(Semaphore::new(3));
    let mut handles = vec![];

    for i in 0..10 {
        let permit = semaphore.clone();
        let handle = tokio::spawn(async move {
            let _permit = permit.acquire().await.unwrap();
            println!("Task {} acquired permit", i);
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            println!("Task {} releasing permit", i);
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.await.unwrap();
    }
}
```

## Streams

**Using async streams:**

```rust
use tokio_stream::{self as stream, StreamExt};

#[tokio::main]
async fn main() {
    let mut stream = stream::iter(vec![1, 2, 3, 4, 5]);

    while let Some(value) = stream.next().await {
        println!("{}", value);
    }
}
```

**Creating custom streams:**

```rust
use tokio_stream::{Stream, StreamExt};
use std::pin::Pin;
use std::task::{Context, Poll};

struct Counter {
    count: usize,
    max: usize,
}

impl Stream for Counter {
    type Item = usize;

    fn poll_next(
        mut self: Pin<&mut Self>,
        _cx: &mut Context<'_>
    ) -> Poll<Option<Self::Item>> {
        if self.count < self.max {
            let current = self.count;
            self.count += 1;
            Poll::Ready(Some(current))
        } else {
            Poll::Ready(None)
        }
    }
}

#[tokio::main]
async fn main() {
    let mut counter = Counter { count: 0, max: 5 };

    while let Some(value) = counter.next().await {
        println!("{}", value);
    }
}
```

## Timeouts and Intervals

**Using timeout:**

```rust
use tokio::time::{timeout, Duration};

async fn slow_operation() -> String {
    tokio::time::sleep(Duration::from_secs(5)).await;
    String::from("done")
}

#[tokio::main]
async fn main() {
    match timeout(Duration::from_secs(2), slow_operation()).await {
        Ok(result) => println!("Success: {}", result),
        Err(_) => println!("Operation timed out"),
    }
}
```

**Using intervals:**

```rust
use tokio::time::{interval, Duration};

#[tokio::main]
async fn main() {
    let mut interval = interval(Duration::from_secs(1));

    for _ in 0..5 {
        interval.tick().await;
        println!("Tick");
    }
}
```

## Error Handling

**Propagating errors with ?:**

```rust
use reqwest;

async fn fetch_url(url: &str) -> Result<String, reqwest::Error> {
    let response = reqwest::get(url).await?;
    let body = response.text().await?;
    Ok(body)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let content = fetch_url("https://example.com").await?;
    println!("{}", content);
    Ok(())
}
```

## Blocking Operations

**Running CPU-intensive tasks:**

```rust
use tokio::task;

fn blocking_operation() -> u64 {
    // CPU-intensive work
    (0..1_000_000).sum()
}

#[tokio::main]
async fn main() {
    let result = task::spawn_blocking(|| {
        blocking_operation()
    }).await.unwrap();

    println!("Result: {}", result);
}
```

## Async Traits

**Using async-trait crate:**

```toml
[dependencies]
async-trait = "0.1"
```

```rust
use async_trait::async_trait;

#[async_trait]
trait Repository {
    async fn find(&self, id: u64) -> Option<String>;
    async fn save(&self, data: String) -> Result<(), String>;
}

struct UserRepository;

#[async_trait]
impl Repository for UserRepository {
    async fn find(&self, id: u64) -> Option<String> {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        Some(format!("User {}", id))
    }

    async fn save(&self, data: String) -> Result<(), String> {
        println!("Saving: {}", data);
        Ok(())
    }
}
```

## When to Use This Skill

Use rust-async-patterns when you need to:

- Build async web servers or clients
- Handle concurrent I/O operations efficiently
- Make multiple HTTP requests concurrently
- Implement producer-consumer patterns
- Work with async streams of data
- Manage shared state across async tasks
- Control concurrency limits
- Handle timeouts and cancellation
- Build event-driven systems
- Process data asynchronously

## Best Practices

- Use tokio::spawn for CPU-independent tasks
- Use spawn_blocking for CPU-intensive work
- Prefer channels over shared state with locks
- Use select! for racing futures
- Use join! for concurrent independent operations
- Set appropriate timeouts for network operations
- Use Semaphore to limit concurrent operations
- Avoid holding locks across await points
- Use Arc for shared ownership in async context
- Handle errors properly with Result

## Common Pitfalls

- Holding std::sync::Mutex across await (use tokio::sync::Mutex)
- Not using move with closures in spawn
- Forgetting to await futures
- Blocking the runtime with CPU-intensive work
- Creating too many tasks without limits
- Not handling cancellation properly
- Using the wrong channel type
- Deadlocks with improper lock ordering
- Not configuring runtime appropriately
- Ignoring errors in spawned tasks

## Resources

- [Tokio Tutorial](https://tokio.rs/tokio/tutorial)
- [Async Book](https://rust-lang.github.io/async-book/)
- [tokio Documentation](https://docs.rs/tokio/)
- [reqwest Documentation](https://docs.rs/reqwest/)
- [async-trait Documentation](https://docs.rs/async-trait/)
