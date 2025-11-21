---
name: cpp-smart-pointers
description: Use when C++ smart pointers including unique_ptr, shared_ptr, and weak_ptr for automatic memory management following RAII principles.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# C++ Smart Pointers

Smart pointers provide automatic memory management through RAII (Resource
Acquisition Is Initialization), eliminating manual `new` and `delete` calls.
They prevent memory leaks, dangling pointers, and double-free errors while
expressing ownership semantics clearly.

## RAII Principles

RAII ties resource lifetime to object lifetime, ensuring automatic cleanup
when objects go out of scope.

```cpp
#include <memory>
#include <iostream>
#include <fstream>

// RAII wrapper for file handle
class FileHandle {
    std::unique_ptr<std::FILE, decltype(&std::fclose)> file_;

public:
    FileHandle(const char* filename, const char* mode)
        : file_(std::fopen(filename, mode), &std::fclose) {
        if (!file_) {
            throw std::runtime_error("Failed to open file");
        }
    }

    std::FILE* get() { return file_.get(); }

    // No need for explicit destructor - RAII handles cleanup
};

// Traditional approach (error-prone)
void manual_memory() {
    int* ptr = new int(42);
    // If exception thrown here, memory leaks!
    delete ptr;
}

// RAII approach (safe)
void raii_memory() {
    auto ptr = std::make_unique<int>(42);
    // Automatic cleanup even if exception thrown
}

// RAII for multiple resources
void multiple_resources() {
    auto file1 = std::make_unique<FileHandle>("data.txt", "r");
    auto file2 = std::make_unique<FileHandle>("output.txt", "w");
    // Both files automatically closed in reverse order
}
```

## unique_ptr - Exclusive Ownership

`unique_ptr` represents exclusive ownership with zero runtime overhead and
move-only semantics.

```cpp
#include <memory>
#include <vector>
#include <iostream>

class Widget {
    int id_;
public:
    Widget(int id) : id_(id) {
        std::cout << "Widget " << id_ << " created\n";
    }
    ~Widget() {
        std::cout << "Widget " << id_ << " destroyed\n";
    }
    int id() const { return id_; }
};

void unique_ptr_basics() {
    // Create unique_ptr
    std::unique_ptr<Widget> w1(new Widget(1));
    auto w2 = std::make_unique<Widget>(2);  // Preferred

    // Access members
    std::cout << "Widget ID: " << w2->id() << "\n";

    // Release ownership
    Widget* raw = w2.release();
    delete raw;  // Now we're responsible

    // Reset to new object
    w1.reset(new Widget(3));  // Old widget destroyed

    // Get raw pointer (ownership retained)
    Widget* ptr = w1.get();

    // Move ownership (unique_ptr is move-only)
    std::unique_ptr<Widget> w3 = std::move(w1);
    // w1 is now nullptr

    // Cannot copy
    // std::unique_ptr<Widget> w4 = w3;  // Compiler error
}

// Factory function returning unique_ptr
std::unique_ptr<Widget> create_widget(int id) {
    return std::make_unique<Widget>(id);
}

// Container of unique_ptr
void container_example() {
    std::vector<std::unique_ptr<Widget>> widgets;
    widgets.push_back(std::make_unique<Widget>(1));
    widgets.push_back(std::make_unique<Widget>(2));

    // Move from container
    auto w = std::move(widgets[0]);
    // widgets[0] is now nullptr
}

// Custom deleter
struct FileCloser {
    void operator()(std::FILE* fp) const {
        if (fp) {
            std::cout << "Closing file\n";
            std::fclose(fp);
        }
    }
};

void custom_deleter_example() {
    std::unique_ptr<std::FILE, FileCloser> file(
        std::fopen("data.txt", "r")
    );

    // Lambda deleter
    auto deleter = [](int* p) {
        std::cout << "Deleting: " << *p << "\n";
        delete p;
    };

    std::unique_ptr<int, decltype(deleter)> ptr(new int(42), deleter);
}
```

## shared_ptr - Shared Ownership

`shared_ptr` enables shared ownership with reference counting, allowing
multiple pointers to the same object.

```cpp
#include <memory>
#include <vector>
#include <iostream>

class Resource {
    int id_;
public:
    Resource(int id) : id_(id) {
        std::cout << "Resource " << id_ << " created\n";
    }
    ~Resource() {
        std::cout << "Resource " << id_ << " destroyed\n";
    }
    int id() const { return id_; }
};

void shared_ptr_basics() {
    // Create shared_ptr
    std::shared_ptr<Resource> r1(new Resource(1));
    auto r2 = std::make_shared<Resource>(2);  // Preferred - one allocation

    // Share ownership
    std::shared_ptr<Resource> r3 = r2;
    std::cout << "Use count: " << r2.use_count() << "\n";  // 2

    // Multiple owners
    {
        std::shared_ptr<Resource> r4 = r2;
        std::cout << "Use count: " << r2.use_count() << "\n";  // 3
    }  // r4 destroyed
    std::cout << "Use count: " << r2.use_count() << "\n";  // 2

    // Check if valid
    if (r2) {
        std::cout << "r2 is valid\n";
    }

    // Reset
    r2.reset();  // Decrements reference count
    std::cout << "Use count: " << r3.use_count() << "\n";  // 1
}

// Shared ownership in data structures
class Node {
public:
    int value;
    std::shared_ptr<Node> next;

    Node(int v) : value(v), next(nullptr) {
        std::cout << "Node " << value << " created\n";
    }
    ~Node() {
        std::cout << "Node " << value << " destroyed\n";
    }
};

void linked_list_example() {
    auto head = std::make_shared<Node>(1);
    head->next = std::make_shared<Node>(2);
    head->next->next = std::make_shared<Node>(3);
    // All nodes automatically destroyed when head goes out of scope
}

// Converting between shared_ptr and unique_ptr
void pointer_conversion() {
    // unique_ptr to shared_ptr
    auto u = std::make_unique<Resource>(1);
    std::shared_ptr<Resource> s = std::move(u);
    // u is now nullptr

    // Cannot convert shared_ptr to unique_ptr (shared ownership)
}

// Aliasing constructor
struct Data {
    int x, y;
};

void aliasing_example() {
    auto data = std::make_shared<Data>();
    data->x = 10;
    data->y = 20;

    // Create shared_ptr to member, but keeps entire object alive
    std::shared_ptr<int> px(data, &data->x);
    std::cout << "Use count: " << data.use_count() << "\n";  // 2
}
```

## weak_ptr - Breaking Cycles

`weak_ptr` provides non-owning references to `shared_ptr` objects, preventing
circular reference memory leaks.

```cpp
#include <memory>
#include <iostream>

// Without weak_ptr: circular reference leak
class BadParent;

class BadChild {
public:
    std::shared_ptr<BadParent> parent;
    ~BadChild() { std::cout << "Child destroyed\n"; }
};

class BadParent {
public:
    std::shared_ptr<BadChild> child;
    ~BadParent() { std::cout << "Parent destroyed\n"; }
};

void circular_reference_leak() {
    auto parent = std::make_shared<BadParent>();
    auto child = std::make_shared<BadChild>();

    parent->child = child;
    child->parent = parent;  // Circular reference - memory leak!
}  // Neither object destroyed!

// With weak_ptr: breaks the cycle
class Parent;

class Child {
public:
    std::weak_ptr<Parent> parent;  // weak_ptr breaks cycle
    ~Child() { std::cout << "Child destroyed\n"; }
};

class Parent {
public:
    std::shared_ptr<Child> child;
    ~Parent() { std::cout << "Parent destroyed\n"; }
};

void weak_ptr_example() {
    auto parent = std::make_shared<Parent>();
    auto child = std::make_shared<Child>();

    parent->child = child;
    child->parent = parent;  // No circular reference
}  // Both objects destroyed properly

// Using weak_ptr
void weak_ptr_usage() {
    std::weak_ptr<Resource> weak;

    {
        auto shared = std::make_shared<Resource>(1);
        weak = shared;

        std::cout << "Use count: " << shared.use_count() << "\n";  // 1
        std::cout << "Weak count: " << weak.use_count() << "\n";   // 1

        // Lock to access object
        if (auto locked = weak.lock()) {
            std::cout << "Resource still alive: " << locked->id()
                      << "\n";
            std::cout << "Use count: " << locked.use_count() << "\n";  // 2
        }
    }  // shared destroyed

    // Object is gone
    if (auto locked = weak.lock()) {
        std::cout << "Resource still alive\n";
    } else {
        std::cout << "Resource destroyed\n";
    }

    std::cout << "Expired: " << weak.expired() << "\n";  // true
}

// Observer pattern with weak_ptr
class Observable {
    std::vector<std::weak_ptr<class Observer>> observers_;

public:
    void attach(std::shared_ptr<Observer> observer) {
        observers_.push_back(observer);
    }

    void notify() {
        // Clean up expired observers
        observers_.erase(
            std::remove_if(observers_.begin(), observers_.end(),
                [](const auto& weak) { return weak.expired(); }),
            observers_.end()
        );

        // Notify active observers
        for (auto& weak : observers_) {
            if (auto observer = weak.lock()) {
                // Notify observer
            }
        }
    }
};
```

## enable_shared_from_this

`enable_shared_from_this` allows objects to create `shared_ptr` instances
pointing to themselves safely.

```cpp
#include <memory>
#include <iostream>
#include <vector>

class Task : public std::enable_shared_from_this<Task> {
    int id_;
    std::vector<std::shared_ptr<Task>> dependencies_;

public:
    Task(int id) : id_(id) {}

    void add_dependency(std::shared_ptr<Task> dep) {
        dependencies_.push_back(dep);
    }

    // Register this task as dependency of another
    void register_with(std::shared_ptr<Task> other) {
        // Get shared_ptr to this
        other->add_dependency(shared_from_this());
    }

    int id() const { return id_; }
};

void shared_from_this_example() {
    auto task1 = std::make_shared<Task>(1);
    auto task2 = std::make_shared<Task>(2);

    task1->register_with(task2);
    // task2 now has a shared_ptr to task1
}

// Callback registration
class Button : public std::enable_shared_from_this<Button> {
    using Callback = std::function<void(std::shared_ptr<Button>)>;
    Callback on_click_;

public:
    void set_on_click(Callback callback) {
        on_click_ = callback;
    }

    void click() {
        if (on_click_) {
            on_click_(shared_from_this());
        }
    }
};

void callback_example() {
    auto button = std::make_shared<Button>();

    button->set_on_click([](std::shared_ptr<Button> btn) {
        std::cout << "Button clicked!\n";
    });

    button->click();
}
```

## Custom Deleters

Custom deleters enable smart pointers to manage non-memory resources like
file handles, sockets, and database connections.

```cpp
#include <memory>
#include <iostream>
#include <cstdio>

// Function deleter
void close_file(std::FILE* fp) {
    if (fp) {
        std::cout << "Closing file\n";
        std::fclose(fp);
    }
}

// Lambda deleter for shared_ptr
void shared_ptr_deleter() {
    std::shared_ptr<std::FILE> file(
        std::fopen("data.txt", "r"),
        [](std::FILE* fp) {
            if (fp) {
                std::cout << "Lambda closing file\n";
                std::fclose(fp);
            }
        }
    );
}

// Array deleter for unique_ptr
void array_deleter() {
    // Built-in array support
    std::unique_ptr<int[]> arr(new int[10]);
    arr[0] = 42;  // Automatic array delete[]

    // Custom array deleter
    std::unique_ptr<int[], void(*)(int*)> custom_arr(
        new int[10],
        [](int* p) {
            std::cout << "Custom array delete\n";
            delete[] p;
        }
    );
}

// Resource wrapper with custom deleter
template<typename T>
class ResourcePool {
    std::vector<std::unique_ptr<T>> pool_;

public:
    std::shared_ptr<T> acquire() {
        if (pool_.empty()) {
            return std::shared_ptr<T>(
                new T(),
                [this](T* ptr) { this->release(ptr); }
            );
        }

        auto ptr = pool_.back().release();
        pool_.pop_back();

        return std::shared_ptr<T>(
            ptr,
            [this](T* p) { this->release(p); }
        );
    }

private:
    void release(T* ptr) {
        pool_.push_back(std::unique_ptr<T>(ptr));
    }
};
```

## Performance Considerations

Smart pointers have different performance characteristics that influence
design decisions.

```cpp
#include <memory>
#include <chrono>
#include <iostream>

struct Data {
    int values[100];
};

void performance_comparison() {
    using namespace std::chrono;

    // unique_ptr: zero overhead
    {
        auto start = high_resolution_clock::now();
        for (int i = 0; i < 1000000; ++i) {
            auto ptr = std::make_unique<Data>();
        }
        auto end = high_resolution_clock::now();
        std::cout << "unique_ptr: "
                  << duration_cast<milliseconds>(end - start).count()
                  << "ms\n";
    }

    // shared_ptr: reference counting overhead
    {
        auto start = high_resolution_clock::now();
        for (int i = 0; i < 1000000; ++i) {
            auto ptr = std::make_shared<Data>();
        }
        auto end = high_resolution_clock::now();
        std::cout << "shared_ptr: "
                  << duration_cast<milliseconds>(end - start).count()
                  << "ms\n";
    }

    // shared_ptr copying: atomic operations
    {
        auto ptr = std::make_shared<Data>();
        auto start = high_resolution_clock::now();
        for (int i = 0; i < 1000000; ++i) {
            auto copy = ptr;  // Atomic increment/decrement
        }
        auto end = high_resolution_clock::now();
        std::cout << "shared_ptr copy: "
                  << duration_cast<milliseconds>(end - start).count()
                  << "ms\n";
    }
}

// make_shared vs constructor
void allocation_efficiency() {
    // One allocation (object + control block)
    auto s1 = std::make_shared<Data>();

    // Two allocations (object, then control block)
    std::shared_ptr<Data> s2(new Data());

    // Prefer make_shared for efficiency and exception safety
}
```

## Thread Safety

Smart pointers provide specific thread-safety guarantees that must be
understood for concurrent programming.

```cpp
#include <memory>
#include <thread>
#include <vector>
#include <iostream>

void thread_safety() {
    auto shared = std::make_shared<int>(42);

    // Reference counting is thread-safe
    std::vector<std::thread> threads;
    for (int i = 0; i < 10; ++i) {
        threads.emplace_back([shared]() {
            auto copy = shared;  // Safe: atomic increment
            std::cout << *copy << "\n";
        });
    }

    for (auto& t : threads) {
        t.join();
    }

    // Modifying pointed-to object is NOT thread-safe
    auto data = std::make_shared<int>(0);
    std::vector<std::thread> unsafe_threads;

    for (int i = 0; i < 10; ++i) {
        unsafe_threads.emplace_back([data]() {
            ++(*data);  // Race condition!
        });
    }

    for (auto& t : unsafe_threads) {
        t.join();
    }
}

// Atomic shared_ptr operations (C++20)
void atomic_shared_ptr() {
    std::shared_ptr<int> shared = std::make_shared<int>(42);

    // Thread 1
    std::thread t1([&shared]() {
        auto local = std::atomic_load(&shared);
    });

    // Thread 2
    std::thread t2([&shared]() {
        auto new_value = std::make_shared<int>(100);
        std::atomic_store(&shared, new_value);
    });

    t1.join();
    t2.join();
}
```

## Best Practices

1. Prefer `make_unique` and `make_shared` over explicit `new` for exception
   safety and efficiency
2. Use `unique_ptr` by default; only use `shared_ptr` when shared ownership is
   truly needed
3. Use `weak_ptr` to break circular references in parent-child relationships
4. Never call `delete` on raw pointers obtained from `get()`
5. Pass `unique_ptr` by value to transfer ownership, by reference to use
   without transferring
6. Pass `shared_ptr` by const reference to observe, by value to share
   ownership
7. Use custom deleters for managing non-memory resources
8. Avoid creating `shared_ptr` from raw pointers multiple times (creates
   multiple control blocks)
9. Mark move operations as `noexcept` when implementing custom smart
   pointer-like types
10. Use `enable_shared_from_this` when objects need to create `shared_ptr` to
    themselves

## Common Pitfalls

1. Creating multiple `shared_ptr` instances from same raw pointer, causing
   double-free
2. Storing `shared_ptr` in containers when `unique_ptr` would suffice, wasting
   memory
3. Forgetting to break circular references with `weak_ptr`, causing memory
   leaks
4. Calling `shared_from_this()` before object is managed by `shared_ptr`
5. Passing smart pointers by value unnecessarily, copying reference count
6. Using `reset()` instead of assignment, potentially destroying objects
   prematurely
7. Assuming thread-safety of pointed-to object (only control block is
   thread-safe)
8. Not checking if `weak_ptr::lock()` succeeds before using returned
   `shared_ptr`
9. Using `unique_ptr<T>` for arrays without `unique_ptr<T[]>` syntax
10. Mixing manual memory management with smart pointers in same codebase

## When to Use Smart Pointers

Use smart pointers when you need:

- Automatic memory management without garbage collection
- Clear expression of ownership semantics in your API
- Exception-safe resource management following RAII
- Prevention of memory leaks in complex control flow
- Shared ownership of objects across multiple components
- Breaking circular references with weak pointers
- Management of non-memory resources with custom deleters
- Modern C++ code that avoids manual `new` and `delete`
- Thread-safe reference counting for concurrent access
- Interoperability with standard library containers and algorithms

## Resources

- [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines#S-resource)
- [Effective Modern C++](https://www.oreilly.com/library/view/effective-modern-c/9781491908419/)
- [Smart Pointers cppreference](https://en.cppreference.com/w/cpp/memory)
- [Herb Sutter on Smart Pointers](https://herbsutter.com/2013/06/05/gotw-91-solution-smart-pointer-parameters/)
