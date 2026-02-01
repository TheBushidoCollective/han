---
name: fastapi-validation
description: Use when FastAPI validation with Pydantic models. Use when building type-safe APIs with robust request/response validation.
allowed-tools:
  - Bash
  - Read
---

# FastAPI Validation

Master FastAPI validation with Pydantic for building type-safe APIs
with comprehensive request and response validation.

## Pydantic BaseModel Fundamentals

Core Pydantic patterns with Pydantic v2.

```python
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

# Basic model
class User(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

# With defaults and optional fields
class UserCreate(BaseModel):
    name: str
    email: str
    age: Optional[int] = None
    is_active: bool = True

# With Field constraints
class Product(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    price: float = Field(..., gt=0, le=1000000)
    quantity: int = Field(default=0, ge=0)
    description: Optional[str] = Field(None, max_length=500)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
        json_schema_extra={
            'example': {
                'name': 'Widget',
                'price': 29.99,
                'quantity': 100,
                'description': 'A useful widget'
            }
        }
    )
```

## Request Body Validation

Validating complex request bodies.

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr, Field
from typing import List

app = FastAPI()

# Simple request validation
class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    age: int = Field(..., ge=13, le=120)

@app.post('/users')
async def create_user(user: CreateUserRequest):
    # user is automatically validated
    return {'username': user.username, 'email': user.email}

# Nested models
class Address(BaseModel):
    street: str
    city: str
    state: str = Field(..., min_length=2, max_length=2)
    zip_code: str = Field(..., pattern=r'^\d{5}(-\d{4})?$')

class UserProfile(BaseModel):
    name: str
    email: EmailStr
    address: Address
    phone: Optional[str] = Field(None, pattern=r'^\+?1?\d{9,15}$')

@app.post('/profiles')
async def create_profile(profile: UserProfile):
    return profile

# List validation
class BulkCreateRequest(BaseModel):
    users: List[CreateUserRequest] = Field(..., min_length=1, max_length=100)

@app.post('/users/bulk')
async def bulk_create_users(request: BulkCreateRequest):
    return {'count': len(request.users)}

# Complex nested structures
class Tag(BaseModel):
    name: str
    color: str = Field(..., pattern=r'^#[0-9A-Fa-f]{6}$')

class Post(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str
    tags: List[Tag] = []
    author: UserProfile
    published: bool = False

@app.post('/posts')
async def create_post(post: Post):
    return post
```

## Query Parameter Validation

Validating query parameters with Field constraints.

```python
from fastapi import FastAPI, Query
from typing import Optional, List
from enum import Enum

app = FastAPI()

# Simple query params
@app.get('/users')
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None, min_length=3, max_length=50)
):
    return {'skip': skip, 'limit': limit, 'search': search}

# Enum validation
class SortOrder(str, Enum):
    asc = 'asc'
    desc = 'desc'

class SortField(str, Enum):
    name = 'name'
    created_at = 'created_at'
    updated_at = 'updated_at'

@app.get('/items')
async def get_items(
    sort_by: SortField = Query(SortField.created_at),
    order: SortOrder = Query(SortOrder.desc)
):
    return {'sort_by': sort_by, 'order': order}

# Multiple values
@app.get('/filter')
async def filter_items(
    tags: List[str] = Query([]),
    categories: List[int] = Query([], max_length=10)
):
    return {'tags': tags, 'categories': categories}

# Regex pattern
@app.get('/search')
async def search(
    q: str = Query(..., min_length=1, max_length=100, pattern=r'^[a-zA-Z0-9\s]+$')
):
    return {'query': q}
```

## Path Parameter Validation

Validating URL path parameters.

```python
from fastapi import FastAPI, Path
from typing import Annotated

app = FastAPI()

@app.get('/users/{user_id}')
async def get_user(
    user_id: int = Path(..., gt=0, description='The user ID')
):
    return {'user_id': user_id}

@app.get('/items/{item_id}/reviews/{review_id}')
async def get_review(
    item_id: Annotated[int, Path(gt=0)],
    review_id: Annotated[int, Path(gt=0)]
):
    return {'item_id': item_id, 'review_id': review_id}

# String path validation
@app.get('/categories/{category_name}')
async def get_category(
    category_name: str = Path(..., min_length=1, max_length=50, pattern=r'^[a-z-]+$')
):
    return {'category': category_name}
```

## Custom Validators

Field validators and model validators with Pydantic v2.

```python
from pydantic import BaseModel, field_validator, model_validator
from typing import Any
import re

class UserRegistration(BaseModel):
    username: str
    email: str
    password: str
    password_confirm: str

    @field_validator('username')
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username must be alphanumeric')
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters')
        return v.lower()

    @field_validator('email')
    @classmethod
    def validate_email_domain(cls, v: str) -> str:
        if not v.endswith(('@example.com', '@example.org')):
            raise ValueError('Email must be from example.com or example.org')
        return v.lower()

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain lowercase letter')
        if not re.search(r'[0-9]', v):
            raise ValueError('Password must contain digit')
        return v

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'UserRegistration':
        if self.password != self.password_confirm:
            raise ValueError('Passwords do not match')
        return self

# Validator with dependencies
class DateRange(BaseModel):
    start_date: datetime
    end_date: datetime

    @model_validator(mode='after')
    def check_dates(self) -> 'DateRange':
        if self.start_date >= self.end_date:
            raise ValueError('start_date must be before end_date')
        return self

# Computed fields
from pydantic import computed_field

class Product(BaseModel):
    name: str
    price: float
    tax_rate: float = 0.1

    @computed_field
    @property
    def price_with_tax(self) -> float:
        return round(self.price * (1 + self.tax_rate), 2)

# Before validator
class UserInput(BaseModel):
    name: str
    email: str

    @field_validator('name', 'email', mode='before')
    @classmethod
    def strip_whitespace(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.strip()
        return v
```

## Field Types

Specialized field types for validation.

```python
from pydantic import (
    BaseModel,
    EmailStr,
    HttpUrl,
    SecretStr,
    conint,
    constr,
    confloat,
    conlist,
    UUID4,
    IPvAnyAddress,
    FilePath,
    DirectoryPath,
    Json
)
from typing import List
from datetime import date, time

class AdvancedUser(BaseModel):
    # String constraints
    username: constr(min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9_]+$')
    bio: constr(max_length=500) | None = None

    # Email and URL
    email: EmailStr
    website: HttpUrl | None = None

    # Numeric constraints
    age: conint(ge=13, le=120)
    rating: confloat(ge=0.0, le=5.0)

    # Secret fields (won't be logged)
    password: SecretStr
    api_key: SecretStr

    # UUID
    user_id: UUID4

    # Network
    ip_address: IPvAnyAddress | None = None

    # Date and time
    birth_date: date
    preferred_time: time | None = None

    # Lists with constraints
    tags: conlist(str, min_length=1, max_length=10)

    # JSON field
    metadata: Json | None = None

# File path validation
class FileUploadConfig(BaseModel):
    upload_dir: DirectoryPath
    allowed_file: FilePath | None = None
```

## Nested Models and Composition

Building complex models from simpler ones.

```python
from pydantic import BaseModel
from typing import List, Optional

# Composition
class Coordinates(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

class Location(BaseModel):
    name: str
    coordinates: Coordinates
    address: Optional[str] = None

class Event(BaseModel):
    title: str
    description: str
    location: Location
    attendees: List[str] = []

# Inheritance
class BaseUser(BaseModel):
    username: str
    email: EmailStr

class AdminUser(BaseUser):
    permissions: List[str]
    is_superuser: bool = False

class RegularUser(BaseUser):
    subscription_tier: str = 'free'

# Model reuse
class TimestampMixin(BaseModel):
    created_at: datetime
    updated_at: datetime

class Post(TimestampMixin):
    title: str
    content: str
    author_id: int

class Comment(TimestampMixin):
    content: str
    post_id: int
    author_id: int
```

## Model Configuration

ConfigDict options for model behavior.

```python
from pydantic import BaseModel, ConfigDict, Field

# Strict mode
class StrictModel(BaseModel):
    model_config = ConfigDict(strict=True)

    id: int  # Won't coerce from string
    name: str

# ORM mode (for database models)
class UserORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str

# Usage with SQLAlchemy
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class UserModel(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    name = Column(String)
    email = Column(String)

@app.get('/users/{user_id}', response_model=UserORM)
async def get_user(user_id: int, db = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    return user  # Automatically converted to UserORM

# Populate by name
class FlexibleModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: int = Field(alias='userId')
    user_name: str = Field(alias='userName')

# Allow extra fields
class ExtraFieldsModel(BaseModel):
    model_config = ConfigDict(extra='allow')

    name: str
    # Any extra fields will be stored

# Forbid extra fields
class StrictFieldsModel(BaseModel):
    model_config = ConfigDict(extra='forbid')

    name: str
    # Extra fields will raise validation error
```

## Response Models

Validating and shaping API responses.

```python
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI()

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    # Note: password excluded

    model_config = ConfigDict(from_attributes=True)

@app.post('/users', response_model=UserResponse)
async def create_user(user: UserCreate):
    # Create user in database
    db_user = create_user_in_db(user)
    return db_user  # Password automatically excluded

# Response with exclude
class UserDetail(BaseModel):
    id: int
    username: str
    email: str
    password_hash: str
    secret_key: str

@app.get('/users/{user_id}', response_model=UserDetail, response_model_exclude={'password_hash', 'secret_key'})
async def get_user_detail(user_id: int):
    return get_user_from_db(user_id)

# Response with include
@app.get('/users/{user_id}/public', response_model=UserDetail, response_model_include={'id', 'username'})
async def get_user_public(user_id: int):
    return get_user_from_db(user_id)

# List response
@app.get('/users', response_model=List[UserResponse])
async def list_users():
    return get_all_users()

# Optional response
from typing import Optional

@app.get('/users/{user_id}/optional', response_model=Optional[UserResponse])
async def get_user_optional(user_id: int):
    user = get_user_from_db(user_id)
    return user  # Can be None

# Union response
from typing import Union

class SuccessResponse(BaseModel):
    status: str = 'success'
    data: dict

class ErrorResponse(BaseModel):
    status: str = 'error'
    message: str

@app.get('/data', response_model=Union[SuccessResponse, ErrorResponse])
async def get_data():
    try:
        data = fetch_data()
        return SuccessResponse(data=data)
    except Exception as e:
        return ErrorResponse(message=str(e))
```

## Error Handling

Custom error messages and validation error handling.

```python
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

app = FastAPI()

# Custom validation error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        errors.append({
            'field': '.'.join(str(loc) for loc in error['loc'][1:]),
            'message': error['msg'],
            'type': error['type']
        })

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={'errors': errors}
    )

# Custom field error messages
class User(BaseModel):
    username: str = Field(..., min_length=3, description='Username must be at least 3 characters')
    age: int = Field(..., ge=18, description='Must be 18 or older')

# Programmatic validation
async def validate_user_data(data: dict):
    try:
        user = User(**data)
        return user
    except ValidationError as e:
        raise HTTPException(
            status_code=422,
            detail=e.errors()
        )
```

## File Upload Validation

Validating file uploads.

```python
from fastapi import FastAPI, File, UploadFile, HTTPException
from typing import List

app = FastAPI()

@app.post('/upload')
async def upload_file(file: UploadFile = File(...)):
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/gif']
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f'File type {file.content_type} not allowed'
        )

    # Validate file size
    contents = await file.read()
    max_size = 5 * 1024 * 1024  # 5MB
    if len(contents) > max_size:
        raise HTTPException(
            status_code=400,
            detail='File too large (max 5MB)'
        )

    # Validate filename
    if not file.filename.endswith(('.jpg', '.jpeg', '.png', '.gif')):
        raise HTTPException(
            status_code=400,
            detail='Invalid file extension'
        )

    return {'filename': file.filename, 'size': len(contents)}

# Multiple files
@app.post('/upload-multiple')
async def upload_multiple_files(files: List[UploadFile] = File(...)):
    if len(files) > 10:
        raise HTTPException(
            status_code=400,
            detail='Maximum 10 files allowed'
        )

    results = []
    for file in files:
        contents = await file.read()
        results.append({
            'filename': file.filename,
            'size': len(contents)
        })

    return results
```

## Form Data Validation

Validating form data submissions.

```python
from fastapi import FastAPI, Form
from pydantic import BaseModel, ValidationError

app = FastAPI()

# Simple form
@app.post('/login')
async def login(
    username: str = Form(..., min_length=3),
    password: str = Form(..., min_length=8)
):
    return {'username': username}

# Form with validation model
class LoginForm(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=8)

@app.post('/login-validated')
async def login_validated(
    username: str = Form(...),
    password: str = Form(...)
):
    try:
        form = LoginForm(username=username, password=password)
        return {'username': form.username}
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors())

# Form with file
@app.post('/profile')
async def update_profile(
    name: str = Form(..., min_length=1),
    bio: str = Form(None, max_length=500),
    avatar: UploadFile = File(None)
):
    result = {'name': name, 'bio': bio}
    if avatar:
        result['avatar_filename'] = avatar.filename
    return result
```

## Advanced Patterns

Discriminated unions and recursive models.

```python
from pydantic import BaseModel, Field, Discriminator
from typing import Literal, Union, List

# Discriminated unions
class Cat(BaseModel):
    pet_type: Literal['cat']
    meows: int

class Dog(BaseModel):
    pet_type: Literal['dog']
    barks: float

Pet = Union[Cat, Dog]

class PetOwner(BaseModel):
    name: str
    pet: Pet

@app.post('/pets')
async def create_pet(owner: PetOwner):
    # Automatically discriminates based on pet_type
    return owner

# Recursive models
class TreeNode(BaseModel):
    value: int
    children: List['TreeNode'] = []

TreeNode.model_rebuild()  # Required for recursive models

@app.post('/tree')
async def create_tree(tree: TreeNode):
    return tree

# Generic models
from typing import TypeVar, Generic

T = TypeVar('T')

class Response(BaseModel, Generic[T]):
    data: T
    message: str
    success: bool = True

class UserData(BaseModel):
    id: int
    name: str

@app.get('/user/{user_id}', response_model=Response[UserData])
async def get_user(user_id: int):
    user = UserData(id=user_id, name='John Doe')
    return Response(data=user, message='User retrieved')
```

## When to Use This Skill

Use fastapi-validation when:

- Building APIs that require strict input validation
- Ensuring type safety across request and response models
- Implementing complex validation rules and business logic
- Converting between database models and API schemas
- Documenting API schemas with OpenAPI
- Preventing invalid data from entering your system
- Building forms with server-side validation
- Handling file uploads with validation
- Creating reusable validation patterns

## FastAPI Validation Best Practices

1. **Use specific types** - Use EmailStr, HttpUrl, UUID instead of plain str
   for better validation
2. **Separate request and response** - Create different models for input and
   output
3. **Leverage computed fields** - Use computed fields for derived values
   instead of manual calculation
4. **Validate early** - Validate at API boundary before business logic
5. **Custom validators** - Create reusable validators for common patterns
6. **Meaningful error messages** - Provide clear, actionable error messages
7. **Use aliases** - Handle different naming conventions (camelCase,
   snake_case) with aliases
8. **Exclude sensitive data** - Always exclude passwords and secrets from responses
9. **ORM mode** - Enable from_attributes for database model conversion
10. **Document examples** - Use json_schema_extra to provide example data

## FastAPI Validation Common Pitfalls

1. **Missing response_model** - Not using response_model exposes all fields
   including secrets
2. **Incorrect Field usage** - Using Field without ... for required fields
   makes them optional
3. **Validator order** - Validators run in definition order, dependencies
   matter
4. **Coercion confusion** - Pydantic coerces types by default, use strict
   mode when needed
5. **Recursive model rebuild** - Forgetting model_rebuild() on recursive
   models causes errors
6. **Form data limitations** - Form data doesn't support nested models
   directly
7. **List validation** - Not setting max_length on lists can allow resource
   exhaustion
8. **Regex complexity** - Complex regex patterns can cause performance issues
9. **Timezone handling** - datetime fields need explicit timezone handling
10. **Union validation** - Union types validate in order, put more specific
    types first

## Resources

- [Pydantic V2 Documentation](https://docs.pydantic.dev/latest/)
- [FastAPI Request Body](https://fastapi.tiangolo.com/tutorial/body/)
- [FastAPI Response Model](https://fastapi.tiangolo.com/tutorial/response-model/)
- [Pydantic Field Types](https://docs.pydantic.dev/latest/api/types/)
- [Pydantic Validators](https://docs.pydantic.dev/latest/concepts/validators/)
- [FastAPI Form Data](https://fastapi.tiangolo.com/tutorial/request-forms/)
- [FastAPI File Uploads](https://fastapi.tiangolo.com/tutorial/request-files/)
- [Pydantic Configuration](https://docs.pydantic.dev/latest/api/config/)
