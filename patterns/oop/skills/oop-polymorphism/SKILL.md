---
name: oop-polymorphism
description: Use when implementing polymorphism and interfaces in object-oriented design. Use when creating flexible, extensible systems with interchangeable components.
allowed-tools:
  - Bash
  - Read
---

# OOP Polymorphism

Master polymorphism to create flexible, extensible object-oriented systems. This skill focuses on understanding and applying polymorphic behavior through interfaces, abstract classes, and runtime type substitution.

## Understanding Polymorphism

Polymorphism allows objects of different types to be treated uniformly through a common interface. It enables writing code that works with abstractions rather than concrete implementations.

### Interface-Based Polymorphism in Java

```java
// Common interface for all payment methods
public interface PaymentMethod {
    PaymentResult process(BigDecimal amount);
    boolean isValid();
    String getDisplayName();
}

// Concrete implementations
public class CreditCard implements PaymentMethod {
    private final String cardNumber;
    private final String cardholderName;
    private final String expiryDate;
    private final String cvv;

    public CreditCard(String cardNumber, String cardholderName, String expiryDate, String cvv) {
        this.cardNumber = cardNumber;
        this.cardholderName = cardholderName;
        this.expiryDate = expiryDate;
        this.cvv = cvv;
    }

    @Override
    public PaymentResult process(BigDecimal amount) {
        if (!isValid()) {
            return PaymentResult.failed("Invalid credit card");
        }

        // Credit card processing logic
        String transactionId = UUID.randomUUID().toString();
        System.out.println("Processing $" + amount + " via credit card ending in " +
            cardNumber.substring(cardNumber.length() - 4));

        return PaymentResult.success(transactionId, amount);
    }

    @Override
    public boolean isValid() {
        return cardNumber != null &&
               cardNumber.length() == 16 &&
               !isExpired(expiryDate);
    }

    @Override
    public String getDisplayName() {
        return "Credit Card ending in " + cardNumber.substring(cardNumber.length() - 4);
    }

    private boolean isExpired(String expiryDate) {
        // Expiry date validation logic
        return false;
    }
}

public class PayPal implements PaymentMethod {
    private final String email;
    private final String password;

    public PayPal(String email, String password) {
        this.email = email;
        this.password = password;
    }

    @Override
    public PaymentResult process(BigDecimal amount) {
        if (!isValid()) {
            return PaymentResult.failed("Invalid PayPal credentials");
        }

        String transactionId = UUID.randomUUID().toString();
        System.out.println("Processing $" + amount + " via PayPal account " + email);

        return PaymentResult.success(transactionId, amount);
    }

    @Override
    public boolean isValid() {
        return email != null && email.contains("@") && password != null;
    }

    @Override
    public String getDisplayName() {
        return "PayPal (" + email + ")";
    }
}

public class BankTransfer implements PaymentMethod {
    private final String accountNumber;
    private final String routingNumber;
    private final String accountHolderName;

    public BankTransfer(String accountNumber, String routingNumber, String accountHolderName) {
        this.accountNumber = accountNumber;
        this.routingNumber = routingNumber;
        this.accountHolderName = accountHolderName;
    }

    @Override
    public PaymentResult process(BigDecimal amount) {
        if (!isValid()) {
            return PaymentResult.failed("Invalid bank account");
        }

        String transactionId = UUID.randomUUID().toString();
        System.out.println("Processing $" + amount + " via bank transfer from " + accountHolderName);

        return PaymentResult.success(transactionId, amount);
    }

    @Override
    public boolean isValid() {
        return accountNumber != null &&
               routingNumber != null &&
               accountNumber.length() > 0;
    }

    @Override
    public String getDisplayName() {
        return "Bank Account (" + accountHolderName + ")";
    }
}

// Polymorphic usage
public class PaymentProcessor {
    private final List<PaymentMethod> paymentMethods;

    public PaymentProcessor() {
        this.paymentMethods = new ArrayList<>();
    }

    public void addPaymentMethod(PaymentMethod method) {
        paymentMethods.add(method);
    }

    public PaymentResult processPayment(BigDecimal amount) {
        // Try each payment method until one succeeds
        for (PaymentMethod method : paymentMethods) {
            if (method.isValid()) {
                System.out.println("Attempting payment with " + method.getDisplayName());
                PaymentResult result = method.process(amount);

                if (result.isSuccess()) {
                    return result;
                }
            }
        }

        return PaymentResult.failed("No valid payment method available");
    }

    public List<String> getAvailablePaymentMethods() {
        return paymentMethods.stream()
            .filter(PaymentMethod::isValid)
            .map(PaymentMethod::getDisplayName)
            .collect(Collectors.toList());
    }
}

// Usage - polymorphism in action
PaymentProcessor processor = new PaymentProcessor();
processor.addPaymentMethod(new CreditCard("1234567890123456", "John Doe", "12/25", "123"));
processor.addPaymentMethod(new PayPal("john@example.com", "secret"));
processor.addPaymentMethod(new BankTransfer("9876543210", "123456789", "John Doe"));

PaymentResult result = processor.processPayment(new BigDecimal("99.99"));
```

### Protocol-Based Polymorphism in Python

```python
from typing import Protocol, List, Optional
from abc import ABC, abstractmethod
from dataclasses import dataclass
import json

# Protocol defines the interface (structural typing)
class Serializable(Protocol):
    """Protocol for objects that can be serialized."""

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        ...

    def to_json(self) -> str:
        """Convert to JSON string."""
        ...

# Another protocol
class Identifiable(Protocol):
    """Protocol for objects with an ID."""

    @property
    def id(self) -> str:
        """Get unique identifier."""
        ...

# Concrete implementations
@dataclass
class User:
    """User implementation with both protocols."""

    _id: str
    username: str
    email: str
    age: int

    @property
    def id(self) -> str:
        return self._id

    def to_dict(self) -> dict:
        return {
            'id': self._id,
            'username': self.username,
            'email': self.email,
            'age': self.age
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

@dataclass
class Product:
    """Product implementation with both protocols."""

    _id: str
    name: str
    price: float
    category: str

    @property
    def id(self) -> str:
        return self._id

    def to_dict(self) -> dict:
        return {
            'id': self._id,
            'name': self.name,
            'price': self.price,
            'category': self.category
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

@dataclass
class Order:
    """Order implementation."""

    _id: str
    user_id: str
    items: List[str]
    total: float

    @property
    def id(self) -> str:
        return self._id

    def to_dict(self) -> dict:
        return {
            'id': self._id,
            'user_id': self.user_id,
            'items': self.items,
            'total': self.total
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

# Polymorphic functions using protocols
def save_to_file(obj: Serializable, filename: str) -> None:
    """Save any serializable object to file."""
    with open(filename, 'w') as f:
        f.write(obj.to_json())

def get_id(obj: Identifiable) -> str:
    """Get ID from any identifiable object."""
    return obj.id

def serialize_batch(objects: List[Serializable]) -> str:
    """Serialize multiple objects."""
    return json.dumps([obj.to_dict() for obj in objects])

# Works with any object implementing the protocols
user = User("u1", "alice", "alice@example.com", 30)
product = Product("p1", "Laptop", 999.99, "Electronics")
order = Order("o1", "u1", ["p1"], 999.99)

save_to_file(user, "user.json")
save_to_file(product, "product.json")

all_objects = [user, product, order]
batch_json = serialize_batch(all_objects)
```

### Abstract Base Classes in Python

```python
from abc import ABC, abstractmethod
from typing import List, Dict, Any
from datetime import datetime

# Abstract base class defining contract
class DataStore(ABC):
    """Abstract base class for data storage."""

    @abstractmethod
    def connect(self) -> None:
        """Establish connection to data store."""
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Close connection to data store."""
        pass

    @abstractmethod
    def save(self, key: str, value: Any) -> bool:
        """Save value with given key."""
        pass

    @abstractmethod
    def load(self, key: str) -> Optional[Any]:
        """Load value for given key."""
        pass

    @abstractmethod
    def delete(self, key: str) -> bool:
        """Delete value for given key."""
        pass

    @abstractmethod
    def list_keys(self) -> List[str]:
        """List all keys in store."""
        pass

    # Concrete method with default implementation
    def exists(self, key: str) -> bool:
        """Check if key exists."""
        return self.load(key) is not None

    def save_batch(self, items: Dict[str, Any]) -> int:
        """Save multiple items."""
        count = 0
        for key, value in items.items():
            if self.save(key, value):
                count += 1
        return count

# Concrete implementation - In-memory store
class MemoryStore(DataStore):
    """In-memory data store implementation."""

    def __init__(self):
        self._data: Dict[str, Any] = {}
        self._connected = False

    def connect(self) -> None:
        self._connected = True
        print("Memory store connected")

    def disconnect(self) -> None:
        self._connected = False
        print("Memory store disconnected")

    def save(self, key: str, value: Any) -> bool:
        if not self._connected:
            raise RuntimeError("Not connected")
        self._data[key] = value
        return True

    def load(self, key: str) -> Optional[Any]:
        if not self._connected:
            raise RuntimeError("Not connected")
        return self._data.get(key)

    def delete(self, key: str) -> bool:
        if not self._connected:
            raise RuntimeError("Not connected")
        if key in self._data:
            del self._data[key]
            return True
        return False

    def list_keys(self) -> List[str]:
        if not self._connected:
            raise RuntimeError("Not connected")
        return list(self._data.keys())

# Concrete implementation - File-based store
class FileStore(DataStore):
    """File-based data store implementation."""

    def __init__(self, directory: str):
        self._directory = directory
        self._connected = False

    def connect(self) -> None:
        import os
        os.makedirs(self._directory, exist_ok=True)
        self._connected = True
        print(f"File store connected: {self._directory}")

    def disconnect(self) -> None:
        self._connected = False
        print("File store disconnected")

    def save(self, key: str, value: Any) -> bool:
        if not self._connected:
            raise RuntimeError("Not connected")

        import json
        filepath = os.path.join(self._directory, f"{key}.json")
        try:
            with open(filepath, 'w') as f:
                json.dump(value, f)
            return True
        except Exception as e:
            print(f"Error saving {key}: {e}")
            return False

    def load(self, key: str) -> Optional[Any]:
        if not self._connected:
            raise RuntimeError("Not connected")

        import json
        filepath = os.path.join(self._directory, f"{key}.json")
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return None
        except Exception as e:
            print(f"Error loading {key}: {e}")
            return None

    def delete(self, key: str) -> bool:
        if not self._connected:
            raise RuntimeError("Not connected")

        import os
        filepath = os.path.join(self._directory, f"{key}.json")
        try:
            os.remove(filepath)
            return True
        except FileNotFoundError:
            return False

    def list_keys(self) -> List[str]:
        if not self._connected:
            raise RuntimeError("Not connected")

        import os
        return [
            f[:-5] for f in os.listdir(self._directory)
            if f.endswith('.json')
        ]

# Polymorphic usage
class DataManager:
    """Manager that works with any DataStore."""

    def __init__(self, store: DataStore):
        self._store = store

    def __enter__(self):
        self._store.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._store.disconnect()

    def backup(self, source_store: DataStore) -> int:
        """Backup from another store."""
        count = 0
        for key in source_store.list_keys():
            value = source_store.load(key)
            if value is not None and self._store.save(key, value):
                count += 1
        return count

    def migrate(self, target_store: DataStore) -> int:
        """Migrate data to another store."""
        count = 0
        for key in self._store.list_keys():
            value = self._store.load(key)
            if value is not None and target_store.save(key, value):
                count += 1
        return count

# Usage with different implementations
with DataManager(MemoryStore()) as manager:
    manager._store.save("user:1", {"name": "Alice", "age": 30})

with DataManager(FileStore("./data")) as manager:
    manager._store.save("user:2", {"name": "Bob", "age": 25})
```

### TypeScript Polymorphism

```typescript
// Interface-based polymorphism
interface Logger {
  log(message: string, level: string): void;
  flush(): void;
}

interface Formatter {
  format(message: string, level: string): string;
}

// Concrete implementations
class ConsoleLogger implements Logger {
  private formatter: Formatter;

  constructor(formatter: Formatter) {
    this.formatter = formatter;
  }

  log(message: string, level: string): void {
    const formatted = this.formatter.format(message, level);
    console.log(formatted);
  }

  flush(): void {
    // Console logs immediately, nothing to flush
  }
}

class FileLogger implements Logger {
  private formatter: Formatter;
  private buffer: string[] = [];
  private readonly filename: string;

  constructor(filename: string, formatter: Formatter) {
    this.filename = filename;
    this.formatter = formatter;
  }

  log(message: string, level: string): void {
    const formatted = this.formatter.format(message, level);
    this.buffer.push(formatted);

    if (this.buffer.length >= 10) {
      this.flush();
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    // Write to file (simplified)
    const content = this.buffer.join('\n');
    console.log(`Writing to ${this.filename}:`, content);
    this.buffer = [];
  }
}

class JsonFormatter implements Formatter {
  format(message: string, level: string): string {
    return JSON.stringify({
      message,
      level,
      timestamp: new Date().toISOString()
    });
  }
}

class TextFormatter implements Formatter {
  format(message: string, level: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }
}

// Composite logger using polymorphism
class MultiLogger implements Logger {
  private loggers: Logger[] = [];

  addLogger(logger: Logger): void {
    this.loggers.push(logger);
  }

  log(message: string, level: string): void {
    for (const logger of this.loggers) {
      logger.log(message, level);
    }
  }

  flush(): void {
    for (const logger of this.loggers) {
      logger.flush();
    }
  }
}

// Application using polymorphism
class Application {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  run(): void {
    this.logger.log("Application started", "INFO");
    this.processData();
    this.logger.log("Application finished", "INFO");
    this.logger.flush();
  }

  private processData(): void {
    this.logger.log("Processing data", "DEBUG");
    // Processing logic
  }
}

// Usage - can swap implementations
const jsonFormatter = new JsonFormatter();
const textFormatter = new TextFormatter();

const consoleLogger = new ConsoleLogger(textFormatter);
const fileLogger = new FileLogger("app.log", jsonFormatter);

const multiLogger = new MultiLogger();
multiLogger.addLogger(consoleLogger);
multiLogger.addLogger(fileLogger);

// Application works with any Logger implementation
const app = new Application(multiLogger);
app.run();
```

### C# Polymorphism with Interfaces

```csharp
// Interface for notification services
public interface INotificationService
{
    Task SendAsync(string recipient, string subject, string body);
    bool IsAvailable();
    string GetServiceName();
}

// Concrete implementations
public class EmailNotificationService : INotificationService
{
    private readonly string _smtpServer;
    private readonly int _port;
    private readonly string _username;
    private readonly string _password;

    public EmailNotificationService(string smtpServer, int port, string username, string password)
    {
        _smtpServer = smtpServer;
        _port = port;
        _username = username;
        _password = password;
    }

    public async Task SendAsync(string recipient, string subject, string body)
    {
        if (!IsAvailable())
            throw new InvalidOperationException("Email service not available");

        Console.WriteLine($"Sending email to {recipient}");
        Console.WriteLine($"Subject: {subject}");
        Console.WriteLine($"Body: {body}");

        // Simulate sending email
        await Task.Delay(100);
    }

    public bool IsAvailable()
    {
        return !string.IsNullOrEmpty(_smtpServer);
    }

    public string GetServiceName()
    {
        return "Email";
    }
}

public class SmsNotificationService : INotificationService
{
    private readonly string _apiKey;
    private readonly string _phoneNumber;

    public SmsNotificationService(string apiKey, string phoneNumber)
    {
        _apiKey = apiKey;
        _phoneNumber = phoneNumber;
    }

    public async Task SendAsync(string recipient, string subject, string body)
    {
        if (!IsAvailable())
            throw new InvalidOperationException("SMS service not available");

        Console.WriteLine($"Sending SMS to {recipient}");
        Console.WriteLine($"Message: {subject} - {body}");

        await Task.Delay(50);
    }

    public bool IsAvailable()
    {
        return !string.IsNullOrEmpty(_apiKey);
    }

    public string GetServiceName()
    {
        return "SMS";
    }
}

public class PushNotificationService : INotificationService
{
    private readonly string _appId;
    private readonly string _apiKey;

    public PushNotificationService(string appId, string apiKey)
    {
        _appId = appId;
        _apiKey = apiKey;
    }

    public async Task SendAsync(string recipient, string subject, string body)
    {
        if (!IsAvailable())
            throw new InvalidOperationException("Push notification service not available");

        Console.WriteLine($"Sending push notification to {recipient}");
        Console.WriteLine($"Title: {subject}");
        Console.WriteLine($"Body: {body}");

        await Task.Delay(30);
    }

    public bool IsAvailable()
    {
        return !string.IsNullOrEmpty(_appId) && !string.IsNullOrEmpty(_apiKey);
    }

    public string GetServiceName()
    {
        return "Push Notification";
    }
}

// Polymorphic notification manager
public class NotificationManager
{
    private readonly List<INotificationService> _services;

    public NotificationManager()
    {
        _services = new List<INotificationService>();
    }

    public void RegisterService(INotificationService service)
    {
        _services.Add(service);
    }

    public async Task NotifyAsync(string recipient, string subject, string body)
    {
        var availableServices = _services.Where(s => s.IsAvailable()).ToList();

        if (!availableServices.Any())
        {
            throw new InvalidOperationException("No notification services available");
        }

        Console.WriteLine($"Sending via {availableServices.Count} service(s)");

        var tasks = availableServices.Select(service =>
            NotifyWithServiceAsync(service, recipient, subject, body)
        );

        await Task.WhenAll(tasks);
    }

    private async Task NotifyWithServiceAsync(
        INotificationService service,
        string recipient,
        string subject,
        string body)
    {
        try
        {
            await service.SendAsync(recipient, subject, body);
            Console.WriteLine($"{service.GetServiceName()} notification sent successfully");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"{service.GetServiceName()} notification failed: {ex.Message}");
        }
    }

    public List<string> GetAvailableServices()
    {
        return _services
            .Where(s => s.IsAvailable())
            .Select(s => s.GetServiceName())
            .ToList();
    }
}

// Usage
var manager = new NotificationManager();
manager.RegisterService(new EmailNotificationService("smtp.example.com", 587, "user", "pass"));
manager.RegisterService(new SmsNotificationService("api-key", "+1234567890"));
manager.RegisterService(new PushNotificationService("app-id", "api-key"));

await manager.NotifyAsync("user@example.com", "Welcome", "Welcome to our service!");
```

## Method Overloading

### Overloading in Java

```java
public class Calculator {
    // Method overloading - same name, different parameters

    // Add two integers
    public int add(int a, int b) {
        return a + b;
    }

    // Add three integers
    public int add(int a, int b, int c) {
        return a + b + c;
    }

    // Add two doubles
    public double add(double a, double b) {
        return a + b;
    }

    // Add array of integers
    public int add(int[] numbers) {
        int sum = 0;
        for (int num : numbers) {
            sum += num;
        }
        return sum;
    }

    // Add with different type combinations
    public double add(int a, double b) {
        return a + b;
    }

    public double add(double a, int b) {
        return a + b;
    }
}

// String formatting with overloading
public class Formatter {
    public String format(String text) {
        return text.trim();
    }

    public String format(String text, boolean uppercase) {
        String trimmed = format(text);
        return uppercase ? trimmed.toUpperCase() : trimmed.toLowerCase();
    }

    public String format(String text, int maxLength) {
        String trimmed = format(text);
        return trimmed.length() > maxLength
            ? trimmed.substring(0, maxLength) + "..."
            : trimmed;
    }

    public String format(String text, boolean uppercase, int maxLength) {
        String formatted = format(text, uppercase);
        return format(formatted, maxLength);
    }
}
```

### Overloading in C #

```csharp
public class DocumentProcessor
{
    // Process string content
    public ProcessResult Process(string content)
    {
        return new ProcessResult
        {
            Type = "text",
            Length = content.Length,
            ProcessedContent = content.Trim()
        };
    }

    // Process byte array (binary content)
    public ProcessResult Process(byte[] content)
    {
        return new ProcessResult
        {
            Type = "binary",
            Length = content.Length,
            ProcessedContent = Convert.ToBase64String(content)
        };
    }

    // Process with options
    public ProcessResult Process(string content, ProcessOptions options)
    {
        var result = Process(content);

        if (options.RemoveWhitespace)
        {
            result.ProcessedContent = Regex.Replace(
                result.ProcessedContent.ToString(),
                @"\s+",
                " "
            );
        }

        if (options.MaxLength > 0)
        {
            var text = result.ProcessedContent.ToString();
            result.ProcessedContent = text.Length > options.MaxLength
                ? text.Substring(0, options.MaxLength)
                : text;
        }

        return result;
    }

    // Process file
    public async Task<ProcessResult> ProcessAsync(FileInfo file)
    {
        var content = await File.ReadAllTextAsync(file.FullName);
        return Process(content);
    }

    // Process stream
    public async Task<ProcessResult> ProcessAsync(Stream stream)
    {
        using var reader = new StreamReader(stream);
        var content = await reader.ReadToEndAsync();
        return Process(content);
    }
}
```

## Operator Overloading

### C# Operator Overloading

```csharp
public struct Vector3D
{
    public double X { get; }
    public double Y { get; }
    public double Z { get; }

    public Vector3D(double x, double y, double z)
    {
        X = x;
        Y = y;
        Z = z;
    }

    // Binary operator overloading
    public static Vector3D operator +(Vector3D a, Vector3D b)
    {
        return new Vector3D(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
    }

    public static Vector3D operator -(Vector3D a, Vector3D b)
    {
        return new Vector3D(a.X - b.X, a.Y - b.Y, a.Z - b.Z);
    }

    public static Vector3D operator *(Vector3D v, double scalar)
    {
        return new Vector3D(v.X * scalar, v.Y * scalar, v.Z * scalar);
    }

    public static Vector3D operator *(double scalar, Vector3D v)
    {
        return v * scalar;
    }

    public static Vector3D operator /(Vector3D v, double scalar)
    {
        if (scalar == 0)
            throw new DivideByZeroException();
        return new Vector3D(v.X / scalar, v.Y / scalar, v.Z / scalar);
    }

    // Unary operator overloading
    public static Vector3D operator -(Vector3D v)
    {
        return new Vector3D(-v.X, -v.Y, -v.Z);
    }

    // Comparison operators
    public static bool operator ==(Vector3D a, Vector3D b)
    {
        return a.X == b.X && a.Y == b.Y && a.Z == b.Z;
    }

    public static bool operator !=(Vector3D a, Vector3D b)
    {
        return !(a == b);
    }

    // Override Object methods
    public override bool Equals(object obj)
    {
        return obj is Vector3D vector && this == vector;
    }

    public override int GetHashCode()
    {
        return HashCode.Combine(X, Y, Z);
    }

    public override string ToString()
    {
        return $"({X}, {Y}, {Z})";
    }

    // Additional vector operations
    public double Magnitude()
    {
        return Math.Sqrt(X * X + Y * Y + Z * Z);
    }

    public Vector3D Normalize()
    {
        double mag = Magnitude();
        return mag > 0 ? this / mag : this;
    }

    public double Dot(Vector3D other)
    {
        return X * other.X + Y * other.Y + Z * other.Z;
    }

    public Vector3D Cross(Vector3D other)
    {
        return new Vector3D(
            Y * other.Z - Z * other.Y,
            Z * other.X - X * other.Z,
            X * other.Y - Y * other.X
        );
    }
}

// Usage
var v1 = new Vector3D(1, 2, 3);
var v2 = new Vector3D(4, 5, 6);
var v3 = v1 + v2;  // (5, 7, 9)
var v4 = v1 * 2;   // (2, 4, 6)
var v5 = -v1;      // (-1, -2, -3)
```

### Python Magic Methods (Operator Overloading)

```python
class Money:
    """Money class with operator overloading."""

    def __init__(self, amount: float, currency: str = "USD"):
        self.amount = amount
        self.currency = currency

    def __add__(self, other):
        """Add two money amounts."""
        if isinstance(other, Money):
            if self.currency != other.currency:
                raise ValueError("Cannot add different currencies")
            return Money(self.amount + other.amount, self.currency)
        elif isinstance(other, (int, float)):
            return Money(self.amount + other, self.currency)
        return NotImplemented

    def __sub__(self, other):
        """Subtract two money amounts."""
        if isinstance(other, Money):
            if self.currency != other.currency:
                raise ValueError("Cannot subtract different currencies")
            return Money(self.amount - other.amount, self.currency)
        elif isinstance(other, (int, float)):
            return Money(self.amount - other, self.currency)
        return NotImplemented

    def __mul__(self, other):
        """Multiply money by a number."""
        if isinstance(other, (int, float)):
            return Money(self.amount * other, self.currency)
        return NotImplemented

    def __truediv__(self, other):
        """Divide money by a number."""
        if isinstance(other, (int, float)):
            if other == 0:
                raise ValueError("Cannot divide by zero")
            return Money(self.amount / other, self.currency)
        return NotImplemented

    def __eq__(self, other):
        """Check equality."""
        if not isinstance(other, Money):
            return False
        return self.amount == other.amount and self.currency == other.currency

    def __lt__(self, other):
        """Less than comparison."""
        if not isinstance(other, Money):
            return NotImplemented
        if self.currency != other.currency:
            raise ValueError("Cannot compare different currencies")
        return self.amount < other.amount

    def __le__(self, other):
        """Less than or equal comparison."""
        return self == other or self < other

    def __gt__(self, other):
        """Greater than comparison."""
        if not isinstance(other, Money):
            return NotImplemented
        if self.currency != other.currency:
            raise ValueError("Cannot compare different currencies")
        return self.amount > other.amount

    def __ge__(self, other):
        """Greater than or equal comparison."""
        return self == other or self > other

    def __str__(self):
        """String representation."""
        return f"{self.currency} {self.amount:.2f}"

    def __repr__(self):
        """Developer representation."""
        return f"Money({self.amount}, {self.currency!r})"

    def __hash__(self):
        """Hash for using in sets/dicts."""
        return hash((self.amount, self.currency))

# Usage
price = Money(19.99)
tax = Money(2.00)
total = price + tax  # Money(21.99, 'USD')
discounted = total * 0.9  # Money(19.791, 'USD')
print(total > price)  # True
```

## Duck Typing and Structural Polymorphism

### Duck Typing in Python

```python
# No explicit interface - objects just need the right methods
class FileWriter:
    """Writes to a file."""

    def __init__(self, filename: str):
        self.file = open(filename, 'w')

    def write(self, data: str) -> None:
        self.file.write(data)

    def close(self) -> None:
        self.file.close()

class StringWriter:
    """Writes to a string buffer."""

    def __init__(self):
        self.buffer = []

    def write(self, data: str) -> None:
        self.buffer.append(data)

    def close(self) -> None:
        pass  # Nothing to close

    def get_value(self) -> str:
        return ''.join(self.buffer)

class NetworkWriter:
    """Writes to a network socket."""

    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.connected = True

    def write(self, data: str) -> None:
        print(f"Sending to {self.host}:{self.port}: {data}")

    def close(self) -> None:
        self.connected = False
        print("Connection closed")

# Function that works with any "writer-like" object
def save_report(writer, title: str, data: List[str]) -> None:
    """Save report using any writer (duck typing)."""
    writer.write(f"Report: {title}\n")
    writer.write("=" * 50 + "\n")

    for item in data:
        writer.write(f"- {item}\n")

    writer.close()

# All work with the same function
save_report(FileWriter("report.txt"), "Sales", ["Item 1", "Item 2"])
save_report(StringWriter(), "Inventory", ["Product A", "Product B"])
save_report(NetworkWriter("server.com", 8080), "Metrics", ["CPU: 50%"])
```

## When to Use This Skill

Apply polymorphism when:

1. Building extensible plugin architectures
2. Creating interchangeable implementations
3. Writing code against interfaces/abstractions
4. Implementing the strategy pattern
5. Building dependency injection systems
6. Creating framework hooks and extension points
7. Supporting multiple data formats or protocols
8. Implementing command patterns
9. Building notification or messaging systems
10. Creating abstract data access layers
11. Supporting multiple rendering engines
12. Implementing visitor patterns
13. Building state machines with polymorphic states
14. Creating factory methods that return polymorphic types
15. Designing testable code with mock objects

## Best Practices

1. Program to interfaces, not implementations
2. Use abstract base classes for shared behavior
3. Keep interfaces small and focused (ISP)
4. Use polymorphism to eliminate switch statements
5. Favor composition over inheritance for flexibility
6. Make polymorphic methods virtual/abstract appropriately
7. Use dependency injection for polymorphic dependencies
8. Document the contract/behavior expected from implementations
9. Provide default implementations where sensible
10. Use generics with polymorphism for type safety
11. Override equality methods when overriding operators
12. Keep polymorphic hierarchies shallow
13. Use factory patterns to create polymorphic objects
14. Test each implementation of a polymorphic interface
15. Consider using protocols/structural typing for flexibility

## Common Pitfalls

1. Breaking Liskov Substitution Principle
2. Creating too many small interfaces
3. Not providing consistent behavior across implementations
4. Overusing inheritance for polymorphism
5. Forgetting to override Object methods (equals, hashCode)
6. Creating leaky abstractions
7. Mixing abstraction levels in interfaces
8. Not handling null/None in polymorphic code
9. Creating circular dependencies between polymorphic types
10. Overloading methods with similar but different semantics
11. Not considering performance of virtual method calls
12. Using reflection instead of polymorphism
13. Creating god interfaces with too many methods
14. Not testing substitutability of implementations
15. Coupling to concrete types instead of abstractions

## Resources

- Design Patterns: Elements of Reusable Object-Oriented Software
- Liskov Substitution Principle: <https://en.wikipedia.org/wiki/Liskov_substitution_principle>
- Python Protocols: <https://peps.python.org/pep-0544/>
- C# Interfaces: <https://docs.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces>
- Java Polymorphism Tutorial: <https://docs.oracle.com/javase/tutorial/java/IandI/polymorphism.html>
- TypeScript Interfaces: <https://www.typescriptlang.org/docs/handbook/interfaces.html>
- Effective Java by Joshua Bloch (Item 64: Refer to objects by their interfaces)
