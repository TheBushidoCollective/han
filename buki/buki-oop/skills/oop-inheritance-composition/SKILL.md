---
name: oop-inheritance-composition
description: Use when deciding between inheritance and composition in object-oriented design. Use when creating class hierarchies or composing objects from smaller components.
allowed-tools:
  - Bash
  - Read
---

# OOP Inheritance and Composition

Master inheritance and composition to build flexible, maintainable object-oriented systems. This skill focuses on understanding when to use inheritance versus composition and how to apply each effectively.

## Inheritance Fundamentals

### Basic Inheritance in Java

```java
// Base class with common behavior
public abstract class Vehicle {
    private String brand;
    private String model;
    private int year;
    protected double currentSpeed;

    protected Vehicle(String brand, String model, int year) {
        this.brand = brand;
        this.model = model;
        this.year = year;
        this.currentSpeed = 0.0;
    }

    // Template method pattern
    public final void start() {
        performSafetyCheck();
        startEngine();
        System.out.println(brand + " " + model + " started");
    }

    // Hook method for subclasses
    protected void performSafetyCheck() {
        System.out.println("Performing basic safety check");
    }

    // Abstract method - must be implemented
    protected abstract void startEngine();

    public void accelerate(double speed) {
        currentSpeed += speed;
        System.out.println("Current speed: " + currentSpeed);
    }

    public void brake(double reduction) {
        currentSpeed = Math.max(0, currentSpeed - reduction);
        System.out.println("Current speed: " + currentSpeed);
    }

    // Getters
    public String getBrand() { return brand; }
    public String getModel() { return model; }
    public int getYear() { return year; }
    public double getCurrentSpeed() { return currentSpeed; }
}

// Concrete implementation
public class Car extends Vehicle {
    private int numberOfDoors;
    private boolean isSunroofOpen;

    public Car(String brand, String model, int year, int numberOfDoors) {
        super(brand, model, year);
        this.numberOfDoors = numberOfDoors;
        this.isSunroofOpen = false;
    }

    @Override
    protected void startEngine() {
        System.out.println("Car engine started with ignition");
    }

    @Override
    protected void performSafetyCheck() {
        super.performSafetyCheck();
        System.out.println("Checking doors are closed");
        System.out.println("Checking seatbelts");
    }

    public void openSunroof() {
        if (currentSpeed == 0) {
            isSunroofOpen = true;
            System.out.println("Sunroof opened");
        } else {
            System.out.println("Stop the car before opening sunroof");
        }
    }

    public int getNumberOfDoors() {
        return numberOfDoors;
    }
}

// Another concrete implementation
public class Motorcycle extends Vehicle {
    private boolean hasWindshield;

    public Motorcycle(String brand, String model, int year, boolean hasWindshield) {
        super(brand, model, year);
        this.hasWindshield = hasWindshield;
    }

    @Override
    protected void startEngine() {
        System.out.println("Motorcycle engine started with kick/button");
    }

    @Override
    public void accelerate(double speed) {
        // Override to add motorcycle-specific behavior
        if (currentSpeed + speed > 200) {
            System.out.println("Warning: Maximum safe speed exceeded!");
        }
        super.accelerate(speed);
    }

    public boolean hasWindshield() {
        return hasWindshield;
    }
}
```

### Inheritance in Python

```python
from abc import ABC, abstractmethod
from typing import List, Optional
from datetime import datetime

class Employee(ABC):
    """Abstract base class for all employees."""

    def __init__(self, employee_id: str, name: str, email: str, hire_date: datetime):
        self._employee_id = employee_id
        self._name = name
        self._email = email
        self._hire_date = hire_date
        self._is_active = True

    @property
    def employee_id(self) -> str:
        return self._employee_id

    @property
    def name(self) -> str:
        return self._name

    @property
    def email(self) -> str:
        return self._email

    @property
    def hire_date(self) -> datetime:
        return self._hire_date

    @property
    def years_of_service(self) -> int:
        return (datetime.now() - self._hire_date).days // 365

    # Template method
    def process_payroll(self) -> float:
        """Process payroll - template method."""
        if not self._is_active:
            raise ValueError("Cannot process payroll for inactive employee")

        base_pay = self.calculate_pay()
        bonus = self.calculate_bonus()
        deductions = self.calculate_deductions()

        total_pay = base_pay + bonus - deductions
        self.record_payment(total_pay)
        return total_pay

    # Abstract methods - must be implemented by subclasses
    @abstractmethod
    def calculate_pay(self) -> float:
        """Calculate base pay."""
        pass

    # Hook methods with default implementation
    def calculate_bonus(self) -> float:
        """Calculate bonus - can be overridden."""
        return 0.0

    def calculate_deductions(self) -> float:
        """Calculate deductions - can be overridden."""
        return 0.0

    def record_payment(self, amount: float) -> None:
        """Record payment."""
        print(f"Recording payment of ${amount:.2f} for {self._name}")

    def deactivate(self) -> None:
        """Deactivate employee."""
        self._is_active = False


class SalariedEmployee(Employee):
    """Employee paid a fixed salary."""

    def __init__(
        self,
        employee_id: str,
        name: str,
        email: str,
        hire_date: datetime,
        annual_salary: float
    ):
        super().__init__(employee_id, name, email, hire_date)
        self._annual_salary = annual_salary

    def calculate_pay(self) -> float:
        """Calculate monthly salary."""
        return self._annual_salary / 12

    def calculate_bonus(self) -> float:
        """Annual bonus based on years of service."""
        return self._annual_salary * 0.01 * self.years_of_service


class HourlyEmployee(Employee):
    """Employee paid by the hour."""

    def __init__(
        self,
        employee_id: str,
        name: str,
        email: str,
        hire_date: datetime,
        hourly_rate: float
    ):
        super().__init__(employee_id, name, email, hire_date)
        self._hourly_rate = hourly_rate
        self._hours_worked = 0.0

    def log_hours(self, hours: float) -> None:
        """Log hours worked this period."""
        if hours < 0:
            raise ValueError("Hours cannot be negative")
        self._hours_worked += hours

    def calculate_pay(self) -> float:
        """Calculate pay based on hours worked."""
        regular_hours = min(self._hours_worked, 40)
        overtime_hours = max(0, self._hours_worked - 40)

        regular_pay = regular_hours * self._hourly_rate
        overtime_pay = overtime_hours * self._hourly_rate * 1.5

        return regular_pay + overtime_pay

    def record_payment(self, amount: float) -> None:
        """Record payment and reset hours."""
        super().record_payment(amount)
        self._hours_worked = 0.0


class CommissionEmployee(SalariedEmployee):
    """Employee with base salary plus commission."""

    def __init__(
        self,
        employee_id: str,
        name: str,
        email: str,
        hire_date: datetime,
        annual_salary: float,
        commission_rate: float
    ):
        super().__init__(employee_id, name, email, hire_date, annual_salary)
        self._commission_rate = commission_rate
        self._sales_this_period = 0.0

    def record_sale(self, amount: float) -> None:
        """Record a sale for commission calculation."""
        if amount <= 0:
            raise ValueError("Sale amount must be positive")
        self._sales_this_period += amount

    def calculate_pay(self) -> float:
        """Calculate base salary plus commission."""
        base = super().calculate_pay()
        commission = self._sales_this_period * self._commission_rate
        return base + commission

    def record_payment(self, amount: float) -> None:
        """Record payment and reset sales."""
        super().record_payment(amount)
        self._sales_this_period = 0.0
```

### Inheritance in TypeScript

```typescript
// Abstract base class
abstract class Shape {
  protected readonly id: string;
  protected color: string;

  constructor(color: string) {
    this.id = crypto.randomUUID();
    this.color = color;
  }

  // Abstract methods
  abstract area(): number;
  abstract perimeter(): number;
  abstract draw(): void;

  // Concrete methods
  getColor(): string {
    return this.color;
  }

  setColor(color: string): void {
    this.color = color;
  }

  describe(): string {
    return `${this.constructor.name} (${this.color}): Area = ${this.area().toFixed(2)}, Perimeter = ${this.perimeter().toFixed(2)}`;
  }
}

// Concrete implementations
class Circle extends Shape {
  private radius: number;

  constructor(color: string, radius: number) {
    super(color);
    if (radius <= 0) {
      throw new Error("Radius must be positive");
    }
    this.radius = radius;
  }

  area(): number {
    return Math.PI * this.radius ** 2;
  }

  perimeter(): number {
    return 2 * Math.PI * this.radius;
  }

  draw(): void {
    console.log(`Drawing a ${this.color} circle with radius ${this.radius}`);
  }

  getRadius(): number {
    return this.radius;
  }
}

class Rectangle extends Shape {
  private width: number;
  private height: number;

  constructor(color: string, width: number, height: number) {
    super(color);
    if (width <= 0 || height <= 0) {
      throw new Error("Dimensions must be positive");
    }
    this.width = width;
    this.height = height;
  }

  area(): number {
    return this.width * this.height;
  }

  perimeter(): number {
    return 2 * (this.width + this.height);
  }

  draw(): void {
    console.log(`Drawing a ${this.color} rectangle ${this.width}x${this.height}`);
  }

  isSquare(): boolean {
    return this.width === this.height;
  }
}

class Triangle extends Shape {
  private sideA: number;
  private sideB: number;
  private sideC: number;

  constructor(color: string, sideA: number, sideB: number, sideC: number) {
    super(color);
    if (!this.isValidTriangle(sideA, sideB, sideC)) {
      throw new Error("Invalid triangle dimensions");
    }
    this.sideA = sideA;
    this.sideB = sideB;
    this.sideC = sideC;
  }

  private isValidTriangle(a: number, b: number, c: number): boolean {
    return a + b > c && b + c > a && a + c > b;
  }

  area(): number {
    // Heron's formula
    const s = this.perimeter() / 2;
    return Math.sqrt(s * (s - this.sideA) * (s - this.sideB) * (s - this.sideC));
  }

  perimeter(): number {
    return this.sideA + this.sideB + this.sideC;
  }

  draw(): void {
    console.log(`Drawing a ${this.color} triangle`);
  }
}
```

## Composition Over Inheritance

### Composition in Java

```java
// Component interfaces
interface Engine {
    void start();
    void stop();
    int getHorsepower();
}

interface Transmission {
    void shiftUp();
    void shiftDown();
    String getType();
}

interface GPS {
    void navigate(String destination);
    String getCurrentLocation();
}

// Concrete component implementations
class V6Engine implements Engine {
    private final int horsepower;
    private boolean running;

    public V6Engine(int horsepower) {
        this.horsepower = horsepower;
        this.running = false;
    }

    @Override
    public void start() {
        running = true;
        System.out.println("V6 engine started");
    }

    @Override
    public void stop() {
        running = false;
        System.out.println("V6 engine stopped");
    }

    @Override
    public int getHorsepower() {
        return horsepower;
    }
}

class ElectricEngine implements Engine {
    private final int horsepower;
    private boolean running;
    private int batteryLevel;

    public ElectricEngine(int horsepower) {
        this.horsepower = horsepower;
        this.batteryLevel = 100;
        this.running = false;
    }

    @Override
    public void start() {
        if (batteryLevel > 0) {
            running = true;
            System.out.println("Electric engine started silently");
        } else {
            System.out.println("Battery depleted!");
        }
    }

    @Override
    public void stop() {
        running = false;
        System.out.println("Electric engine stopped");
    }

    @Override
    public int getHorsepower() {
        return horsepower;
    }

    public int getBatteryLevel() {
        return batteryLevel;
    }
}

class AutomaticTransmission implements Transmission {
    private int currentGear;

    public AutomaticTransmission() {
        this.currentGear = 1;
    }

    @Override
    public void shiftUp() {
        if (currentGear < 8) {
            currentGear++;
            System.out.println("Automatically shifted to gear " + currentGear);
        }
    }

    @Override
    public void shiftDown() {
        if (currentGear > 1) {
            currentGear--;
            System.out.println("Automatically shifted to gear " + currentGear);
        }
    }

    @Override
    public String getType() {
        return "Automatic";
    }
}

class ManualTransmission implements Transmission {
    private int currentGear;

    public ManualTransmission() {
        this.currentGear = 1;
    }

    @Override
    public void shiftUp() {
        if (currentGear < 6) {
            currentGear++;
            System.out.println("Manually shifted to gear " + currentGear);
        }
    }

    @Override
    public void shiftDown() {
        if (currentGear > 1) {
            currentGear--;
            System.out.println("Manually shifted to gear " + currentGear);
        }
    }

    @Override
    public String getType() {
        return "Manual";
    }
}

// Composed car class
public class ComposedCar {
    private final Engine engine;
    private final Transmission transmission;
    private final GPS gps;  // Optional component
    private final String brand;
    private final String model;

    // Builder for flexible construction
    public static class Builder {
        private Engine engine;
        private Transmission transmission;
        private GPS gps;
        private String brand;
        private String model;

        public Builder brand(String brand) {
            this.brand = brand;
            return this;
        }

        public Builder model(String model) {
            this.model = model;
            return this;
        }

        public Builder engine(Engine engine) {
            this.engine = engine;
            return this;
        }

        public Builder transmission(Transmission transmission) {
            this.transmission = transmission;
            return this;
        }

        public Builder gps(GPS gps) {
            this.gps = gps;
            return this;
        }

        public ComposedCar build() {
            if (engine == null || transmission == null) {
                throw new IllegalStateException("Engine and transmission required");
            }
            return new ComposedCar(this);
        }
    }

    private ComposedCar(Builder builder) {
        this.engine = builder.engine;
        this.transmission = builder.transmission;
        this.gps = builder.gps;
        this.brand = builder.brand;
        this.model = builder.model;
    }

    // Delegate to components
    public void start() {
        engine.start();
        System.out.println(brand + " " + model + " is ready to drive");
    }

    public void stop() {
        engine.stop();
    }

    public void shiftUp() {
        transmission.shiftUp();
    }

    public void shiftDown() {
        transmission.shiftDown();
    }

    public void navigateTo(String destination) {
        if (gps != null) {
            gps.navigate(destination);
        } else {
            System.out.println("GPS not available");
        }
    }

    public String getSpecs() {
        return String.format("%s %s - %d HP %s transmission",
            brand, model, engine.getHorsepower(), transmission.getType());
    }
}

// Usage
ComposedCar sportsCar = new ComposedCar.Builder()
    .brand("Porsche")
    .model("911")
    .engine(new V6Engine(450))
    .transmission(new ManualTransmission())
    .build();

ComposedCar electricCar = new ComposedCar.Builder()
    .brand("Tesla")
    .model("Model 3")
    .engine(new ElectricEngine(283))
    .transmission(new AutomaticTransmission())
    .build();
```

### Composition in Python

```python
from typing import Protocol, List, Optional
from dataclasses import dataclass

# Component protocols (interfaces)
class Renderer(Protocol):
    """Protocol for rendering components."""
    def render(self, content: str) -> str: ...

class Logger(Protocol):
    """Protocol for logging components."""
    def log(self, message: str, level: str) -> None: ...

class Validator(Protocol):
    """Protocol for validation components."""
    def validate(self, data: dict) -> bool: ...
    def get_errors(self) -> List[str]: ...

# Concrete component implementations
class HTMLRenderer:
    """Renders content as HTML."""

    def render(self, content: str) -> str:
        return f"<html><body>{content}</body></html>"

class MarkdownRenderer:
    """Renders content as Markdown."""

    def render(self, content: str) -> str:
        return f"# {content}\n\nRendered as Markdown"

class FileLogger:
    """Logs messages to a file."""

    def __init__(self, filename: str):
        self.filename = filename

    def log(self, message: str, level: str) -> None:
        with open(self.filename, 'a') as f:
            f.write(f"[{level}] {message}\n")

class ConsoleLogger:
    """Logs messages to console."""

    def log(self, message: str, level: str) -> None:
        print(f"[{level}] {message}")

class EmailValidator:
    """Validates email addresses."""

    def __init__(self):
        self.errors: List[str] = []

    def validate(self, data: dict) -> bool:
        self.errors = []
        email = data.get('email', '')

        if not email:
            self.errors.append("Email is required")
            return False

        if '@' not in email:
            self.errors.append("Email must contain @")
            return False

        if '.' not in email.split('@')[1]:
            self.errors.append("Email must have valid domain")
            return False

        return True

    def get_errors(self) -> List[str]:
        return self.errors

# Composed class using dependency injection
class UserService:
    """Service composed of various components."""

    def __init__(
        self,
        renderer: Renderer,
        logger: Logger,
        validator: Validator
    ):
        self._renderer = renderer
        self._logger = logger
        self._validator = validator

    def create_user(self, user_data: dict) -> Optional[str]:
        """Create user using composed components."""
        self._logger.log(f"Creating user: {user_data.get('email')}", "INFO")

        # Use validator component
        if not self._validator.validate(user_data):
            errors = self._validator.get_errors()
            self._logger.log(f"Validation failed: {errors}", "ERROR")
            return None

        # Process user creation
        user_content = f"User created: {user_data['email']}"

        # Use renderer component
        rendered = self._renderer.render(user_content)
        self._logger.log("User created successfully", "INFO")

        return rendered

# Component swapping at runtime
class CompositeLogger:
    """Logger that delegates to multiple loggers."""

    def __init__(self, loggers: List[Logger]):
        self._loggers = loggers

    def log(self, message: str, level: str) -> None:
        for logger in self._loggers:
            logger.log(message, level)

    def add_logger(self, logger: Logger) -> None:
        self._loggers.append(logger)

# Usage with different compositions
html_service = UserService(
    renderer=HTMLRenderer(),
    logger=ConsoleLogger(),
    validator=EmailValidator()
)

markdown_service = UserService(
    renderer=MarkdownRenderer(),
    logger=CompositeLogger([ConsoleLogger(), FileLogger('app.log')]),
    validator=EmailValidator()
)
```

### Strategy Pattern with Composition in C #

```csharp
// Strategy interfaces
public interface IPaymentStrategy
{
    PaymentResult ProcessPayment(decimal amount);
    bool IsAvailable();
}

public interface IShippingStrategy
{
    decimal CalculateCost(decimal weight, string destination);
    int EstimateDeliveryDays();
}

public interface IDiscountStrategy
{
    decimal ApplyDiscount(decimal originalPrice);
}

// Concrete strategies
public class CreditCardPayment : IPaymentStrategy
{
    private readonly string _cardNumber;
    private readonly string _cvv;

    public CreditCardPayment(string cardNumber, string cvv)
    {
        _cardNumber = cardNumber;
        _cvv = cvv;
    }

    public PaymentResult ProcessPayment(decimal amount)
    {
        // Credit card processing logic
        Console.WriteLine($"Processing ${amount} via credit card");
        return PaymentResult.Success(Guid.NewGuid().ToString());
    }

    public bool IsAvailable() => true;
}

public class PayPalPayment : IPaymentStrategy
{
    private readonly string _email;

    public PayPalPayment(string email)
    {
        _email = email;
    }

    public PaymentResult ProcessPayment(decimal amount)
    {
        Console.WriteLine($"Processing ${amount} via PayPal");
        return PaymentResult.Success(Guid.NewGuid().ToString());
    }

    public bool IsAvailable() => true;
}

public class StandardShipping : IShippingStrategy
{
    public decimal CalculateCost(decimal weight, string destination)
    {
        return weight * 2.5m;
    }

    public int EstimateDeliveryDays() => 7;
}

public class ExpressShipping : IShippingStrategy
{
    public decimal CalculateCost(decimal weight, string destination)
    {
        return weight * 5.0m;
    }

    public int EstimateDeliveryDays() => 2;
}

public class PercentageDiscount : IDiscountStrategy
{
    private readonly decimal _percentage;

    public PercentageDiscount(decimal percentage)
    {
        _percentage = percentage;
    }

    public decimal ApplyDiscount(decimal originalPrice)
    {
        return originalPrice * (1 - _percentage / 100);
    }
}

public class FixedAmountDiscount : IDiscountStrategy
{
    private readonly decimal _amount;

    public FixedAmountDiscount(decimal amount)
    {
        _amount = amount;
    }

    public decimal ApplyDiscount(decimal originalPrice)
    {
        return Math.Max(0, originalPrice - _amount);
    }
}

// Composed order processor
public class OrderProcessor
{
    private IPaymentStrategy _paymentStrategy;
    private IShippingStrategy _shippingStrategy;
    private IDiscountStrategy? _discountStrategy;

    public OrderProcessor(
        IPaymentStrategy paymentStrategy,
        IShippingStrategy shippingStrategy,
        IDiscountStrategy? discountStrategy = null)
    {
        _paymentStrategy = paymentStrategy ?? throw new ArgumentNullException(nameof(paymentStrategy));
        _shippingStrategy = shippingStrategy ?? throw new ArgumentNullException(nameof(shippingStrategy));
        _discountStrategy = discountStrategy;
    }

    // Strategy can be changed at runtime
    public void SetPaymentStrategy(IPaymentStrategy strategy)
    {
        _paymentStrategy = strategy ?? throw new ArgumentNullException(nameof(strategy));
    }

    public void SetShippingStrategy(IShippingStrategy strategy)
    {
        _shippingStrategy = strategy ?? throw new ArgumentNullException(nameof(strategy));
    }

    public void SetDiscountStrategy(IDiscountStrategy? strategy)
    {
        _discountStrategy = strategy;
    }

    public OrderResult ProcessOrder(Order order)
    {
        // Calculate total
        decimal subtotal = order.Items.Sum(item => item.Price * item.Quantity);

        // Apply discount
        decimal total = _discountStrategy?.ApplyDiscount(subtotal) ?? subtotal;

        // Calculate shipping
        decimal shippingCost = _shippingStrategy.CalculateCost(order.TotalWeight, order.Destination);
        total += shippingCost;

        // Process payment
        if (!_paymentStrategy.IsAvailable())
        {
            return OrderResult.Failed("Payment method not available");
        }

        var paymentResult = _paymentStrategy.ProcessPayment(total);
        if (!paymentResult.IsSuccess)
        {
            return OrderResult.Failed("Payment failed");
        }

        return OrderResult.Success(
            order.Id,
            total,
            _shippingStrategy.EstimateDeliveryDays()
        );
    }
}

// Usage
var processor = new OrderProcessor(
    new CreditCardPayment("1234-5678-9012-3456", "123"),
    new StandardShipping(),
    new PercentageDiscount(10)
);

// Change strategy at runtime
processor.SetShippingStrategy(new ExpressShipping());
processor.SetDiscountStrategy(new FixedAmountDiscount(20));
```

## Mixin Pattern

### Mixins in Python

```python
from typing import Any
import json

# Mixin classes providing specific functionality
class JsonSerializableMixin:
    """Mixin to add JSON serialization."""

    def to_json(self) -> str:
        """Serialize object to JSON."""
        return json.dumps(self.__dict__)

    @classmethod
    def from_json(cls, json_str: str) -> Any:
        """Deserialize from JSON."""
        data = json.loads(json_str)
        return cls(**data)

class TimestampMixin:
    """Mixin to add timestamp tracking."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.created_at = datetime.now()
        self.updated_at = datetime.now()

    def touch(self) -> None:
        """Update the updated_at timestamp."""
        self.updated_at = datetime.now()

class ValidationMixin:
    """Mixin to add validation capabilities."""

    def validate(self) -> bool:
        """Validate object state."""
        errors = self.get_validation_errors()
        return len(errors) == 0

    def get_validation_errors(self) -> List[str]:
        """Get list of validation errors."""
        errors = []
        for attr_name, attr_value in self.__dict__.items():
            if attr_value is None and not attr_name.startswith('_'):
                errors.append(f"{attr_name} is required")
        return errors

class AuditMixin:
    """Mixin to add audit trail."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._changes: List[dict] = []

    def record_change(self, field: str, old_value: Any, new_value: Any) -> None:
        """Record a change to the audit trail."""
        self._changes.append({
            'field': field,
            'old_value': old_value,
            'new_value': new_value,
            'timestamp': datetime.now()
        })

    def get_audit_trail(self) -> List[dict]:
        """Get the audit trail."""
        return self._changes.copy()

# Combining mixins with a base class
class User(TimestampMixin, JsonSerializableMixin, ValidationMixin, AuditMixin):
    """User class with multiple mixed-in behaviors."""

    def __init__(self, username: str, email: str, age: int):
        super().__init__()
        self._username = username
        self._email = email
        self._age = age

    @property
    def username(self) -> str:
        return self._username

    @username.setter
    def username(self, value: str) -> None:
        old_value = self._username
        self._username = value
        self.touch()
        self.record_change('username', old_value, value)

    @property
    def email(self) -> str:
        return self._email

    @email.setter
    def email(self, value: str) -> None:
        old_value = self._email
        self._email = value
        self.touch()
        self.record_change('email', old_value, value)

    def get_validation_errors(self) -> List[str]:
        """Override to add specific validation."""
        errors = super().get_validation_errors()

        if len(self._username) < 3:
            errors.append("Username must be at least 3 characters")

        if '@' not in self._email:
            errors.append("Email must be valid")

        if self._age < 18:
            errors.append("User must be at least 18 years old")

        return errors

# Usage
user = User("john_doe", "john@example.com", 25)
user.username = "jane_doe"
print(user.to_json())
print(user.get_audit_trail())
print(user.validate())
```

## Interface Segregation

### Multiple Interfaces in Java

```java
// Segregated interfaces - clients only depend on what they need
interface Readable {
    String read();
}

interface Writable {
    void write(String content);
}

interface Appendable {
    void append(String content);
}

interface Searchable {
    List<String> search(String query);
}

// Read-only document
class ReadOnlyDocument implements Readable {
    private final String content;

    public ReadOnlyDocument(String content) {
        this.content = content;
    }

    @Override
    public String read() {
        return content;
    }
}

// Full-featured document
class Document implements Readable, Writable, Appendable, Searchable {
    private StringBuilder content;

    public Document(String initialContent) {
        this.content = new StringBuilder(initialContent);
    }

    @Override
    public String read() {
        return content.toString();
    }

    @Override
    public void write(String newContent) {
        content = new StringBuilder(newContent);
    }

    @Override
    public void append(String additionalContent) {
        content.append(additionalContent);
    }

    @Override
    public List<String> search(String query) {
        List<String> results = new ArrayList<>();
        String[] lines = content.toString().split("\n");
        for (String line : lines) {
            if (line.contains(query)) {
                results.add(line);
            }
        }
        return results;
    }
}

// Client that only needs reading
class DocumentViewer {
    private final Readable document;

    public DocumentViewer(Readable document) {
        this.document = document;
    }

    public void display() {
        System.out.println(document.read());
    }
}

// Client that needs reading and searching
class DocumentSearcher {
    private final Readable readable;
    private final Searchable searchable;

    public DocumentSearcher(Readable readable, Searchable searchable) {
        this.readable = readable;
        this.searchable = searchable;
    }

    public void findAndDisplay(String query) {
        List<String> results = searchable.search(query);
        results.forEach(System.out::println);
    }
}
```

## When to Use This Skill

Apply inheritance and composition when:

1. Designing class hierarchies with shared behavior
2. Modeling IS-A relationships (inheritance)
3. Modeling HAS-A relationships (composition)
4. Creating extensible frameworks
5. Implementing template methods
6. Building flexible, configurable systems
7. Avoiding code duplication across related classes
8. Supporting runtime behavior changes (composition)
9. Implementing the strategy pattern
10. Creating plugin architectures
11. Building testable code with dependency injection
12. Avoiding deep inheritance hierarchies
13. Supporting multiple implementations of behavior
14. Creating reusable components
15. Implementing interface segregation

## Best Practices

1. Favor composition over inheritance for flexibility
2. Use inheritance for true IS-A relationships
3. Keep inheritance hierarchies shallow (2-3 levels max)
4. Make base classes abstract when appropriate
5. Use interfaces/protocols for behavior contracts
6. Prefer small, focused interfaces over large ones
7. Use dependency injection for composable designs
8. Document the template method pattern clearly
9. Override methods properly with super calls when needed
10. Use final/sealed to prevent further inheritance
11. Compose behavior from small, single-purpose components
12. Use the strategy pattern for runtime behavior changes
13. Avoid protected fields, use protected methods instead
14. Make composed objects immutable when possible
15. Test each component independently

## Common Pitfalls

1. Creating deep inheritance hierarchies
2. Using inheritance for code reuse alone
3. Inheriting from concrete classes
4. Breaking Liskov Substitution Principle
5. Creating God classes with too many responsibilities
6. Overusing inheritance when composition would work better
7. Making everything inherit from a common base class
8. Using protected fields instead of private
9. Forgetting to call super() in constructors
10. Creating circular dependencies in composition
11. Not considering the fragile base class problem
12. Using implementation inheritance over interface inheritance
13. Creating tight coupling through inheritance
14. Not properly overriding equals/hashCode in subclasses
15. Mixing concerns in base classes

## Resources

- Design Patterns: Elements of Reusable Object-Oriented Software
- Effective Java by Joshua Bloch (Favor composition over inheritance)
- Head First Design Patterns
- Python Multiple Inheritance: <https://docs.python.org/3/tutorial/classes.html#multiple-inheritance>
- C# Inheritance: <https://docs.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/inheritance>
- Java Inheritance Tutorial: <https://docs.oracle.com/javase/tutorial/java/IandI/subclasses.html>
- TypeScript Classes: <https://www.typescriptlang.org/docs/handbook/2/classes.html>
