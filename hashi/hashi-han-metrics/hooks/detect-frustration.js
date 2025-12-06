#!/usr/bin/env node

/**
 * Frustration Detection Hook
 *
 * Analyzes user messages for frustration signals and provides guidance
 * when frustration is detected. This helps track user experience in metrics.
 */

const message = process.env.USER_MESSAGE || '';

// Define frustration indicators
const indicators = {
  // Negative outcome words
  negative: /\b(broken|doesn't work|doesn't|didn't|failed|error|wrong|useless|bad|worse|terrible|awful|horrible|not working)\b/gi,

  // Emotional frustration words
  emotional: /\b(frustrat(ed|ing)|annoying|confus(ed|ing)|hate|stupid|dumb|ridiculous|waste|pointless)\b/gi,

  // All caps (indicates shouting/frustration)
  caps: /[A-Z]{5,}/,

  // Multiple punctuation marks
  exclamation: /[!?]{2,}/,

  // Very terse messages (potential anger)
  terse: message.trim().length < 15 && message.trim().length > 0 && !message.includes(' '),

  // Repeated words (indicates emphasis/frustration)
  repeated: /\b(\w+)\s+\1\b/gi,

  // Negative commands
  negativeCommands: /\b(stop|quit|never mind|forget it|give up)\b/gi,
};

// Count matches for each indicator
const matches = {
  negative: (message.match(indicators.negative) || []).length,
  emotional: (message.match(indicators.emotional) || []).length,
  caps: indicators.caps.test(message),
  exclamation: indicators.exclamation.test(message),
  terse: indicators.terse,
  repeated: (message.match(indicators.repeated) || []).length,
  negativeCommands: (message.match(indicators.negativeCommands) || []).length,
};

// Calculate frustration score (weighted)
const score =
  matches.negative * 1 +
  matches.emotional * 2 +
  (matches.caps ? 2 : 0) +
  (matches.exclamation ? 1 : 0) +
  (matches.terse ? 1 : 0) +
  matches.repeated * 1 +
  matches.negativeCommands * 2;

// Threshold for frustration detection
const FRUSTRATION_THRESHOLD = 2;

if (score >= FRUSTRATION_THRESHOLD) {
  console.log(`\n⚠️  Frustration detected (score: ${score}/${Object.values(matches).reduce((a, b) => a + (typeof b === 'number' ? b : b ? 1 : 0), 0)} indicators)`);
  console.log('\nDetected signals:');

  if (matches.negative > 0) {
    console.log(`  • ${matches.negative} negative outcome word(s)`);
  }
  if (matches.emotional > 0) {
    console.log(`  • ${matches.emotional} emotional frustration word(s)`);
  }
  if (matches.caps) {
    console.log('  • ALL CAPS detected');
  }
  if (matches.exclamation) {
    console.log('  • Multiple punctuation marks (!!!/???)');
  }
  if (matches.terse) {
    console.log('  • Very terse message');
  }
  if (matches.repeated > 0) {
    console.log(`  • ${matches.repeated} repeated word(s)`);
  }
  if (matches.negativeCommands > 0) {
    console.log(`  • ${matches.negativeCommands} negative command(s)`);
  }

  console.log('\nThis interaction will be tracked in metrics for quality improvement.');
  console.log('The agent will work to better understand and address your needs.\n');
}

// Exit successfully (don't block the interaction)
process.exit(0);
