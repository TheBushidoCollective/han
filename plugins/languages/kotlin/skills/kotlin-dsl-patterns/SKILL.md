---
name: Kotlin DSL Patterns
description: Use when domain-specific language design in Kotlin using type-safe builders, infix functions, operator overloading, lambdas with receivers, and patterns for creating expressive, readable DSLs for configuration and domain modeling.
allowed-tools: []
---

# Kotlin DSL Patterns

## Introduction

Kotlin's language features enable creation of expressive domain-specific
languages (DSLs) that feel like natural extensions of the language itself. DSLs
improve code readability, reduce boilerplate, and provide type-safe APIs for
configuration, builders, and domain modeling.

Key features supporting DSL design include lambdas with receivers, extension
functions, infix notation, operator overloading, and scope control. These
features combine to create fluent, intuitive APIs that express domain concepts
clearly without sacrificing type safety or IDE support.

This skill covers type-safe builders, lambda receivers, infix functions,
operator overloading, and practical patterns for designing maintainable DSLs in
Android, testing, and configuration contexts.

## Type-Safe Builders

Type-safe builders use lambdas with receivers to create hierarchical structures
with compile-time validation and IDE support.

```kotlin
// HTML DSL example
class HTML {
    private val elements = mutableListOf<Element>()

    fun head(init: Head.() -> Unit) {
        val head = Head()
        head.init()
        elements.add(head)
    }

    fun body(init: Body.() -> Unit) {
        val body = Body()
        body.init()
        elements.add(body)
    }

    override fun toString(): String {
        return "<html>\n${elements.joinToString("\n")}\n</html>"
    }
}

abstract class Element(val name: String) {
    private val children = mutableListOf<Element>()

    protected fun <T : Element> initElement(element: T, init: T.() -> Unit): T {
        element.init()
        children.add(element)
        return element
    }

    override fun toString(): String {
        return if (children.isEmpty()) {
            "<$name/>"
        } else {
            "<$name>\n${children.joinToString("\n")}\n</$name>"
        }
    }
}

class Head : Element("head") {
    fun title(text: String) {
        initElement(Title()) { this.text = text }
    }
}

class Title : Element("title") {
    var text: String = ""

    override fun toString() = "<title>$text</title>"
}

class Body : Element("body") {
    fun h1(text: String) {
        initElement(H1()) { this.text = text }
    }

    fun p(text: String) {
        initElement(P()) { this.text = text }
    }

    fun div(cssClass: String = "", init: Div.() -> Unit) {
        initElement(Div(cssClass), init)
    }
}

class H1 : Element("h1") {
    var text: String = ""
    override fun toString() = "<h1>$text</h1>"
}

class P : Element("p") {
    var text: String = ""
    override fun toString() = "<p>$text</p>"
}

class Div(private val cssClass: String = "") : Element("div") {
    fun p(text: String) {
        initElement(P()) { this.text = text }
    }

    override fun toString(): String {
        val classAttr = if (cssClass.isNotEmpty()) " class=\"$cssClass\"" else ""
        return "<div$classAttr>...</div>"
    }
}

// Using the HTML DSL
fun buildPage() = html {
    head {
        title("My Page")
    }
    body {
        h1("Welcome")
        p("This is a paragraph")
        div("container") {
            p("Nested paragraph")
        }
    }
}

fun html(init: HTML.() -> Unit): HTML {
    val html = HTML()
    html.init()
    return html
}

// Configuration DSL
class ServerConfig {
    var port: Int = 8080
    var host: String = "localhost"
    val routes = mutableListOf<Route>()

    fun route(path: String, init: Route.() -> Unit) {
        val route = Route(path)
        route.init()
        routes.add(route)
    }
}

class Route(val path: String) {
    var method: String = "GET"
    var handler: (Request) -> Response = { Response(200, "OK") }

    fun get(handler: (Request) -> Response) {
        this.method = "GET"
        this.handler = handler
    }

    fun post(handler: (Request) -> Response) {
        this.method = "POST"
        this.handler = handler
    }
}

data class Request(val path: String, val body: String = "")
data class Response(val status: Int, val body: String)

fun server(init: ServerConfig.() -> Unit): ServerConfig {
    val config = ServerConfig()
    config.init()
    return config
}

// Using configuration DSL
val config = server {
    port = 9000
    host = "0.0.0.0"

    route("/api/users") {
        get { request ->
            Response(200, "User list")
        }
    }

    route("/api/posts") {
        post { request ->
            Response(201, "Post created")
        }
    }
}
```

Type-safe builders provide IDE autocompletion and compile-time validation while
creating readable, hierarchical structures.

## Lambdas with Receivers

Lambdas with receivers enable DSL functions to access receiver properties and
methods directly, creating implicit context for cleaner APIs.

```kotlin
// Lambda with receiver basics
fun buildString(action: StringBuilder.() -> Unit): String {
    val builder = StringBuilder()
    builder.action()
    return builder.toString()
}

val result = buildString {
    append("Hello")
    append(" ")
    append("World")
}

// Extension functions as DSL builders
class Query {
    private val conditions = mutableListOf<String>()

    fun where(condition: String) {
        conditions.add(condition)
    }

    fun build(): String {
        return "SELECT * WHERE ${conditions.joinToString(" AND ")}"
    }
}

fun query(init: Query.() -> Unit): String {
    val query = Query()
    query.init()
    return query.build()
}

val sql = query {
    where("age > 18")
    where("status = 'active'")
}

// Scoped builders
class TestSuite(val name: String) {
    private val tests = mutableListOf<Test>()

    fun test(name: String, block: TestContext.() -> Unit) {
        val context = TestContext()
        context.block()
        tests.add(Test(name, context))
    }

    fun run() {
        println("Running suite: $name")
        tests.forEach { it.run() }
    }
}

class TestContext {
    val assertions = mutableListOf<() -> Unit>()

    fun assertEquals(expected: Any, actual: Any) {
        assertions.add {
            if (expected != actual) {
                throw AssertionError("Expected $expected but got $actual")
            }
        }
    }
}

class Test(val name: String, val context: TestContext) {
    fun run() {
        println("  Test: $name")
        context.assertions.forEach { it() }
    }
}

fun suite(name: String, init: TestSuite.() -> Unit): TestSuite {
    val suite = TestSuite(name)
    suite.init()
    return suite
}

// Using test DSL
val testSuite = suite("Math Tests") {
    test("addition") {
        assertEquals(4, 2 + 2)
        assertEquals(0, 1 - 1)
    }

    test("multiplication") {
        assertEquals(6, 2 * 3)
    }
}

// Apply and also for DSL chaining
data class Person(
    var name: String = "",
    var age: Int = 0,
    var email: String = ""
)

fun createPerson() = Person().apply {
    name = "Alice"
    age = 30
    email = "alice@example.com"
}

// With for scoped access
fun processConfig(config: ServerConfig) {
    with(config) {
        println("Server on $host:$port")
        routes.forEach { route ->
            println("  ${route.method} ${route.path}")
        }
    }
}
```

Lambdas with receivers enable accessing receiver members without explicit
qualifiers, creating natural, context-aware DSL syntax.

## Infix Functions and Operators

Infix functions and operator overloading enable natural mathematical and logical
expressions in DSLs, improving readability for domain concepts.

```kotlin
// Infix functions for fluent API
infix fun String.shouldEqual(expected: String) {
    if (this != expected) {
        throw AssertionError("Expected '$expected' but got '$this'")
    }
}

"hello" shouldEqual "hello"

// Time duration DSL with infix
class Duration(val milliseconds: Long) {
    operator fun plus(other: Duration) =
        Duration(milliseconds + other.milliseconds)

    override fun toString() = "${milliseconds}ms"
}

infix fun Int.seconds(unit: Unit) = Duration(this * 1000L)
infix fun Int.minutes(unit: Unit) = Duration(this * 60 * 1000L)

object Unit

val timeout = 5 seconds Unit
val interval = 2 minutes Unit

// Query DSL with infix
class Condition(val field: String, val operator: String, val value: Any)

infix fun String.eq(value: Any) = Condition(this, "=", value)
infix fun String.gt(value: Any) = Condition(this, ">", value)
infix fun String.lt(value: Any) = Condition(this, "<", value)

class QueryBuilder {
    private val conditions = mutableListOf<Condition>()

    fun where(condition: Condition) {
        conditions.add(condition)
    }

    infix fun Condition.and(other: Condition): List<Condition> {
        return listOf(this, other)
    }

    fun build(): String {
        return "WHERE ${conditions.joinToString(" AND ") {
            "${it.field} ${it.operator} ${it.value}"
        }}"
    }
}

fun queryBuilder(init: QueryBuilder.() -> Unit): String {
    val builder = QueryBuilder()
    builder.init()
    return builder.build()
}

val query1 = queryBuilder {
    where("age" gt 18)
    where("status" eq "active")
}

// Operator overloading for DSL
data class Vector(val x: Double, val y: Double) {
    operator fun plus(other: Vector) =
        Vector(x + other.x, y + other.y)

    operator fun times(scalar: Double) =
        Vector(x * scalar, y * scalar)

    operator fun unaryMinus() =
        Vector(-x, -y)
}

val v1 = Vector(1.0, 2.0)
val v2 = Vector(3.0, 4.0)
val v3 = v1 + v2
val v4 = v1 * 2.0
val v5 = -v1

// Invoke operator for function-like objects
class Router {
    private val routes = mutableMapOf<String, (Request) -> Response>()

    operator fun invoke(path: String, handler: (Request) -> Response) {
        routes[path] = handler
    }

    fun handle(request: Request): Response {
        return routes[request.path]?.invoke(request)
            ?: Response(404, "Not Found")
    }
}

val router = Router()
router("/users") { request ->
    Response(200, "Users")
}

// Get/set operators for map-like DSL
class Configuration {
    private val values = mutableMapOf<String, Any>()

    operator fun get(key: String): Any? = values[key]
    operator fun set(key: String, value: Any) {
        values[key] = value
    }
}

val config1 = Configuration()
config1["timeout"] = 5000
val timeout1 = config1["timeout"]
```

Infix functions remove parentheses and dots for binary operations, while
operator overloading enables natural mathematical notation in DSLs.

## Scope Control with @DslMarker

DslMarker annotations prevent implicit receivers from outer scopes, improving
DSL safety by catching accidental nesting errors at compile time.

```kotlin
// Problem: implicit receivers without @DslMarker
class Table(val name: String) {
    val columns = mutableListOf<Column>()

    fun column(name: String, init: Column.() -> Unit) {
        val column = Column(name)
        column.init()
        columns.add(column)
    }
}

class Column(val name: String) {
    var type: String = "VARCHAR"
    var nullable: Boolean = true

    fun column(name: String, init: Column.() -> Unit) {
        // Accidentally accessible from outer scope
    }
}

// Without @DslMarker, this compiles but is wrong
fun problematicDSL() = Table("users") {
    column("id") {
        type = "INT"
        // This accidentally calls outer Table.column, not inner
        column("nested") {
            type = "TEXT"
        }
    }
}

// Solution: @DslMarker annotation
@DslMarker
annotation class DatabaseDsl

@DatabaseDsl
class SafeTable(val name: String) {
    val columns = mutableListOf<SafeColumn>()

    fun column(name: String, init: SafeColumn.() -> Unit) {
        val column = SafeColumn(name)
        column.init()
        columns.add(column)
    }
}

@DatabaseDsl
class SafeColumn(val name: String) {
    var type: String = "VARCHAR"
    var nullable: Boolean = true
}

// Now this won't compile - @DslMarker prevents implicit outer receivers
fun safeDSL() = SafeTable("users") {
    column("id") {
        type = "INT"
        // column("nested") { } // Compilation error!
    }
}

// Custom DSL markers for different domains
@DslMarker
annotation class HtmlDsl

@DslMarker
annotation class TestDsl

@HtmlDsl
class SafeHTML {
    fun body(init: SafeBody.() -> Unit) {
        SafeBody().init()
    }
}

@HtmlDsl
class SafeBody {
    fun p(text: String) {}
}

@TestDsl
class SafeTestSuite {
    fun test(name: String, block: SafeTestContext.() -> Unit) {
        SafeTestContext().block()
    }
}

@TestDsl
class SafeTestContext {
    fun assertEquals(expected: Any, actual: Any) {}
}

// Multiple DSL markers prevent mixing
fun mixedDSLs() {
    SafeHTML {
        body {
            // Cannot access test DSL here
        }
    }

    SafeTestSuite {
        test("example") {
            // Cannot access HTML DSL here
        }
    }
}
```

DslMarker prevents confusing implicit receiver access across DSL boundaries,
making DSLs safer and more maintainable.

## Gradle Kotlin DSL Patterns

Gradle's Kotlin DSL demonstrates real-world DSL patterns for build
configuration, dependency management, and task definition.

```kotlin
// Build script DSL patterns
plugins {
    kotlin("jvm") version "1.9.0"
    id("application")
}

repositories {
    mavenCentral()
    google()
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.0")
    testImplementation("org.junit.jupiter:junit-jupiter:5.9.0")
}

// Custom task with DSL
abstract class CustomTask : DefaultTask() {
    @get:Input
    abstract val message: Property<String>

    @TaskAction
    fun execute() {
        println(message.get())
    }
}

tasks {
    register<CustomTask>("greet") {
        message.set("Hello from custom task")
    }
}

// Extension functions for domain-specific configuration
fun Project.configureKotlin() {
    kotlin {
        jvmToolchain(17)
    }
}

fun Project.configureTesting() {
    tasks.withType<Test> {
        useJUnitPlatform()
    }
}

// Convention plugins with DSL
abstract class MyPluginExtension {
    abstract val version: Property<String>
    abstract val enabled: Property<Boolean>

    init {
        version.convention("1.0.0")
        enabled.convention(true)
    }
}

class MyPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        val extension = project.extensions.create(
            "myPlugin",
            MyPluginExtension::class.java
        )

        project.tasks.register("printConfig") {
            doLast {
                println("Version: ${extension.version.get()}")
                println("Enabled: ${extension.enabled.get()}")
            }
        }
    }
}

// Using the plugin DSL
configure<MyPluginExtension> {
    version.set("2.0.0")
    enabled.set(true)
}

// Type-safe accessors
val compileKotlin: KotlinCompile by tasks
compileKotlin.kotlinOptions {
    jvmTarget = "17"
    freeCompilerArgs = listOf("-Xjsr305=strict")
}

// Multiplatform DSL
kotlin {
    jvm {
        withJava()
    }

    js(IR) {
        browser()
        nodejs()
    }

    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.0")
            }
        }

        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
            }
        }
    }
}
```

Gradle Kotlin DSL combines multiple DSL patterns to create expressive,
type-safe build configuration with excellent IDE support.

## Ktor DSL for Web Applications

Ktor demonstrates DSL patterns for routing, serialization, and server
configuration in web applications.

```kotlin
// Ktor application DSL
fun Application.module() {
    install(ContentNegotiation) {
        json(Json {
            prettyPrint = true
            isLenient = true
        })
    }

    routing {
        get("/") {
            call.respondText("Hello, world!")
        }

        get("/users/{id}") {
            val id = call.parameters["id"]
            call.respond(User(id?.toInt() ?: 0, "User $id"))
        }

        post("/users") {
            val user = call.receive<User>()
            call.respond(HttpStatusCode.Created, user)
        }

        route("/api") {
            get("/health") {
                call.respondText("OK")
            }

            authenticate("auth-jwt") {
                get("/protected") {
                    call.respondText("Protected route")
                }
            }
        }
    }
}

// Custom Ktor DSL extensions
fun Route.userRoutes() {
    route("/users") {
        get {
            call.respond(listOf(User(1, "Alice"), User(2, "Bob")))
        }

        get("/{id}") {
            val id = call.parameters["id"]?.toInt() ?: return@get call.respond(
                HttpStatusCode.BadRequest
            )
            call.respond(User(id, "User $id"))
        }
    }
}

// Type-safe routing DSL
inline fun <reified T : Any> Route.typedGet(
    path: String,
    crossinline handler: suspend PipelineContext<Unit, ApplicationCall>.(T) -> Unit
) {
    get(path) {
        val params = call.receive<T>()
        handler(params)
    }
}

data class UserQuery(val name: String, val minAge: Int)

fun Route.typedRoutes() {
    typedGet<UserQuery>("/search") { query ->
        call.respondText("Searching for ${query.name}, age >= ${query.minAge}")
    }
}
```

Ktor's DSL provides readable, declarative server configuration while maintaining
type safety and composability.

## Best Practices

1. **Use @DslMarker to prevent scope confusion** by restricting implicit
   receivers and catching incorrect nesting at compile time

2. **Keep DSL scope focused** on a single domain to maintain clarity and prevent
   mixing unrelated concepts in one DSL

3. **Provide sensible defaults** in DSL builders to reduce boilerplate while
   allowing customization when needed

4. **Leverage lambdas with receivers** for context-aware DSL syntax that enables
   direct member access without qualifiers

5. **Use infix functions sparingly** only for natural binary operations like
   comparisons, logical operators, or domain relationships

6. **Document DSL usage with examples** to show intended patterns and prevent
   misuse of flexible DSL APIs

7. **Validate DSL structures** at build time rather than runtime to catch errors
   early with clear compilation errors

8. **Make DSLs immutable when possible** to prevent unexpected modifications and
   enable safer concurrent usage

9. **Provide both DSL and non-DSL APIs** to give users choice between
   expressiveness and explicitness

10. **Test DSL usage patterns** extensively to ensure intuitive behavior and
    catch edge cases in complex nesting scenarios

## Common Pitfalls

1. **Overusing infix functions** for inappropriate operations makes code harder
   to read and understand without clear conventions

2. **Creating overly complex DSLs** that try to do too much leads to confusing
   APIs that are hard to learn and maintain

3. **Forgetting @DslMarker annotation** allows implicit receivers from outer
   scopes, causing subtle bugs in nested DSL structures

4. **Not validating DSL structures** allows invalid configurations to pass
   compilation and fail at runtime

5. **Using mutable DSL builders without protection** enables unsafe concurrent
   modifications and unexpected behavior

6. **Creating deeply nested DSLs** without clear structure becomes difficult to
   navigate and reason about

7. **Overloading too many operators** obscures intent and makes code cryptic
   rather than expressive

8. **Mixing DSL and imperative code** inconsistently creates confusion about
   which style to use where

9. **Not providing clear DSL boundaries** makes it unclear when DSL context
   starts and ends in code

10. **Ignoring IDE support implications** creates DSLs that don't work well with
    autocompletion or refactoring tools

## When to Use This Skill

Use Kotlin DSL patterns when building libraries, frameworks, or configuration
systems that benefit from readable, type-safe domain-specific syntax.

Apply type-safe builders for hierarchical structures like HTML generation, UI
layouts, or nested configuration trees where structure matters.

Employ infix functions and operators for domain concepts that have natural
binary operations like comparisons, measurements, or logical relationships.

Leverage lambdas with receivers for test frameworks, build scripts, or any API
where context-specific operations improve readability.

Use @DslMarker when building complex nested DSLs to prevent scope confusion and
catch errors at compile time rather than runtime.

## Resources

- [Kotlin DSL Documentation](<https://kotlinlang.org/docs/type-safe-builders.html>)
- [Gradle Kotlin DSL Primer](<https://docs.gradle.org/current/userguide/kotlin_dsl.html>)
- [Ktor Documentation](<https://ktor.io/docs/>)
- [Effective Kotlin: DSL Design](<https://kt.academy/book/effectivekotlin>)
- [Type-Safe Builders Examples](<https://kotlinlang.org/docs/type-safe-builders.html#full-definition-of-the-comexamplehtml-package>)
