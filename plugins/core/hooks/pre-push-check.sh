#!/bin/bash
# Pre-push verification: Ensure Stop hooks have been run before allowing git push

# Read stdin JSON payload
PAYLOAD=$(cat)

# Extract the command being run from the JSON payload using han parse
COMMAND=$(echo "$PAYLOAD" | han parse json command -r --default "" 2>/dev/null || echo "")

# Check if this is a git push command
if echo "$COMMAND" | grep -q "git.*push"; then
	# Run verification to check if Stop hooks are cached
	if han hook verify Stop >/dev/null 2>&1; then
		# All hooks are cached, allow push to proceed
		exit 0
	else
		# Hooks are stale or haven't been run - auto-run them
		echo "⚠️  Stop hooks need to be run before pushing. Running them now..."

		# Run Stop hooks via dispatch
		if han hook dispatch Stop; then
			echo "✅ Stop hooks completed successfully. Proceeding with push..."
			exit 0
		else
			echo "❌ Stop hooks failed. Please fix the issues before pushing."
			echo ""
			echo "To retry manually:"
			echo "  han hook dispatch Stop"
			exit 1
		fi
	fi
fi

# Not a git push command, allow normal execution
exit 0
