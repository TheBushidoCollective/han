---
name: ruby-metaprogramming
description: Use when working with Ruby metaprogramming features including dynamic method definition, method_missing, class_eval, define_method, and reflection.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# Ruby Metaprogramming

Master Ruby's powerful metaprogramming capabilities to write code that writes code. Ruby's dynamic nature makes it exceptionally good at metaprogramming.

## Dynamic Method Definition

### define_method

```ruby
class Person
  [:name, :age, :email].each do |attribute|
    define_method(attribute) do
      instance_variable_get("@#{attribute}")
    end

    define_method("#{attribute}=") do |value|
      instance_variable_set("@#{attribute}", value)
    end
  end
end

person = Person.new
person.name = "Alice"
puts person.name  # "Alice"
```

### class_eval and instance_eval

```ruby
# class_eval - Evaluates code in context of a class
class MyClass
end

MyClass.class_eval do
  def hello
    "Hello from class_eval"
  end
end

puts MyClass.new.hello

# instance_eval - Evaluates code in context of an instance
obj = Object.new
obj.instance_eval do
  def greet
    "Hello from instance_eval"
  end
end

puts obj.greet
```

### module_eval

```ruby
module MyModule
end

MyModule.module_eval do
  def self.info
    "Module metaprogramming"
  end
end

puts MyModule.info
```

## Method Missing

### Basic method_missing

```ruby
class DynamicFinder
  def initialize(data)
    @data = data
  end

  def method_missing(method_name, *args)
    if method_name.to_s.start_with?("find_by_")
      attribute = method_name.to_s.sub("find_by_", "")
      @data.find { |item| item[attribute.to_sym] == args.first }
    else
      super
    end
  end

  def respond_to_missing?(method_name, include_private = false)
    method_name.to_s.start_with?("find_by_") || super
  end
end

users = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 }
]

finder = DynamicFinder.new(users)
puts finder.find_by_name("Alice")  # {:name=>"Alice", :age=>30}
```

### Const Missing

```ruby
class DynamicConstants
  def self.const_missing(const_name)
    puts "Constant #{const_name} not found, creating it..."
    const_set(const_name, "Dynamic value for #{const_name}")
  end
end

puts DynamicConstants::SOMETHING  # "Dynamic value for SOMETHING"
```

## send and public_send

```ruby
class Calculator
  def add(x, y)
    x + y
  end

  private

  def secret_method
    "This is private"
  end
end

calc = Calculator.new

# send can call any method (including private)
puts calc.send(:add, 3, 4)           # 7
puts calc.send(:secret_method)       # "This is private"

# public_send only calls public methods
puts calc.public_send(:add, 3, 4)    # 7
# calc.public_send(:secret_method)   # NoMethodError
```

## Class Macros

```ruby
class ActiveModel
  def self.attr_with_history(attribute)
    define_method(attribute) do
      instance_variable_get("@#{attribute}")
    end

    define_method("#{attribute}=") do |value|
      history = instance_variable_get("@#{attribute}_history") || []
      history << value
      instance_variable_set("@#{attribute}_history", history)
      instance_variable_set("@#{attribute}", value)
    end

    define_method("#{attribute}_history") do
      instance_variable_get("@#{attribute}_history") || []
    end
  end
end

class Person < ActiveModel
  attr_with_history :name
end

person = Person.new
person.name = "Alice"
person.name = "Alicia"
puts person.name_history.inspect  # ["Alice", "Alicia"]
```

## Singleton Methods

```ruby
obj = "hello"

# Define method on single instance
def obj.shout
  self.upcase + "!!!"
end

puts obj.shout  # "HELLO!!!"

# Using define_singleton_method
obj.define_singleton_method(:whisper) do
  self.downcase + "..."
end

puts obj.whisper  # "hello..."
```

## Eigenclass (Singleton Class)

```ruby
class Person
  def self.species
    "Homo sapiens"
  end
end

# Accessing eigenclass
eigenclass = class << Person
  self
end

puts eigenclass  # #<Class:Person>

# Adding class methods via eigenclass
class Person
  class << self
    def count
      @@count ||= 0
    end

    def increment_count
      @@count ||= 0
      @@count += 1
    end
  end
end

Person.increment_count
puts Person.count  # 1
```

## Reflection and Introspection

### Object Introspection

```ruby
class MyClass
  def public_method; end
  protected
  def protected_method; end
  private
  def private_method; end
end

obj = MyClass.new

# List methods
puts obj.methods.include?(:public_method)
puts obj.private_methods.include?(:private_method)
puts obj.protected_methods.include?(:protected_method)

# Check method existence
puts obj.respond_to?(:public_method)       # true
puts obj.respond_to?(:private_method)      # false
puts obj.respond_to?(:private_method, true) # true (include private)

# Get method object
method = obj.method(:public_method)
puts method.class  # Method
```

### Class Introspection

```ruby
class Parent
  def parent_method; end
end

class Child < Parent
  def child_method; end
end

# Inheritance chain
puts Child.ancestors  # [Child, Parent, Object, Kernel, BasicObject]

# Instance methods
puts Child.instance_methods(false)  # Only Child's methods

# Class variables and instance variables
class Person
  @@count = 0
  def initialize(name)
    @name = name
  end
end

puts Person.class_variables        # [:@@count]
person = Person.new("Alice")
puts person.instance_variables     # [:@name]
```

## Hook Methods

### Inheritance Hooks

```ruby
class BaseClass
  def self.inherited(subclass)
    puts "#{subclass} inherited from #{self}"
    subclass.instance_variable_set(:@inherited_at, Time.now)
  end
end

class ChildClass < BaseClass
end
# Output: ChildClass inherited from BaseClass
```

### Method Hooks

```ruby
module Monitored
  def self.included(base)
    base.extend(ClassMethods)
  end

  module ClassMethods
    def method_added(method_name)
      puts "Method #{method_name} was added to #{self}"
    end

    def method_removed(method_name)
      puts "Method #{method_name} was removed from #{self}"
    end
  end
end

class MyClass
  include Monitored

  def my_method
  end
  # Output: Method my_method was added to MyClass
end
```

### included and extended

```ruby
module MyModule
  def self.included(base)
    puts "#{self} included in #{base}"
    base.extend(ClassMethods)
  end

  def self.extended(base)
    puts "#{self} extended by #{base}"
  end

  module ClassMethods
    def class_method
      "I'm a class method"
    end
  end

  def instance_method
    "I'm an instance method"
  end
end

class MyClass
  include MyModule  # Adds instance_method as instance method
end

class AnotherClass
  extend MyModule   # Adds instance_method as class method
end
```

## DSL Creation

```ruby
class RouteBuilder
  def initialize
    @routes = {}
  end

  def get(path, &block)
    @routes[path] = { method: :get, handler: block }
  end

  def post(path, &block)
    @routes[path] = { method: :post, handler: block }
  end

  def routes
    @routes
  end
end

# DSL usage
builder = RouteBuilder.new
builder.instance_eval do
  get "/users" do
    "List of users"
  end

  post "/users" do
    "Create user"
  end
end

puts builder.routes
```

## Dynamic Class Creation

```ruby
# Create class dynamically
MyClass = Class.new do
  define_method :greet do
    "Hello from dynamic class"
  end
end

puts MyClass.new.greet

# Create class with inheritance
Parent = Class.new do
  def parent_method
    "From parent"
  end
end

Child = Class.new(Parent) do
  def child_method
    "From child"
  end
end

child = Child.new
puts child.parent_method
puts child.child_method
```

## Object Extension

```ruby
module Greetable
  def greet
    "Hello!"
  end
end

obj = Object.new
obj.extend(Greetable)
puts obj.greet  # "Hello!"

# Only this instance has the method
another_obj = Object.new
# another_obj.greet  # NoMethodError
```

## Binding and eval

```ruby
def get_binding(param)
  local_var = "local value"
  binding
end

b = get_binding("test")

# Evaluate code in the binding context
puts eval("param", b)      # "test"
puts eval("local_var", b)  # "local value"

# instance_eval with binding
class MyClass
  def initialize
    @value = 42
  end
end

obj = MyClass.new
puts obj.instance_eval { @value }  # 42
```

## TracePoint

```ruby
trace = TracePoint.new(:call, :return) do |tp|
  puts "#{tp.event}: #{tp.method_id} in #{tp.defined_class}"
end

trace.enable

def my_method
  "Hello"
end

my_method

trace.disable
```

## Best Practices

1. **Use metaprogramming sparingly** - it can make code hard to understand
2. **Always implement respond_to_missing?** when using method_missing
3. **Prefer define_method over class_eval** when possible
4. **Document metaprogramming heavily** - it's not obvious what's happening
5. **Use public_send over send** to respect visibility
6. **Cache metaprogrammed methods** to avoid repeated definition
7. **Test metaprogrammed code thoroughly** - bugs can be subtle

## Anti-Patterns

❌ **Don't overuse method_missing** - it's slow and hard to debug
❌ **Don't use eval with user input** - major security risk
❌ **Don't metaprogram when simple code works** - clarity over cleverness
❌ **Don't forget to call super** in method_missing
❌ **Don't create methods without documenting them** - IDE support breaks

## Common Use Cases

- **ORMs** (ActiveRecord) - Dynamic finders, associations
- **DSLs** - Route definitions, configurations
- **Decorators** - Method wrapping and enhancement
- **Mocking/Stubbing** - Test frameworks
- **Attribute definition** - Custom accessors with behavior

## Related Skills

- ruby-oop - Understanding classes and modules
- ruby-blocks-procs-lambdas - For callbacks and dynamic behavior
- ruby-gems - Many gems use metaprogramming extensively
