---
name: ios-swift-concurrency
description: Use when implementing async/await, Task management, actors, or Combine reactive patterns in iOS applications.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# iOS - Swift Concurrency

Modern concurrency patterns using async/await, actors, and structured concurrency in Swift.

## Key Concepts

### Async/Await Fundamentals

```swift
// Async function declaration
func fetchUser(id: String) async throws -> User {
    let url = URL(string: "https://api.example.com/users/\(id)")!
    let (data, response) = try await URLSession.shared.data(from: url)

    guard let httpResponse = response as? HTTPURLResponse,
          httpResponse.statusCode == 200 else {
        throw APIError.invalidResponse
    }

    return try JSONDecoder().decode(User.self, from: data)
}

// Calling async functions
func loadUserProfile() async {
    do {
        let user = try await fetchUser(id: "123")
        await MainActor.run {
            updateUI(with: user)
        }
    } catch {
        await MainActor.run {
            showError(error)
        }
    }
}
```

### Task Management

```swift
class UserViewController: UIViewController {
    private var loadTask: Task<Void, Never>?

    override func viewDidLoad() {
        super.viewDidLoad()

        // Create a task for async work
        loadTask = Task {
            await loadUserData()
        }
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        // Cancel when view disappears
        loadTask?.cancel()
    }

    private func loadUserData() async {
        // Check for cancellation
        guard !Task.isCancelled else { return }

        do {
            let user = try await fetchUser()

            // Check again before UI update
            guard !Task.isCancelled else { return }

            await MainActor.run {
                displayUser(user)
            }
        } catch {
            // Handle error
        }
    }
}
```

### Actors for Thread Safety

```swift
actor UserCache {
    private var cache: [String: User] = [:]

    func user(for id: String) -> User? {
        cache[id]
    }

    func setUser(_ user: User, for id: String) {
        cache[id] = user
    }

    func clear() {
        cache.removeAll()
    }
}

// Usage
let cache = UserCache()

Task {
    await cache.setUser(user, for: user.id)
    let cached = await cache.user(for: "123")
}
```

### MainActor for UI Updates

```swift
@MainActor
class UserViewModel: ObservableObject {
    @Published var user: User?
    @Published var isLoading = false
    @Published var error: Error?

    func loadUser(id: String) async {
        isLoading = true
        defer { isLoading = false }

        do {
            user = try await userService.fetchUser(id: id)
        } catch {
            self.error = error
        }
    }
}

// Or use MainActor.run for specific operations
func fetchAndDisplay() async {
    let data = await fetchData()

    await MainActor.run {
        self.displayData(data)
    }
}
```

## Best Practices

### Structured Concurrency with TaskGroup

```swift
func fetchAllUserData(userId: String) async throws -> UserProfile {
    async let user = fetchUser(id: userId)
    async let posts = fetchPosts(userId: userId)
    async let followers = fetchFollowers(userId: userId)

    // All three requests run concurrently
    return try await UserProfile(
        user: user,
        posts: posts,
        followers: followers
    )
}

// For dynamic number of tasks
func fetchMultipleUsers(ids: [String]) async throws -> [User] {
    try await withThrowingTaskGroup(of: User.self) { group in
        for id in ids {
            group.addTask {
                try await fetchUser(id: id)
            }
        }

        var users: [User] = []
        for try await user in group {
            users.append(user)
        }
        return users
    }
}
```

### AsyncSequence for Streams

```swift
// Custom async sequence
struct NotificationStream: AsyncSequence {
    typealias Element = Notification

    let name: Notification.Name

    struct AsyncIterator: AsyncIteratorProtocol {
        let name: Notification.Name
        var iterator: AsyncStream<Notification>.Iterator

        mutating func next() async -> Notification? {
            await iterator.next()
        }
    }

    func makeAsyncIterator() -> AsyncIterator {
        let stream = AsyncStream<Notification> { continuation in
            let observer = NotificationCenter.default.addObserver(
                forName: name,
                object: nil,
                queue: nil
            ) { notification in
                continuation.yield(notification)
            }

            continuation.onTermination = { _ in
                NotificationCenter.default.removeObserver(observer)
            }
        }

        return AsyncIterator(name: name, iterator: stream.makeAsyncIterator())
    }
}

// Usage
for await notification in NotificationStream(name: .userDidLogin) {
    handleLogin(notification)
}
```

### Continuations for Callback-Based APIs

```swift
func fetchLegacyData() async throws -> Data {
    try await withCheckedThrowingContinuation { continuation in
        legacyAPI.fetch { result in
            switch result {
            case .success(let data):
                continuation.resume(returning: data)
            case .failure(let error):
                continuation.resume(throwing: error)
            }
        }
    }
}

// For delegate-based APIs
class LocationManager: NSObject, CLLocationManagerDelegate {
    private var locationContinuation: CheckedContinuation<CLLocation, Error>?

    func getCurrentLocation() async throws -> CLLocation {
        try await withCheckedThrowingContinuation { continuation in
            self.locationContinuation = continuation
            locationManager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        locationContinuation?.resume(returning: locations[0])
        locationContinuation = nil
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        locationContinuation?.resume(throwing: error)
        locationContinuation = nil
    }
}
```

## Common Patterns

### Cancellation Handling

```swift
func downloadFile(url: URL) async throws -> Data {
    var data = Data()

    let (bytes, _) = try await URLSession.shared.bytes(from: url)

    for try await byte in bytes {
        // Cooperative cancellation check
        try Task.checkCancellation()
        data.append(byte)
    }

    return data
}
```

### Debouncing with Task

```swift
class SearchViewModel: ObservableObject {
    @Published var searchText = ""
    @Published var results: [SearchResult] = []

    private var searchTask: Task<Void, Never>?

    func search(_ query: String) {
        searchTask?.cancel()

        searchTask = Task {
            // Debounce delay
            try? await Task.sleep(for: .milliseconds(300))

            guard !Task.isCancelled else { return }

            do {
                let results = try await searchService.search(query: query)
                guard !Task.isCancelled else { return }

                await MainActor.run {
                    self.results = results
                }
            } catch {
                // Handle error
            }
        }
    }
}
```

### Combine Integration

```swift
import Combine

extension Publisher {
    func asyncMap<T>(_ transform: @escaping (Output) async -> T) -> AnyPublisher<T, Failure> {
        flatMap { value in
            Future { promise in
                Task {
                    let result = await transform(value)
                    promise(.success(result))
                }
            }
        }
        .eraseToAnyPublisher()
    }
}

// Convert async function to publisher
func userPublisher(id: String) -> AnyPublisher<User, Error> {
    Future { promise in
        Task {
            do {
                let user = try await fetchUser(id: id)
                promise(.success(user))
            } catch {
                promise(.failure(error))
            }
        }
    }
    .eraseToAnyPublisher()
}
```

## Anti-Patterns

### Blocking the Main Thread

Bad:

```swift
// DON'T do this
func loadData() {
    let semaphore = DispatchSemaphore(value: 0)
    Task {
        data = await fetchData()
        semaphore.signal()
    }
    semaphore.wait() // Blocks main thread!
}
```

Good:

```swift
func loadData() async {
    data = await fetchData()
}
```

### Ignoring Cancellation

Bad:

```swift
func processItems(_ items: [Item]) async {
    for item in items {
        await process(item) // Never checks cancellation
    }
}
```

Good:

```swift
func processItems(_ items: [Item]) async throws {
    for item in items {
        try Task.checkCancellation()
        await process(item)
    }
}
```

### Data Races with Shared Mutable State

Bad:

```swift
class Counter {
    var count = 0 // Not thread-safe!

    func increment() {
        count += 1
    }
}
```

Good:

```swift
actor Counter {
    var count = 0

    func increment() {
        count += 1
    }
}
```

## Related Skills

- **ios-swiftui-patterns**: Using concurrency with SwiftUI
- **ios-uikit-architecture**: Async patterns in UIKit
