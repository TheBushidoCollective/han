---
name: Scala Functional Patterns
description: Use when functional programming patterns in Scala including higher-order functions, immutability, pattern matching, algebraic data types, monads, for-comprehensions, and functional composition for building robust, type-safe applications.
allowed-tools: []
---

# Scala Functional Patterns

## Introduction

Scala uniquely blends object-oriented and functional programming paradigms,
enabling developers to leverage the best of both worlds. Functional programming
in Scala emphasizes immutability, pure functions, and composability, leading to
more predictable and maintainable code.

Core functional patterns in Scala include higher-order functions, immutable data
structures, pattern matching, algebraic data types (ADTs), monadic composition,
for-comprehensions, and type classes. These patterns enable elegant solutions to
complex problems while maintaining type safety.

This skill covers immutability principles, higher-order functions, pattern
matching, ADTs with sealed traits, Option and Either monads, for-comprehensions,
function composition, and functional error handling.

## Immutability and Pure Functions

Immutable data structures and pure functions form the foundation of functional
programming, ensuring predictable behavior and thread safety.

```scala
// Immutable case classes
case class User(
  id: Int,
  name: String,
  email: String,
  age: Int
)

// Copying with modifications
val user = User(1, "Alice", "alice@example.com", 30)
val updatedUser = user.copy(age = 31)

// Immutable collections
val numbers = List(1, 2, 3, 4, 5)
val doubled = numbers.map(_ * 2)  // Original list unchanged

// Pure functions (deterministic, no side effects)
def add(a: Int, b: Int): Int = a + b

def multiply(a: Int, b: Int): Int = a * b

def calculateTotal(price: Double, quantity: Int, discount: Double): Double = {
  val subtotal = price * quantity
  val discountAmount = subtotal * discount
  subtotal - discountAmount
}

// Impure function (side effect: logging)
def impureAdd(a: Int, b: Int): Int = {
  println(s"Adding $a and $b")  // Side effect
  a + b
}

// Separating pure logic from side effects
def pureCalculation(items: List[Double]): Double =
  items.sum

def displayResult(result: Double): Unit =
  println(s"Total: $result")

val items = List(10.0, 20.0, 30.0)
val total = pureCalculation(items)
displayResult(total)

// Immutable data transformations
case class Order(items: List[String], total: Double)

def addItem(order: Order, item: String, price: Double): Order =
  order.copy(
    items = order.items :+ item,
    total = order.total + price
  )

def applyDiscount(order: Order, percentage: Double): Order =
  order.copy(total = order.total * (1 - percentage))

// Composing immutable transformations
val order = Order(List("Book"), 25.0)
val finalOrder = applyDiscount(addItem(order, "Pen", 5.0), 0.1)

// Immutable builder pattern
case class PersonBuilder(
  name: Option[String] = None,
  age: Option[Int] = None,
  email: Option[String] = None
) {
  def withName(n: String): PersonBuilder = copy(name = Some(n))
  def withAge(a: Int): PersonBuilder = copy(age = Some(a))
  def withEmail(e: String): PersonBuilder = copy(email = Some(e))

  def build: Option[Person] = for {
    n <- name
    a <- age
    e <- email
  } yield Person(n, a, e)
}

case class Person(name: String, age: Int, email: String)

val person = PersonBuilder()
  .withName("Bob")
  .withAge(25)
  .withEmail("bob@example.com")
  .build
```

Immutability eliminates entire classes of bugs related to shared mutable state
and enables safe concurrent programming.

## Higher-Order Functions

Higher-order functions accept functions as parameters or return functions,
enabling powerful abstraction and code reuse.

```scala
// Functions as parameters
def applyOperation(x: Int, y: Int, op: (Int, Int) => Int): Int =
  op(x, y)

val sum = applyOperation(5, 3, (a, b) => a + b)
val product = applyOperation(5, 3, (a, b) => a * b)

// Functions as return values
def multiplyBy(factor: Int): Int => Int =
  (x: Int) => x * factor

val double = multiplyBy(2)
val triple = multiplyBy(3)

println(double(5))  // 10
println(triple(5))  // 15

// Currying
def curriedAdd(a: Int)(b: Int): Int = a + b

val add5 = curriedAdd(5) _
println(add5(3))  // 8

// Partial application
def greet(greeting: String, name: String): String =
  s"$greeting, $name!"

val sayHello: String => String = greet("Hello", _)
println(sayHello("Alice"))  // Hello, Alice!

// Function composition
val addOne: Int => Int = _ + 1
val multiplyByTwo: Int => Int = _ * 2

val addThenMultiply = addOne andThen multiplyByTwo
val multiplyThenAdd = addOne compose multiplyByTwo

println(addThenMultiply(5))   // (5 + 1) * 2 = 12
println(multiplyThenAdd(5))   // (5 * 2) + 1 = 11

// Collection operations with higher-order functions
val numbers = List(1, 2, 3, 4, 5)

val squared = numbers.map(x => x * x)
val evens = numbers.filter(_ % 2 == 0)
val sum = numbers.reduce(_ + _)
val product = numbers.fold(1)(_ * _)

// FlatMap for nested transformations
val nested = List(List(1, 2), List(3, 4), List(5))
val flattened = nested.flatMap(identity)

val pairs = numbers.flatMap(x => numbers.map(y => (x, y)))

// Custom higher-order functions
def retry[T](times: Int)(operation: => T): Option[T] = {
  @scala.annotation.tailrec
  def attempt(remaining: Int): Option[T] = {
    if (remaining <= 0) None
    else {
      try {
        Some(operation)
      } catch {
        case _: Exception => attempt(remaining - 1)
      }
    }
  }
  attempt(times)
}

def withLogging[T](name: String)(operation: => T): T = {
  println(s"Starting $name")
  val result = operation
  println(s"Finished $name")
  result
}

// Measuring execution time
def timed[T](operation: => T): (T, Long) = {
  val start = System.nanoTime()
  val result = operation
  val elapsed = System.nanoTime() - start
  (result, elapsed / 1000000)  // Convert to milliseconds
}

val (result, time) = timed {
  (1 to 1000000).sum
}
println(s"Result: $result, Time: ${time}ms")
```

Higher-order functions enable powerful abstraction, allowing you to capture
common patterns and eliminate code duplication.

## Pattern Matching

Pattern matching provides elegant syntax for conditional logic and data
extraction, far more powerful than traditional switch statements.

```scala
// Basic pattern matching
def describe(x: Any): String = x match {
  case 0 => "zero"
  case 1 => "one"
  case i: Int => s"integer: $i"
  case s: String => s"string: $s"
  case _ => "unknown"
}

// Matching with guards
def classify(x: Int): String = x match {
  case n if n < 0 => "negative"
  case 0 => "zero"
  case n if n > 0 && n < 10 => "small positive"
  case n if n >= 10 => "large positive"
}

// Destructuring case classes
case class Point(x: Int, y: Int)

def locationDescription(point: Point): String = point match {
  case Point(0, 0) => "origin"
  case Point(0, y) => s"on Y-axis at $y"
  case Point(x, 0) => s"on X-axis at $x"
  case Point(x, y) if x == y => s"on diagonal at ($x, $y)"
  case Point(x, y) => s"at ($x, $y)"
}

// List pattern matching
def sumList(list: List[Int]): Int = list match {
  case Nil => 0
  case head :: tail => head + sumList(tail)
}

def describeList[T](list: List[T]): String = list match {
  case Nil => "empty"
  case _ :: Nil => "single element"
  case _ :: _ :: Nil => "two elements"
  case _ :: _ :: _ :: _ => "three or more elements"
}

// Variable binding in patterns
def processMessage(msg: Any): String = msg match {
  case s: String if s.length > 10 => s"Long string: ${s.take(10)}..."
  case s @ String => s"String: $s"
  case n @ (_: Int | _: Double) => s"Number: $n"
  case _ => "Unknown type"
}

// Option pattern matching
def getUserName(userId: Int): Option[String] = {
  if (userId > 0) Some(s"User$userId") else None
}

def displayUserName(userId: Int): String = getUserName(userId) match {
  case Some(name) => s"Welcome, $name"
  case None => "User not found"
}

// Either pattern matching
def divide(a: Int, b: Int): Either[String, Double] =
  if (b == 0) Left("Division by zero")
  else Right(a.toDouble / b)

def describeDivision(result: Either[String, Double]): String = result match {
  case Left(error) => s"Error: $error"
  case Right(value) => s"Result: $value"
}

// Tuple pattern matching
def processPair(pair: (String, Int)): String = pair match {
  case (name, age) if age < 18 => s"$name is a minor"
  case (name, age) => s"$name is $age years old"
}

// Nested pattern matching
sealed trait Tree[+T]
case class Leaf[T](value: T) extends Tree[T]
case class Branch[T](left: Tree[T], right: Tree[T]) extends Tree[T]

def depth[T](tree: Tree[T]): Int = tree match {
  case Leaf(_) => 1
  case Branch(left, right) => 1 + Math.max(depth(left), depth(right))
}

// Pattern matching in for-comprehensions
val tuples = List((1, "one"), (2, "two"), (3, "three"))

val result = for {
  (num, word) <- tuples
  if num % 2 != 0
} yield s"$num: $word"
```

Pattern matching makes code more readable and exhaustive, with the compiler
ensuring all cases are covered for sealed types.

## Algebraic Data Types (ADTs)

ADTs model data with sealed traits and case classes, enabling exhaustive pattern
matching and type-safe domain modeling.

```scala
// Simple ADT for results
sealed trait Result[+T]
case class Success[T](value: T) extends Result[T]
case class Failure(error: String) extends Result[Nothing]

def processResult[T](result: Result[T]): String = result match {
  case Success(value) => s"Success: $value"
  case Failure(error) => s"Failure: $error"
}

// ADT for payment methods
sealed trait PaymentMethod
case class CreditCard(number: String, cvv: String) extends PaymentMethod
case class PayPal(email: String) extends PaymentMethod
case class BankTransfer(accountNumber: String) extends PaymentMethod

def processPayment(method: PaymentMethod, amount: Double): String =
  method match {
  case CreditCard(number, _) => s"Charging $$${amount} to card ending in ${number.takeRight(4)}"
  case PayPal(email) => s"Charging $$${amount} via PayPal account $email"
  case BankTransfer(account) => s"Transferring $$${amount} from account $account"
}

// Recursive ADT for lists
sealed trait MyList[+T]
case object MyNil extends MyList[Nothing]
case class Cons[T](head: T, tail: MyList[T]) extends MyList[T]

def length[T](list: MyList[T]): Int = list match {
  case MyNil => 0
  case Cons(_, tail) => 1 + length(tail)
}

// ADT for expression trees
sealed trait Expr
case class Num(value: Double) extends Expr
case class Add(left: Expr, right: Expr) extends Expr
case class Multiply(left: Expr, right: Expr) extends Expr
case class Divide(left: Expr, right: Expr) extends Expr

def evaluate(expr: Expr): Either[String, Double] = expr match {
  case Num(value) => Right(value)
  case Add(left, right) => for {
    l <- evaluate(left)
    r <- evaluate(right)
  } yield l + r
  case Multiply(left, right) => for {
    l <- evaluate(left)
    r <- evaluate(right)
  } yield l * r
  case Divide(left, right) => for {
    l <- evaluate(left)
    r <- evaluate(right)
    result <- if (r != 0) Right(l / r) else Left("Division by zero")
  } yield result
}

// Example usage
val expr = Divide(Add(Num(10), Num(5)), Multiply(Num(3), Num(2)))
println(evaluate(expr))  // Right(2.5)

// ADT for JSON
sealed trait Json
case object JNull extends Json
case class JBoolean(value: Boolean) extends Json
case class JNumber(value: Double) extends Json
case class JString(value: String) extends Json
case class JArray(values: List[Json]) extends Json
case class JObject(fields: Map[String, Json]) extends Json

def stringify(json: Json): String = json match {
  case JNull => "null"
  case JBoolean(value) => value.toString
  case JNumber(value) => value.toString
  case JString(value) => s""""$value""""
  case JArray(values) => values.map(stringify).mkString("[", ",", "]")
  case JObject(fields) =>
    fields.map { case (k, v) => s""""$k":${stringify(v)}""" }
      .mkString("{", ",", "}")
}

// State machine with ADT
sealed trait ConnectionState
case object Disconnected extends ConnectionState
case object Connecting extends ConnectionState
case object Connected extends ConnectionState
case object Disconnecting extends ConnectionState

def transition(state: ConnectionState, event: String): ConnectionState =
  (state, event) match {
    case (Disconnected, "connect") => Connecting
    case (Connecting, "connected") => Connected
    case (Connected, "disconnect") => Disconnecting
    case (Disconnecting, "disconnected") => Disconnected
    case (current, _) => current  // Invalid transition
  }
```

ADTs provide exhaustive pattern matching guarantees and make illegal states
unrepresentable at compile time.

## Option and Either Monads

Option and Either provide functional error handling without exceptions, enabling
composable error handling.

```scala
// Option for nullable values
def findUser(id: Int): Option[User] =
  if (id > 0) Some(User(id, "Alice", "alice@example.com", 30))
  else None

// Option operations
val maybeUser = findUser(1)

val name = maybeUser.map(_.name).getOrElse("Unknown")
val email = maybeUser.flatMap(u => Some(u.email))

// Option chaining
def getAddress(user: User): Option[String] = Some("123 Main St")
def getCity(address: String): Option[String] = Some("Springfield")

val city = for {
  user <- findUser(1)
  address <- getAddress(user)
  city <- getCity(address)
} yield city

// Either for error handling
def parseInt(s: String): Either[String, Int] =
  try Right(s.toInt)
  catch { case _: NumberFormatException => Left(s"'$s' is not a valid integer") }

def divide(a: Int, b: Int): Either[String, Double] =
  if (b == 0) Left("Division by zero")
  else Right(a.toDouble / b)

// Either composition
def calculate(a: String, b: String): Either[String, Double] = for {
  x <- parseInt(a)
  y <- parseInt(b)
  result <- divide(x, y)
} yield result

println(calculate("10", "2"))   // Right(5.0)
println(calculate("10", "0"))   // Left(Division by zero)
println(calculate("ten", "2"))  // Left('ten' is not a valid integer)

// Combining multiple Options
def combineOptions(a: Option[Int], b: Option[Int], c: Option[Int]): Option[Int] =
  for {
    x <- a
    y <- b
    z <- c
  } yield x + y + z

// Handling collections of Options
val options = List(Some(1), None, Some(3), Some(4))

val flattened = options.flatten  // List(1, 3, 4)
val sumOfSomes = options.flatten.sum  // 8

// Converting between Option and Either
def optionToEither[T](opt: Option[T], error: String): Either[String, T] =
  opt.toRight(error)

def eitherToOption[T](either: Either[String, T]): Option[T] =
  either.toOption

// Validation with Either
case class ValidationError(field: String, message: String)

def validateEmail(email: String): Either[ValidationError, String] =
  if (email.contains("@")) Right(email)
  else Left(ValidationError("email", "Invalid email format"))

def validateAge(age: Int): Either[ValidationError, Int] =
  if (age >= 18) Right(age)
  else Left(ValidationError("age", "Must be 18 or older"))

def validateUser(email: String, age: Int):
  Either[List[ValidationError], User] = {
  val emailResult = validateEmail(email)
  val ageResult = validateAge(age)

  (emailResult, ageResult) match {
    case (Right(e), Right(a)) => Right(User(1, "User", e, a))
    case (Left(e1), Left(e2)) => Left(List(e1, e2))
    case (Left(e), _) => Left(List(e))
    case (_, Left(e)) => Left(List(e))
  }
}

// Try for exception handling
import scala.util.{Try, Success, Failure}

def safeDivide(a: Int, b: Int): Try[Double] =
  Try(a.toDouble / b)

val tryResult = safeDivide(10, 2) match {
  case Success(value) => s"Result: $value"
  case Failure(exception) => s"Error: ${exception.getMessage}"
}

// Converting Try to Either
def tryToEither[T](tried: Try[T]): Either[Throwable, T] =
  tried.toEither
```

Option and Either eliminate null pointer exceptions and make error handling
explicit in function signatures.

## For-Comprehensions

For-comprehensions provide syntactic sugar for monadic operations, making
sequential computations more readable.

```scala
// Basic for-comprehension
val result = for {
  x <- List(1, 2, 3)
  y <- List(10, 20)
} yield x + y

// With filtering
val evens = for {
  x <- 1 to 10
  if x % 2 == 0
} yield x

// Nested for-comprehensions
val pairs = for {
  x <- 1 to 3
  y <- 1 to 3
  if x < y
} yield (x, y)

// With Option
def getUserById(id: Int): Option[User] =
  Some(User(id, "Alice", "alice@example.com", 30))
def getOrdersByUser(user: User): Option[List[Order]] =
  Some(List(Order(List("Book"), 25.0)))

val totalOrders = for {
  user <- getUserById(1)
  orders <- getOrdersByUser(user)
} yield orders.length

// With Either
def validateInput(input: String): Either[String, Int] =
  if (input.isEmpty) Left("Input is empty")
  else if (input.toIntOption.isEmpty) Left("Not a number")
  else Right(input.toInt)

def processValue(value: Int): Either[String, Int] =
  if (value < 0) Left("Value must be positive")
  else Right(value * 2)

val processed = for {
  input <- validateInput("10")
  doubled <- processValue(input)
} yield doubled

// Parallel composition with for-comprehension
case class UserProfile(user: User, orders: List[Order], friends: List[User])

def getUserProfile(userId: Int): Option[UserProfile] = for {
  user <- getUserById(userId)
  orders <- getOrdersByUser(user)
  friends <- getFriendsByUser(user)
} yield UserProfile(user, orders, friends)

def getFriendsByUser(user: User): Option[List[User]] = Some(List())

// For-comprehension with Future
import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global

def fetchUser(id: Int): Future[User] =
  Future(User(id, "Alice", "alice@example.com", 30))

def fetchOrders(user: User): Future[List[Order]] =
  Future(List(Order(List("Book"), 25.0)))

val userWithOrders: Future[(User, List[Order])] = for {
  user <- fetchUser(1)
  orders <- fetchOrders(user)
} yield (user, orders)

// De-sugaring for-comprehension
val manual = List(1, 2, 3)
  .flatMap(x => List(10, 20).map(y => x + y))

val withFor = for {
  x <- List(1, 2, 3)
  y <- List(10, 20)
} yield x + y

// Both produce the same result
```

For-comprehensions make monadic composition readable and eliminate callback
nesting in asynchronous code.

## Function Composition and Combinators

Function composition creates complex functions from simpler ones, promoting
reusability and modularity.

```scala
// Basic composition
val addOne: Int => Int = _ + 1
val double: Int => Int = _ * 2
val square: Int => Int = x => x * x

val addOneThenDouble = addOne andThen double
val doubleBeforeAddOne = addOne compose double

println(addOneThenDouble(3))    // (3 + 1) * 2 = 8
println(doubleBeforeAddOne(3))  // (3 * 2) + 1 = 7

// Function combinators
def constant[A, B](b: B): A => B = _ => b

def identity[A]: A => A = a => a

def compose[A, B, C](f: B => C, g: A => B): A => C =
  a => f(g(a))

// Lifting functions
def lift[A, B](f: A => B): Option[A] => Option[B] =
  _.map(f)

val lifted = lift(addOne)
println(lifted(Some(5)))  // Some(6)
println(lifted(None))     // None

// Kleisli composition (composing monadic functions)
def kleisli[A, B, C](f: A => Option[B], g: B => Option[C]): A => Option[C] =
  a => f(a).flatMap(g)

def safeDivideBy(divisor: Int): Int => Option[Int] =
  n => if (divisor != 0) Some(n / divisor) else None

def validatePositive(n: Int): Option[Int] =
  if (n > 0) Some(n) else None

val composed = kleisli(safeDivideBy(2), validatePositive)
println(composed(10))  // Some(5)
println(composed(3))   // None (not positive after division)

// Reader monad for dependency injection
case class Config(apiUrl: String, timeout: Int)

type Reader[A] = Config => A

def getApiUrl: Reader[String] = config => config.apiUrl
def getTimeout: Reader[Int] = config => config.timeout

def buildRequest: Reader[String] = for {
  url <- getApiUrl
  timeout <- getTimeout
} yield s"Request to $url with timeout $timeout"

val config = Config("https://api.example.com", 5000)
println(buildRequest(config))

// Applicative functors
def map2[A, B, C](fa: Option[A], fb: Option[B])(f: (A, B) => C): Option[C] =
  for {
    a <- fa
    b <- fb
  } yield f(a, b)

val result1 = map2(Some(2), Some(3))(_ + _)  // Some(5)
val result2 = map2(Some(2), None: Option[Int])(_ + _)  // None

// Traverse
def traverse[A, B](list: List[A])(f: A => Option[B]): Option[List[B]] =
  list.foldRight(Some(Nil): Option[List[B]]) { (a, acc) =>
    map2(f(a), acc)(_ :: _)
  }

val numbers = List("1", "2", "3")
println(traverse(numbers)(s => s.toIntOption))  // Some(List(1, 2, 3))
```

Function composition enables building complex operations from simple, testable
components.

## Best Practices

1. **Prefer immutable data structures** to eliminate entire classes of bugs
   related to shared mutable state

2. **Use sealed traits for ADTs** to enable exhaustive pattern matching and
   compile-time guarantees

3. **Leverage for-comprehensions** for monadic composition instead of nested
   flatMap calls

4. **Make side effects explicit** by separating pure computation from IO
   operations

5. **Use Option instead of null** to make nullable values explicit in type
   signatures

6. **Prefer Either for error handling** over exceptions to make error cases
   explicit

7. **Compose functions** rather than writing large monolithic functions for
   better reusability

8. **Use tail recursion** with @tailrec annotation for recursive functions to
   prevent stack overflow

9. **Leverage type inference** but provide explicit types for public APIs and
   complex expressions

10. **Apply partial application** and currying to create specialized functions
    from general ones

## Common Pitfalls

1. **Mixing mutable and immutable collections** leads to unexpected modifications
   and bugs

2. **Overusing var instead of val** defeats immutability benefits and makes code
   harder to reason about

3. **Not handling None cases** in Option results in runtime failures despite
   type safety

4. **Catching all exceptions** instead of using Try, Either, or Option loses
   type safety benefits

5. **Creating non-tail-recursive functions** for large inputs causes stack
   overflow errors

6. **Not making ADTs sealed** allows adding cases elsewhere, breaking pattern
   match exhaustiveness

7. **Nesting flatMap calls** instead of for-comprehensions reduces readability
   significantly

8. **Using null instead of Option** defeats the purpose of functional error
   handling

9. **Creating impure functions** without documenting side effects makes code
   unpredictable

10. **Over-abstracting with higher-kinded types** prematurely adds complexity
    without clear benefits

## When to Use This Skill

Apply functional patterns throughout Scala development to leverage the language's
strengths and build maintainable systems.

Use immutability and pure functions when building business logic to ensure
predictability and testability.

Leverage pattern matching and ADTs when modeling domain entities with distinct
states or variants.

Apply Option and Either for error handling in APIs and service layers to make
error cases explicit.

Use for-comprehensions when composing multiple monadic operations for improved
readability.

Employ function composition when building data transformation pipelines or
reusable utility functions.

## Resources

- [Functional Programming in Scala](<https://www.manning.com/books/functional-programming-in-scala>)
- [Scala Documentation - Pattern Matching](<https://docs.scala-lang.org/tour/pattern-matching.html>)
- [Scala with Cats](<https://underscore.io/books/scala-with-cats/>)
- [Functional Programming Principles in Scala (Coursera)](<https://www.coursera.org/learn/scala-functional-programming>)
- [Herding Cats - Cats Tutorial](<http://eed3si9n.com/herding-cats/>)
