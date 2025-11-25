---
name: phoenix-controllers
description: Handle HTTP requests with Phoenix controllers including actions, parameters, rendering, flash messages, and redirects
allowed-tools: [Bash, Read]
---

# Phoenix Controllers

Phoenix controllers are the intermediary modules between the router and views in a Phoenix application. They handle HTTP requests, process parameters, interact with contexts, and determine what response to send back to the client. Controllers are stateless and receive a connection struct (`conn`) that represents the current HTTP request.

## Basic Controller Structure

The simplest Phoenix controller uses the `HelloWeb, :controller` macro and defines actions as functions that receive the connection and parameters:

```elixir
defmodule HelloWeb.PageController do
  use HelloWeb, :controller

  def home(conn, _params) do
    render(conn, :home, layout: false)
  end
end
```

Each controller action receives:

- `conn` - The `Plug.Conn` struct representing the HTTP request/response
- `params` - A map containing request parameters from the URL, query string, and request body

## Controller Actions and Parameter Handling

### Extracting Specific Parameters

Use pattern matching to extract specific parameters from the params map:

```elixir
defmodule HelloWeb.HelloController do
  use HelloWeb, :controller

  def show(conn, %{"messenger" => messenger}) do
    render(conn, :show, messenger: messenger)
  end
end
```

### Accessing Full Parameter Map

To access both a specific parameter and the full params map, use pattern matching with the `=` operator:

```elixir
def show(conn, %{"messenger" => messenger} = params) do
  # Access to both messenger and the full params map
  render(conn, :show, messenger: messenger)
end
```

### Ignoring Parameters

When an action doesn't need parameters, prefix the variable with an underscore to avoid compiler warnings:

```elixir
def index(conn, _params) do
  render(conn, :home)
end
```

### Renaming Actions

Action names can be customized independently of the template name:

```elixir
defmodule HelloWeb.PageController do
  use HelloWeb, :controller

  def index(conn, _params) do
    # Renders :home template but action is named :index
    render(conn, :home)
  end
end
```

Update the router accordingly:

```elixir
get "/", PageController, :index
```

## Rendering Responses

### Rendering HTML Templates

Use the `render/3` function to render HTML templates via Phoenix Views:

```elixir
defmodule HelloWeb.HelloController do
  use HelloWeb, :controller

  def show(conn, %{"messenger" => messenger}) do
    render(conn, :show, messenger: messenger)
  end
end
```

The controller and view must share a root name (e.g., `HelloController` and `HelloHTML`).

### Rendering Without Layout

Disable the layout for specific actions:

```elixir
def home(conn, _params) do
  render(conn, :home, layout: false)
end
```

## Assigning Values to Templates

### Using assign/3

Pass data to templates using `assign/3`:

```elixir
def show(conn, %{"messenger" => messenger}) do
  conn
  |> assign(:messenger, messenger)
  |> render(:show)
end
```

### Chaining Multiple Assigns

Chain multiple assigns for cleaner code:

```elixir
def show(conn, %{"messenger" => messenger}) do
  conn
  |> assign(:messenger, messenger)
  |> assign(:receiver, "Dweezil")
  |> render(:show)
end
```

### Passing Assigns Directly to render/3

For concise syntax, pass assigns directly to `render/3`:

```elixir
def show(conn, %{"messenger" => messenger}) do
  render(conn, :show, messenger: messenger, receiver: "Dweezil")
end
```

## Configuring Controller Formats

Configure supported response formats in your controller configuration:

```elixir
def controller do
  quote do
    use Phoenix.Controller,
      formats: [:html, :json]
    ...
  end
end
```

This allows controllers to respond with different formats based on the request.

## Flash Messages

### Setting Flash Messages

Use `put_flash/3` to set temporary messages:

```elixir
defmodule HelloWeb.PageController do
  use HelloWeb, :controller

  def home(conn, _params) do
    conn
    |> put_flash(:error, "Let's pretend we have an error.")
    |> render(:home, layout: false)
  end
end
```

Flash message types:

- `:info` - Informational messages
- `:error` - Error messages
- `:warning` - Warning messages (custom)
- `:success` - Success messages (custom)

### Clearing Flash Messages

Remove all flash messages from the connection:

```elixir
clear_flash(conn)
```

### Flash with Redirects

Combine flash messages with redirects to provide context after navigation:

```elixir
def home(conn, _params) do
  conn
  |> put_flash(:error, "Let's pretend we have an error.")
  |> redirect(to: ~p"/redirect_test")
end
```

## Redirects

### Basic Redirect

Redirect to another route using the verified routes syntax:

```elixir
def create(conn, params) do
  # ... create logic
  redirect(conn, to: ~p"/posts")
end
```

### Redirect with Parameters

Include dynamic parameters in redirects:

```elixir
def create(conn, params) do
  # ... create post
  redirect(conn, to: ~p"/posts/#{post}")
end
```

### External Redirects

Redirect to external URLs:

```elixir
def external(conn, _params) do
  redirect(conn, external: "https://example.com")
end
```

## Action Fallback

Action fallback controllers handle error cases elegantly by centralizing error handling logic:

```elixir
defmodule HelloWeb.MyController do
  use Phoenix.Controller

  action_fallback HelloWeb.MyFallbackController

  def show(conn, %{"id" => id}, current_user) do
    with {:ok, post} <- fetch_post(id),
         :ok <- authorize_user(current_user, :view, post) do
      render(conn, :show, post: post)
    end
  end
end
```

The fallback controller handles non-ok tuples:

```elixir
defmodule HelloWeb.MyFallbackController do
  use Phoenix.Controller

  def call(conn, {:error, :not_found}) do
    conn
    |> put_status(:not_found)
    |> put_view(HelloWeb.ErrorHTML)
    |> render(:"404")
  end

  def call(conn, {:error, :unauthorized}) do
    conn
    |> put_status(403)
    |> put_view(HelloWeb.ErrorHTML)
    |> render(:"403")
  end
end
```

## Testing Controllers

### HTML Controller Tests

Test controller actions using `ConnCase`:

```elixir
defmodule HelloWeb.PostControllerTest do
  use HelloWeb.ConnCase

  import Hello.BlogFixtures

  @create_attrs %{body: "some body", title: "some title"}
  @update_attrs %{body: "some updated body", title: "some updated title"}
  @invalid_attrs %{body: nil, title: nil}

  describe "index" do
    test "lists all posts", %{conn: conn} do
      conn = get(conn, ~p"/posts")
      assert html_response(conn, 200) =~ "Listing Posts"
    end
  end

  describe "show" do
    test "displays a single post", %{conn: conn} do
      post = post_fixture()
      conn = get(conn, ~p"/posts/#{post}")
      assert html_response(conn, 200) =~ post.title
    end
  end
end
```

### Testing Redirects

Assert redirects in tests:

```elixir
test "redirects after create", %{conn: conn} do
  conn = post(conn, ~p"/posts", post: @create_attrs)
  assert %{id: id} = redirected_params(conn)
  assert redirected_to(conn) == ~p"/posts/#{id}"
end
```

### Testing Flash Messages

Verify flash messages are set correctly:

```elixir
test "sets flash message on error", %{conn: conn} do
  conn = post(conn, ~p"/posts", post: @invalid_attrs)
  assert get_flash(conn, :error) == "Could not create post"
end
```

## When to Use This Skill

Use this skill when you need to:

1. Create new controller actions to handle HTTP requests
2. Process and validate incoming request parameters
3. Render HTML templates with dynamic data
4. Implement user feedback with flash messages
5. Handle redirects after form submissions or actions
6. Test controller behavior and responses
7. Implement error handling with action fallbacks
8. Build RESTful API endpoints
9. Integrate controller actions with Phoenix contexts
10. Manage session data and user authentication flows
11. Handle file uploads and multipart forms
12. Implement pagination for list views
13. Create custom response formats (JSON, XML, etc.)
14. Debug request/response cycles

## Best Practices

1. **Keep controllers thin** - Move business logic to contexts, keep controllers focused on HTTP concerns
2. **Use pattern matching** - Extract only the parameters you need from the params map
3. **Validate early** - Validate parameters at the controller level before passing to contexts
4. **Use action fallback** - Centralize error handling with action fallback controllers
5. **Leverage pipeline** - Use plugs for common operations like authentication and authorization
6. **Be explicit with assigns** - Pass only necessary data to templates to avoid exposing sensitive information
7. **Use verified routes** - Always use `~p` sigil for route paths to catch errors at compile time
8. **Test thoroughly** - Write comprehensive tests for all controller actions and edge cases
9. **Handle errors gracefully** - Provide meaningful error messages and appropriate HTTP status codes
10. **Use flash messages wisely** - Provide clear, actionable feedback to users after actions
11. **Avoid business logic** - Controllers should orchestrate, not implement business rules
12. **Return early** - Use guard clauses and early returns for cleaner code
13. **Consistent naming** - Follow Phoenix conventions for action names (index, show, new, create, edit, update, delete)
14. **Document complex actions** - Add comments for non-obvious controller logic
15. **Use structs over maps** - Work with structs from contexts rather than raw parameter maps when possible

## Common Pitfalls

1. **Putting business logic in controllers** - This makes code harder to test and reuse
2. **Not validating parameters** - Always validate and sanitize user input
3. **Overusing assigns** - Passing entire context modules or large data structures to views
4. **Ignoring error cases** - Not handling errors from context functions properly
5. **Hard-coding paths** - Using string paths instead of verified routes (`~p`)
6. **Not using action fallback** - Repeating error handling logic across actions
7. **Testing implementation details** - Test behavior, not internal implementation
8. **Exposing internal errors** - Leaking stack traces or internal errors to users
9. **Not setting status codes** - Forgetting to set appropriate HTTP status codes for errors
10. **Mutating params** - Attempting to modify the params map instead of using assigns
11. **Skipping CSRF protection** - Disabling security features without understanding implications
12. **Large controller files** - Creating monolithic controllers instead of splitting concerns
13. **Not using with statements** - Missing opportunities to chain operations cleanly
14. **Forgetting content negotiation** - Not handling different response formats appropriately
15. **Mixing concerns** - Handling both API and HTML responses in the same controller without proper separation

## Resources

- [Phoenix Controllers Guide](https://hexdocs.pm/phoenix/controllers.html)
- [Phoenix.Controller Documentation](https://hexdocs.pm/phoenix/Phoenix.Controller.html)
- [Plug.Conn Documentation](https://hexdocs.pm/plug/Plug.Conn.html)
- [Phoenix Testing Controllers](https://hexdocs.pm/phoenix/testing_controllers.html)
- [Phoenix Request Lifecycle](https://hexdocs.pm/phoenix/request_lifecycle.html)
