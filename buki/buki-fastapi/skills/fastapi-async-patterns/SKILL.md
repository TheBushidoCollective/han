---
name: fastapi-async-patterns
description: Use when FastAPI async patterns for building high-performance APIs. Use when handling concurrent requests and async operations.
allowed-tools:
  - Bash
  - Read
---

# FastAPI Async Patterns

Master async patterns in FastAPI for building high-performance,
concurrent APIs with optimal resource usage.

## Basic Async Route Handlers

Understanding async vs sync endpoints in FastAPI.

```python
from fastapi import FastAPI
import time
import asyncio

app = FastAPI()

# Sync endpoint (blocks the event loop)
@app.get('/sync')
def sync_endpoint():
    time.sleep(1)  # Blocks the entire server
    return {'message': 'Completed after 1 second'}

# Async endpoint (non-blocking)
@app.get('/async')
async def async_endpoint():
    await asyncio.sleep(1)  # Other requests can be handled
    return {'message': 'Completed after 1 second'}

# CPU-bound work (use sync)
@app.get('/cpu-intensive')
def cpu_intensive():
    result = sum(i * i for i in range(10000000))
    return {'result': result}

# I/O-bound work (use async)
@app.get('/io-intensive')
async def io_intensive():
    async with httpx.AsyncClient() as client:
        response = await client.get('https://api.example.com/data')
        return response.json()
```

## Async Database Operations

Async database patterns with popular ORMs and libraries.

```python
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import asyncpg
from motor.motor_asyncio import AsyncIOMotorClient
from tortoise import Tortoise
from tortoise.contrib.fastapi import register_tortoise

app = FastAPI()

# SQLAlchemy async setup
DATABASE_URL = 'postgresql+asyncpg://user:pass@localhost/db'
engine = create_async_engine(DATABASE_URL, echo=True, future=True)
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

@app.get('/users/{user_id}')
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    return user

# Direct asyncpg (lower level, faster)
async def get_asyncpg_pool():
    pool = await asyncpg.create_pool(
        'postgresql://user:pass@localhost/db',
        min_size=10,
        max_size=20
    )
    try:
        yield pool
    finally:
        await pool.close()

@app.get('/users-fast/{user_id}')
async def get_user_fast(user_id: int, pool = Depends(get_asyncpg_pool)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            'SELECT * FROM users WHERE id = $1', user_id
        )
        if not row:
            raise HTTPException(status_code=404, detail='User not found')
        return dict(row)

# MongoDB with Motor
mongo_client = AsyncIOMotorClient('mongodb://localhost:27017')
db = mongo_client.mydatabase

@app.get('/documents/{doc_id}')
async def get_document(doc_id: str):
    document = await db.collection.find_one({'_id': doc_id})
    if not document:
        raise HTTPException(status_code=404, detail='Document not found')
    return document

@app.post('/documents')
async def create_document(data: dict):
    result = await db.collection.insert_one(data)
    return {'id': str(result.inserted_id)}

# Tortoise ORM async
register_tortoise(
    app,
    db_url='postgres://user:pass@localhost/db',
    modules={'models': ['app.models']},
    generate_schemas=True,
    add_exception_handlers=True,
)

from tortoise.models import Model
from tortoise import fields

class UserModel(Model):
    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=255)
    email = fields.CharField(max_length=255)

@app.get('/tortoise-users/{user_id}')
async def get_tortoise_user(user_id: int):
    user = await UserModel.get_or_none(id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    return user
```

## Background Tasks

Fire-and-forget tasks without blocking the response.

```python
from fastapi import BackgroundTasks, FastAPI
import asyncio
from datetime import datetime

app = FastAPI()

# Simple background task
async def send_email(email: str, message: str):
    await asyncio.sleep(2)  # Simulate email sending
    print(f'Email sent to {email}: {message}')

@app.post('/send-email')
async def send_email_endpoint(
    email: str,
    message: str,
    background_tasks: BackgroundTasks
):
    background_tasks.add_task(send_email, email, message)
    return {'status': 'Email will be sent in background'}

# Multiple background tasks
async def log_activity(user_id: int, action: str):
    await asyncio.sleep(0.5)
    print(f'[{datetime.now()}] User {user_id} performed: {action}')

async def update_analytics(action: str):
    await asyncio.sleep(1)
    print(f'Analytics updated for action: {action}')

@app.post('/users/{user_id}/action')
async def perform_action(
    user_id: int,
    action: str,
    background_tasks: BackgroundTasks
):
    # Add multiple tasks
    background_tasks.add_task(log_activity, user_id, action)
    background_tasks.add_task(update_analytics, action)
    return {'status': 'Action logged'}

# Background cleanup
async def cleanup_temp_files(file_path: str):
    await asyncio.sleep(60)  # Wait before cleanup
    import os
    if os.path.exists(file_path):
        os.remove(file_path)
        print(f'Cleaned up: {file_path}')

@app.post('/upload')
async def upload_file(
    file: UploadFile,
    background_tasks: BackgroundTasks
):
    temp_path = f'/tmp/{file.filename}'
    with open(temp_path, 'wb') as f:
        content = await file.read()
        f.write(content)

    # Schedule cleanup
    background_tasks.add_task(cleanup_temp_files, temp_path)
    return {'filename': file.filename, 'path': temp_path}
```

## WebSocket Handling

Real-time bidirectional communication patterns.

```python
from fastapi import WebSocket, WebSocketDisconnect, Depends
from typing import List
import json

app = FastAPI()

# Simple WebSocket
@app.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f'Echo: {data}')
    except WebSocketDisconnect:
        print('Client disconnected')

# WebSocket with authentication
async def get_current_user_ws(websocket: WebSocket):
    token = websocket.query_params.get('token')
    if not token or not verify_token(token):
        await websocket.close(code=1008)  # Policy violation
        raise HTTPException(status_code=401, detail='Unauthorized')
    return decode_token(token)

@app.websocket('/ws/authenticated')
async def authenticated_websocket(
    websocket: WebSocket,
    user = Depends(get_current_user_ws)
):
    await websocket.accept()
    try:
        await websocket.send_text(f'Welcome {user["name"]}')
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f'{user["name"]}: {data}')
    except WebSocketDisconnect:
        print(f'User {user["name"]} disconnected')

# Broadcasting to multiple connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.websocket('/ws/chat/{client_id}')
async def chat_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    await manager.broadcast(f'Client {client_id} joined the chat')
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(f'Client {client_id}: {data}')
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(f'Client {client_id} left the chat')

# WebSocket with JSON messages
@app.websocket('/ws/json')
async def json_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get('type')

            if message_type == 'ping':
                await websocket.send_json({'type': 'pong'})
            elif message_type == 'message':
                await websocket.send_json({
                    'type': 'response',
                    'data': f'Received: {data.get("content")}'
                })
    except WebSocketDisconnect:
        print('Client disconnected')
```

## Server-Sent Events (SSE)

One-way streaming from server to client.

```python
from fastapi import FastAPI
from sse_starlette.sse import EventSourceResponse
import asyncio

app = FastAPI()

@app.get('/sse')
async def sse_endpoint():
    async def event_generator():
        for i in range(10):
            await asyncio.sleep(1)
            yield {
                'event': 'message',
                'data': f'Message {i}'
            }

    return EventSourceResponse(event_generator())

# SSE with real-time updates
@app.get('/sse/updates')
async def sse_updates():
    async def update_generator():
        while True:
            # Simulate fetching updates
            await asyncio.sleep(2)
            update = await fetch_latest_update()
            yield {
                'event': 'update',
                'data': json.dumps(update)
            }

    return EventSourceResponse(update_generator())

# SSE with heartbeat
@app.get('/sse/heartbeat')
async def sse_heartbeat():
    async def heartbeat_generator():
        try:
            while True:
                await asyncio.sleep(30)
                yield {
                    'event': 'heartbeat',
                    'data': datetime.now().isoformat()
                }
        except asyncio.CancelledError:
            print('SSE connection closed')

    return EventSourceResponse(heartbeat_generator())
```

## Streaming Responses

Stream large files or generated content.

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import io
import csv

app = FastAPI()

# Stream large file
@app.get('/download/{filename}')
async def download_file(filename: str):
    async def file_stream():
        with open(f'/data/{filename}', 'rb') as f:
            while chunk := f.read(8192):
                yield chunk

    return StreamingResponse(
        file_stream(),
        media_type='application/octet-stream',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )

# Stream generated CSV
@app.get('/export/users')
async def export_users():
    async def csv_stream():
        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow(['ID', 'Name', 'Email'])
        yield output.getvalue()
        output.truncate(0)
        output.seek(0)

        # Stream users in batches
        offset = 0
        batch_size = 100
        while True:
            users = await fetch_users_batch(offset, batch_size)
            if not users:
                break

            for user in users:
                writer.writerow([user.id, user.name, user.email])
                yield output.getvalue()
                output.truncate(0)
                output.seek(0)

            offset += batch_size

    return StreamingResponse(
        csv_stream(),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename=users.csv'}
    )

# Stream generated content
@app.get('/generate/report')
async def generate_report():
    async def report_stream():
        yield b'<html><body><h1>Report</h1>'

        for section in ['users', 'orders', 'analytics']:
            await asyncio.sleep(0.5)  # Simulate processing
            data = await fetch_section_data(section)
            yield f'<h2>{section.title()}</h2>'.encode()
            yield f'<pre>{data}</pre>'.encode()

        yield b'</body></html>'

    return StreamingResponse(report_stream(), media_type='text/html')
```

## Concurrent Request Handling

Parallel processing patterns for multiple operations.

```python
from fastapi import FastAPI
import asyncio
import httpx

app = FastAPI()

# Parallel API calls
@app.get('/aggregate/user/{user_id}')
async def aggregate_user_data(user_id: int):
    async with httpx.AsyncClient() as client:
        # Fetch from multiple sources in parallel
        profile_task = client.get(f'https://api.example.com/users/{user_id}')
        posts_task = client.get(f'https://api.example.com/users/{user_id}/posts')
        comments_task = client.get(f'https://api.example.com/users/{user_id}/comments')

        profile, posts, comments = await asyncio.gather(
            profile_task,
            posts_task,
            comments_task
        )

        return {
            'profile': profile.json(),
            'posts': posts.json(),
            'comments': comments.json()
        }

# Parallel database queries
@app.get('/dashboard')
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    # Execute multiple queries in parallel
    users_query = db.execute(select(User).limit(10))
    orders_query = db.execute(select(Order).limit(10))
    stats_query = db.execute(select(func.count(User.id)))

    users, orders, stats = await asyncio.gather(
        users_query,
        orders_query,
        stats_query
    )

    return {
        'users': users.scalars().all(),
        'orders': orders.scalars().all(),
        'total_users': stats.scalar()
    }

# Race condition (first to complete wins)
@app.get('/fastest-price/{product_id}')
async def get_fastest_price(product_id: str):
    async with httpx.AsyncClient() as client:
        tasks = [
            client.get(f'https://store1.com/price/{product_id}'),
            client.get(f'https://store2.com/price/{product_id}'),
            client.get(f'https://store3.com/price/{product_id}')
        ]

        done, pending = await asyncio.wait(
            tasks,
            return_when=asyncio.FIRST_COMPLETED
        )

        # Cancel pending requests
        for task in pending:
            task.cancel()

        result = done.pop().result()
        return result.json()
```

## Async Context Managers

Resource management with async context managers.

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
import asyncio

# Async context manager for lifespan events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print('Starting up...')
    db_pool = await create_db_pool()
    redis_client = await create_redis_client()

    # Store in app state
    app.state.db_pool = db_pool
    app.state.redis = redis_client

    yield

    # Shutdown
    print('Shutting down...')
    await db_pool.close()
    await redis_client.close()

app = FastAPI(lifespan=lifespan)

# Custom async context manager
class AsyncDatabaseSession:
    def __init__(self, pool):
        self.pool = pool
        self.conn = None

    async def __aenter__(self):
        self.conn = await self.pool.acquire()
        return self.conn

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.pool.release(self.conn)
        if exc_type is not None:
            # Handle exception
            await self.conn.rollback()
        return False

@app.get('/data')
async def get_data():
    async with AsyncDatabaseSession(app.state.db_pool) as conn:
        result = await conn.fetch('SELECT * FROM data')
        return result
```

## Connection Pooling

Efficient connection management for databases and HTTP clients.

```python
from fastapi import FastAPI, Depends
import asyncpg
import httpx
from typing import AsyncGenerator

app = FastAPI()

# Database connection pool
class DatabasePool:
    def __init__(self):
        self.pool = None

    async def create_pool(self):
        self.pool = await asyncpg.create_pool(
            'postgresql://user:pass@localhost/db',
            min_size=10,
            max_size=20,
            command_timeout=60,
            max_queries=50000,
            max_inactive_connection_lifetime=300
        )

    async def close_pool(self):
        await self.pool.close()

    async def get_connection(self):
        async with self.pool.acquire() as connection:
            yield connection

db_pool = DatabasePool()

@app.on_event('startup')
async def startup():
    await db_pool.create_pool()

@app.on_event('shutdown')
async def shutdown():
    await db_pool.close_pool()

@app.get('/users')
async def get_users(conn = Depends(db_pool.get_connection)):
    rows = await conn.fetch('SELECT * FROM users')
    return [dict(row) for row in rows]

# HTTP client pool
class HTTPClientPool:
    def __init__(self):
        self.client = None

    async def get_client(self) -> AsyncGenerator[httpx.AsyncClient, None]:
        if self.client is None:
            self.client = httpx.AsyncClient(
                limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
                timeout=httpx.Timeout(10.0)
            )
        yield self.client

    async def close(self):
        if self.client:
            await self.client.aclose()

http_pool = HTTPClientPool()

@app.get('/external-api')
async def call_external_api(client: httpx.AsyncClient = Depends(http_pool.get_client)):
    response = await client.get('https://api.example.com/data')
    return response.json()
```

## Performance Optimization

Async patterns for optimal performance.

```python
from fastapi import FastAPI
import asyncio
from functools import lru_cache

app = FastAPI()

# Cache expensive async operations
from aiocache import Cache
from aiocache.serializers import JsonSerializer

cache = Cache(Cache.MEMORY, serializer=JsonSerializer())

@app.get('/expensive-data/{key}')
async def get_expensive_data(key: str):
    # Check cache first
    cached = await cache.get(key)
    if cached:
        return {'data': cached, 'cached': True}

    # Expensive operation
    await asyncio.sleep(2)
    data = compute_expensive_result(key)

    # Store in cache
    await cache.set(key, data, ttl=300)
    return {'data': data, 'cached': False}

# Batch operations
@app.post('/users/batch')
async def create_users_batch(users: List[UserCreate], db = Depends(get_db)):
    # Create users in batch (more efficient than one-by-one)
    user_objects = [User(**user.dict()) for user in users]
    db.add_all(user_objects)
    await db.flush()
    return user_objects

# Debouncing with asyncio
class Debouncer:
    def __init__(self, delay: float):
        self.delay = delay
        self.task = None

    async def debounce(self, coro):
        if self.task:
            self.task.cancel()

        async def delayed():
            await asyncio.sleep(self.delay)
            await coro

        self.task = asyncio.create_task(delayed())
        await self.task

debouncer = Debouncer(delay=1.0)

# Prefetching related data
@app.get('/posts/{post_id}')
async def get_post_with_relations(post_id: int, db = Depends(get_db)):
    # Fetch post and related data in parallel
    post_task = db.get(Post, post_id)
    comments_task = db.execute(
        select(Comment).where(Comment.post_id == post_id)
    )
    author_task = db.execute(
        select(User).where(User.id == Post.author_id)
    )

    post, comments_result, author_result = await asyncio.gather(
        post_task, comments_task, author_task
    )

    return {
        'post': post,
        'comments': comments_result.scalars().all(),
        'author': author_result.scalar_one()
    }
```

## When to Use This Skill

Use fastapi-async-patterns when:

- Building high-throughput APIs that handle many concurrent requests
- Working with I/O-bound operations (database, external APIs, file operations)
- Implementing real-time features (WebSockets, SSE)
- Processing multiple operations in parallel
- Streaming large datasets or files
- Building microservices that communicate with other services
- Optimizing API response times and resource usage
- Handling background tasks without blocking responses

## FastAPI Async Best Practices

1. **Use async for I/O** - Always use async for database, HTTP requests, and
   file operations
2. **Avoid blocking calls** - Never use blocking calls in async functions
   (time.sleep, requests library)
3. **Connection pooling** - Use connection pools for databases and HTTP
   clients
4. **Proper cleanup** - Always clean up resources with try/finally or async
   context managers
5. **Concurrent operations** - Use asyncio.gather for parallel operations when possible
6. **Background tasks** - Use BackgroundTasks for fire-and-forget operations
7. **Stream large data** - Use StreamingResponse for large files or generated content
8. **Timeout handling** - Set timeouts on all external calls to prevent hanging
9. **Error propagation** - Handle exceptions properly in async code
10. **Monitor performance** - Use tools like aiomonitor to debug async issues

## FastAPI Async Common Pitfalls

1. **Blocking the event loop** - Using synchronous I/O in async functions kills performance
2. **Missing await** - Forgetting await on async functions causes coroutine warnings
3. **Creating too many tasks** - Spawning unlimited tasks can exhaust resources
4. **Not closing connections** - Resource leaks from unclosed database/HTTP connections
5. **Mixing sync and async** - Incorrect mixing causes event loop issues
6. **Race conditions** - Shared state in async code without proper locking
7. **Timeout issues** - No timeouts on external calls can hang the server
8. **Memory leaks** - Background tasks that never complete accumulate
9. **Error swallowing** - Silent failures in background tasks and event handlers
10. **Deadlocks** - Circular waits in async dependencies or locks

## Resources

- [FastAPI Async Documentation](https://fastapi.tiangolo.com/async/)
- [Python asyncio Documentation](https://docs.python.org/3/library/asyncio.html)
- [SQLAlchemy Async Guide](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [HTTPX Async Client](https://www.python-httpx.org/async/)
- [AsyncPG Documentation](https://magicstack.github.io/asyncpg/)
- [Motor (MongoDB Async)](https://motor.readthedocs.io/)
- [WebSockets in FastAPI](https://fastapi.tiangolo.com/advanced/websockets/)
- [Server-Sent Events with Starlette](https://github.com/sysid/sse-starlette)
