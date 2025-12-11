/**
 * Han OpenTelemetry Integration
 *
 * Uses the same environment variables as Claude Code for seamless integration:
 * - CLAUDE_CODE_ENABLE_TELEMETRY=1 - Enable telemetry
 * - OTEL_EXPORTER_OTLP_ENDPOINT - Collector endpoint
 * - OTEL_EXPORTER_OTLP_PROTOCOL - grpc, http/json, http/protobuf
 * - OTEL_EXPORTER_OTLP_HEADERS - Auth headers
 * - OTEL_METRICS_EXPORTER - otlp, console
 * - OTEL_LOGS_EXPORTER - otlp, console
 * - OTEL_RESOURCE_ATTRIBUTES - Custom attributes
 */

import { type Counter, type Histogram, metrics } from "@opentelemetry/api";
import { type Logger, logs, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
	ConsoleLogRecordExporter,
	LoggerProvider,
	SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
	ConsoleMetricExporter,
	MeterProvider,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { HAN_VERSION } from "../build-info.generated.js";

// Environment variable names (matching Claude Code)
const ENV_ENABLE_TELEMETRY = "CLAUDE_CODE_ENABLE_TELEMETRY";
const ENV_METRICS_EXPORTER = "OTEL_METRICS_EXPORTER";
const ENV_LOGS_EXPORTER = "OTEL_LOGS_EXPORTER";
const ENV_OTLP_ENDPOINT = "OTEL_EXPORTER_OTLP_ENDPOINT";
const ENV_OTLP_HEADERS = "OTEL_EXPORTER_OTLP_HEADERS";
const ENV_METRIC_INTERVAL = "OTEL_METRIC_EXPORT_INTERVAL";
const ENV_RESOURCE_ATTRIBUTES = "OTEL_RESOURCE_ATTRIBUTES";

// Default values
const DEFAULT_ENDPOINT = "http://localhost:4317";
const DEFAULT_METRIC_INTERVAL = 60000; // 60 seconds

// Han metric names
export const HAN_METRICS = {
	HOOK_EXECUTION: "han.hook.execution",
	HOOK_DURATION: "han.hook.duration_ms",
	PLUGIN_INSTALL: "han.plugin.install",
	PLUGIN_UNINSTALL: "han.plugin.uninstall",
	VALIDATION_RUN: "han.validation.run",
	TASK_COMPLETED: "han.task.completed",
	TASK_FAILED: "han.task.failed",
	FRUSTRATION_DETECTED: "han.frustration.detected",
	MCP_TOOL_CALL: "han.mcp.tool_call",
	SESSION_START: "han.session.start",
} as const;

// Han event names
export const HAN_EVENTS = {
	HOOK_RESULT: "han.hook_result",
	VALIDATION_ERROR: "han.validation_error",
	TASK_OUTCOME: "han.task_outcome",
	PLUGIN_EVENT: "han.plugin_event",
} as const;

interface TelemetryState {
	enabled: boolean;
	initialized: boolean;
	meterProvider: MeterProvider | null;
	loggerProvider: LoggerProvider | null;
	counters: Map<string, Counter>;
	histograms: Map<string, Histogram>;
	logger: Logger | null;
}

const state: TelemetryState = {
	enabled: false,
	initialized: false,
	meterProvider: null,
	loggerProvider: null,
	counters: new Map(),
	histograms: new Map(),
	logger: null,
};

/**
 * Check if telemetry is enabled via environment variable
 */
export function isTelemetryEnabled(): boolean {
	return process.env[ENV_ENABLE_TELEMETRY] === "1";
}

/**
 * Parse OTEL headers from environment variable
 * Format: "key1=value1,key2=value2"
 */
function parseHeaders(): Record<string, string> {
	const headersStr = process.env[ENV_OTLP_HEADERS];
	if (!headersStr) return {};

	const headers: Record<string, string> = {};
	for (const pair of headersStr.split(",")) {
		const [key, ...valueParts] = pair.split("=");
		if (key && valueParts.length > 0) {
			headers[key.trim()] = valueParts.join("=").trim();
		}
	}
	return headers;
}

/**
 * Parse resource attributes from environment variable
 * Format: "key1=value1,key2=value2" (W3C Baggage format)
 */
function parseResourceAttributes(): Record<string, string> {
	const attrsStr = process.env[ENV_RESOURCE_ATTRIBUTES];
	if (!attrsStr) return {};

	const attrs: Record<string, string> = {};
	for (const pair of attrsStr.split(",")) {
		const [key, ...valueParts] = pair.split("=");
		if (key && valueParts.length > 0) {
			attrs[key.trim()] = valueParts.join("=").trim();
		}
	}
	return attrs;
}

/**
 * Initialize OpenTelemetry SDK
 * Call this early in the application lifecycle
 */
export function initTelemetry(): void {
	if (state.initialized) return;
	state.initialized = true;

	if (!isTelemetryEnabled()) {
		state.enabled = false;
		return;
	}

	state.enabled = true;

	const endpoint = process.env[ENV_OTLP_ENDPOINT] || DEFAULT_ENDPOINT;
	const headers = parseHeaders();
	const customAttrs = parseResourceAttributes();
	const metricInterval = Number.parseInt(
		process.env[ENV_METRIC_INTERVAL] || String(DEFAULT_METRIC_INTERVAL),
		10,
	);

	// Create resource with Han-specific attributes
	const resource = resourceFromAttributes({
		[ATTR_SERVICE_NAME]: "han",
		[ATTR_SERVICE_VERSION]: HAN_VERSION,
		...customAttrs,
	});

	// Setup metrics
	const metricsExporter = process.env[ENV_METRICS_EXPORTER] || "otlp";
	if (metricsExporter !== "none") {
		const exporter =
			metricsExporter === "console"
				? new ConsoleMetricExporter()
				: new OTLPMetricExporter({
						url: `${endpoint}/v1/metrics`,
						headers,
					});

		state.meterProvider = new MeterProvider({
			resource,
			readers: [
				new PeriodicExportingMetricReader({
					exporter,
					exportIntervalMillis: metricInterval,
				}),
			],
		});

		metrics.setGlobalMeterProvider(state.meterProvider);
	}

	// Setup logs
	const logsExporter = process.env[ENV_LOGS_EXPORTER] || "otlp";
	if (logsExporter !== "none") {
		const logExporter =
			logsExporter === "console"
				? new ConsoleLogRecordExporter()
				: new OTLPLogExporter({
						url: `${endpoint}/v1/logs`,
						headers,
					});

		state.loggerProvider = new LoggerProvider({
			resource,
			processors: [new SimpleLogRecordProcessor(logExporter)],
		});

		logs.setGlobalLoggerProvider(state.loggerProvider);
		state.logger = logs.getLogger("han");
	}

	// Create standard counters
	const meter = metrics.getMeter("han");

	state.counters.set(
		HAN_METRICS.HOOK_EXECUTION,
		meter.createCounter(HAN_METRICS.HOOK_EXECUTION, {
			description: "Number of hook executions",
		}),
	);

	state.counters.set(
		HAN_METRICS.PLUGIN_INSTALL,
		meter.createCounter(HAN_METRICS.PLUGIN_INSTALL, {
			description: "Number of plugin installations",
		}),
	);

	state.counters.set(
		HAN_METRICS.PLUGIN_UNINSTALL,
		meter.createCounter(HAN_METRICS.PLUGIN_UNINSTALL, {
			description: "Number of plugin uninstallations",
		}),
	);

	state.counters.set(
		HAN_METRICS.VALIDATION_RUN,
		meter.createCounter(HAN_METRICS.VALIDATION_RUN, {
			description: "Number of validation runs",
		}),
	);

	state.counters.set(
		HAN_METRICS.TASK_COMPLETED,
		meter.createCounter(HAN_METRICS.TASK_COMPLETED, {
			description: "Number of tasks completed",
		}),
	);

	state.counters.set(
		HAN_METRICS.TASK_FAILED,
		meter.createCounter(HAN_METRICS.TASK_FAILED, {
			description: "Number of tasks failed",
		}),
	);

	state.counters.set(
		HAN_METRICS.FRUSTRATION_DETECTED,
		meter.createCounter(HAN_METRICS.FRUSTRATION_DETECTED, {
			description: "Number of frustration events detected",
		}),
	);

	state.counters.set(
		HAN_METRICS.MCP_TOOL_CALL,
		meter.createCounter(HAN_METRICS.MCP_TOOL_CALL, {
			description: "Number of MCP tool calls",
		}),
	);

	state.counters.set(
		HAN_METRICS.SESSION_START,
		meter.createCounter(HAN_METRICS.SESSION_START, {
			description: "Number of Han sessions started",
		}),
	);

	// Create histograms
	state.histograms.set(
		HAN_METRICS.HOOK_DURATION,
		meter.createHistogram(HAN_METRICS.HOOK_DURATION, {
			description: "Hook execution duration in milliseconds",
			unit: "ms",
		}),
	);
}

/**
 * Increment a counter metric
 */
export function incrementCounter(
	name: string,
	value = 1,
	attributes: Record<string, string | number | boolean> = {},
): void {
	if (!state.enabled) return;
	const counter = state.counters.get(name);
	if (counter) {
		counter.add(value, attributes);
	}
}

/**
 * Record a histogram value
 */
export function recordHistogram(
	name: string,
	value: number,
	attributes: Record<string, string | number | boolean> = {},
): void {
	if (!state.enabled) return;
	const histogram = state.histograms.get(name);
	if (histogram) {
		histogram.record(value, attributes);
	}
}

/**
 * Log an event
 */
export function logEvent(
	eventName: string,
	attributes: Record<string, string | number | boolean> = {},
	severity: SeverityNumber = SeverityNumber.INFO,
): void {
	if (!state.enabled || !state.logger) return;

	state.logger.emit({
		severityNumber: severity,
		body: eventName,
		attributes: {
			"event.name": eventName,
			"event.timestamp": new Date().toISOString(),
			...attributes,
		},
	});
}

/**
 * Shutdown telemetry (flush pending data)
 */
export async function shutdownTelemetry(): Promise<void> {
	if (!state.enabled) return;

	const promises: Promise<void>[] = [];

	if (state.meterProvider) {
		promises.push(state.meterProvider.shutdown());
	}

	if (state.loggerProvider) {
		promises.push(state.loggerProvider.shutdown());
	}

	await Promise.all(promises);
}

// ============================================================================
// Convenience functions for common metrics
// ============================================================================

/**
 * Record a hook execution
 */
export function recordHookExecution(
	hookName: string,
	success: boolean,
	durationMs: number,
	hookType: string,
): void {
	incrementCounter(HAN_METRICS.HOOK_EXECUTION, 1, {
		hook_name: hookName,
		success: String(success),
		hook_type: hookType,
	});

	recordHistogram(HAN_METRICS.HOOK_DURATION, durationMs, {
		hook_name: hookName,
		hook_type: hookType,
	});

	logEvent(HAN_EVENTS.HOOK_RESULT, {
		hook_name: hookName,
		success: String(success),
		duration_ms: durationMs,
		hook_type: hookType,
	});
}

/**
 * Record a plugin installation
 */
export function recordPluginInstall(
	pluginName: string,
	scope: string,
	success: boolean,
): void {
	incrementCounter(HAN_METRICS.PLUGIN_INSTALL, 1, {
		plugin_name: pluginName,
		scope,
		success: String(success),
	});

	logEvent(HAN_EVENTS.PLUGIN_EVENT, {
		action: "install",
		plugin_name: pluginName,
		scope,
		success: String(success),
	});
}

/**
 * Record a plugin uninstallation
 */
export function recordPluginUninstall(
	pluginName: string,
	success: boolean,
): void {
	incrementCounter(HAN_METRICS.PLUGIN_UNINSTALL, 1, {
		plugin_name: pluginName,
		success: String(success),
	});

	logEvent(HAN_EVENTS.PLUGIN_EVENT, {
		action: "uninstall",
		plugin_name: pluginName,
		success: String(success),
	});
}

/**
 * Record a validation run
 */
export function recordValidationRun(
	validationType: string,
	passed: boolean,
	errorCount = 0,
): void {
	incrementCounter(HAN_METRICS.VALIDATION_RUN, 1, {
		validation_type: validationType,
		passed: String(passed),
		error_count: errorCount,
	});

	if (!passed) {
		logEvent(
			HAN_EVENTS.VALIDATION_ERROR,
			{
				validation_type: validationType,
				error_count: errorCount,
			},
			SeverityNumber.WARN,
		);
	}
}

/**
 * Record a task completion
 */
export function recordTaskCompletion(
	taskType: string,
	outcome: "success" | "partial" | "failure",
	confidence: number,
): void {
	const metricName =
		outcome === "failure"
			? HAN_METRICS.TASK_FAILED
			: HAN_METRICS.TASK_COMPLETED;

	incrementCounter(metricName, 1, {
		task_type: taskType,
		outcome,
		confidence_bucket: Math.floor(confidence * 10) / 10, // Round to 0.1
	});

	logEvent(HAN_EVENTS.TASK_OUTCOME, {
		task_type: taskType,
		outcome,
		confidence,
	});
}

/**
 * Record a frustration detection
 */
export function recordFrustrationDetection(
	level: "low" | "moderate" | "high",
	score: number,
): void {
	incrementCounter(HAN_METRICS.FRUSTRATION_DETECTED, 1, {
		level,
		score_bucket: Math.floor(score),
	});
}

/**
 * Record an MCP tool call
 */
export function recordMcpToolCall(
	toolName: string,
	success: boolean,
	durationMs: number,
): void {
	incrementCounter(HAN_METRICS.MCP_TOOL_CALL, 1, {
		tool_name: toolName,
		success: String(success),
		duration_ms: durationMs,
	});
}

/**
 * Record a session start
 */
export function recordSessionStart(sessionId: string): void {
	incrementCounter(HAN_METRICS.SESSION_START, 1, {
		session_id: sessionId,
	});
}
