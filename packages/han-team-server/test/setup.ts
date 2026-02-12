/**
 * Test Setup - Sets environment variables for test mode
 *
 * This file is preloaded before all tests via bunfig.toml
 */

// SECURITY: Enable test mode - only in test environment
process.env.HAN_TEST_MODE = "true";

// SECURITY: Allow test tokens to have admin privileges in tests
process.env.HAN_ALLOW_TEST_ADMIN = "true";
