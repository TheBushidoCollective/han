---
name: android-kotlin-coroutines
description: Use when implementing async operations with Kotlin coroutines, Flow, StateFlow, or managing concurrency in Android apps.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Android - Kotlin Coroutines

Asynchronous programming patterns using Kotlin coroutines and Flow in Android.

## Key Concepts

### Coroutine Basics

```kotlin
// Launching coroutines
class UserViewModel : ViewModel() {

    fun loadUser(id: String) {
        // viewModelScope is automatically cancelled when ViewModel is cleared
        viewModelScope.launch {
            try {
                val user = userRepository.getUser(id)
                _uiState.value = UiState.Success(user)
            } catch (e: Exception) {
                _uiState.value = UiState.Error(e.message)
            }
        }
    }

    // For operations that return a value
    fun fetchUserAsync(id: String): Deferred<User> {
        return viewModelScope.async {
            userRepository.getUser(id)
        }
    }
}

// Suspend functions
suspend fun fetchUserFromNetwork(id: String): User {
    return withContext(Dispatchers.IO) {
        api.getUser(id)
    }
}
```

### Dispatchers

```kotlin
// Main - UI operations
withContext(Dispatchers.Main) {
    textView.text = "Updated"
}

// IO - Network, database, file operations
withContext(Dispatchers.IO) {
    val data = api.fetchData()
    database.save(data)
}

// Default - CPU-intensive work
withContext(Dispatchers.Default) {
    val result = expensiveComputation(data)
}

// Custom dispatcher for limited parallelism
val limitedDispatcher = Dispatchers.IO.limitedParallelism(4)
```

### Flow Basics

```kotlin
// Creating flows
fun getUsers(): Flow<List<User>> = flow {
    while (true) {
        val users = api.getUsers()
        emit(users)
        delay(30_000) // Poll every 30 seconds
    }
}

// Flow from Room
@Dao
interface UserDao {
    @Query("SELECT * FROM users")
    fun getAllUsers(): Flow<List<UserEntity>>
}

// Collecting flows
viewModelScope.launch {
    userRepository.getUsers()
        .catch { e -> _uiState.value = UiState.Error(e) }
        .collect { users ->
            _uiState.value = UiState.Success(users)
        }
}
```

### StateFlow and SharedFlow

```kotlin
class SearchViewModel : ViewModel() {
    // StateFlow - always has a current value
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    // SharedFlow - for events without initial value
    private val _events = MutableSharedFlow<UiEvent>()
    val events: SharedFlow<UiEvent> = _events.asSharedFlow()

    // Derived state from flow
    val searchResults: StateFlow<List<Item>> = _searchQuery
        .debounce(300)
        .filter { it.length >= 2 }
        .flatMapLatest { query ->
            searchRepository.search(query)
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    fun updateQuery(query: String) {
        _searchQuery.value = query
    }

    fun sendEvent(event: UiEvent) {
        viewModelScope.launch {
            _events.emit(event)
        }
    }
}
```

## Best Practices

### Structured Concurrency

```kotlin
// Good: Using coroutineScope for parallel operations
suspend fun loadDashboard(): Dashboard = coroutineScope {
    val userDeferred = async { userRepository.getUser() }
    val ordersDeferred = async { orderRepository.getOrders() }
    val notificationsDeferred = async { notificationRepository.getNotifications() }

    // All complete or all fail together
    Dashboard(
        user = userDeferred.await(),
        orders = ordersDeferred.await(),
        notifications = notificationsDeferred.await()
    )
}

// With timeout
suspend fun loadWithTimeout(): Data {
    return withTimeout(5000) {
        api.fetchData()
    }
}

// Or with nullable result on timeout
suspend fun loadWithTimeoutOrNull(): Data? {
    return withTimeoutOrNull(5000) {
        api.fetchData()
    }
}
```

### Exception Handling

```kotlin
// Using runCatching
suspend fun safeApiCall(): Result<User> = runCatching {
    api.getUser()
}

// Handling in ViewModel
fun loadUser() {
    viewModelScope.launch {
        safeApiCall()
            .onSuccess { user ->
                _uiState.value = UiState.Success(user)
            }
            .onFailure { error ->
                _uiState.value = UiState.Error(error.message)
            }
    }
}

// SupervisorJob for independent child failures
class MyViewModel : ViewModel() {
    private val supervisorJob = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.Main + supervisorJob)

    fun loadMultiple() {
        scope.launch {
            // This failure won't cancel other children
            userRepository.getUser()
        }
        scope.launch {
            // This continues even if above fails
            orderRepository.getOrders()
        }
    }
}
```

### Flow Operators

```kotlin
// Transformation operators
userRepository.getUsers()
    .map { users -> users.filter { it.isActive } }
    .distinctUntilChanged()
    .collect { activeUsers -> updateUI(activeUsers) }

// Combining flows
val combined: Flow<Pair<User, Settings>> = combine(
    userRepository.getUser(),
    settingsRepository.getSettings()
) { user, settings ->
    Pair(user, settings)
}

// FlatMapLatest for search
searchQuery
    .debounce(300)
    .flatMapLatest { query ->
        if (query.isEmpty()) flowOf(emptyList())
        else searchRepository.search(query)
    }
    .collect { results -> updateResults(results) }

// Retry with exponential backoff
api.fetchData()
    .retry(3) { cause ->
        if (cause is IOException) {
            delay(1000 * (2.0.pow(retryCount)).toLong())
            true
        } else false
    }
```

### Lifecycle-Aware Collection

```kotlin
// In Compose - collectAsStateWithLifecycle
@Composable
fun UserScreen(viewModel: UserViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    UserContent(uiState)
}

// In Activity/Fragment - repeatOnLifecycle
class UserFragment : Fragment() {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    updateUI(state)
                }
            }
        }
    }
}

// Multiple flows
viewLifecycleOwner.lifecycleScope.launch {
    viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
        launch {
            viewModel.users.collect { updateUserList(it) }
        }
        launch {
            viewModel.events.collect { handleEvent(it) }
        }
    }
}
```

## Common Patterns

### Repository Pattern with Flow

```kotlin
class UserRepository(
    private val api: UserApi,
    private val dao: UserDao,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    fun getUser(id: String): Flow<User> = flow {
        // Emit cached data first
        dao.getUser(id)?.let { emit(it.toDomain()) }

        // Fetch from network
        val networkUser = api.getUser(id)
        dao.insertUser(networkUser.toEntity())
        emit(networkUser.toDomain())
    }
    .flowOn(dispatcher)
    .catch { e ->
        // Log error, emit from cache if available
        dao.getUser(id)?.let { emit(it.toDomain()) }
            ?: throw e
    }

    suspend fun refreshUsers() {
        withContext(dispatcher) {
            val users = api.getUsers()
            dao.deleteAll()
            dao.insertAll(users.map { it.toEntity() })
        }
    }
}
```

### Cancellation Handling

```kotlin
suspend fun downloadFile(url: String): ByteArray {
    return withContext(Dispatchers.IO) {
        val connection = URL(url).openConnection()
        connection.inputStream.use { input ->
            val buffer = ByteArrayOutputStream()
            val data = ByteArray(4096)

            while (true) {
                // Check for cancellation
                ensureActive()

                val count = input.read(data)
                if (count == -1) break
                buffer.write(data, 0, count)
            }

            buffer.toByteArray()
        }
    }
}

// Cancellable flow
fun pollData(): Flow<Data> = flow {
    while (currentCoroutineContext().isActive) {
        emit(api.fetchData())
        delay(5000)
    }
}
```

### Debounce and Throttle

```kotlin
// Debounce - wait for pause in emissions
@Composable
fun SearchField(onSearch: (String) -> Unit) {
    var query by remember { mutableStateOf("") }

    LaunchedEffect(query) {
        delay(300) // Debounce
        if (query.isNotEmpty()) {
            onSearch(query)
        }
    }

    TextField(value = query, onValueChange = { query = it })
}

// In ViewModel
private val _searchQuery = MutableStateFlow("")

val searchResults = _searchQuery
    .debounce(300)
    .distinctUntilChanged()
    .flatMapLatest { query ->
        searchRepository.search(query)
    }
    .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())
```

## Anti-Patterns

### GlobalScope Usage

Bad:

```kotlin
GlobalScope.launch {  // Never cancelled, leaks memory
    fetchData()
}
```

Good:

```kotlin
viewModelScope.launch {  // Properly scoped
    fetchData()
}
```

### Blocking Calls on Main Thread

Bad:

```kotlin
fun loadData() {
    runBlocking {  // Blocks main thread!
        api.fetchData()
    }
}
```

Good:

```kotlin
fun loadData() {
    viewModelScope.launch {
        withContext(Dispatchers.IO) {
            api.fetchData()
        }
    }
}
```

### Flow Collection Without Lifecycle

Bad:

```kotlin
override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
    lifecycleScope.launch {
        viewModel.uiState.collect {  // Collects even when in background
            updateUI(it)
        }
    }
}
```

Good:

```kotlin
override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
    viewLifecycleOwner.lifecycleScope.launch {
        viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
            viewModel.uiState.collect { updateUI(it) }
        }
    }
}
```

### Creating New Flow on Each Call

Bad:

```kotlin
// Creates new flow each time
fun getUsers(): Flow<List<User>> = userDao.getAllUsers()

// Called multiple times, multiple database subscriptions
```

Good:

```kotlin
// Shared flow, single subscription
val users: StateFlow<List<User>> = userDao.getAllUsers()
    .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
```

## Related Skills

- **android-jetpack-compose**: UI integration with coroutines
- **android-architecture**: Architectural patterns using coroutines
