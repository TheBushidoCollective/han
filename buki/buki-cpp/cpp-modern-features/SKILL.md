---
name: cpp-modern-features
description: Use when modern C++ features from C++11/14/17/20 including auto, lambdas, range-based loops, structured bindings, and concepts.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# Modern C++ Features

Modern C++ (C++11 and beyond) introduced significant improvements that make
C++ more expressive, safer, and easier to use. This skill covers essential
modern features including type inference, lambda expressions, range-based
loops, smart initialization, and the latest C++20 additions.

## Auto Type Inference

The `auto` keyword enables automatic type deduction, reducing verbosity while
maintaining type safety.

```cpp
#include <iostream>
#include <vector>
#include <map>
#include <string>

void auto_examples() {
    // Simple type inference
    auto x = 42;              // int
    auto pi = 3.14159;        // double
    auto name = "Alice";      // const char*
    auto message = std::string("Hello");  // std::string

    // Iterator simplification
    std::vector<int> numbers = {1, 2, 3, 4, 5};

    // Before C++11
    for (std::vector<int>::iterator it = numbers.begin();
         it != numbers.end(); ++it) {
        std::cout << *it << " ";
    }

    // With auto
    for (auto it = numbers.begin(); it != numbers.end(); ++it) {
        std::cout << *it << " ";
    }

    // Complex types
    std::map<std::string, std::vector<int>> data;
    auto it = data.find("key");  // Much cleaner than full type

    // Return type deduction (C++14)
    auto multiply = [](int a, int b) { return a * b; };

    // Structured bindings (C++17)
    std::map<std::string, int> scores = {{"Alice", 95}, {"Bob", 87}};
    for (const auto& [name, score] : scores) {
        std::cout << name << ": " << score << "\n";
    }
}
```

## Lambda Expressions

Lambdas provide inline anonymous functions, essential for modern C++
algorithms and callbacks.

```cpp
#include <algorithm>
#include <vector>
#include <functional>
#include <iostream>

void lambda_examples() {
    std::vector<int> numbers = {5, 2, 8, 1, 9, 3};

    // Basic lambda
    auto print = [](int n) { std::cout << n << " "; };
    std::for_each(numbers.begin(), numbers.end(), print);

    // Lambda with capture
    int threshold = 5;
    auto above_threshold = [threshold](int n) { return n > threshold; };

    // Capture by value [=]
    auto sum_above = [=]() {
        int sum = 0;
        for (int n : numbers) {
            if (n > threshold) sum += n;
        }
        return sum;
    };

    // Capture by reference [&]
    int count = 0;
    auto count_above = [&count, threshold](int n) {
        if (n > threshold) count++;
    };
    std::for_each(numbers.begin(), numbers.end(), count_above);

    // Generic lambda (C++14)
    auto generic_print = [](const auto& item) {
        std::cout << item << " ";
    };

    // Lambda as comparator
    std::sort(numbers.begin(), numbers.end(),
              [](int a, int b) { return a > b; });  // Descending

    // Mutable lambda
    auto counter = [count = 0]() mutable {
        return ++count;
    };

    std::cout << counter() << "\n";  // 1
    std::cout << counter() << "\n";  // 2
}

// Returning lambdas
std::function<int(int)> make_multiplier(int factor) {
    return [factor](int n) { return n * factor; };
}
```

## Range-Based For Loops

Range-based for loops provide clean, safe iteration over containers and
ranges.

```cpp
#include <vector>
#include <map>
#include <string>
#include <iostream>

void range_based_loops() {
    std::vector<int> numbers = {1, 2, 3, 4, 5};

    // Basic iteration
    for (int n : numbers) {
        std::cout << n << " ";
    }

    // By reference (for modification)
    for (int& n : numbers) {
        n *= 2;
    }

    // By const reference (efficient for large objects)
    std::vector<std::string> names = {"Alice", "Bob", "Charlie"};
    for (const auto& name : names) {
        std::cout << name << "\n";
    }

    // With structured bindings (C++17)
    std::map<std::string, int> ages = {
        {"Alice", 30},
        {"Bob", 25},
        {"Charlie", 35}
    };

    for (const auto& [name, age] : ages) {
        std::cout << name << " is " << age << " years old\n";
    }

    // Initializer in for loop (C++20)
    for (std::vector<int> temp = {1, 2, 3}; auto n : temp) {
        std::cout << n << " ";
    }
}

// Custom range support
class Range {
    int start_, end_;

public:
    Range(int start, int end) : start_(start), end_(end) {}

    struct Iterator {
        int current;
        Iterator(int val) : current(val) {}
        int operator*() const { return current; }
        Iterator& operator++() { ++current; return *this; }
        bool operator!=(const Iterator& other) const {
            return current != other.current;
        }
    };

    Iterator begin() const { return Iterator(start_); }
    Iterator end() const { return Iterator(end_); }
};

void use_custom_range() {
    for (int i : Range(0, 10)) {
        std::cout << i << " ";
    }
}
```

## Uniform Initialization

Uniform initialization using braces provides consistent syntax and prevents
narrowing conversions.

```cpp
#include <vector>
#include <string>
#include <map>

struct Point {
    int x, y;
};

void uniform_initialization() {
    // Built-in types
    int a{42};
    double pi{3.14159};

    // Containers
    std::vector<int> numbers{1, 2, 3, 4, 5};
    std::map<std::string, int> ages{
        {"Alice", 30},
        {"Bob", 25}
    };

    // Aggregates
    Point p{10, 20};

    // Prevents narrowing
    // int x{3.14};  // Compiler error!
    int x = 3.14;    // Compiles (implicit conversion)

    // Empty initialization (zero/default)
    int zero{};      // 0
    std::string empty{};  // ""

    // Return value
    auto get_numbers = []() { return std::vector<int>{1, 2, 3}; };
}

// Most vexing parse solution
class Widget {
public:
    Widget() = default;
    Widget(int x) {}
};

void vexing_parse() {
    // Before C++11: declares a function!
    // Widget w();

    // Modern C++: creates an object
    Widget w{};     // Correct
    Widget w2{10};  // Also correct
}
```

## Move Semantics and Rvalue References

Move semantics enable efficient transfer of resources without copying,
crucial for performance.

```cpp
#include <vector>
#include <string>
#include <utility>
#include <iostream>

class Buffer {
    size_t size_;
    int* data_;

public:
    // Constructor
    Buffer(size_t size) : size_(size), data_(new int[size]) {
        std::cout << "Constructor\n";
    }

    // Copy constructor
    Buffer(const Buffer& other)
        : size_(other.size_), data_(new int[other.size_]) {
        std::copy(other.data_, other.data_ + size_, data_);
        std::cout << "Copy constructor\n";
    }

    // Move constructor
    Buffer(Buffer&& other) noexcept
        : size_(other.size_), data_(other.data_) {
        other.size_ = 0;
        other.data_ = nullptr;
        std::cout << "Move constructor\n";
    }

    // Copy assignment
    Buffer& operator=(const Buffer& other) {
        if (this != &other) {
            delete[] data_;
            size_ = other.size_;
            data_ = new int[size_];
            std::copy(other.data_, other.data_ + size_, data_);
            std::cout << "Copy assignment\n";
        }
        return *this;
    }

    // Move assignment
    Buffer& operator=(Buffer&& other) noexcept {
        if (this != &other) {
            delete[] data_;
            size_ = other.size_;
            data_ = other.data_;
            other.size_ = 0;
            other.data_ = nullptr;
            std::cout << "Move assignment\n";
        }
        return *this;
    }

    ~Buffer() { delete[] data_; }
};

void move_semantics_example() {
    Buffer b1(100);
    Buffer b2 = std::move(b1);  // Move, not copy

    std::vector<Buffer> buffers;
    buffers.push_back(Buffer(50));  // Move constructor used

    // Perfect forwarding
    auto make_buffer = [](auto&&... args) {
        return Buffer(std::forward<decltype(args)>(args)...);
    };
}
```

## Variadic Templates

Variadic templates enable functions and classes that accept any number of
arguments.

```cpp
#include <iostream>
#include <string>

// Base case
void print() {
    std::cout << "\n";
}

// Recursive variadic template
template<typename T, typename... Args>
void print(T first, Args... rest) {
    std::cout << first << " ";
    print(rest...);
}

// Fold expressions (C++17)
template<typename... Args>
auto sum(Args... args) {
    return (args + ...);
}

template<typename... Args>
auto sum_with_init(Args... args) {
    return (args + ... + 0);
}

// Perfect forwarding with variadic templates
template<typename T, typename... Args>
std::unique_ptr<T> make_unique_custom(Args&&... args) {
    return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
}

void variadic_examples() {
    print(1, 2.5, "hello", std::string("world"));

    auto total = sum(1, 2, 3, 4, 5);  // 15

    // Fold expressions for various operations
    auto all_true = [](auto... args) {
        return (args && ...);
    };

    auto any_true = [](auto... args) {
        return (args || ...);
    };
}
```

## Structured Bindings (C++17)

Structured bindings decompose objects into their constituent parts,
improving code readability.

```cpp
#include <tuple>
#include <map>
#include <string>
#include <array>

struct Person {
    std::string name;
    int age;
    double salary;
};

std::tuple<int, std::string, double> get_employee() {
    return {42, "Alice", 75000.0};
}

void structured_bindings() {
    // Tuple decomposition
    auto [id, name, salary] = get_employee();

    // Pair decomposition
    std::pair<int, std::string> p{1, "one"};
    auto [num, text] = p;

    // Struct decomposition
    Person person{"Bob", 30, 80000.0};
    auto [pname, page, psalary] = person;

    // Array decomposition
    std::array<int, 3> arr{1, 2, 3};
    auto [a, b, c] = arr;

    // Map iteration
    std::map<std::string, int> scores{{"Alice", 95}, {"Bob", 87}};
    for (const auto& [name, score] : scores) {
        std::cout << name << ": " << score << "\n";
    }

    // References
    auto& [rname, rage, rsalary] = person;
    rage = 31;  // Modifies person.age
}
```

## Concepts (C++20)

Concepts constrain template parameters, providing better error messages and
clearer interfaces.

```cpp
#include <concepts>
#include <iostream>
#include <vector>

// Define custom concept
template<typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

// Use concept to constrain template
template<Numeric T>
T add(T a, T b) {
    return a + b;
}

// Concept with multiple constraints
template<typename T>
concept Printable = requires(T t) {
    { std::cout << t } -> std::convertible_to<std::ostream&>;
};

template<Printable T>
void print(const T& value) {
    std::cout << value << "\n";
}

// Range concept
template<typename T>
concept Range = requires(T r) {
    r.begin();
    r.end();
};

template<Range R>
void print_range(const R& range) {
    for (const auto& item : range) {
        std::cout << item << " ";
    }
    std::cout << "\n";
}

// Concept with associated types
template<typename T>
concept Container = requires(T c) {
    typename T::value_type;
    typename T::iterator;
    { c.begin() } -> std::same_as<typename T::iterator>;
    { c.end() } -> std::same_as<typename T::iterator>;
    { c.size() } -> std::convertible_to<std::size_t>;
};

template<Container C>
void process_container(const C& container) {
    std::cout << "Size: " << container.size() << "\n";
}

void concepts_example() {
    auto result = add(5, 10);      // OK
    auto dresult = add(5.5, 2.3);  // OK
    // auto sresult = add("hi", "there");  // Error: doesn't satisfy
                                             // Numeric

    print(42);
    print("Hello");

    std::vector<int> vec{1, 2, 3};
    print_range(vec);
    process_container(vec);
}
```

## Ranges Library (C++20)

The ranges library provides composable algorithms and views for working with
sequences.

```cpp
#include <ranges>
#include <vector>
#include <iostream>
#include <algorithm>

void ranges_examples() {
    std::vector<int> numbers{1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

    // Views are lazy and composable
    auto even = [](int n) { return n % 2 == 0; };
    auto square = [](int n) { return n * n; };

    // Compose operations without intermediate containers
    auto result = numbers
        | std::views::filter(even)
        | std::views::transform(square)
        | std::views::take(3);

    for (int n : result) {
        std::cout << n << " ";  // 4 16 36
    }
    std::cout << "\n";

    // Range algorithms
    std::ranges::sort(numbers, std::greater{});

    // Find with projection
    struct Person {
        std::string name;
        int age;
    };

    std::vector<Person> people{
        {"Alice", 30},
        {"Bob", 25},
        {"Charlie", 35}
    };

    auto it = std::ranges::find(people, "Bob", &Person::name);

    // Views::iota for number generation
    for (int i : std::views::iota(1, 6)) {
        std::cout << i << " ";  // 1 2 3 4 5
    }
    std::cout << "\n";

    // Split view
    std::string text = "one,two,three";
    for (auto word : text | std::views::split(',')) {
        for (char c : word) {
            std::cout << c;
        }
        std::cout << " ";
    }
}
```

## Best Practices

1. Use `auto` for complex types and iterators but keep simple types explicit
2. Prefer lambdas over function objects for inline operations and callbacks
3. Use range-based for loops instead of manual iterator manipulation
4. Initialize variables with `{}` to prevent narrowing conversions
5. Implement move constructors and assignments for resource-owning classes
6. Use `std::move` when transferring ownership, not for general optimization
7. Prefer structured bindings over `std::get<>()` for tuples and pairs
8. Use concepts to constrain templates and improve error messages
9. Leverage ranges for composable, lazy operations on sequences
10. Use `const auto&` for range-based loops with large objects

## Common Pitfalls

1. Overusing `auto` making code less readable when types provide clarity
2. Capturing by reference in lambdas that outlive their captures
3. Using `std::move` on const objects, which disables move semantics
4. Forgetting `noexcept` on move operations, preventing optimizations
5. Modifying containers while iterating with range-based for loops
6. Dangling references from structured bindings of temporary objects
7. Using fold expressions without considering operator precedence
8. Assuming ranges views create copies instead of providing lazy views
9. Moving from objects that will be used again later
10. Not marking move constructors and assignments as `noexcept`

## When to Use Modern C++ Features

Use modern C++ features when you need:

- Cleaner, more expressive code with less boilerplate
- Better type safety with concepts and structured bindings
- Improved performance through move semantics
- Functional programming patterns with lambdas and ranges
- Generic programming with less template complexity
- Safer resource management with smart pointers
- Code that's easier to maintain and refactor
- Better compiler error messages with concepts
- Lazy evaluation and composition with ranges
- Migration from older C++ codebases to modern standards

## Resources

- [C++ Reference](https://en.cppreference.com/)
- [Modern C++ Tutorial](https://changkun.de/modern-cpp/)
- [Effective Modern C++](https://www.oreilly.com/library/view/effective-modern-c/9781491908419/)
- [C++20 Ranges](https://www.modernescpp.com/index.php/c-20-ranges-library)
