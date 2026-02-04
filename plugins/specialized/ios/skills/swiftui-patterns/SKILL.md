---
name: ios-swiftui-patterns
description: Use when building SwiftUI views, managing state with @State/@Binding/@ObservableObject, or implementing declarative UI patterns in iOS apps.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# iOS - SwiftUI Patterns

Modern declarative UI development for iOS, macOS, watchOS, and tvOS applications.

## Key Concepts

### State Management Hierarchy

SwiftUI provides a hierarchy of property wrappers for different state needs:

- **@State**: Local view state, owned by the view
- **@Binding**: Two-way connection to state owned elsewhere
- **@StateObject**: Creates and owns an ObservableObject
- **@ObservedObject**: References an ObservableObject owned elsewhere
- **@EnvironmentObject**: Dependency injection through the view hierarchy
- **@Environment**: Access to system-provided values

### Observable Pattern (iOS 17+)

```swift
@Observable
class UserModel {
    var name: String = ""
    var email: String = ""
    var isLoggedIn: Bool = false
}

struct ContentView: View {
    @State private var user = UserModel()

    var body: some View {
        UserProfileView(user: user)
    }
}
```

### Legacy ObservableObject Pattern

```swift
class UserViewModel: ObservableObject {
    @Published var name: String = ""
    @Published var isLoading: Bool = false

    func fetchUser() async {
        isLoading = true
        defer { isLoading = false }
        // fetch logic
    }
}

struct UserView: View {
    @StateObject private var viewModel = UserViewModel()

    var body: some View {
        // view implementation
    }
}
```

## Best Practices

### View Composition

Break complex views into smaller, focused components:

```swift
struct OrderSummaryView: View {
    let order: Order

    var body: some View {
        VStack(spacing: 16) {
            OrderHeaderView(order: order)
            OrderItemsListView(items: order.items)
            OrderTotalView(total: order.total)
        }
    }
}
```

### Prefer Value Types

Use structs for models when possible to leverage SwiftUI's efficient diffing:

```swift
struct Product: Identifiable, Equatable {
    let id: UUID
    var name: String
    var price: Decimal
    var quantity: Int
}
```

### Use ViewModifiers for Reusable Styling

```swift
struct CardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(radius: 4)
    }
}

extension View {
    func cardStyle() -> some View {
        modifier(CardModifier())
    }
}
```

### Task Lifecycle for Async Work

```swift
struct UserDetailView: View {
    let userId: String
    @State private var user: User?

    var body: some View {
        Group {
            if let user {
                UserContent(user: user)
            } else {
                ProgressView()
            }
        }
        .task {
            user = await fetchUser(id: userId)
        }
    }
}
```

## Common Patterns

### Navigation with NavigationStack (iOS 16+)

```swift
struct ContentView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            ProductListView()
                .navigationDestination(for: Product.self) { product in
                    ProductDetailView(product: product)
                }
                .navigationDestination(for: Category.self) { category in
                    CategoryView(category: category)
                }
        }
    }
}
```

### Sheet and Alert Presentation

```swift
struct ItemView: View {
    @State private var showingDetail = false
    @State private var showingDeleteAlert = false

    var body: some View {
        Button("View Details") {
            showingDetail = true
        }
        .sheet(isPresented: $showingDetail) {
            DetailSheet()
        }
        .alert("Delete Item?", isPresented: $showingDeleteAlert) {
            Button("Delete", role: .destructive) { deleteItem() }
            Button("Cancel", role: .cancel) { }
        }
    }
}
```

### List with SwiftData (iOS 17+)

```swift
@Model
class Task {
    var title: String
    var isCompleted: Bool
    var createdAt: Date

    init(title: String) {
        self.title = title
        self.isCompleted = false
        self.createdAt = Date()
    }
}

struct TaskListView: View {
    @Query(sort: \Task.createdAt, order: .reverse)
    private var tasks: [Task]
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        List(tasks) { task in
            TaskRowView(task: task)
        }
    }
}
```

## Anti-Patterns

### Avoid Large Monolithic Views

Bad:

```swift
struct BadView: View {
    var body: some View {
        VStack {
            // 200+ lines of nested views
        }
    }
}
```

Good: Extract into focused subviews.

### Don't Use @ObservedObject for Owned State

Bad:

```swift
struct BadView: View {
    @ObservedObject var viewModel = ViewModel() // Re-created on every view init!
}
```

Good:

```swift
struct GoodView: View {
    @StateObject private var viewModel = ViewModel()
}
```

### Avoid Side Effects in View Body

Bad:

```swift
var body: some View {
    let _ = print("View rendered") // Side effect!
    Text("Hello")
}
```

Good: Use `.task`, `.onAppear`, or `.onChange` for side effects.

### Don't Force Unwrap in Views

Bad:

```swift
Text(user!.name) // Crash risk
```

Good:

```swift
if let user {
    Text(user.name)
}
```

## Related Skills

- **ios-swift-concurrency**: Async/await patterns for data loading
- **ios-uikit-architecture**: When bridging UIKit and SwiftUI
