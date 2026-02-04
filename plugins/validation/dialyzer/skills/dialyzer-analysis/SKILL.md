---
name: dialyzer-analysis
description: Use when analyzing and fixing Dialyzer warnings and type discrepancies in Erlang/Elixir code.
allowed-tools: []
---

# Dialyzer Analysis

Understanding and fixing Dialyzer warnings in Erlang and Elixir code.

## Type Specifications

### Basic Specs

```elixir
@spec add(integer(), integer()) :: integer()
def add(a, b), do: a + b

@spec get_user(pos_integer()) :: {:ok, User.t()} | {:error, atom()}
def get_user(id) do
  # implementation
end
```

### Complex Types

```elixir
@type user :: %{
  id: pos_integer(),
  name: String.t(),
  email: String.t(),
  role: :admin | :user | :guest
}

@spec process_users([user()]) :: {:ok, [user()]} | {:error, String.t()}
```

### Generic Types

```elixir
@spec map_values(map(), (any() -> any())) :: map()
@spec filter_list([t], (t -> boolean())) :: [t] when t: any()
```

## Common Warnings

### Pattern Match Coverage

```elixir
# Warning: pattern match is not exhaustive
case value do
  :ok -> :success
  # Missing :error case
end

# Fixed
case value do
  :ok -> :success
  :error -> :failure
  _ -> :unknown
end
```

### No Return

```elixir
# Warning: function has no local return
def always_raises do
  raise "error"
end

# Fixed with spec
@spec always_raises :: no_return()
def always_raises do
  raise "error"
end
```

### Unmatched Returns

```elixir
# Warning: unmatched return
def process do
  {:error, "failed"}  # Return value not used
  :ok
end

# Fixed
def process do
  case do_something() do
    {:error, reason} -> handle_error(reason)
    :ok -> :ok
  end
end
```

### Unknown Functions

```elixir
# Warning: unknown function
SomeModule.undefined_function()

# Fixed: ensure function exists or handle dynamically
if Code.ensure_loaded?(SomeModule) and
   function_exported?(SomeModule, :function_name, 1) do
  SomeModule.function_name(arg)
end
```

## Type Analysis Patterns

### Union Types

```elixir
@type result :: :ok | {:ok, any()} | {:error, String.t()}

@spec handle_result(result()) :: any()
def handle_result(:ok), do: nil
def handle_result({:ok, value}), do: value
def handle_result({:error, msg}), do: Logger.error(msg)
```

### Opaque Types

```elixir
@opaque internal_state :: %{data: map(), timestamp: integer()}

@spec new() :: internal_state()
def new, do: %{data: %{}, timestamp: System.system_time()}
```

### Remote Types

```elixir
@spec process_conn(Plug.Conn.t()) :: Plug.Conn.t()
@spec format_date(Date.t()) :: String.t()
```

## Success Typing

Dialyzer uses success typing:

- Approximates what a function can succeed with
- Different from traditional type systems
- May miss some errors, but no false positives (in theory)

### Example

```elixir
# Dialyzer infers: integer() -> integer()
def double(x), do: x * 2

# More specific spec
@spec double(pos_integer()) :: pos_integer()
def double(x) when x > 0, do: x * 2
```

## Best Practices

1. **Start with Core Modules**: Add specs to public APIs first
2. **Use Strict Types**: Prefer specific types over `any()`
3. **Document Assumptions**: Use specs to document expected behavior
4. **Test Specs**: Ensure specs match actual behavior
5. **Iterative Fixing**: Fix warnings incrementally

## Debugging Tips

### Verbose Output

```bash
mix dialyzer --format dialyzer
```

### Explain Warnings

```bash
mix dialyzer --explain
```

### Check Specific Files

```bash
mix dialyzer lib/my_module.ex
```
