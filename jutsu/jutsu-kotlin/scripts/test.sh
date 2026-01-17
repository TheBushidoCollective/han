#!/bin/bash
# Run Kotlin tests with Gradle, fall back to Maven if Gradle fails

if ./gradlew test; then
  exit 0
fi

# Gradle failed, try Maven if pom.xml exists
if [ -f "pom.xml" ]; then
  echo "Gradle test failed, trying Maven..."
  mvn test
else
  exit 1
fi
