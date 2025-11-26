---
name: ecto-schemas
description: Use when defining and working with Ecto schemas including field types, associations, and embedded schemas. Use when modeling database entities in Elixir.
allowed-tools:
  - Bash
  - Read
---

# Ecto Schemas

Master Ecto schema definitions to model your database entities effectively in Elixir applications.

## Basic Schema Definition

```elixir
defmodule MyApp.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  schema "users" do
    field :email, :string
    field :name, :string
    field :age, :integer
    field :is_active, :boolean, default: true
    field :role, Ecto.Enum, values: [:user, :admin, :moderator]

    timestamps()
  end

  def changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :name, :age, :is_active, :role])
    |> validate_required([:email, :name])
    |> validate_format(:email, ~r/@/)
    |> validate_number(:age, greater_than: 0)
    |> unique_constraint(:email)
  end
end
```

## Field Types

```elixir
schema "products" do
  # Basic types
  field :name, :string
  field :price, :decimal
  field :quantity, :integer
  field :is_available, :boolean
  field :rating, :float

  # Date and time
  field :released_on, :date
  field :sale_starts_at, :naive_datetime
  field :sale_ends_at, :utc_datetime

  # Complex types
  field :tags, {:array, :string}
  field :metadata, :map
  field :settings, {:map, :string}  # map with string values

  # Binary data
  field :image_data, :binary
  field :uuid, :binary_id

  timestamps()
end
```

## Associations

```elixir
defmodule MyApp.Blog.Post do
  use Ecto.Schema

  schema "posts" do
    field :title, :string
    field :body, :string

    # Belongs to
    belongs_to :author, MyApp.Accounts.User

    # Has many
    has_many :comments, MyApp.Blog.Comment

    # Has one
    has_one :featured_image, MyApp.Blog.Image

    # Many to many
    many_to_many :tags, MyApp.Blog.Tag, join_through: "posts_tags"

    timestamps()
  end
end

defmodule MyApp.Blog.Comment do
  use Ecto.Schema

  schema "comments" do
    field :content, :string

    belongs_to :post, MyApp.Blog.Post
    belongs_to :user, MyApp.Accounts.User

    timestamps()
  end
end
```

## Embedded Schemas

```elixir
defmodule MyApp.Accounts.Address do
  use Ecto.Schema

  # Embedded schema - stored as JSON in parent
  embedded_schema do
    field :street, :string
    field :city, :string
    field :state, :string
    field :zip, :string
    field :country, :string, default: "US"
  end

  def changeset(address, attrs) do
    address
    |> cast(attrs, [:street, :city, :state, :zip, :country])
    |> validate_required([:street, :city, :state, :zip])
  end
end

defmodule MyApp.Accounts.User do
  use Ecto.Schema

  schema "users" do
    field :name, :string

    # Single embedded
    embeds_one :billing_address, MyApp.Accounts.Address, on_replace: :update

    # Multiple embedded
    embeds_many :shipping_addresses, MyApp.Accounts.Address, on_replace: :delete

    timestamps()
  end

  def changeset(user, attrs) do
    user
    |> cast(attrs, [:name])
    |> cast_embed(:billing_address)
    |> cast_embed(:shipping_addresses)
  end
end
```

## Virtual Fields

```elixir
defmodule MyApp.Accounts.User do
  use Ecto.Schema

  schema "users" do
    field :email, :string
    field :password_hash, :string

    # Virtual fields - not persisted
    field :password, :string, virtual: true
    field :password_confirmation, :string, virtual: true
    field :full_name, :string, virtual: true

    timestamps()
  end

  def changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :password, :password_confirmation])
    |> validate_required([:email, :password])
    |> validate_confirmation(:password)
    |> hash_password()
  end

  defp hash_password(changeset) do
    case get_change(changeset, :password) do
      nil -> changeset
      password -> put_change(changeset, :password_hash, Bcrypt.hash_pwd_salt(password))
    end
  end
end
```

## When to Use This Skill

Use ecto-schemas when you need to:

- Define database table structures
- Model relationships between entities
- Create embedded documents
- Handle complex data types
- Implement virtual computed fields

## Best Practices

- Use meaningful schema module names
- Keep schemas focused on data structure
- Use embedded schemas for nested JSON
- Define changesets in the schema module
- Use Ecto.Enum for constrained values
- Add database constraints with unique_constraint

## Common Pitfalls

- Forgetting timestamps() in schemas
- Not handling on_replace for embeds
- Mixing business logic into schemas
- Forgetting to add associations on both sides
- Not using virtual fields for sensitive data
- Overusing embedded schemas when separate tables are better
