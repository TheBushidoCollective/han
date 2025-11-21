---
name: csharp-nullable-types
description: Use when C# nullable reference types and value types for null safety, nullable annotations, and patterns for handling null values.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# C# Nullable Types

Nullable types in C# help prevent null reference exceptions, one of the most
common programming errors. C# 8.0 introduced nullable reference types,
providing compile-time null-safety checking. This skill covers nullable value
types, nullable reference types, null-coalescing operators, and patterns for
safe null handling.

## Nullable Value Types

Value types (int, double, bool, struct) normally cannot be null. Nullable
value types enable representing "no value" state.

```csharp
using System;

public class NullableValueTypes
{
    // Declaration
    public void Declaration()
    {
        int? nullableInt = null;
        int? anotherInt = 42;

        double? nullableDouble = null;
        bool? nullableBool = true;

        // Generic syntax (equivalent)
        Nullable<int> genericNullable = null;
    }

    // Checking for null
    public void NullChecking()
    {
        int? value = GetNullableValue();

        // HasValue property
        if (value.HasValue)
        {
            int actualValue = value.Value;
            Console.WriteLine(actualValue);
        }

        // Comparison with null
        if (value != null)
        {
            Console.WriteLine(value.Value);
        }

        // Null-conditional operator
        int? doubled = value?.GetHashCode();
    }

    // Getting values
    public void GettingValues()
    {
        int? value = 42;

        // Value property (throws if null)
        int val1 = value.Value;

        // GetValueOrDefault
        int val2 = value.GetValueOrDefault();  // Returns 0 if null
        int val3 = value.GetValueOrDefault(10); // Returns 10 if null

        // Null-coalescing operator
        int val4 = value ?? 0;  // Returns 0 if null
    }

    // Nullable in expressions
    public void NullableExpressions()
    {
        int? a = 10;
        int? b = 20;
        int? c = null;

        // Arithmetic (null if any operand is null)
        int? sum1 = a + b;  // 30
        int? sum2 = a + c;  // null

        // Comparison
        bool? equal = a == b;  // false
        bool? greater = a > c;  // null

        // Logical operators
        bool? and = (a > 5) & (c > 5);  // null
    }

    // Nullable structs
    public struct Point
    {
        public int X { get; set; }
        public int Y { get; set; }
    }

    public void NullableStructs()
    {
        Point? point = null;

        if (point.HasValue)
        {
            int x = point.Value.X;
            int y = point.Value.Y;
        }

        // Null-conditional with structs
        int? x = point?.X;
    }

    private int? GetNullableValue() => null;
}
```

## Nullable Reference Types

C# 8.0+ provides nullable reference types, enabling compile-time null-safety
for reference types.

```csharp
#nullable enable

using System;
using System.Collections.Generic;

public class NullableReferenceTypes
{
    // Non-nullable by default
    public string Name { get; set; } = string.Empty;

    // Explicitly nullable
    public string? MiddleName { get; set; }

    // Constructor
    public NullableReferenceTypes(string name, string? middleName = null)
    {
        Name = name;  // Must be non-null
        MiddleName = middleName;  // Can be null
    }

    // Method with nullable parameters
    public string FormatName(string firstName, string? middleName,
                            string lastName)
    {
        // Compiler warns if middleName used without null check
        if (middleName != null)
        {
            return $"{firstName} {middleName} {lastName}";
        }

        return $"{firstName} {lastName}";
    }

    // Nullable return type
    public string? FindPerson(int id)
    {
        // May return null
        return id > 0 ? "Found" : null;
    }

    // Collections of nullable types
    public void CollectionExamples()
    {
        // List of non-null strings
        List<string> names = new List<string> { "Alice", "Bob" };

        // List of nullable strings
        List<string?> nullableNames = new List<string?>
        {
            "Alice", null, "Charlie"
        };

        // Dictionary with nullable values
        Dictionary<string, string?> dict =
            new Dictionary<string, string?>
            {
                { "key1", "value1" },
                { "key2", null }
            };
    }

    // Nullable generic types
    public T? FindById<T>(int id) where T : class
    {
        // Returns null if not found
        return default(T);
    }

    // Not-null assertion operator
    public void NotNullAssertion()
    {
        string? maybeName = GetName();

        // Tell compiler this won't be null (use with caution!)
        string name = maybeName!;
    }

    private string? GetName() => null;
}
```

## Null-Coalescing Operators

Null-coalescing operators provide concise null handling.

```csharp
#nullable enable

using System;
using System.Collections.Generic;

public class NullCoalescingOperators
{
    // Null-coalescing operator (??)
    public string GetDisplayName(string? name)
    {
        // Returns "Unknown" if name is null
        return name ?? "Unknown";
    }

    // Chaining
    public string GetFirstNonNull(string? a, string? b, string? c)
    {
        return a ?? b ?? c ?? "Default";
    }

    // Null-coalescing assignment (??=)
    public void NullCoalescingAssignment()
    {
        string? name = null;

        // Assign only if null
        name ??= "Default Name";  // name is now "Default Name"

        name ??= "Another Name";  // name stays "Default Name"
    }

    // With collections
    public void CollectionCoalescing()
    {
        List<string>? list = null;

        // Initialize if null
        list ??= new List<string>();

        // Add items
        list.Add("item");
    }

    // In property initialization
    private List<string>? _items;
    public List<string> Items => _items ??= new List<string>();

    // Complex expressions
    public string ComplexCoalescing(User? user)
    {
        // Multiple levels
        return user?.Profile?.DisplayName ??
               user?.Email ??
               "Guest";
    }

    public class User
    {
        public Profile? Profile { get; set; }
        public string? Email { get; set; }
    }

    public class Profile
    {
        public string? DisplayName { get; set; }
    }
}
```

## Null-Conditional Operator

The null-conditional operator safely accesses members and calls methods on
potentially null references.

```csharp
#nullable enable

using System;
using System.Collections.Generic;

public class NullConditionalOperator
{
    public class Person
    {
        public string Name { get; set; } = string.Empty;
        public Address? Address { get; set; }
        public List<string>? PhoneNumbers { get; set; }
    }

    public class Address
    {
        public string City { get; set; } = string.Empty;
        public string? PostalCode { get; set; }
    }

    // Basic null-conditional
    public string? GetCity(Person? person)
    {
        // Returns null if person or Address is null
        return person?.Address?.City;
    }

    // With indexers
    public string? GetFirstPhone(Person? person)
    {
        // Returns null if person, PhoneNumbers is null, or empty
        return person?.PhoneNumbers?[0];
    }

    // With method calls
    public int? GetNameLength(Person? person)
    {
        return person?.Name.Length;
    }

    // Combining operators
    public string GetCityOrDefault(Person? person)
    {
        return person?.Address?.City ?? "Unknown";
    }

    // With arrays
    public string? GetFirstItem(string[]? items)
    {
        return items?[0];
    }

    // With delegates
    public void InvokeCallback(Action? callback)
    {
        callback?.Invoke();
    }

    // With events
    public event EventHandler? DataChanged;

    public void OnDataChanged()
    {
        DataChanged?.Invoke(this, EventArgs.Empty);
    }

    // Chaining multiple operations
    public void ChainedOperations(Person? person)
    {
        string? result = person?
            .Address?
            .City
            .ToUpper()
            .Substring(0, 3);
    }
}
```

## Null Handling Patterns

Common patterns for safely handling null values.

```csharp
#nullable enable

using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;

public class NullHandlingPatterns
{
    // Null object pattern
    public interface ILogger
    {
        void Log(string message);
    }

    public class ConsoleLogger : ILogger
    {
        public void Log(string message) =>
            Console.WriteLine(message);
    }

    public class NullLogger : ILogger
    {
        public void Log(string message) { }
    }

    // Guard clauses
    public void ProcessData(string? data)
    {
        if (data == null)
        {
            throw new ArgumentNullException(nameof(data));
        }

        // data is non-null here
        Console.WriteLine(data.Length);
    }

    // Early return
    public string FormatData(string? data)
    {
        if (data == null) return string.Empty;

        return data.ToUpper();
    }

    // TryGet pattern
    public bool TryGetValue(string key, [NotNullWhen(true)] out string? value)
    {
        // Simulate lookup
        if (key == "valid")
        {
            value = "Found";
            return true;
        }

        value = null;
        return false;
    }

    public void UseTryGet()
    {
        if (TryGetValue("valid", out string? result))
        {
            // result is guaranteed non-null here
            Console.WriteLine(result.Length);
        }
    }

    // MemberNotNull attribute
    private string? _cachedValue;

    [MemberNotNull(nameof(_cachedValue))]
    private void EnsureCacheLoaded()
    {
        _cachedValue ??= LoadValue();
    }

    public void UseCache()
    {
        EnsureCacheLoaded();
        // _cachedValue is guaranteed non-null
        Console.WriteLine(_cachedValue.Length);
    }

    // NotNullIfNotNull attribute
    [return: NotNullIfNotNull(nameof(input))]
    public string? Transform(string? input)
    {
        return input?.ToUpper();
    }

    // AllowNull and DisallowNull
    private string _name = string.Empty;

    [AllowNull]
    public string Name
    {
        get => _name;
        set => _name = value ?? string.Empty;
    }

    private string LoadValue() => "loaded";
}
```

## Nullable Annotations

Attributes that provide additional null-state information to the compiler.

```csharp
#nullable enable

using System.Diagnostics.CodeAnalysis;
using System.Collections.Generic;

public class NullableAnnotations
{
    // NotNull - parameter won't be null when method returns
    public void Initialize([NotNull] ref string? value)
    {
        value ??= "default";
    }

    // MaybeNull - return may be null despite non-nullable type
    [return: MaybeNull]
    public T GetDefaultValue<T>()
    {
        return default(T);
    }

    // DoesNotReturn - method never returns normally
    [DoesNotReturn]
    public void ThrowError(string message)
    {
        throw new System.InvalidOperationException(message);
    }

    public void UseDoesNotReturn(string? value)
    {
        if (value == null)
        {
            ThrowError("Value is null");
        }

        // Compiler knows value is not null here
        System.Console.WriteLine(value.Length);
    }

    // MemberNotNullWhen
    private string? _data;

    [MemberNotNullWhen(true, nameof(_data))]
    private bool IsDataLoaded()
    {
        return _data != null;
    }

    public void UseData()
    {
        if (IsDataLoaded())
        {
            // _data is guaranteed non-null
            System.Console.WriteLine(_data.Length);
        }
    }

    // NotNullIfNotNull
    [return: NotNullIfNotNull(nameof(source))]
    public string? ProcessString(string? source)
    {
        return source?.Trim();
    }
}
```

## Migration Strategies

Strategies for adopting nullable reference types in existing code.

```csharp
// Gradual migration approach

// File 1: Keep nullability disabled
#nullable disable

public class LegacyClass
{
    public string Name { get; set; }  // Implicitly nullable
}

#nullable restore

// File 2: Enable nullability for new code
#nullable enable

public class ModernClass
{
    public string Name { get; set; } = string.Empty;  // Non-nullable
    public string? MiddleName { get; set; }  // Explicitly nullable
}

#nullable restore

// File 3: Suppress warnings during migration
#nullable enable

public class MigratingClass
{
    // Suppress specific warnings
    #pragma warning disable CS8618
    public string Name { get; set; }
    #pragma warning restore CS8618

    // Or use ! operator temporarily
    public string GetName() => Name!;
}
```

## Working with External Libraries

Handling nullability when working with libraries that don't use nullable
annotations.

```csharp
#nullable enable

using System;

public class ExternalLibraryHandling
{
    // Assume external library method
    // public string GetData() { ... }

    // Defensive programming
    public void UseExternalLibrary()
    {
        // Treat return as potentially null
        string? data = GetExternalData();

        if (data != null)
        {
            ProcessData(data);
        }
    }

    // Create wrappers
    public string? GetExternalDataSafe()
    {
        string result = GetExternalData();
        return string.IsNullOrEmpty(result) ? null : result;
    }

    // Extension methods for safety
    public static class StringExtensions
    {
        public static string OrEmpty(this string? value)
        {
            return value ?? string.Empty;
        }

        public static bool IsNullOrEmpty(
            [NotNullWhen(false)] this string? value)
        {
            return string.IsNullOrEmpty(value);
        }
    }

    private string GetExternalData() => "data";
    private void ProcessData(string data) { }
}
```

## Best Practices

1. Enable nullable reference types in new projects from the start
2. Use `string?` for optional string parameters and return values
3. Initialize non-nullable properties in constructors or with default values
4. Prefer null-coalescing operators over explicit null checks
5. Use `NotNullWhen` attribute for `TryGet` pattern methods
6. Validate arguments early with guard clauses
7. Use `ThrowIfNull` helper for parameter validation
8. Avoid using `!` operator unless absolutely certain value is non-null
9. Leverage compiler warnings to find potential null reference issues
10. Document nullability expectations in public APIs

## Common Pitfalls

1. Using `!` operator to silence warnings without ensuring non-null
2. Not initializing non-nullable properties in all constructors
3. Returning null from methods declared with non-nullable return types
4. Forgetting to check for null before dereferencing nullable references
5. Mixing nullable and non-nullable contexts causing confusion
6. Over-using nullable types when default values would suffice
7. Not propagating null checks through method chains
8. Assuming external library methods respect nullability
9. Ignoring nullable warnings during migration
10. Using `#pragma warning disable` too broadly

## When to Use Nullable Types

Use nullable types when you need:

- Representing the absence of a value distinctly from default value
- Database fields that can be NULL mapped to C# properties
- Optional parameters in methods and constructors
- API responses that may or may not contain data
- Preventing null reference exceptions at compile time
- Gradual migration of legacy code to null-safe patterns
- Clear contracts about which values can be null
- Type-safe handling of optional configuration values
- Integration with external APIs that may return null
- Functional programming patterns with Option/Maybe types

## Resources

- [Nullable Reference Types](https://docs.microsoft.com/en-us/dotnet/csharp/nullable-references)
- [Nullable Attributes](https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/attributes/nullable-analysis)
- [Migrating to Nullable References](https://docs.microsoft.com/en-us/dotnet/csharp/nullable-migration-strategies)
- [C# Null Safety](https://docs.microsoft.com/en-us/dotnet/csharp/programming-guide/nullable-types/)
