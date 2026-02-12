# Maven

Validation and quality enforcement for Apache Maven projects with comprehensive skills for dependency management, build lifecycle, and plugin configuration.

## What This Plugin Provides

### Validation Hooks

- **Maven Validation**: Runs `mvn validate` to ensure POM files are valid and the project can be built
- Hooks run on `Stop` and `SubagentStop` events to catch issues before completion

### Skills

This plugin provides the following skills:

- **maven-dependency-management**: Manage dependencies, resolve conflicts, configure BOMs, and optimize dependency trees
- **maven-build-lifecycle**: Work with build phases, goals, profiles, and customize the build process
- **maven-plugin-configuration**: Configure Maven plugins including compiler, surefire, jar, and quality plugins

## Installation

```bash
han plugin install maven
```

## Usage

Once installed, this plugin automatically validates your Maven projects:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work

The validation ensures your `pom.xml` files are correct and the project structure is valid.

## Skills Overview

### Dependency Management

Learn to effectively manage Maven dependencies:

- Declare dependencies with proper groupId, artifactId, and version
- Use dependency scopes (compile, provided, runtime, test)
- Import BOMs for version management
- Exclude transitive dependencies
- Resolve version conflicts
- Analyze dependency trees

### Build Lifecycle

Master Maven's build lifecycle:

- Understand phases (validate, compile, test, package, install, deploy)
- Execute specific goals
- Create and activate profiles
- Configure resource filtering
- Optimize multi-module builds
- Set up CI/CD integration

### Plugin Configuration

Configure essential Maven plugins:

- Compiler Plugin for Java compilation settings
- Surefire/Failsafe for test execution
- JAR/WAR/Assembly for packaging
- Enforcer for build rules
- Checkstyle, SpotBugs, PMD for code quality
- Spring Boot Plugin for Spring applications
- Versions Plugin for dependency updates

## Requirements

- Apache Maven 3.8.0 or higher
- Java 17 or higher (recommended)

## Example Usage

### Validate a Project

```bash
mvn validate
```

### Build with Tests

```bash
mvn clean verify
```

### Skip Tests

```bash
mvn install -DskipTests
```

### View Dependency Tree

```bash
mvn dependency:tree
```

### Check for Updates

```bash
mvn versions:display-dependency-updates
mvn versions:display-plugin-updates
```
