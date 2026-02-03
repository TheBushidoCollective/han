#!/bin/bash
# Detect the JavaScript package manager based on lock files
# Usage: detect-package-manager.sh [command]
#   No args: prints the package manager name (bun, pnpm, yarn, npm)
#   With arg: prints the full command (e.g., "bun run test", "yarn test")
#
# Priority order (first match wins):
#   1. bun.lock or bun.lockb -> bun
#   2. pnpm-lock.yaml -> pnpm
#   3. yarn.lock -> yarn
#   4. package-lock.json -> npm
#   5. Default -> npm (if package.json exists)

detect_pm() {
  if [ -f "bun.lock" ] || [ -f "bun.lockb" ]; then
    echo "bun"
  elif [ -f "pnpm-lock.yaml" ]; then
    echo "pnpm"
  elif [ -f "yarn.lock" ]; then
    echo "yarn"
  elif [ -f "package-lock.json" ]; then
    echo "npm"
  elif [ -f "package.json" ]; then
    # Default to npm if package.json exists but no lock file
    echo "npm"
  else
    # No JS project detected
    echo ""
  fi
}

# Get the run command for a package manager
# Usage: get_run_cmd <pm> <script>
# e.g., get_run_cmd "bun" "test" -> "bun run test"
#       get_run_cmd "yarn" "test" -> "yarn test"
get_run_cmd() {
  local pm="$1"
  local script="$2"

  case "$pm" in
    bun)
      echo "bun run $script"
      ;;
    pnpm)
      echo "pnpm run $script"
      ;;
    yarn)
      # yarn doesn't need "run" for scripts
      echo "yarn $script"
      ;;
    npm)
      echo "npm run $script"
      ;;
    *)
      # Default to npm
      echo "npm run $script"
      ;;
  esac
}

# Main execution
if [ $# -eq 0 ]; then
  # No args - just print the package manager
  detect_pm
else
  # With arg - print the run command
  pm=$(detect_pm)
  if [ -z "$pm" ]; then
    echo "No package manager detected" >&2
    exit 1
  fi
  get_run_cmd "$pm" "$1"
fi
