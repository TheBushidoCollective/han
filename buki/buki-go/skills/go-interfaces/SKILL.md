---
name: go-interfaces
description: Use when Go interfaces including interface design, duck typing, and composition patterns. Use when designing Go APIs and abstractions.
allowed-tools:
  - Bash
  - Read
---

# Go Interfaces

Master Go's interface system for creating flexible, decoupled code through
implicit implementation and composition patterns.

## Basic Interfaces

**Defining and implementing interfaces:**

```go
package main

import "fmt"

// Define interface
type Writer interface {
    Write(p []byte) (n int, err error)
}

// Implement interface (implicit)
type ConsoleWriter struct{}

func (cw ConsoleWriter) Write(p []byte) (n int, err error) {
    fmt.Print(string(p))
    return len(p), nil
}

func main() {
    var w Writer = ConsoleWriter{}
    w.Write([]byte("Hello, World!\n"))
}
```

**Multiple methods in interface:**

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type ReadWriter interface {
    Read(p []byte) (n int, err error)
    Write(p []byte) (n int, err error)
}

// Implement ReadWriter
type File struct {
    name string
}

func (f *File) Read(p []byte) (n int, err error) {
    // Implementation
    return 0, nil
}

func (f *File) Write(p []byte) (n int, err error) {
    // Implementation
    return len(p), nil
}
```

## Empty Interface

**Using interface{} (any in Go 1.18+):**

```go
// Accepts any type
func printValue(v interface{}) {
    fmt.Println(v)
}

// Modern syntax (Go 1.18+)
func printAny(v any) {
    fmt.Println(v)
}

func main() {
    printValue(42)
    printValue("hello")
    printValue(true)

    printAny(3.14)
}
```

**Type assertions:**

```go
func processValue(v interface{}) {
    // Type assertion
    if str, ok := v.(string); ok {
        fmt.Println("String:", str)
    }

    // Type switch
    switch val := v.(type) {
    case int:
        fmt.Println("Integer:", val)
    case string:
        fmt.Println("String:", val)
    case bool:
        fmt.Println("Boolean:", val)
    default:
        fmt.Println("Unknown type")
    }
}
```

## Interface Composition

**Embedding interfaces:**

```go
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

type Closer interface {
    Close() error
}

// Compose interfaces
type ReadWriter interface {
    Reader
    Writer
}

type ReadWriteCloser interface {
    Reader
    Writer
    Closer
}

// Standard library example
import "io"

func useReadWriteCloser(rwc io.ReadWriteCloser) {
    // Can call Read, Write, and Close
    rwc.Write([]byte("data"))
    rwc.Close()
}
```

## Common Interfaces

**Standard library interfaces:**

```go
// Stringer interface
type Stringer interface {
    String() string
}

type Person struct {
    Name string
    Age  int
}

func (p Person) String() string {
    return fmt.Sprintf("%s (%d years old)", p.Name, p.Age)
}

// error interface
type error interface {
    Error() string
}

type MyError struct {
    Message string
}

func (e MyError) Error() string {
    return e.Message
}

// sort.Interface
type Interface interface {
    Len() int
    Less(i, j int) bool
    Swap(i, j int)
}

type ByAge []Person

func (a ByAge) Len() int           { return len(a) }
func (a ByAge) Less(i, j int) bool { return a[i].Age < a[j].Age }
func (a ByAge) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
```

## Interface Design Patterns

**Small interfaces:**

```go
// Good: small, focused interfaces
type Getter interface {
    Get(key string) (value string, exists bool)
}

type Setter interface {
    Set(key, value string)
}

type Deleter interface {
    Delete(key string)
}

// Compose as needed
type Cache interface {
    Getter
    Setter
    Deleter
}
```

**Accept interfaces, return structs:**

```go
// Accept interface parameter
func processReader(r io.Reader) error {
    data, err := io.ReadAll(r)
    if err != nil {
        return err
    }
    fmt.Println(string(data))
    return nil
}

// Return concrete type
func newConfig() *Config {
    return &Config{
        Host: "localhost",
        Port: 8080,
    }
}

type Config struct {
    Host string
    Port int
}
```

## Nil Interfaces

**Understanding nil interfaces:**

```go
func checkNil() {
    var i interface{}
    fmt.Println(i == nil) // true

    var p *Person
    i = p
    fmt.Println(i == nil) // false! (type is set, value is nil)

    // Proper nil check
    v, ok := i.(*Person)
    fmt.Println(v == nil, ok) // true, true
}
```

## Interface Satisfaction

**Checking interface implementation:**

```go
// Compile-time check
var _ io.Writer = (*MyWriter)(nil)
var _ io.Reader = (*MyReader)(nil)

type MyWriter struct{}

func (w *MyWriter) Write(p []byte) (n int, err error) {
    return len(p), nil
}

// If MyWriter doesn't implement Writer, compilation fails
```

## Duck Typing

**Implicit interface satisfaction:**

```go
// No explicit "implements" keyword needed
type Duck interface {
    Quack()
    Walk()
}

type RealDuck struct{}

func (d RealDuck) Quack() {
    fmt.Println("Quack!")
}

func (d RealDuck) Walk() {
    fmt.Println("Waddle waddle")
}

type Robot struct{}

func (r Robot) Quack() {
    fmt.Println("Beep boop quack")
}

func (r Robot) Walk() {
    fmt.Println("*mechanical walking sounds*")
}

func makeDuckDoThings(d Duck) {
    d.Quack()
    d.Walk()
}

func main() {
    makeDuckDoThings(RealDuck{})
    makeDuckDoThings(Robot{})
}
```

## Polymorphism

**Using interfaces for polymorphism:**

```go
type Shape interface {
    Area() float64
    Perimeter() float64
}

type Rectangle struct {
    Width, Height float64
}

func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}

func (r Rectangle) Perimeter() float64 {
    return 2 * (r.Width + r.Height)
}

type Circle struct {
    Radius float64
}

func (c Circle) Area() float64 {
    return 3.14159 * c.Radius * c.Radius
}

func (c Circle) Perimeter() float64 {
    return 2 * 3.14159 * c.Radius
}

func printShapeInfo(s Shape) {
    fmt.Printf("Area: %.2f, Perimeter: %.2f\n",
        s.Area(), s.Perimeter())
}

func main() {
    shapes := []Shape{
        Rectangle{Width: 10, Height: 5},
        Circle{Radius: 7},
    }

    for _, shape := range shapes {
        printShapeInfo(shape)
    }
}
```

## Dependency Injection

**Using interfaces for testability:**

```go
// Define interface for dependency
type UserRepository interface {
    GetUser(id int) (*User, error)
    SaveUser(user *User) error
}

// Production implementation
type PostgresUserRepo struct {
    db *sql.DB
}

func (r *PostgresUserRepo) GetUser(id int) (*User, error) {
    // Database query
    return &User{}, nil
}

func (r *PostgresUserRepo) SaveUser(user *User) error {
    // Database insert/update
    return nil
}

// Test implementation
type MockUserRepo struct {
    users map[int]*User
}

func (m *MockUserRepo) GetUser(id int) (*User, error) {
    user, exists := m.users[id]
    if !exists {
        return nil, errors.New("user not found")
    }
    return user, nil
}

func (m *MockUserRepo) SaveUser(user *User) error {
    m.users[user.ID] = user
    return nil
}

// Service depends on interface, not concrete type
type UserService struct {
    repo UserRepository
}

func (s *UserService) GetUserName(id int) (string, error) {
    user, err := s.repo.GetUser(id)
    if err != nil {
        return "", err
    }
    return user.Name, nil
}

type User struct {
    ID   int
    Name string
}
```

## Builder Pattern with Interfaces

**Fluent interface pattern:**

```go
type QueryBuilder interface {
    Select(fields ...string) QueryBuilder
    From(table string) QueryBuilder
    Where(condition string) QueryBuilder
    Build() string
}

type sqlQueryBuilder struct {
    selectFields []string
    fromTable    string
    whereClause  string
}

func NewQueryBuilder() QueryBuilder {
    return &sqlQueryBuilder{}
}

func (b *sqlQueryBuilder) Select(fields ...string) QueryBuilder {
    b.selectFields = fields
    return b
}

func (b *sqlQueryBuilder) From(table string) QueryBuilder {
    b.fromTable = table
    return b
}

func (b *sqlQueryBuilder) Where(condition string) QueryBuilder {
    b.whereClause = condition
    return b
}

func (b *sqlQueryBuilder) Build() string {
    query := "SELECT " + strings.Join(b.selectFields, ", ")
    query += " FROM " + b.fromTable
    if b.whereClause != "" {
        query += " WHERE " + b.whereClause
    }
    return query
}

func main() {
    query := NewQueryBuilder().
        Select("id", "name", "email").
        From("users").
        Where("age > 18").
        Build()

    fmt.Println(query)
}
```

## Strategy Pattern

**Implementing strategy pattern:**

```go
type PaymentStrategy interface {
    Pay(amount float64) error
}

type CreditCardPayment struct {
    CardNumber string
}

func (c *CreditCardPayment) Pay(amount float64) error {
    fmt.Printf("Paying %.2f with credit card %s\n",
        amount, c.CardNumber)
    return nil
}

type PayPalPayment struct {
    Email string
}

func (p *PayPalPayment) Pay(amount float64) error {
    fmt.Printf("Paying %.2f via PayPal to %s\n",
        amount, p.Email)
    return nil
}

type ShoppingCart struct {
    paymentMethod PaymentStrategy
}

func (cart *ShoppingCart) SetPaymentMethod(pm PaymentStrategy) {
    cart.paymentMethod = pm
}

func (cart *ShoppingCart) Checkout(amount float64) error {
    return cart.paymentMethod.Pay(amount)
}

func main() {
    cart := &ShoppingCart{}

    cart.SetPaymentMethod(&CreditCardPayment{CardNumber: "1234-5678"})
    cart.Checkout(100.00)

    cart.SetPaymentMethod(&PayPalPayment{Email: "user@example.com"})
    cart.Checkout(50.00)
}
```

## Adapter Pattern

**Adapting interfaces:**

```go
// Third-party logger
type ThirdPartyLogger struct{}

func (t *ThirdPartyLogger) LogMessage(msg string, level int) {
    fmt.Printf("[Level %d] %s\n", level, msg)
}

// Our application interface
type Logger interface {
    Info(msg string)
    Error(msg string)
}

// Adapter
type LoggerAdapter struct {
    thirdParty *ThirdPartyLogger
}

func (a *LoggerAdapter) Info(msg string) {
    a.thirdParty.LogMessage(msg, 0)
}

func (a *LoggerAdapter) Error(msg string) {
    a.thirdParty.LogMessage(msg, 2)
}

func useLogger(logger Logger) {
    logger.Info("Application started")
    logger.Error("An error occurred")
}

func main() {
    adapter := &LoggerAdapter{
        thirdParty: &ThirdPartyLogger{},
    }
    useLogger(adapter)
}
```

## When to Use This Skill

Use go-interfaces when you need to:

- Define contracts for behavior without implementation
- Enable polymorphism and code reuse
- Create testable code with dependency injection
- Implement design patterns (strategy, adapter, etc.)
- Build plugin systems or extensible architectures
- Decouple components in large applications
- Mock dependencies in tests
- Follow SOLID principles in Go
- Create flexible, maintainable APIs
- Support multiple implementations of same behavior

## Best Practices

- Keep interfaces small and focused (1-3 methods)
- Accept interfaces, return concrete types
- Define interfaces where they're used, not implemented
- Use interface composition for complex interfaces
- Don't use empty interface unless absolutely necessary
- Verify interface implementation at compile time
- Document expected behavior in interface comments
- Prefer many small interfaces over large ones
- Use standard library interfaces when applicable
- Name interfaces with -er suffix (Reader, Writer, etc.)

## Common Pitfalls

- Making interfaces too large or generic
- Defining unused interfaces "just in case"
- Returning interfaces instead of concrete types
- Not checking for nil interface values properly
- Over-abstracting simple code
- Forgetting that interfaces are satisfied implicitly
- Using empty interface excessively
- Not documenting interface contracts
- Creating interfaces for single implementation
- Confusing nil value vs nil interface

## Resources

- [Effective Go - Interfaces](https://go.dev/doc/effective_go#interfaces)
- [Go Blog - Laws of Reflection](https://go.dev/blog/laws-of-reflection)
- [Interface Documentation](https://go.dev/ref/spec#Interface_types)
- [Go by Example - Interfaces](https://gobyexample.com/interfaces)
- [Accept Interfaces, Return Structs](https://bryanftan.medium.com/accept-interfaces-return-structs-in-go-d4cab29a301b)
