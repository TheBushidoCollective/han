---
name: rust-error-handling
user-invocable: false
description: Use when Rust error handling with Result, Option, custom errors, thiserror, and anyhow. Use when handling errors in Rust applications.
allowed-tools:
  - Bash
  - Read
---

# Rust Error Handling

Master Rust's error handling mechanisms using Result, Option, custom error
types, and popular error handling libraries for robust applications.

## Result and Option

**Result type for recoverable errors:**

```rust
// Result<T, E> for operations that can fail
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        Err(String::from("Division by zero"))
    } else {
        Ok(a / b)
    }
}

fn main() {
    match divide(10.0, 2.0) {
        Ok(result) => println!("Result: {}", result),
        Err(e) => println!("Error: {}", e),
    }
}
```

**Option type for optional values:**

```rust
fn find_user(id: u32) -> Option<String> {
    if id == 1 {
        Some(String::from("Alice"))
    } else {
        None
    }
}

fn main() {
    match find_user(1) {
        Some(name) => println!("Found: {}", name),
        None => println!("User not found"),
    }
}
```

## Error Propagation with ?

**Using ? operator:**

```rust
use std::fs::File;
use std::io::{self, Read};

fn read_file(path: &str) -> Result<String, io::Error> {
    let mut file = File::open(path)?;  // Propagate error
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;  // Propagate error
    Ok(contents)
}

// Equivalent without ? operator
fn read_file_explicit(path: &str) -> Result<String, io::Error> {
    let mut file = match File::open(path) {
        Ok(f) => f,
        Err(e) => return Err(e),
    };

    let mut contents = String::new();
    match file.read_to_string(&mut contents) {
        Ok(_) => Ok(contents),
        Err(e) => Err(e),
    }
}
```

**? with Option:**

```rust
fn get_first_char(text: &str) -> Option<char> {
    text.chars().next()
}

fn process_text(text: Option<&str>) -> Option<char> {
    let t = text?;  // Return None if text is None
    get_first_char(t)
}
```

## Custom Error Types

**Simple custom error:**

```rust
use std::fmt;

#[derive(Debug)]
struct ParseError {
    message: String,
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Parse error: {}", self.message)
    }
}

impl std::error::Error for ParseError {}

fn parse_number(s: &str) -> Result<i32, ParseError> {
    s.parse().map_err(|_| ParseError {
        message: format!("Failed to parse '{}'", s),
    })
}
```

**Enum-based error type:**

```rust
use std::fmt;
use std::io;

#[derive(Debug)]
enum AppError {
    Io(io::Error),
    Parse(String),
    NotFound(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AppError::Io(e) => write!(f, "IO error: {}", e),
            AppError::Parse(msg) => write!(f, "Parse error: {}", msg),
            AppError::NotFound(item) => write!(f, "Not found: {}", item),
        }
    }
}

impl std::error::Error for AppError {}

impl From<io::Error> for AppError {
    fn from(error: io::Error) -> Self {
        AppError::Io(error)
    }
}

fn process_file(path: &str) -> Result<String, AppError> {
    let content = std::fs::read_to_string(path)?;  // io::Error auto-converted

    if content.is_empty() {
        Err(AppError::NotFound(path.to_string()))
    } else {
        Ok(content)
    }
}
```

## thiserror Library

**Install thiserror:**

```bash
cargo add thiserror
```

**Using thiserror for custom errors:**

```rust
use thiserror::Error;

#[derive(Error, Debug)]
enum DataError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Validation failed: {field} is invalid")]
    Validation { field: String },

    #[error("Not found: {0}")]
    NotFound(String),
}

fn validate_user(name: &str) -> Result<(), DataError> {
    if name.is_empty() {
        return Err(DataError::Validation {
            field: "name".to_string(),
        });
    }
    Ok(())
}

fn load_data(path: &str) -> Result<String, DataError> {
    let data = std::fs::read_to_string(path)?;  // Auto-converts io::Error

    if data.is_empty() {
        return Err(DataError::NotFound(path.to_string()));
    }

    Ok(data)
}
```

**thiserror with source errors:**

```rust
use thiserror::Error;
use std::io;

#[derive(Error, Debug)]
enum ConfigError {
    #[error("Failed to read config file")]
    ReadError {
        #[source]
        source: io::Error,
    },

    #[error("Invalid config format")]
    ParseError {
        #[source]
        source: serde_json::Error,
    },
}
```

## anyhow Library

**Install anyhow:**

```bash
cargo add anyhow
```

**Using anyhow for application errors:**

```rust
use anyhow::{Result, Context, anyhow, bail};

fn read_config(path: &str) -> Result<String> {
    let content = std::fs::read_to_string(path)
        .context("Failed to read config file")?;

    if content.is_empty() {
        bail!("Config file is empty");
    }

    Ok(content)
}

fn process_data(value: i32) -> Result<i32> {
    if value < 0 {
        return Err(anyhow!("Value must be positive, got {}", value));
    }
    Ok(value * 2)
}

fn main() -> Result<()> {
    let config = read_config("config.toml")
        .context("Failed to load configuration")?;

    let value = process_data(42)?;

    println!("Value: {}", value);
    Ok(())
}
```

**anyhow with context chaining:**

```rust
use anyhow::{Result, Context};

fn load_user(id: u32) -> Result<String> {
    fetch_from_database(id)
        .context("Database query failed")?
        .parse()
        .context(format!("Failed to parse user {}", id))
}

fn fetch_from_database(id: u32) -> Result<String> {
    // Implementation
    Ok(format!("user_{}", id))
}
```

## Error Conversion

**Converting between error types:**

```rust
use std::io;
use std::num::ParseIntError;

enum AppError {
    Io(io::Error),
    Parse(ParseIntError),
}

impl From<io::Error> for AppError {
    fn from(error: io::Error) -> Self {
        AppError::Io(error)
    }
}

impl From<ParseIntError> for AppError {
    fn from(error: ParseIntError) -> Self {
        AppError::Parse(error)
    }
}

fn process() -> Result<i32, AppError> {
    let content = std::fs::read_to_string("file.txt")?;
    let number: i32 = content.trim().parse()?;
    Ok(number)
}
```

## unwrap and expect

**When to use unwrap and expect:**

```rust
fn unwrap_examples() {
    // unwrap: panics with generic message
    let value = Some(42).unwrap();

    // expect: panics with custom message
    let value = Some(42).expect("Value should be present");

    // Only use in:
    // 1. Tests
    // 2. Prototypes
    // 3. When you're certain it won't panic

    // Better: handle the error
    if let Some(value) = get_value() {
        println!("{}", value);
    }
}

fn get_value() -> Option<i32> {
    Some(42)
}
```

## Result Combinators

**Using Result methods:**

```rust
fn combinators() -> Result<i32, String> {
    // map: transform Ok value
    let result = Ok(5).map(|x| x * 2);  // Ok(10)

    // map_err: transform Err value
    let result = Err("error").map_err(|e| format!("Error: {}", e));

    // and_then (flatMap): chain operations
    let result = Ok(5)
        .and_then(|x| Ok(x * 2))
        .and_then(|x| Ok(x + 1));  // Ok(11)

    // or_else: provide alternative on error
    let result = Err("error")
        .or_else(|_| Ok(42));  // Ok(42)

    // unwrap_or: provide default on error
    let value = Err("error").unwrap_or(42);  // 42

    // unwrap_or_else: compute default on error
    let value = Err("error").unwrap_or_else(|_| 42);  // 42

    Ok(value)
}
```

## Option Combinators

**Using Option methods:**

```rust
fn option_combinators() {
    // map: transform Some value
    let result = Some(5).map(|x| x * 2);  // Some(10)

    // and_then (flatMap): chain operations
    let result = Some(5)
        .and_then(|x| Some(x * 2))
        .and_then(|x| Some(x + 1));  // Some(11)

    // or: provide alternative
    let result = None.or(Some(42));  // Some(42)

    // unwrap_or: provide default
    let value = None.unwrap_or(42);  // 42

    // filter: keep only if predicate is true
    let result = Some(5).filter(|x| x > &3);  // Some(5)
    let result = Some(2).filter(|x| x > &3);  // None

    // ok_or: convert Option to Result
    let result: Result<i32, &str> = Some(5).ok_or("error");  // Ok(5)
}
```

## Pattern Matching

**Comprehensive error handling with match:**

```rust
use std::fs::File;
use std::io::ErrorKind;

fn open_file(path: &str) -> File {
    let file = match File::open(path) {
        Ok(file) => file,
        Err(error) => match error.kind() {
            ErrorKind::NotFound => {
                match File::create(path) {
                    Ok(file) => file,
                    Err(e) => panic!("Failed to create file: {:?}", e),
                }
            }
            ErrorKind::PermissionDenied => {
                panic!("Permission denied: {}", path);
            }
            other_error => {
                panic!("Failed to open file: {:?}", other_error);
            }
        },
    };

    file
}
```

**if let for simple cases:**

```rust
fn simple_match(result: Result<i32, String>) {
    // Handle only the success case
    if let Ok(value) = result {
        println!("Got value: {}", value);
    }

    // Handle only the error case
    if let Err(e) = result {
        eprintln!("Error: {}", e);
    }
}
```

## Panic vs Result

**When to panic:**

```rust
// Panic for unrecoverable errors or bugs
fn get_element(index: usize) -> i32 {
    let data = vec![1, 2, 3];

    // Panic if index out of bounds (programmer error)
    data[index]
}

// Use Result for expected errors
fn safe_get_element(index: usize) -> Option<i32> {
    let data = vec![1, 2, 3];
    data.get(index).copied()
}

// Custom panic messages
fn validate_config(value: i32) {
    if value < 0 {
        panic!("Config value must be positive, got {}", value);
    }
}

// Conditional panic
fn debug_only_panic(condition: bool) {
    debug_assert!(condition, "This only panics in debug builds");
}
```

## Error Handling in Tests

**Testing error conditions:**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_success() {
        let result = divide(10.0, 2.0);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 5.0);
    }

    #[test]
    fn test_error() {
        let result = divide(10.0, 0.0);
        assert!(result.is_err());
    }

    #[test]
    #[should_panic(expected = "Division by zero")]
    fn test_panic() {
        panic!("Division by zero");
    }

    #[test]
    fn test_with_question_mark() -> Result<(), String> {
        let result = divide(10.0, 2.0)?;
        assert_eq!(result, 5.0);
        Ok(())
    }
}

fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        Err(String::from("Division by zero"))
    } else {
        Ok(a / b)
    }
}
```

## When to Use This Skill

Use rust-error-handling when you need to:

- Handle recoverable errors with Result
- Work with optional values using Option
- Create custom error types for your domain
- Use thiserror for library error types
- Use anyhow for application-level errors
- Propagate errors with the ? operator
- Convert between different error types
- Provide context to errors
- Implement comprehensive error handling
- Write robust error messages for debugging

## Best Practices

- Use Result for recoverable errors, panic for unrecoverable ones
- Provide context with anyhow::Context in applications
- Use thiserror for library error types
- Implement Display and Error trait for custom errors
- Use ? operator for error propagation
- Avoid unwrap/expect in production code
- Return errors instead of logging and continuing
- Make error messages actionable and descriptive
- Use type system to prevent errors at compile time
- Document expected errors in function documentation

## Common Pitfalls

- Overusing unwrap() leading to panics in production
- Not providing enough context in error messages
- Mixing panic and Result inconsistently
- Creating overly generic error types (String)
- Not implementing From for error conversions
- Ignoring errors with let _ = result
- Using Result when Option is more appropriate
- Not handling all error variants in match
- Creating error types that are hard to use
- Forgetting to propagate errors up the call stack

## Resources

- [Rust Book - Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)
- [thiserror Documentation](https://docs.rs/thiserror/)
- [anyhow Documentation](https://docs.rs/anyhow/)
- [Rust By Example - Error Handling](https://doc.rust-lang.org/rust-by-example/error.html)
- [Error Handling Survey](https://blog.burntsushi.net/rust-error-handling/)
