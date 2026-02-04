#!/bin/bash
set -e

# Build Android project with Gradle
# Limit output to last 30 lines to avoid overwhelming logs
./gradlew assembleDebug --no-daemon -q 2>&1 | tail -30 || exit 1
