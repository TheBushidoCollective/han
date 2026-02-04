---
name: java-generics
description: Use when Java generics including type parameters, wildcards, and type bounds. Use when writing type-safe reusable code.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# Java Generics

Master Java's generics system for writing type-safe, reusable code with
compile-time type checking, generic classes, methods, wildcards, and
type bounds.

## Introduction to Generics

Generics enable types to be parameters when defining classes, interfaces,
and methods, providing compile-time type safety.

**Basic generic class:**

```java
public class Box<T> {
    private T content;

    public void set(T content) {
        this.content = content;
    }

    public T get() {
        return content;
    }

    public static void main(String[] args) {
        // Type-safe box for String
        Box<String> stringBox = new Box<>();
        stringBox.set("Hello");
        String value = stringBox.get(); // No casting needed

        // Type-safe box for Integer
        Box<Integer> intBox = new Box<>();
        intBox.set(42);
        Integer number = intBox.get();
    }
}
```

**Generic with multiple type parameters:**

```java
public class Pair<K, V> {
    private K key;
    private V value;

    public Pair(K key, V value) {
        this.key = key;
        this.value = value;
    }

    public K getKey() { return key; }
    public V getValue() { return value; }

    public static void main(String[] args) {
        Pair<String, Integer> pair = new Pair<>("age", 30);
        String key = pair.getKey();
        Integer value = pair.getValue();
    }
}
```

## Generic Methods

Generic methods can be defined independently of generic classes.

**Basic generic method:**

```java
public class GenericMethods {
    // Generic method
    public static <T> void printArray(T[] array) {
        for (T element : array) {
            System.out.println(element);
        }
    }

    // Generic method with return type
    public static <T> T getFirst(T[] array) {
        if (array.length > 0) {
            return array[0];
        }
        return null;
    }

    public static void main(String[] args) {
        String[] strings = {"a", "b", "c"};
        Integer[] numbers = {1, 2, 3};

        printArray(strings);  // T inferred as String
        printArray(numbers);  // T inferred as Integer

        String first = getFirst(strings);
        Integer firstNum = getFirst(numbers);
    }
}
```

**Generic method with multiple type parameters:**

```java
public class MultiplTypeParams {
    public static <K, V> Map<K, V> createMap(K key, V value) {
        Map<K, V> map = new HashMap<>();
        map.put(key, value);
        return map;
    }

    public static <T, R> R transform(T input, Function<T, R> transformer) {
        return transformer.apply(input);
    }

    public static void main(String[] args) {
        Map<String, Integer> map = createMap("count", 10);

        String result = transform(42, num -> "Number: " + num);
        // Result: "Number: 42"
    }
}
```

## Bounded Type Parameters

Type bounds restrict the types that can be used as type arguments.

**Upper bounded type parameters:**

```java
public class UpperBound {
    // T must be Number or subclass of Number
    public static <T extends Number> double sum(List<T> numbers) {
        double total = 0;
        for (T num : numbers) {
            total += num.doubleValue();
        }
        return total;
    }

    // Multiple bounds
    public static <T extends Comparable<T> & Serializable> T max(T a, T b) {
        return a.compareTo(b) > 0 ? a : b;
    }

    public static void main(String[] args) {
        List<Integer> integers = List.of(1, 2, 3, 4, 5);
        double sum = sum(integers); // 15.0

        List<Double> doubles = List.of(1.5, 2.5, 3.5);
        double doubleSum = sum(doubles); // 7.5

        String maxStr = max("apple", "banana"); // "banana"
    }
}
```

**Class with bounded type parameter:**

```java
public class NumberBox<T extends Number> {
    private T number;

    public NumberBox(T number) {
        this.number = number;
    }

    public double doubleValue() {
        return number.doubleValue();
    }

    public boolean isZero() {
        return number.doubleValue() == 0.0;
    }

    public static void main(String[] args) {
        NumberBox<Integer> intBox = new NumberBox<>(42);
        NumberBox<Double> doubleBox = new NumberBox<>(3.14);

        // Compile error: String is not a Number
        // NumberBox<String> stringBox = new NumberBox<>("fail");
    }
}
```

## Wildcards

Wildcards provide flexibility when working with generic types.

**Unbounded wildcard:**

```java
public class UnboundedWildcard {
    // Accept any List
    public static void printList(List<?> list) {
        for (Object elem : list) {
            System.out.println(elem);
        }
    }

    public static int size(List<?> list) {
        return list.size();
    }

    public static void main(String[] args) {
        List<String> strings = List.of("a", "b", "c");
        List<Integer> integers = List.of(1, 2, 3);

        printList(strings);
        printList(integers);

        System.out.println(size(strings));  // 3
        System.out.println(size(integers)); // 3
    }
}
```

**Upper bounded wildcard:**

```java
public class UpperBoundedWildcard {
    // Accept List of Number or any subclass
    public static double sum(List<? extends Number> numbers) {
        double total = 0;
        for (Number num : numbers) {
            total += num.doubleValue();
        }
        return total;
    }

    public static void main(String[] args) {
        List<Integer> integers = List.of(1, 2, 3);
        List<Double> doubles = List.of(1.5, 2.5);
        List<Number> numbers = List.of(1, 2.5, 3);

        System.out.println(sum(integers)); // 6.0
        System.out.println(sum(doubles));  // 4.0
        System.out.println(sum(numbers));  // 6.5
    }
}
```

**Lower bounded wildcard:**

```java
public class LowerBoundedWildcard {
    // Accept List of Integer or any superclass
    public static void addIntegers(List<? super Integer> list) {
        for (int i = 1; i <= 5; i++) {
            list.add(i);
        }
    }

    public static void main(String[] args) {
        List<Integer> integers = new ArrayList<>();
        addIntegers(integers);
        System.out.println(integers); // [1, 2, 3, 4, 5]

        List<Number> numbers = new ArrayList<>();
        addIntegers(numbers);
        System.out.println(numbers); // [1, 2, 3, 4, 5]

        List<Object> objects = new ArrayList<>();
        addIntegers(objects);
        System.out.println(objects); // [1, 2, 3, 4, 5]
    }
}
```

## PECS Principle

Producer Extends, Consumer Super - guideline for using wildcards.

**PECS in action:**

```java
public class PECSExample {
    // Producer - reading from source (extends)
    public static <T> void copy(
        List<? extends T> source,
        List<? super T> destination
    ) {
        for (T item : source) {
            destination.add(item);
        }
    }

    // Producer - extends for reading
    public static double sumNumbers(List<? extends Number> numbers) {
        double sum = 0;
        for (Number num : numbers) { // Reading (producing values)
            sum += num.doubleValue();
        }
        return sum;
    }

    // Consumer - super for writing
    public static void addNumbers(List<? super Integer> list) {
        for (int i = 1; i <= 3; i++) {
            list.add(i); // Writing (consuming values)
        }
    }

    public static void main(String[] args) {
        List<Integer> source = List.of(1, 2, 3);
        List<Number> destination = new ArrayList<>();

        copy(source, destination);
        System.out.println(destination); // [1, 2, 3]
    }
}
```

## Generic Interfaces

Interfaces can be generic, providing contracts for generic types.

**Generic interface:**

```java
public interface Repository<T, ID> {
    T findById(ID id);
    List<T> findAll();
    void save(T entity);
    void delete(ID id);
}

public class UserRepository implements Repository<User, Long> {
    private Map<Long, User> storage = new HashMap<>();

    @Override
    public User findById(Long id) {
        return storage.get(id);
    }

    @Override
    public List<User> findAll() {
        return new ArrayList<>(storage.values());
    }

    @Override
    public void save(User user) {
        storage.put(user.getId(), user);
    }

    @Override
    public void delete(Long id) {
        storage.remove(id);
    }
}

class User {
    private Long id;
    private String name;

    public User(Long id, String name) {
        this.id = id;
        this.name = name;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
}
```

**Comparable and Comparator:**

```java
public class Person implements Comparable<Person> {
    private String name;
    private int age;

    public Person(String name, int age) {
        this.name = name;
        this.age = age;
    }

    @Override
    public int compareTo(Person other) {
        return this.name.compareTo(other.name);
    }

    public static void main(String[] args) {
        List<Person> people = new ArrayList<>();
        people.add(new Person("Alice", 30));
        people.add(new Person("Bob", 25));

        // Natural ordering (by name)
        Collections.sort(people);

        // Custom comparator (by age)
        Comparator<Person> ageComparator =
            Comparator.comparingInt(p -> p.age);
        people.sort(ageComparator);
    }
}
```

## Type Erasure

Java generics use type erasure - generic type information is removed at
runtime.

**Understanding type erasure:**

```java
public class TypeErasure {
    public static void main(String[] args) {
        List<String> strings = new ArrayList<>();
        List<Integer> integers = new ArrayList<>();

        // At runtime, both are just List
        System.out.println(strings.getClass() == integers.getClass());
        // true

        // Cannot check generic type at runtime
        // if (list instanceof List<String>) {} // Compile error

        // Can only check raw type
        if (strings instanceof List) {
            System.out.println("Is a List");
        }
    }
}
```

**Consequences of type erasure:**

```java
public class ErasureConsequences<T> {
    // Cannot create instance of type parameter
    // T instance = new T(); // Compile error

    // Cannot create array of parameterized type
    // T[] array = new T[10]; // Compile error

    // Cannot use instanceof with type parameter
    public boolean isInstance(Object obj) {
        // if (obj instanceof T) {} // Compile error
        return true;
    }

    // Workaround: pass Class<T>
    private Class<T> type;

    public ErasureConsequences(Class<T> type) {
        this.type = type;
    }

    public T createInstance() throws Exception {
        return type.getDeclaredConstructor().newInstance();
    }

    @SuppressWarnings("unchecked")
    public T[] createArray(int size) {
        return (T[]) Array.newInstance(type, size);
    }
}
```

## Generic Builders

Builder pattern with generics for fluent APIs.

**Generic builder:**

```java
public class Query<T> {
    private final Class<T> type;
    private String where;
    private String orderBy;
    private int limit;

    private Query(Class<T> type) {
        this.type = type;
    }

    public static <T> Query<T> from(Class<T> type) {
        return new Query<>(type);
    }

    public Query<T> where(String condition) {
        this.where = condition;
        return this;
    }

    public Query<T> orderBy(String field) {
        this.orderBy = field;
        return this;
    }

    public Query<T> limit(int count) {
        this.limit = count;
        return this;
    }

    public List<T> execute() {
        // Execute query and return results
        return new ArrayList<>();
    }

    public static void main(String[] args) {
        List<User> users = Query.from(User.class)
            .where("age > 18")
            .orderBy("name")
            .limit(10)
            .execute();
    }
}
```

## Recursive Type Bounds

Type bounds can reference the type parameter itself.

**Enum with recursive bound:**

```java
public class RecursiveBound {
    // Enum trick
    public static <E extends Enum<E>> void printEnum(Class<E> enumClass) {
        for (E constant : enumClass.getEnumConstants()) {
            System.out.println(constant);
        }
    }

    // Comparable with recursive bound
    public static <T extends Comparable<T>> T max(List<T> list) {
        if (list.isEmpty()) {
            throw new IllegalArgumentException("Empty list");
        }

        T max = list.get(0);
        for (T item : list) {
            if (item.compareTo(max) > 0) {
                max = item;
            }
        }
        return max;
    }

    enum Color { RED, GREEN, BLUE }

    public static void main(String[] args) {
        printEnum(Color.class);

        List<String> words = List.of("apple", "banana", "cherry");
        String maxWord = max(words); // "cherry"

        List<Integer> numbers = List.of(1, 5, 3, 9, 2);
        Integer maxNum = max(numbers); // 9
    }
}
```

**Builder with recursive bound:**

```java
public abstract class Builder<T, B extends Builder<T, B>> {
    protected abstract B self();

    public abstract T build();
}

public class Person {
    private final String name;
    private final int age;

    protected Person(PersonBuilder<?> builder) {
        this.name = builder.name;
        this.age = builder.age;
    }

    public static PersonBuilder<?> builder() {
        return new PersonBuilder<>();
    }

    public static class PersonBuilder<B extends PersonBuilder<B>>
            extends Builder<Person, B> {
        private String name;
        private int age;

        public B name(String name) {
            this.name = name;
            return self();
        }

        public B age(int age) {
            this.age = age;
            return self();
        }

        @Override
        @SuppressWarnings("unchecked")
        protected B self() {
            return (B) this;
        }

        @Override
        public Person build() {
            return new Person(this);
        }
    }
}
```

## When to Use This Skill

Use java-generics when you need to:

- Write reusable code that works with multiple types
- Enforce compile-time type safety
- Eliminate casting and type errors at runtime
- Create generic collections, algorithms, or utilities
- Build type-safe APIs and frameworks
- Implement generic design patterns
- Work with Java Collections Framework
- Define flexible method signatures with type parameters
- Create bounded type hierarchies
- Implement builder or factory patterns with type safety

## Best Practices

- Use meaningful type parameter names (T, E, K, V)
- Prefer bounded type parameters over raw types
- Use wildcards for flexibility in method parameters
- Apply PECS principle (Producer Extends, Consumer Super)
- Avoid raw types in new code
- Use @SuppressWarnings("unchecked") sparingly
- Document generic type constraints clearly
- Prefer generic methods over generic classes when possible
- Use bounded wildcards for maximum API flexibility
- Consider type erasure implications

## Common Pitfalls

- Using raw types instead of parameterized types
- Confusing extends and super wildcards
- Trying to create arrays of generic types
- Not understanding type erasure limitations
- Overusing wildcards making code unreadable
- Incorrect variance with wildcards
- Forgetting that generics are compile-time only
- Not handling unchecked warnings properly
- Creating unnecessarily complex generic hierarchies
- Misusing instanceof with generic types

## Resources

- [Java Generics Tutorial](<https://docs.oracle.com/javase/tutorial/java/generics/>)
- [Effective Java: Generics](<https://www.oreilly.com/library/view/effective-java/9780134686097/>)
- [Java Generics FAQ](<http://www.angelikalanger.com/GenericsFAQ/JavaGenericsFAQ.html>)
- [Oracle Generics Documentation](<https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/package-summary.html>)
