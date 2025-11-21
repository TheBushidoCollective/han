---
name: cpp-templates-metaprogramming
description: Use when C++ templates and metaprogramming including template specialization, SFINAE, type traits, and C++20 concepts.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# C++ Templates and Metaprogramming

Template metaprogramming enables compile-time computation and code generation,
creating flexible, efficient abstractions without runtime overhead. This skill
covers function and class templates, specialization, SFINAE, type traits, and
modern concepts-based template constraints.

## Function Templates

Function templates enable writing generic algorithms that work with any type
satisfying requirements.

```cpp
#include <iostream>
#include <vector>
#include <string>

// Basic function template
template<typename T>
T maximum(T a, T b) {
    return (a > b) ? a : b;
}

// Multiple template parameters
template<typename T, typename U>
auto add(T a, U b) -> decltype(a + b) {
    return a + b;
}

// Template with non-type parameters
template<typename T, size_t N>
size_t array_size(T (&)[N]) {
    return N;
}

// Template overloading
template<typename T>
void print(T value) {
    std::cout << value << "\n";
}

template<typename T>
void print(const std::vector<T>& vec) {
    for (const auto& item : vec) {
        std::cout << item << " ";
    }
    std::cout << "\n";
}

void function_template_examples() {
    auto max_int = maximum(10, 20);
    auto max_double = maximum(3.14, 2.71);
    auto max_string = maximum(std::string("abc"), std::string("xyz"));

    auto sum = add(5, 3.14);  // int + double

    int arr[] = {1, 2, 3, 4, 5};
    std::cout << "Array size: " << array_size(arr) << "\n";

    print(42);
    print(std::vector<int>{1, 2, 3});
}
```

## Class Templates

Class templates enable creating generic containers and data structures.

```cpp
#include <iostream>
#include <stdexcept>

// Basic class template
template<typename T>
class Stack {
    T* data_;
    size_t size_;
    size_t capacity_;

public:
    Stack(size_t capacity = 10)
        : data_(new T[capacity])
        , size_(0)
        , capacity_(capacity) {}

    ~Stack() {
        delete[] data_;
    }

    void push(const T& value) {
        if (size_ >= capacity_) {
            resize();
        }
        data_[size_++] = value;
    }

    T pop() {
        if (size_ == 0) {
            throw std::underflow_error("Stack is empty");
        }
        return data_[--size_];
    }

    bool empty() const { return size_ == 0; }
    size_t size() const { return size_; }

private:
    void resize() {
        capacity_ *= 2;
        T* new_data = new T[capacity_];
        for (size_t i = 0; i < size_; ++i) {
            new_data[i] = data_[i];
        }
        delete[] data_;
        data_ = new_data;
    }
};

// Multiple template parameters
template<typename Key, typename Value>
class Pair {
    Key key_;
    Value value_;

public:
    Pair(const Key& k, const Value& v) : key_(k), value_(v) {}

    const Key& key() const { return key_; }
    const Value& value() const { return value_; }
};

// Template with default parameters
template<typename T, typename Allocator = std::allocator<T>>
class Vector {
    // Implementation
};

void class_template_examples() {
    Stack<int> int_stack;
    int_stack.push(1);
    int_stack.push(2);
    std::cout << int_stack.pop() << "\n";

    Stack<std::string> str_stack;
    str_stack.push("hello");

    Pair<std::string, int> p("age", 30);
}
```

## Template Specialization

Template specialization allows providing custom implementations for specific
types.

```cpp
#include <iostream>
#include <cstring>

// Primary template
template<typename T>
class Container {
    T value_;

public:
    Container(const T& value) : value_(value) {}

    void print() const {
        std::cout << "Generic: " << value_ << "\n";
    }

    size_t memory_size() const {
        return sizeof(T);
    }
};

// Full specialization for const char*
template<>
class Container<const char*> {
    const char* value_;

public:
    Container(const char* value) : value_(value) {}

    void print() const {
        std::cout << "C-string: " << value_ << "\n";
    }

    size_t memory_size() const {
        return std::strlen(value_) + 1;
    }
};

// Partial specialization for pointers
template<typename T>
class Container<T*> {
    T* value_;

public:
    Container(T* value) : value_(value) {}

    void print() const {
        std::cout << "Pointer: " << *value_ << "\n";
    }

    size_t memory_size() const {
        return sizeof(T*);
    }
};

// Function template specialization
template<typename T>
bool is_negative(T value) {
    return value < 0;
}

template<>
bool is_negative<bool>(bool value) {
    return false;  // bool can't be negative
}

void specialization_examples() {
    Container<int> c1(42);
    c1.print();  // Generic

    Container<const char*> c2("hello");
    c2.print();  // C-string

    int x = 10;
    Container<int*> c3(&x);
    c3.print();  // Pointer
}
```

## SFINAE (Substitution Failure Is Not An Error)

SFINAE enables compile-time function selection based on type properties.

```cpp
#include <iostream>
#include <type_traits>
#include <vector>

// Enable if type has begin() and end()
template<typename T>
typename std::enable_if<
    std::is_same<
        decltype(std::declval<T>().begin()),
        decltype(std::declval<T>().end())
    >::value
>::type print_container(const T& container) {
    std::cout << "Container: ";
    for (const auto& item : container) {
        std::cout << item << " ";
    }
    std::cout << "\n";
}

// Enable if type is arithmetic
template<typename T>
typename std::enable_if<std::is_arithmetic<T>::value>::type
print_value(T value) {
    std::cout << "Number: " << value << "\n";
}

// Enable if type is not arithmetic
template<typename T>
typename std::enable_if<!std::is_arithmetic<T>::value>::type
print_value(const T& value) {
    std::cout << "Non-number: " << value << "\n";
}

// Using std::enable_if as template parameter
template<typename T,
         typename = std::enable_if_t<std::is_integral<T>::value>>
T safe_divide(T a, T b) {
    if (b == 0) {
        throw std::domain_error("Division by zero");
    }
    return a / b;
}

// Tag dispatching (alternative to SFINAE)
template<typename T>
void process_impl(T value, std::true_type /* is_pointer */) {
    std::cout << "Processing pointer: " << *value << "\n";
}

template<typename T>
void process_impl(T value, std::false_type /* is_pointer */) {
    std::cout << "Processing value: " << value << "\n";
}

template<typename T>
void process(T value) {
    process_impl(value, std::is_pointer<T>{});
}

void sfinae_examples() {
    std::vector<int> vec{1, 2, 3};
    print_container(vec);

    print_value(42);
    print_value(std::string("hello"));

    std::cout << safe_divide(10, 2) << "\n";

    int x = 100;
    process(x);
    process(&x);
}
```

## Type Traits

Type traits provide compile-time type information and transformations.

```cpp
#include <type_traits>
#include <iostream>
#include <string>

// Using standard type traits
template<typename T>
void analyze_type() {
    std::cout << "Type analysis:\n";
    std::cout << "  Is integral: "
              << std::is_integral<T>::value << "\n";
    std::cout << "  Is floating point: "
              << std::is_floating_point<T>::value << "\n";
    std::cout << "  Is pointer: "
              << std::is_pointer<T>::value << "\n";
    std::cout << "  Is const: "
              << std::is_const<T>::value << "\n";
    std::cout << "  Size: " << sizeof(T) << "\n";
}

// Type transformations
template<typename T>
void transform_type() {
    using NoCV = std::remove_cv_t<T>;
    using NoRef = std::remove_reference_t<T>;
    using NoPtr = std::remove_pointer_t<T>;
    using AddConst = std::add_const_t<T>;
    using AddLRef = std::add_lvalue_reference_t<T>;

    std::cout << "Is same after remove_cv: "
              << std::is_same<NoCV, T>::value << "\n";
}

// Custom type trait
template<typename T>
struct is_string : std::false_type {};

template<>
struct is_string<std::string> : std::true_type {};

template<>
struct is_string<const char*> : std::true_type {};

template<typename T>
inline constexpr bool is_string_v = is_string<T>::value;

// Conditional types
template<typename T>
using MakeUnsigned = std::conditional_t<
    std::is_signed<T>::value,
    std::make_unsigned_t<T>,
    T
>;

// Compile-time if (C++17)
template<typename T>
void print_type(const T& value) {
    if constexpr (std::is_integral_v<T>) {
        std::cout << "Integer: " << value << "\n";
    } else if constexpr (std::is_floating_point_v<T>) {
        std::cout << "Float: " << value << "\n";
    } else if constexpr (is_string_v<T>) {
        std::cout << "String: " << value << "\n";
    } else {
        std::cout << "Unknown type\n";
    }
}

void type_traits_examples() {
    analyze_type<int>();
    analyze_type<const double*>();

    print_type(42);
    print_type(3.14);
    print_type(std::string("hello"));
}
```

## Variadic Templates

Variadic templates enable functions and classes accepting any number of
arguments.

```cpp
#include <iostream>
#include <sstream>

// Base case
void print_all() {
    std::cout << "\n";
}

// Recursive variadic template
template<typename T, typename... Args>
void print_all(T first, Args... rest) {
    std::cout << first << " ";
    print_all(rest...);
}

// Fold expressions (C++17)
template<typename... Args>
auto sum_all(Args... args) {
    return (args + ...);
}

template<typename... Args>
auto multiply_all(Args... args) {
    return (args * ... * 1);
}

// Variadic class template
template<typename... Types>
class Tuple;

template<>
class Tuple<> {
public:
    static constexpr size_t size = 0;
};

template<typename Head, typename... Tail>
class Tuple<Head, Tail...> : private Tuple<Tail...> {
    Head head_;

public:
    static constexpr size_t size = 1 + Tuple<Tail...>::size;

    Tuple(Head h, Tail... t)
        : Tuple<Tail...>(t...), head_(h) {}

    Head& head() { return head_; }
    const Head& head() const { return head_; }

    Tuple<Tail...>& tail() {
        return *this;
    }
};

// Parameter pack expansion
template<typename... Args>
void process_all(Args... args) {
    // Expand in initializer list
    int dummy[] = { (std::cout << args << " ", 0)... };
    (void)dummy;  // Suppress unused warning
}

// Index sequence for compile-time iteration
template<size_t... Is>
void print_indices(std::index_sequence<Is...>) {
    ((std::cout << Is << " "), ...);
    std::cout << "\n";
}

void variadic_examples() {
    print_all(1, 2.5, "hello", std::string("world"));

    auto total = sum_all(1, 2, 3, 4, 5);
    auto product = multiply_all(2, 3, 4);

    Tuple<int, double, std::string> t(42, 3.14, "test");
    std::cout << "Tuple size: " << decltype(t)::size << "\n";

    print_indices(std::make_index_sequence<5>{});
}
```

## Template Metaprogramming

Template metaprogramming performs compile-time computation using templates.

```cpp
#include <iostream>

// Compile-time factorial
template<int N>
struct Factorial {
    static constexpr int value = N * Factorial<N - 1>::value;
};

template<>
struct Factorial<0> {
    static constexpr int value = 1;
};

// Compile-time Fibonacci
template<int N>
struct Fibonacci {
    static constexpr int value =
        Fibonacci<N - 1>::value + Fibonacci<N - 2>::value;
};

template<>
struct Fibonacci<0> {
    static constexpr int value = 0;
};

template<>
struct Fibonacci<1> {
    static constexpr int value = 1;
};

// Type list manipulation
template<typename... Types>
struct TypeList {};

// Get size of type list
template<typename List>
struct Length;

template<typename... Types>
struct Length<TypeList<Types...>> {
    static constexpr size_t value = sizeof...(Types);
};

// Get element at index
template<size_t Index, typename List>
struct At;

template<size_t Index, typename Head, typename... Tail>
struct At<Index, TypeList<Head, Tail...>> {
    using type = typename At<Index - 1, TypeList<Tail...>>::type;
};

template<typename Head, typename... Tail>
struct At<0, TypeList<Head, Tail...>> {
    using type = Head;
};

// Check if type is in list
template<typename T, typename List>
struct Contains;

template<typename T>
struct Contains<T, TypeList<>> : std::false_type {};

template<typename T, typename Head, typename... Tail>
struct Contains<T, TypeList<Head, Tail...>>
    : Contains<T, TypeList<Tail...>> {};

template<typename T, typename... Tail>
struct Contains<T, TypeList<T, Tail...>> : std::true_type {};

// Constexpr functions (C++11 and later)
constexpr int factorial_constexpr(int n) {
    return (n <= 1) ? 1 : n * factorial_constexpr(n - 1);
}

constexpr int fibonacci_constexpr(int n) {
    return (n <= 1) ? n : fibonacci_constexpr(n - 1) +
                          fibonacci_constexpr(n - 2);
}

void metaprogramming_examples() {
    // Computed at compile time
    constexpr int fact5 = Factorial<5>::value;
    constexpr int fib7 = Fibonacci<7>::value;

    std::cout << "5! = " << fact5 << "\n";
    std::cout << "fib(7) = " << fib7 << "\n";

    using MyTypes = TypeList<int, double, std::string>;
    std::cout << "Type list length: "
              << Length<MyTypes>::value << "\n";

    using SecondType = At<1, MyTypes>::type;  // double
    std::cout << "Contains int: "
              << Contains<int, MyTypes>::value << "\n";

    // Modern constexpr
    constexpr int fact6 = factorial_constexpr(6);
    std::cout << "6! = " << fact6 << "\n";
}
```

## Concepts (C++20)

Concepts provide named constraints for template parameters with better error
messages.

```cpp
#include <concepts>
#include <iostream>

// Basic concept
template<typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

// Concept with requirements
template<typename T>
concept Addable = requires(T a, T b) {
    { a + b } -> std::convertible_to<T>;
};

// Concept with multiple constraints
template<typename T>
concept Container = requires(T c) {
    typename T::value_type;
    typename T::iterator;
    { c.begin() } -> std::same_as<typename T::iterator>;
    { c.end() } -> std::same_as<typename T::iterator>;
    { c.size() } -> std::convertible_to<std::size_t>;
};

// Using concepts in function templates
template<Numeric T>
T add(T a, T b) {
    return a + b;
}

// Concept as return type constraint
template<typename T>
auto square(T x) -> std::same_as<T> auto {
    return x * x;
}

// Multiple concept constraints
template<typename T>
concept Sortable = std::totally_ordered<T> && std::copyable<T>;

template<Sortable T>
void sort_values(std::vector<T>& values) {
    std::sort(values.begin(), values.end());
}

// Subsumption (concept refinement)
template<typename T>
concept SignedNumeric = Numeric<T> && std::signed_integral<T>;

template<Numeric T>
void process(T value) {
    std::cout << "Processing numeric\n";
}

template<SignedNumeric T>
void process(T value) {
    std::cout << "Processing signed numeric\n";
}

void concepts_examples() {
    auto result = add(5, 10);      // OK
    auto dresult = add(5.5, 2.3);  // OK
    // auto sresult = add("hi", "there");  // Error

    std::vector<int> vec{3, 1, 2};
    sort_values(vec);

    process(5);   // Calls SignedNumeric version
    process(5.5); // Calls Numeric version
}
```

## Best Practices

1. Use concepts instead of SFINAE in C++20 for clearer template constraints
2. Prefer `constexpr` functions over template metaprogramming for readability
3. Use `std::enable_if_t` and type trait `_v` and `_t` suffixes for conciseness
4. Document template requirements clearly even without concepts
5. Use `decltype(auto)` for perfect return type deduction
6. Prefer template specialization over SFINAE when full implementation differs
7. Use fold expressions instead of recursive variadic templates when possible
8. Mark template functions `inline` or define in headers to avoid linking errors
9. Use `static_assert` to validate template parameters at compile time
10. Prefer standard library type traits over custom implementations

## Common Pitfalls

1. Forgetting to define template member functions in headers, causing linker
   errors
2. Infinite template recursion without proper base cases
3. Complex SFINAE expressions that are hard to read and maintain
4. Not using `typename` keyword when referring to dependent types
5. Template bloat from unnecessary instantiations of large templates
6. Circular dependencies in template specializations
7. Ambiguous function overloads when multiple SFINAE conditions match
8. Excessive compile times from complex template metaprogramming
9. Not marking template `constexpr` functions as `constexpr`
10. Using templates when runtime polymorphism would be simpler and sufficient

## When to Use Templates and Metaprogramming

Use templates and metaprogramming when you need:

- Generic algorithms that work with multiple types
- Compile-time computation and code generation
- Zero-overhead abstractions without runtime cost
- Type-safe interfaces with strong compile-time checking
- Containers and data structures for any type
- Expression templates for domain-specific languages
- Policy-based design with compile-time configuration
- Elimination of code duplication across similar implementations
- Static polymorphism without virtual function overhead
- Modern C++ libraries with flexible, composable components

## Resources

- [C++ Templates: The Complete Guide](https://www.oreilly.com/library/view/c-templates-the/9780134778808/)
- [Modern C++ Programming Cookbook](https://www.packtpub.com/product/modern-c-programming-cookbook-third-edition/9781835080542)
- [C++ Template Metaprogramming](https://www.boost.org/doc/libs/1_82_0/libs/mpl/doc/index.html)
- [cppreference Templates](https://en.cppreference.com/w/cpp/language/templates)
