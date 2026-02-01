---
name: java-streams-api
description: Use when Java Streams API for functional-style data processing. Use when processing collections with streams.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# Java Streams API

Master Java's Streams API for functional-style operations on collections,
enabling declarative data processing with operations like filter, map, and
reduce.

## Introduction to Streams

Streams provide a functional approach to processing collections of objects.
Unlike collections, streams don't store elements - they convey elements from
a source through a pipeline of operations.

**Creating streams:**

```java
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

public class StreamCreation {
    public static void main(String[] args) {
        // From collection
        List<String> list = Arrays.asList("a", "b", "c");
        Stream<String> stream1 = list.stream();

        // From array
        String[] array = {"a", "b", "c"};
        Stream<String> stream2 = Arrays.stream(array);

        // Using Stream.of()
        Stream<String> stream3 = Stream.of("a", "b", "c");

        // Empty stream
        Stream<String> stream4 = Stream.empty();

        // Infinite stream with limit
        Stream<Integer> stream5 = Stream.iterate(0, n -> n + 1)
                                       .limit(10);
    }
}
```

## Intermediate Operations

Intermediate operations return a new stream and are lazy - they don't
execute until a terminal operation is invoked.

**filter() - Select elements:**

```java
import java.util.List;
import java.util.stream.Collectors;

public class FilterExample {
    public static void main(String[] args) {
        List<Integer> numbers = List.of(1, 2, 3, 4, 5, 6, 7, 8);

        // Filter even numbers
        List<Integer> evenNumbers = numbers.stream()
            .filter(n -> n % 2 == 0)
            .collect(Collectors.toList());
        // Result: [2, 4, 6, 8]

        // Multiple filters can be chained
        List<Integer> result = numbers.stream()
            .filter(n -> n > 3)
            .filter(n -> n < 7)
            .collect(Collectors.toList());
        // Result: [4, 5, 6]
    }
}
```

**map() - Transform elements:**

```java
public class MapExample {
    public static void main(String[] args) {
        List<String> words = List.of("hello", "world");

        // Convert to uppercase
        List<String> uppercase = words.stream()
            .map(String::toUpperCase)
            .collect(Collectors.toList());
        // Result: ["HELLO", "WORLD"]

        // Get string lengths
        List<Integer> lengths = words.stream()
            .map(String::length)
            .collect(Collectors.toList());
        // Result: [5, 5]

        // Chain transformations
        List<Integer> doubled = List.of(1, 2, 3).stream()
            .map(n -> n * 2)
            .collect(Collectors.toList());
        // Result: [2, 4, 6]
    }
}
```

**flatMap() - Flatten nested structures:**

```java
public class FlatMapExample {
    public static void main(String[] args) {
        List<List<Integer>> nested = List.of(
            List.of(1, 2),
            List.of(3, 4),
            List.of(5, 6)
        );

        // Flatten to single list
        List<Integer> flattened = nested.stream()
            .flatMap(List::stream)
            .collect(Collectors.toList());
        // Result: [1, 2, 3, 4, 5, 6]

        // Split strings and flatten
        List<String> sentences = List.of("hello world", "foo bar");
        List<String> words = sentences.stream()
            .flatMap(s -> Arrays.stream(s.split(" ")))
            .collect(Collectors.toList());
        // Result: ["hello", "world", "foo", "bar"]
    }
}
```

**distinct() and sorted():**

```java
public class DistinctSortedExample {
    public static void main(String[] args) {
        List<Integer> numbers = List.of(5, 2, 8, 2, 1, 5, 3);

        // Remove duplicates
        List<Integer> distinct = numbers.stream()
            .distinct()
            .collect(Collectors.toList());
        // Result: [5, 2, 8, 1, 3]

        // Sort ascending
        List<Integer> sorted = numbers.stream()
            .sorted()
            .collect(Collectors.toList());
        // Result: [1, 2, 2, 3, 5, 5, 8]

        // Sort descending
        List<Integer> descending = numbers.stream()
            .sorted((a, b) -> b - a)
            .collect(Collectors.toList());

        // Distinct and sorted
        List<Integer> distinctSorted = numbers.stream()
            .distinct()
            .sorted()
            .collect(Collectors.toList());
        // Result: [1, 2, 3, 5, 8]
    }
}
```

**peek() - Debug or perform side effects:**

```java
public class PeekExample {
    public static void main(String[] args) {
        List<Integer> numbers = List.of(1, 2, 3, 4, 5);

        // Debug stream pipeline
        List<Integer> result = numbers.stream()
            .peek(n -> System.out.println("Original: " + n))
            .map(n -> n * 2)
            .peek(n -> System.out.println("Doubled: " + n))
            .filter(n -> n > 5)
            .peek(n -> System.out.println("Filtered: " + n))
            .collect(Collectors.toList());
    }
}
```

## Terminal Operations

Terminal operations produce a result or side effect and close the stream.

**collect() - Gather results:**

```java
import java.util.stream.Collectors;
import java.util.Map;
import java.util.Set;

public class CollectExample {
    public static void main(String[] args) {
        List<String> words = List.of("apple", "banana", "cherry");

        // To List
        List<String> list = words.stream()
            .collect(Collectors.toList());

        // To Set
        Set<String> set = words.stream()
            .collect(Collectors.toSet());

        // To Map
        Map<String, Integer> map = words.stream()
            .collect(Collectors.toMap(
                w -> w,              // Key
                String::length       // Value
            ));
        // Result: {apple=5, banana=6, cherry=6}

        // Joining strings
        String joined = words.stream()
            .collect(Collectors.joining(", "));
        // Result: "apple, banana, cherry"

        // Grouping by length
        Map<Integer, List<String>> grouped = words.stream()
            .collect(Collectors.groupingBy(String::length));
        // Result: {5=[apple], 6=[banana, cherry]}
    }
}
```

**reduce() - Combine elements:**

```java
public class ReduceExample {
    public static void main(String[] args) {
        List<Integer> numbers = List.of(1, 2, 3, 4, 5);

        // Sum with identity
        int sum = numbers.stream()
            .reduce(0, (a, b) -> a + b);
        // Result: 15

        // Product
        int product = numbers.stream()
            .reduce(1, (a, b) -> a * b);
        // Result: 120

        // Max value
        Optional<Integer> max = numbers.stream()
            .reduce((a, b) -> a > b ? a : b);
        // Result: Optional[5]

        // Using method reference
        int sum2 = numbers.stream()
            .reduce(0, Integer::sum);

        // String concatenation
        String concatenated = List.of("a", "b", "c").stream()
            .reduce("", (a, b) -> a + b);
        // Result: "abc"
    }
}
```

**forEach() and forEachOrdered():**

```java
public class ForEachExample {
    public static void main(String[] args) {
        List<String> words = List.of("hello", "world");

        // Print each element
        words.stream()
            .forEach(System.out::println);

        // Parallel stream with ordered iteration
        words.parallelStream()
            .forEachOrdered(System.out::println);

        // With side effects (use cautiously)
        List<String> results = new ArrayList<>();
        words.stream()
            .map(String::toUpperCase)
            .forEach(results::add);
    }
}
```

**count(), anyMatch(), allMatch(), noneMatch():**

```java
public class MatchingExample {
    public static void main(String[] args) {
        List<Integer> numbers = List.of(1, 2, 3, 4, 5);

        // Count elements
        long count = numbers.stream()
            .filter(n -> n > 2)
            .count();
        // Result: 3

        // Check if any match
        boolean hasEven = numbers.stream()
            .anyMatch(n -> n % 2 == 0);
        // Result: true

        // Check if all match
        boolean allPositive = numbers.stream()
            .allMatch(n -> n > 0);
        // Result: true

        // Check if none match
        boolean noNegative = numbers.stream()
            .noneMatch(n -> n < 0);
        // Result: true
    }
}
```

**findFirst() and findAny():**

```java
public class FindExample {
    public static void main(String[] args) {
        List<Integer> numbers = List.of(1, 2, 3, 4, 5);

        // Find first element
        Optional<Integer> first = numbers.stream()
            .filter(n -> n > 2)
            .findFirst();
        // Result: Optional[3]

        // Find any (useful in parallel streams)
        Optional<Integer> any = numbers.parallelStream()
            .filter(n -> n > 2)
            .findAny();
        // Result: Optional[3] or Optional[4] or Optional[5]

        // Handle empty result
        Integer value = numbers.stream()
            .filter(n -> n > 10)
            .findFirst()
            .orElse(-1);
        // Result: -1
    }
}
```

## Advanced Collectors

**Partitioning and grouping:**

```java
public class AdvancedCollectors {
    public static void main(String[] args) {
        List<Integer> numbers = List.of(1, 2, 3, 4, 5, 6);

        // Partition by predicate
        Map<Boolean, List<Integer>> partitioned = numbers.stream()
            .collect(Collectors.partitioningBy(n -> n % 2 == 0));
        // Result: {false=[1,3,5], true=[2,4,6]}

        // Group by with counting
        Map<Integer, Long> lengthCounts = List.of("a", "bb", "ccc").stream()
            .collect(Collectors.groupingBy(
                String::length,
                Collectors.counting()
            ));
        // Result: {1=1, 2=1, 3=1}

        // Downstream collectors
        Map<Integer, List<String>> grouped =
            List.of("apple", "apricot", "banana").stream()
            .collect(Collectors.groupingBy(
                String::length,
                Collectors.mapping(
                    String::toUpperCase,
                    Collectors.toList()
                )
            ));
        // Result: {5=[APPLE], 6=[BANANA], 7=[APRICOT]}
    }
}
```

**Statistics collectors:**

```java
import java.util.IntSummaryStatistics;
import java.util.stream.Collectors;

public class StatisticsExample {
    public static void main(String[] args) {
        List<Integer> numbers = List.of(1, 2, 3, 4, 5);

        // Summary statistics
        IntSummaryStatistics stats = numbers.stream()
            .collect(Collectors.summarizingInt(Integer::intValue));

        System.out.println("Count: " + stats.getCount());     // 5
        System.out.println("Sum: " + stats.getSum());         // 15
        System.out.println("Min: " + stats.getMin());         // 1
        System.out.println("Max: " + stats.getMax());         // 5
        System.out.println("Average: " + stats.getAverage()); // 3.0

        // Averaging
        double average = numbers.stream()
            .collect(Collectors.averagingInt(Integer::intValue));
        // Result: 3.0
    }
}
```

## Parallel Streams

Parallel streams automatically partition data and process in parallel.

**Using parallel streams:**

```java
public class ParallelStreamExample {
    public static void main(String[] args) {
        List<Integer> numbers = List.of(1, 2, 3, 4, 5, 6, 7, 8);

        // Convert to parallel stream
        int sum = numbers.parallelStream()
            .filter(n -> n % 2 == 0)
            .mapToInt(Integer::intValue)
            .sum();

        // From sequential to parallel
        long count = numbers.stream()
            .parallel()
            .filter(n -> n > 3)
            .count();

        // Check if parallel
        boolean isParallel = numbers.parallelStream().isParallel();
        // Result: true

        // Back to sequential
        List<Integer> result = numbers.parallelStream()
            .sequential()
            .collect(Collectors.toList());
    }
}
```

**Performance considerations:**

```java
import java.util.stream.IntStream;

public class ParallelPerformance {
    public static void main(String[] args) {
        // Small dataset - sequential is faster
        List<Integer> small = IntStream.range(0, 100)
            .boxed()
            .collect(Collectors.toList());

        // Large dataset - parallel may be faster
        List<Integer> large = IntStream.range(0, 1_000_000)
            .boxed()
            .collect(Collectors.toList());

        // Sequential
        long start = System.nanoTime();
        long sum1 = large.stream()
            .mapToLong(Integer::longValue)
            .sum();
        long sequential = System.nanoTime() - start;

        // Parallel
        start = System.nanoTime();
        long sum2 = large.parallelStream()
            .mapToLong(Integer::longValue)
            .sum();
        long parallel = System.nanoTime() - start;

        System.out.println("Sequential: " + sequential);
        System.out.println("Parallel: " + parallel);
    }
}
```

## Primitive Streams

Specialized streams for primitive types avoid boxing overhead.

**IntStream, LongStream, DoubleStream:**

```java
import java.util.stream.IntStream;
import java.util.stream.LongStream;
import java.util.stream.DoubleStream;

public class PrimitiveStreams {
    public static void main(String[] args) {
        // IntStream range
        IntStream.range(1, 5)
            .forEach(System.out::println); // 1, 2, 3, 4

        // IntStream rangeClosed (inclusive)
        IntStream.rangeClosed(1, 5)
            .forEach(System.out::println); // 1, 2, 3, 4, 5

        // Sum of IntStream
        int sum = IntStream.of(1, 2, 3, 4, 5).sum();
        // Result: 15

        // Average
        double avg = IntStream.of(1, 2, 3, 4, 5)
            .average()
            .orElse(0.0);
        // Result: 3.0

        // mapToInt to avoid boxing
        int total = List.of(1, 2, 3, 4, 5).stream()
            .mapToInt(Integer::intValue)
            .sum();

        // Generate random numbers
        DoubleStream.generate(Math::random)
            .limit(5)
            .forEach(System.out::println);
    }
}
```

## Real-World Examples

**Processing business objects:**

```java
class Employee {
    private String name;
    private String department;
    private double salary;

    public Employee(String name, String department, double salary) {
        this.name = name;
        this.department = department;
        this.salary = salary;
    }

    // Getters
    public String getName() { return name; }
    public String getDepartment() { return department; }
    public double getSalary() { return salary; }
}

public class EmployeeProcessing {
    public static void main(String[] args) {
        List<Employee> employees = List.of(
            new Employee("Alice", "Engineering", 80000),
            new Employee("Bob", "Engineering", 90000),
            new Employee("Charlie", "Sales", 70000),
            new Employee("Diana", "Sales", 75000)
        );

        // Average salary by department
        Map<String, Double> avgSalaryByDept = employees.stream()
            .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.averagingDouble(Employee::getSalary)
            ));
        // Result: {Engineering=85000.0, Sales=72500.0}

        // Highest paid employee
        Optional<Employee> highestPaid = employees.stream()
            .max((e1, e2) -> Double.compare(e1.getSalary(),
                                            e2.getSalary()));

        // Total salary by department
        Map<String, Double> totalByDept = employees.stream()
            .collect(Collectors.groupingBy(
                Employee::getDepartment,
                Collectors.summingDouble(Employee::getSalary)
            ));

        // Employees earning over 75k
        List<String> highEarners = employees.stream()
            .filter(e -> e.getSalary() > 75000)
            .map(Employee::getName)
            .collect(Collectors.toList());
    }
}
```

**File processing example:**

```java
import java.nio.file.Files;
import java.nio.file.Paths;
import java.io.IOException;

public class FileProcessing {
    public static void main(String[] args) throws IOException {
        // Read file lines as stream
        Files.lines(Paths.get("data.txt"))
            .filter(line -> !line.isEmpty())
            .map(String::trim)
            .forEach(System.out::println);

        // Count words in file
        long wordCount = Files.lines(Paths.get("data.txt"))
            .flatMap(line -> Arrays.stream(line.split("\\s+")))
            .count();

        // Find unique words
        Set<String> uniqueWords = Files.lines(Paths.get("data.txt"))
            .flatMap(line -> Arrays.stream(line.split("\\s+")))
            .map(String::toLowerCase)
            .collect(Collectors.toSet());
    }
}
```

## When to Use This Skill

Use java-streams-api when you need to:

- Process collections with functional-style operations
- Filter, map, or transform data declaratively
- Aggregate or reduce collections to single values
- Group or partition data by criteria
- Chain multiple data transformations
- Process large datasets in parallel
- Write more readable collection processing code
- Avoid explicit loops and mutable state
- Perform lazy evaluation of operations
- Work with infinite sequences efficiently

## Best Practices

- Use method references when possible for readability
- Avoid side effects in stream operations
- Close streams from I/O sources (Files.lines, etc.)
- Prefer collect() over forEach() for accumulation
- Use primitive streams to avoid boxing overhead
- Keep stream pipelines readable with proper formatting
- Use parallel streams only for large datasets
- Don't reuse streams - they're one-time use
- Prefer Optional over null checks in results
- Use Collectors factory methods for common operations

## Common Pitfalls

- Reusing streams after terminal operation (throws exception)
- Modifying source collection during stream processing
- Using parallel streams for small datasets (overhead cost)
- Side effects in stateless operations (unpredictable results)
- Not handling Optional results properly
- Excessive chaining making code unreadable
- Forgetting to close streams from I/O sources
- Using forEach() when collect() is more appropriate
- Not considering thread safety in parallel streams
- Performance issues from unnecessary boxing/unboxing

## Resources

- [Java Streams Documentation](<https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/stream/package-summary.html>)
- [Java Stream API Guide](<https://www.oracle.com/technical-resources/articles/java/ma14-java-se-8-streams.html>)
- [Collectors Documentation](<https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/stream/Collectors.html>)
- [Parallel Streams Guide](<https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/stream/package-summary.html#StreamOps>)
