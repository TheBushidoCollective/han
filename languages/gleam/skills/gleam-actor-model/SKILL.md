---
name: Gleam Actor Model
description: Use when oTP actor patterns in Gleam including processes, message passing, GenServer implementations, supervisors, fault tolerance, state management, and building concurrent, fault-tolerant applications on the Erlang VM.
allowed-tools: []
---

# Gleam Actor Model

## Introduction

Gleam leverages the Erlang VM's actor model, enabling lightweight concurrent
processes that communicate through message passing. This model provides inherent
fault tolerance, isolation, and scalability, making it ideal for building
distributed systems.

The actor model in Gleam uses OTP (Open Telecom Platform) patterns including
GenServers for stateful processes, supervisors for fault recovery, and message
passing for inter-process communication. Each process has its own heap and
communicates asynchronously, eliminating shared memory concerns.

This skill covers process creation and message passing, GenServer pattern for
stateful actors, supervisors and fault tolerance, process linking and monitoring,
selective receive, and patterns for building robust concurrent applications.

## Process Basics and Message Passing

Processes are lightweight, isolated units of execution that communicate via
message passing.

```gleam
import gleam/erlang/process
import gleam/io

// Basic process creation
pub fn simple_process() {
  process.spawn(fn() {
    io.println("Hello from process!")
  })
}

// Process with message passing
pub type Message {
  Ping
  Pong
  Stop
}

pub fn echo_process() {
  let subject = process.new_subject()

  process.spawn(fn() {
    loop(subject)
  })

  subject
}

fn loop(subject: process.Subject(Message)) {
  case process.receive(subject, 1000) {
    Ok(Ping) -> {
      io.println("Received Ping")
      loop(subject)
    }
    Ok(Pong) -> {
      io.println("Received Pong")
      loop(subject)
    }
    Ok(Stop) -> {
      io.println("Stopping")
      Nil
    }
    Error(_) -> {
      io.println("Timeout")
      loop(subject)
    }
  }
}

// Sending messages
pub fn send_messages(subject: process.Subject(Message)) {
  process.send(subject, Ping)
  process.send(subject, Pong)
  process.send(subject, Stop)
}

// Request-response pattern
pub type Request {
  GetValue(reply_to: process.Subject(Int))
  SetValue(value: Int, reply_to: process.Subject(Nil))
}

pub fn state_process(initial: Int) {
  let subject = process.new_subject()

  process.spawn(fn() {
    state_loop(subject, initial)
  })

  subject
}

fn state_loop(subject: process.Subject(Request), state: Int) {
  case process.receive(subject, 5000) {
    Ok(GetValue(reply_to)) -> {
      process.send(reply_to, state)
      state_loop(subject, state)
    }
    Ok(SetValue(value, reply_to)) -> {
      process.send(reply_to, Nil)
      state_loop(subject, value)
    }
    Error(_) -> state_loop(subject, state)
  }
}

// Calling the state process
pub fn use_state_process() {
  let proc = state_process(0)
  let reply_subject = process.new_subject()

  // Set value
  process.send(proc, SetValue(42, reply_subject))
  let _ack = process.receive(reply_subject, 1000)

  // Get value
  process.send(proc, GetValue(reply_subject))
  case process.receive(reply_subject, 1000) {
    Ok(value) -> io.debug(value)
    Error(_) -> io.println("Timeout")
  }
}

// Process with multiple message types
pub type ServerMessage {
  Request(id: Int, reply_to: process.Subject(String))
  Broadcast(message: String)
  Shutdown
}

pub fn multi_message_process() {
  let subject = process.new_subject()

  process.spawn(fn() {
    multi_loop(subject, [])
  })

  subject
}

fn multi_loop(
  subject: process.Subject(ServerMessage),
  clients: List(process.Subject(String)),
) {
  case process.receive(subject, 1000) {
    Ok(Request(id, reply_to)) -> {
      let response = "Response for " <> int.to_string(id)
      process.send(reply_to, response)
      multi_loop(subject, [reply_to, ..clients])
    }
    Ok(Broadcast(message)) -> {
      list.each(clients, fn(client) {
        process.send(client, message)
      })
      multi_loop(subject, clients)
    }
    Ok(Shutdown) -> Nil
    Error(_) -> multi_loop(subject, clients)
  }
}

// Process pools
pub fn worker_pool(size: Int) -> List(process.Subject(Message)) {
  list.range(1, size)
  |> list.map(fn(_) { echo_process() })
}

pub fn distribute_work(pool: List(process.Subject(Message)),
                       work: List(Message)) {
  list.zip(work, list.cycle(pool))
  |> list.each(fn(pair) {
    let #(message, worker) = pair
    process.send(worker, message)
  })
}
```

Lightweight processes with message passing enable concurrent applications without
shared memory complexity.

## GenServer Pattern

GenServer provides a standard pattern for stateful processes with synchronous
and asynchronous operations.

```gleam
import gleam/otp/actor
import gleam/erlang/process

// State type
pub type Counter {
  Counter(value: Int)
}

// Message types
pub type CounterMessage {
  Increment
  Decrement
  GetValue(reply_to: process.Subject(Int))
  Reset(reply_to: process.Subject(Nil))
}

// GenServer implementation
pub fn start_counter() -> Result(process.Subject(CounterMessage),
                                 actor.StartError) {
  actor.start(Counter(value: 0), handle_message)
}

fn handle_message(
  message: CounterMessage,
  state: Counter,
) -> actor.Next(CounterMessage, Counter) {
  case message {
    Increment -> {
      actor.continue(Counter(value: state.value + 1))
    }
    Decrement -> {
      actor.continue(Counter(value: state.value - 1))
    }
    GetValue(reply_to) -> {
      process.send(reply_to, state.value)
      actor.continue(state)
    }
    Reset(reply_to) -> {
      process.send(reply_to, Nil)
      actor.continue(Counter(value: 0))
    }
  }
}

// Using the GenServer
pub fn use_counter() {
  case start_counter() {
    Ok(counter) -> {
      // Increment
      process.send(counter, Increment)
      process.send(counter, Increment)

      // Get value
      let reply = process.new_subject()
      process.send(counter, GetValue(reply))
      case process.receive(reply, 1000) {
        Ok(value) -> io.debug(value)  // 2
        Error(_) -> io.println("Timeout")
      }
    }
    Error(_) -> io.println("Failed to start counter")
  }
}

// GenServer with complex state
pub type CacheState {
  CacheState(items: Dict(String, String), max_size: Int)
}

pub type CacheMessage {
  Get(key: String, reply_to: process.Subject(Option(String)))
  Put(key: String, value: String, reply_to: process.Subject(Bool))
  Delete(key: String, reply_to: process.Subject(Bool))
  Size(reply_to: process.Subject(Int))
}

pub fn start_cache(max_size: Int) -> Result(process.Subject(CacheMessage),
                                            actor.StartError) {
  actor.start(
    CacheState(items: dict.new(), max_size: max_size),
    handle_cache_message,
  )
}

fn handle_cache_message(
  message: CacheMessage,
  state: CacheState,
) -> actor.Next(CacheMessage, CacheState) {
  case message {
    Get(key, reply_to) -> {
      let value = dict.get(state.items, key)
      process.send(reply_to, value)
      actor.continue(state)
    }
    Put(key, value, reply_to) -> {
      let current_size = dict.size(state.items)
      case current_size < state.max_size {
        True -> {
          let new_items = dict.insert(state.items, key, value)
          process.send(reply_to, True)
          actor.continue(CacheState(..state, items: new_items))
        }
        False -> {
          process.send(reply_to, False)
          actor.continue(state)
        }
      }
    }
    Delete(key, reply_to) -> {
      let new_items = dict.delete(state.items, key)
      process.send(reply_to, True)
      actor.continue(CacheState(..state, items: new_items))
    }
    Size(reply_to) -> {
      process.send(reply_to, dict.size(state.items))
      actor.continue(state)
    }
  }
}

// GenServer with initialization
pub type ConnectionState {
  ConnectionState(url: String, connected: Bool)
}

pub type ConnectionMessage {
  Connect(reply_to: process.Subject(Result(Nil, String)))
  Disconnect
  Status(reply_to: process.Subject(Bool))
}

pub fn start_connection(url: String) ->
  Result(process.Subject(ConnectionMessage), actor.StartError) {
  actor.start_spec(actor.Spec(
    init: fn() {
      // Initialization logic
      let state = ConnectionState(url: url, connected: False)
      actor.Ready(state, process.new_selector())
    },
    init_timeout: 5000,
    loop: handle_connection_message,
  ))
}

fn handle_connection_message(
  message: ConnectionMessage,
  state: ConnectionState,
) -> actor.Next(ConnectionMessage, ConnectionState) {
  case message {
    Connect(reply_to) -> {
      case state.connected {
        True -> {
          process.send(reply_to, Error("Already connected"))
          actor.continue(state)
        }
        False -> {
          // Simulate connection
          process.send(reply_to, Ok(Nil))
          actor.continue(ConnectionState(..state, connected: True))
        }
      }
    }
    Disconnect -> {
      actor.continue(ConnectionState(..state, connected: False))
    }
    Status(reply_to) -> {
      process.send(reply_to, state.connected)
      actor.continue(state)
    }
  }
}

// GenServer with timeout
pub type TimedMessage {
  Heartbeat
  Data(String)
  Timeout
}

pub fn timed_actor() -> Result(process.Subject(TimedMessage), actor.StartError) {
  actor.start(0, fn(message, state) {
    case message {
      Heartbeat -> {
        io.println("Heartbeat received")
        actor.continue(state)
      }
      Data(str) -> {
        io.println("Data: " <> str)
        actor.continue(state)
      }
      Timeout -> {
        io.println("Timeout occurred")
        actor.Stop(process.Normal)
      }
    }
  })
}
```

GenServer pattern provides structure for stateful concurrent processes with
standard message handling.

## Supervisors and Fault Tolerance

Supervisors monitor child processes and restart them on failure, enabling
fault-tolerant systems.

```gleam
import gleam/otp/supervisor
import gleam/erlang/process

// Simple worker
pub fn worker() -> Result(process.Subject(Message), actor.StartError) {
  actor.start(0, fn(message, state) {
    case message {
      Ping -> {
        io.println("Worker alive")
        actor.continue(state)
      }
      Stop -> actor.Stop(process.Normal)
      _ -> actor.continue(state)
    }
  })
}

// Supervisor specification
pub fn start_supervisor() ->
  Result(process.Subject(supervisor.Message), supervisor.StartError) {
  supervisor.start(fn(children) {
    children
    |> supervisor.add(supervisor.worker(fn(_) { worker() }))
    |> supervisor.add(supervisor.worker(fn(_) { worker() }))
  })
}

// Supervisor with named workers
pub type WorkerName {
  CounterWorker
  CacheWorker
  DatabaseWorker
}

pub fn start_named_supervisor() ->
  Result(process.Subject(supervisor.Message), supervisor.StartError) {
  supervisor.start(fn(children) {
    children
    |> supervisor.add(supervisor.worker_spec(
      start: fn(_) { start_counter() },
      restart: supervisor.RestartForever,
    ))
    |> supervisor.add(supervisor.worker_spec(
      start: fn(_) { start_cache(100) },
      restart: supervisor.RestartForever,
    ))
  })
}

// Supervisor tree
pub fn start_application() ->
  Result(process.Subject(supervisor.Message), supervisor.StartError) {
  supervisor.start(fn(children) {
    children
    // Workers
    |> supervisor.add(supervisor.worker(fn(_) { start_counter() }))
    |> supervisor.add(supervisor.worker(fn(_) { start_cache(100) }))
    // Child supervisor
    |> supervisor.add(supervisor.supervisor(fn(children) {
      children
      |> supervisor.add(supervisor.worker(fn(_) { worker() }))
      |> supervisor.add(supervisor.worker(fn(_) { worker() }))
    }))
  })
}

// Custom restart strategy
pub fn start_custom_supervisor() ->
  Result(process.Subject(supervisor.Message), supervisor.StartError) {
  supervisor.start_spec(supervisor.Spec(
    argument: Nil,
    max_frequency: 5,
    frequency_period: 60,
    init: fn(children) {
      children
      |> supervisor.add(supervisor.worker_spec(
        start: fn(_) { worker() },
        restart: supervisor.RestartTransient,  // Only restart if abnormal exit
      ))
    },
  ))
}

// One-for-one vs one-for-all
pub fn one_for_one_supervisor() {
  // Each child restarts independently
  supervisor.start(fn(children) {
    children
    |> supervisor.add(supervisor.worker(fn(_) { worker() }))
    |> supervisor.add(supervisor.worker(fn(_) { worker() }))
  })
}

// Dynamic supervisor (adding children at runtime)
pub type DynamicMessage {
  AddWorker(reply_to: process.Subject(Result(process.Pid, String)))
  RemoveWorker(pid: process.Pid)
}
```

Supervisors provide automatic fault recovery and system resilience through
process monitoring and restarts.

## Process Linking and Monitoring

Links and monitors enable processes to react to failures in related processes.

```gleam
import gleam/erlang/process

// Process linking
pub fn linked_processes() {
  let parent = process.self()

  let child = process.spawn_link(fn() {
    io.println("Child process started")
    process.sleep(1000)
    io.println("Child process exiting")
  })

  // Parent is linked to child - will receive exit signal
  io.println("Parent waiting...")
  process.sleep(2000)
}

// Process monitoring
pub fn monitored_process() {
  let monitored = process.spawn(fn() {
    io.println("Monitored process started")
    process.sleep(1000)
  })

  let monitor = process.monitor_process(monitored)

  // Wait for down message
  let selector = process.new_selector()
    |> process.selecting_process_down(monitor, fn(down) { down })

  case process.select(selector, 2000) {
    Ok(down) -> io.println("Process exited")
    Error(_) -> io.println("Still running")
  }
}

// Trap exits for supervision
pub fn trap_exits() {
  process.trap_exits(True)

  let child = process.spawn_link(fn() {
    io.println("Child starting")
    panic as "Simulated error"
  })

  let selector = process.new_selector()
    |> process.selecting_trapped_exits(fn(exit) { exit })

  case process.select(selector, 2000) {
    Ok(exit) -> {
      io.println("Caught exit from child")
      // Can restart child here
    }
    Error(_) -> io.println("No exit received")
  }
}

// Monitor multiple processes
pub fn monitor_pool(workers: List(process.Pid)) {
  let monitors = list.map(workers, process.monitor_process)

  // Handle any worker failure
  let selector = list.fold(monitors, process.new_selector(), fn(sel, mon) {
    process.selecting_process_down(sel, mon, fn(down) { down })
  })

  case process.select(selector, 10000) {
    Ok(down) -> {
      io.println("Worker failed")
      // Restart logic here
    }
    Error(_) -> io.println("All workers healthy")
  }
}
```

Links and monitors enable building fault-tolerant systems with proper failure
handling.

## Best Practices

1. **Use GenServer for stateful processes** to leverage OTP patterns and standard
   behaviors

2. **Wrap GenServers in supervisor trees** to enable automatic recovery from
   failures

3. **Keep process state minimal** to reduce memory usage and simplify state
   management

4. **Use message types with reply_to fields** for synchronous request-response
   patterns

5. **Set appropriate timeouts** on receive operations to prevent indefinite
   blocking

6. **Monitor external processes** rather than linking when you don't want to
   crash together

7. **Use descriptive message types** with custom types rather than generic tuples

8. **Handle all message types** in loops to prevent unexpected message
   accumulation

9. **Design for failure** by assuming processes will crash and using supervisors

10. **Keep process hierarchies simple** with clear parent-child relationships

## Common Pitfalls

1. **Not handling timeout cases** in receive operations causes process to hang
   indefinitely

2. **Forgetting to reply** in request-response patterns causes client timeout

3. **Creating too many processes** without reason adds overhead without benefits

4. **Not using supervisors** loses fault tolerance benefits of the actor model

5. **Blocking in message handlers** prevents processing other messages causing
   deadlock

6. **Accumulating unconsumed messages** in mailbox causes memory leaks

7. **Linking processes incorrectly** causes unintended crash propagation

8. **Not setting init_timeout** on actors causes startup delays to crash system

9. **Using shared mutable state** defeats isolation benefits of actor model

10. **Ignoring exit signals** when trapping exits prevents proper cleanup

## When to Use This Skill

Apply actors for concurrent operations requiring isolated state and message-based
communication.

Use GenServers when implementing stateful services like caches, connections, or
workers.

Leverage supervisors for any process that should automatically restart on failure.

Apply process monitoring when one process needs to react to another's termination.

Use process pools for distributing work across multiple concurrent workers.

Build supervisor trees for structuring complex applications with multiple
components.

## Resources

- [Gleam OTP Documentation](<https://hexdocs.pm/gleam_otp/>)
- [Erlang Actor Model](<https://www.erlang.org/doc/getting_started/conc_prog.html>)
- [OTP Design Principles](<https://www.erlang.org/doc/design_principles/des_princ.html>)
- [Gleam Actor Tutorial](<https://gleam.run/writing-gleam/actors/>)
- [Learn You Some Erlang - Supervisors](<https://learnyousomeerlang.com/supervisors>)
