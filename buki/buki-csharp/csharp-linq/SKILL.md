---
name: csharp-linq
description: Use when lINQ (Language Integrated Query) with query and method syntax, deferred execution, expression trees, and performance optimization.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
---

# C# LINQ

LINQ (Language Integrated Query) provides a consistent query experience across
different data sources including collections, databases, XML, and more. It
combines the power of SQL-like queries with C# type safety and IntelliSense
support, enabling expressive and maintainable data manipulation code.

## Query Syntax

Query syntax provides SQL-like syntax for querying data sources, compiled to
method calls at compile time.

```csharp
using System;
using System.Collections.Generic;
using System.Linq;

public class QuerySyntaxExamples
{
    public record Person(string Name, int Age, string City);

    // Basic query
    public IEnumerable<Person> BasicQuery(List<Person> people)
    {
        var query = from p in people
                    where p.Age >= 18
                    select p;

        return query;
    }

    // Query with multiple conditions
    public IEnumerable<Person> MultipleConditions(List<Person> people)
    {
        var query = from p in people
                    where p.Age >= 18 && p.City == "Seattle"
                    orderby p.Name
                    select p;

        return query;
    }

    // Projection with select
    public IEnumerable<string> ProjectNames(List<Person> people)
    {
        var query = from p in people
                    where p.Age >= 21
                    select p.Name;

        return query;
    }

    // Anonymous types
    public IEnumerable<object> AnonymousProjection(List<Person> people)
    {
        var query = from p in people
                    select new
                    {
                        p.Name,
                        p.Age,
                        IsAdult = p.Age >= 18
                    };

        return query;
    }

    // Grouping
    public IEnumerable<IGrouping<string, Person>> GroupByCity(
        List<Person> people)
    {
        var query = from p in people
                    group p by p.City;

        return query;
    }

    // Group with projection
    public IEnumerable<object> GroupWithProjection(List<Person> people)
    {
        var query = from p in people
                    group p by p.City into cityGroup
                    select new
                    {
                        City = cityGroup.Key,
                        Count = cityGroup.Count(),
                        AverageAge = cityGroup.Average(p => p.Age)
                    };

        return query;
    }

    // Join
    public record Order(int Id, string PersonName, decimal Amount);

    public IEnumerable<object> JoinExample(
        List<Person> people,
        List<Order> orders)
    {
        var query = from p in people
                    join o in orders on p.Name equals o.PersonName
                    select new
                    {
                        p.Name,
                        p.Age,
                        OrderAmount = o.Amount
                    };

        return query;
    }

    // Left join
    public IEnumerable<object> LeftJoin(
        List<Person> people,
        List<Order> orders)
    {
        var query = from p in people
                    join o in orders on p.Name equals o.PersonName
                    into personOrders
                    from po in personOrders.DefaultIfEmpty()
                    select new
                    {
                        p.Name,
                        OrderAmount = po?.Amount ?? 0
                    };

        return query;
    }
}
```

## Method Syntax

Method syntax uses extension methods for querying, providing more flexibility
and access to all LINQ operators.

```csharp
using System;
using System.Collections.Generic;
using System.Linq;

public class MethodSyntaxExamples
{
    public record Product(string Name, decimal Price, string Category);

    // Filtering
    public IEnumerable<Product> FilterProducts(List<Product> products)
    {
        return products
            .Where(p => p.Price > 100)
            .Where(p => p.Category == "Electronics");
    }

    // Ordering
    public IEnumerable<Product> OrderProducts(List<Product> products)
    {
        return products
            .OrderBy(p => p.Category)
            .ThenByDescending(p => p.Price);
    }

    // Projection
    public IEnumerable<string> ProjectNames(List<Product> products)
    {
        return products
            .Select(p => p.Name.ToUpper());
    }

    // SelectMany (flatten)
    public IEnumerable<int> FlattenLists()
    {
        var lists = new List<List<int>>
        {
            new List<int> { 1, 2, 3 },
            new List<int> { 4, 5 },
            new List<int> { 6, 7, 8, 9 }
        };

        return lists.SelectMany(list => list);
    }

    // Grouping
    public IEnumerable<IGrouping<string, Product>> GroupByCategory(
        List<Product> products)
    {
        return products.GroupBy(p => p.Category);
    }

    // Aggregation
    public void AggregationExamples(List<Product> products)
    {
        decimal total = products.Sum(p => p.Price);
        decimal average = products.Average(p => p.Price);
        decimal max = products.Max(p => p.Price);
        decimal min = products.Min(p => p.Price);
        int count = products.Count();
        int expensiveCount = products.Count(p => p.Price > 500);
    }

    // Any and All
    public void ExistenceChecks(List<Product> products)
    {
        bool hasExpensive = products.Any(p => p.Price > 1000);
        bool allAffordable = products.All(p => p.Price < 100);
        bool hasElectronics = products.Any(p =>
            p.Category == "Electronics");
    }

    // Take and Skip
    public IEnumerable<Product> Pagination(
        List<Product> products,
        int page,
        int pageSize)
    {
        return products
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize);
    }

    // Distinct
    public IEnumerable<string> UniqueCategories(List<Product> products)
    {
        return products
            .Select(p => p.Category)
            .Distinct();
    }

    // Set operations
    public void SetOperations(
        List<Product> products1,
        List<Product> products2)
    {
        var union = products1.Union(products2);
        var intersect = products1.Intersect(products2);
        var except = products1.Except(products2);
    }
}
```

## Deferred Execution

LINQ queries use deferred execution, meaning the query executes when
enumerated, not when defined.

```csharp
using System;
using System.Collections.Generic;
using System.Linq;

public class DeferredExecutionExamples
{
    // Deferred execution demonstration
    public void DeferredExecutionDemo()
    {
        var numbers = new List<int> { 1, 2, 3, 4, 5 };

        // Query defined but not executed
        var query = numbers.Where(n => n > 2);

        Console.WriteLine("Before modification:");
        foreach (var n in query)  // Executes here
        {
            Console.WriteLine(n);  // 3, 4, 5
        }

        // Modify source
        numbers.Add(6);
        numbers.Add(7);

        Console.WriteLine("After modification:");
        foreach (var n in query)  // Executes again with new data
        {
            Console.WriteLine(n);  // 3, 4, 5, 6, 7
        }
    }

    // Immediate execution with ToList
    public void ImmediateExecution()
    {
        var numbers = new List<int> { 1, 2, 3, 4, 5 };

        // Execute immediately and cache results
        var list = numbers.Where(n => n > 2).ToList();

        numbers.Add(6);
        numbers.Add(7);

        // list still contains only 3, 4, 5
        foreach (var n in list)
        {
            Console.WriteLine(n);
        }
    }

    // Operators that force immediate execution
    public void ImmediateExecutionOperators()
    {
        var numbers = new List<int> { 1, 2, 3, 4, 5 };

        // These execute immediately
        var array = numbers.Where(n => n > 2).ToArray();
        var dict = numbers.ToDictionary(n => n, n => n * 2);
        var hashSet = numbers.ToHashSet();
        var lookup = numbers.ToLookup(n => n % 2);

        // Aggregates execute immediately
        int count = numbers.Count(n => n > 2);
        int sum = numbers.Sum();
        int max = numbers.Max();
        bool any = numbers.Any(n => n > 10);
    }

    // Multiple enumeration issue
    public void MultipleEnumeration()
    {
        var numbers = GetNumbers();  // IEnumerable

        // Bad: enumerates twice
        int count = numbers.Count();
        int sum = numbers.Sum();

        // Good: enumerate once, cache
        var list = numbers.ToList();
        count = list.Count;
        sum = list.Sum();
    }

    private IEnumerable<int> GetNumbers()
    {
        Console.WriteLine("Generating numbers...");
        for (int i = 1; i <= 5; i++)
        {
            yield return i;
        }
    }
}
```

## Complex Queries

Combining multiple LINQ operations for complex data transformations.

```csharp
using System;
using System.Collections.Generic;
using System.Linq;

public class ComplexQueries
{
    public record Student(string Name, int Grade, string Subject,
                          int Score);
    public record Course(string Subject, string Teacher, int Credits);

    // Complex filtering and projection
    public IEnumerable<object> StudentReport(
        List<Student> students,
        List<Course> courses)
    {
        return students
            .Where(s => s.Grade >= 10)
            .GroupBy(s => new { s.Name, s.Grade })
            .Select(g => new
            {
                g.Key.Name,
                g.Key.Grade,
                Subjects = g.Select(s => s.Subject).Distinct(),
                AverageScore = g.Average(s => s.Score),
                TotalCredits = g.Join(
                    courses,
                    s => s.Subject,
                    c => c.Subject,
                    (s, c) => c.Credits
                ).Sum()
            })
            .OrderByDescending(s => s.AverageScore);
    }

    // Nested queries
    public IEnumerable<object> TopStudentsBySubject(
        List<Student> students)
    {
        return students
            .GroupBy(s => s.Subject)
            .Select(g => new
            {
                Subject = g.Key,
                TopStudent = g
                    .OrderByDescending(s => s.Score)
                    .Select(s => new { s.Name, s.Score })
                    .FirstOrDefault(),
                ClassAverage = g.Average(s => s.Score)
            });
    }

    // Window functions
    public IEnumerable<object> RunningTotal(List<Student> students)
    {
        return students
            .OrderBy(s => s.Name)
            .ThenBy(s => s.Subject)
            .Select((s, index) => new
            {
                s.Name,
                s.Subject,
                s.Score,
                RunningTotal = students
                    .Take(index + 1)
                    .Sum(x => x.Score)
            });
    }

    // Hierarchical data
    public record Category(string Name, string Parent);

    public IEnumerable<object> BuildHierarchy(List<Category> categories)
    {
        return categories
            .Where(c => c.Parent == null)
            .Select(parent => new
            {
                parent.Name,
                Children = categories
                    .Where(c => c.Parent == parent.Name)
                    .Select(child => new
                    {
                        child.Name,
                        Grandchildren = categories
                            .Where(gc => gc.Parent == child.Name)
                    })
            });
    }
}
```

## Performance Optimization

Understanding LINQ performance characteristics and optimization techniques.

```csharp
using System;
using System.Collections.Generic;
using System.Linq;

public class PerformanceOptimization
{
    // Use Count property instead of Count() method
    public void CountOptimization(List<int> numbers)
    {
        // Slow: iterates entire collection
        int count1 = numbers.Where(n => n > 0).Count();

        // Fast: uses Count property if available
        int count2 = numbers.Count;

        // Use Any() instead of Count() for existence check
        bool hasItems = numbers.Any();  // Fast
        bool hasItems2 = numbers.Count() > 0;  // Slow
    }

    // Avoid multiple enumerations
    public void AvoidMultipleEnumerations()
    {
        var query = GetExpensiveQuery();

        // Bad: enumerates multiple times
        int count = query.Count();
        int sum = query.Sum();
        var first = query.First();

        // Good: enumerate once
        var list = query.ToList();
        count = list.Count;
        sum = list.Sum();
        first = list.First();
    }

    // Use Where before Select
    public IEnumerable<string> FilterBeforeProject(List<int> numbers)
    {
        // Good: filter first (fewer items to project)
        return numbers
            .Where(n => n > 100)
            .Select(n => n.ToString());

        // Bad: project all, then filter
        // return numbers
        //     .Select(n => n.ToString())
        //     .Where(s => int.Parse(s) > 100);
    }

    // Use FirstOrDefault instead of Where().First()
    public int? FindFirst(List<int> numbers)
    {
        // Good: stops at first match
        return numbers.FirstOrDefault(n => n > 100);

        // Bad: filters all, then takes first
        // return numbers.Where(n => n > 100).FirstOrDefault();
    }

    // Avoid unnecessary sorting
    public IEnumerable<int> TakeWithoutSort(List<int> numbers)
    {
        // If you only need top N, consider partial sort
        return numbers
            .OrderByDescending(n => n)
            .Take(10);

        // Better for large collections: use PriorityQueue or similar
    }

    // Use AsParallel for CPU-intensive operations
    public IEnumerable<int> ParallelQuery(List<int> numbers)
    {
        return numbers
            .AsParallel()
            .Where(n => ExpensiveOperation(n))
            .Select(n => n * 2);
    }

    private IEnumerable<int> GetExpensiveQuery()
    {
        return Enumerable.Range(1, 1000)
            .Where(n => n % 2 == 0);
    }

    private bool ExpensiveOperation(int n)
    {
        System.Threading.Thread.Sleep(1);
        return n > 50;
    }
}
```

## LINQ to Objects vs LINQ to SQL

Understanding differences between in-memory and database queries.

```csharp
using System;
using System.Collections.Generic;
using System.Linq;

public class LinqProviders
{
    public record Customer(int Id, string Name, string City);

    // LINQ to Objects (in-memory)
    public void LinqToObjects(List<Customer> customers)
    {
        // Executes in memory
        var query = customers
            .Where(c => c.City == "Seattle")
            .OrderBy(c => c.Name)
            .Select(c => new { c.Name, c.City });

        // Can use any C# method
        var withMethods = customers
            .Where(c => IsValidCity(c.City))
            .ToList();
    }

    // LINQ to SQL (database)
    public void LinqToSQL()
    {
        // In real application, this would be DbContext
        // var query = dbContext.Customers
        //     .Where(c => c.City == "Seattle")  // Translates to SQL
        //     .OrderBy(c => c.Name)
        //     .Select(c => new { c.Name, c.City });

        // Can't use arbitrary C# methods in SQL query
        // This would throw runtime error:
        // .Where(c => IsValidCity(c.City))

        // Use AsEnumerable() to switch to LINQ to Objects
        // var mixed = dbContext.Customers
        //     .Where(c => c.City == "Seattle")  // SQL
        //     .AsEnumerable()
        //     .Where(c => IsValidCity(c.City)); // In-memory
    }

    private bool IsValidCity(string city)
    {
        return !string.IsNullOrEmpty(city) && city.Length > 2;
    }
}
```

## Expression Trees

Understanding expression trees for advanced LINQ scenarios.

```csharp
using System;
using System.Linq.Expressions;

public class ExpressionTreeExamples
{
    // Building expression trees
    public void BuildExpressionTree()
    {
        // Manual expression tree
        ParameterExpression param = Expression.Parameter(typeof(int), "x");
        BinaryExpression body = Expression.Add(
            param,
            Expression.Constant(5)
        );
        Expression<Func<int, int>> expr =
            Expression.Lambda<Func<int, int>>(body, param);

        // Compile and execute
        Func<int, int> func = expr.Compile();
        int result = func(10);  // 15
    }

    // From lambda to expression
    public void LambdaToExpression()
    {
        // Expression tree from lambda
        Expression<Func<int, bool>> expr = x => x > 5;

        // Compile to delegate
        Func<int, bool> func = expr.Compile();
        bool result = func(10);  // true
    }

    // Analyzing expressions
    public void AnalyzeExpression()
    {
        Expression<Func<int, bool>> expr = x => x > 5;

        // Get parts
        var lambda = (LambdaExpression)expr;
        var body = (BinaryExpression)lambda.Body;
        var left = (ParameterExpression)body.Left;
        var right = (ConstantExpression)body.Right;

        Console.WriteLine($"Parameter: {left.Name}");
        Console.WriteLine($"Operator: {body.NodeType}");
        Console.WriteLine($"Constant: {right.Value}");
    }

    // Dynamic query building
    public Expression<Func<T, bool>> BuildPredicate<T>(
        string propertyName,
        object value)
    {
        ParameterExpression param = Expression.Parameter(typeof(T), "x");
        MemberExpression property = Expression.Property(param,
                                                        propertyName);
        ConstantExpression constant = Expression.Constant(value);
        BinaryExpression equal = Expression.Equal(property, constant);

        return Expression.Lambda<Func<T, bool>>(equal, param);
    }
}
```

## Best Practices

1. Use method syntax for complex queries with multiple operations
2. Use query syntax for queries that look more like SQL
3. Call `ToList()` or `ToArray()` when you need to enumerate multiple times
4. Use `Any()` instead of `Count() > 0` for existence checks
5. Filter with `Where()` before projecting with `Select()`
6. Use `FirstOrDefault()` instead of `Where().First()` when finding single item
7. Avoid `Select()` when you don't need to transform the data
8. Use `AsParallel()` only for CPU-intensive operations on large datasets
9. Be aware of deferred execution and when queries actually execute
10. Consider expression tree compilation cost for frequently-used queries

## Common Pitfalls

1. Multiple enumeration of `IEnumerable` causing performance issues
2. Using LINQ on database queries without understanding SQL translation
3. Calling `ToList()` too early, losing deferred execution benefits
4. Using `Count()` method instead of `Count` property on collections
5. Not disposing `IEnumerable` from database queries, leaking connections
6. Using LINQ for simple loops where foreach would be clearer
7. Excessive `AsParallel()` causing overhead instead of speedup
8. Capturing variables in lambda expressions causing unintended closures
9. Using `Select()` where `SelectMany()` is needed for flattening
10. Not understanding operator precedence in complex query expressions

## When to Use LINQ

Use LINQ when you need:

- Querying collections, databases, XML, or other data sources uniformly
- Expressive data transformation and filtering operations
- Type-safe queries with compile-time checking and IntelliSense
- Functional programming patterns for data manipulation
- Complex grouping, joining, and aggregation operations
- Declarative code that expresses intent clearly
- Integration with Entity Framework or other ORMs
- Composition of queries from reusable components
- Parallel processing of large datasets with PLINQ
- Consistent API across different data sources

## Resources

- [LINQ Documentation](https://docs.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/linq/)
- [101 LINQ Samples](https://docs.microsoft.com/en-us/samples/dotnet/try-samples/101-linq-samples/)
- [LINQ Performance Tips](https://docs.microsoft.com/en-us/dotnet/standard/linq/performance-linq-xml)
- [Expression Trees](https://docs.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/expression-trees/)
