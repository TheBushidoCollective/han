---
title: "OpenTelemetry"
description: "Export Han metrics to observability platforms via OpenTelemetry."
---

Han supports exporting metrics, logs, and events to observability platforms via OpenTelemetry. This allows you to correlate Han's performance data with your application monitoring, dashboards, and alerting systems.

## What is OpenTelemetry?

OpenTelemetry (OTel) is an open-source standard for collecting telemetry data (metrics, logs, traces) from applications. It provides a vendor-neutral way to instrument code and export data to various backends like Grafana, Honeycomb, Datadog, and more.

## Why Export Han Metrics?

While Han stores metrics locally in `~/.claude/han/metrics/`, exporting to OpenTelemetry enables:

- **Dashboards** - Visualize task success rates, hook failures, and calibration trends
- **Alerting** - Get notified when hook failure rates spike or calibration degrades
- **Correlation** - Connect AI-assisted development metrics with application performance
- **Team visibility** - Share aggregate metrics across your team (without exposing individual work)

## Enabling OpenTelemetry

Han uses the same environment variables as Claude Code for seamless integration:

```bash
# Enable telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY=1

# Set OTLP endpoint (required)
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317

# Optional: Set protocol (default: grpc)
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc  # or http/json, http/protobuf

# Optional: Set authentication headers
export OTEL_EXPORTER_OTLP_HEADERS="x-api-key=your-api-key"

# Optional: Configure exporters
export OTEL_METRICS_EXPORTER=otlp  # or console, none
export OTEL_LOGS_EXPORTER=otlp     # or console, none

# Optional: Custom resource attributes
export OTEL_RESOURCE_ATTRIBUTES="environment=production,team=engineering"

# Optional: Metric export interval (default: 60000ms)
export OTEL_METRIC_EXPORT_INTERVAL=30000
```

## Supported Platforms

Han exports telemetry to any OpenTelemetry-compatible backend:

### Grafana Cloud

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-prod-us-central-0.grafana.net/otlp
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic $(echo -n "instance_id:api_token" | base64)"
```

### Honeycomb

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
export OTEL_EXPORTER_OTLP_HEADERS="x-honeycomb-team=your-api-key"
```

### Datadog

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
# Ensure Datadog Agent is running with OTLP receiver enabled
```

### Self-hosted OpenTelemetry Collector

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

## Metrics Exported

Han exports the following metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `han.hook.execution` | Counter | Number of hook executions (with `hook_name`, `success`, `hook_type` attributes) |
| `han.hook.duration_ms` | Histogram | Hook execution duration in milliseconds |
| `han.plugin.install` | Counter | Plugin installations (with `plugin_name`, `scope`, `success`) |
| `han.plugin.uninstall` | Counter | Plugin uninstallations (with `plugin_name`, `success`) |
| `han.task.completed` | Counter | Tasks completed (with `task_type`, `outcome`, `confidence_bucket`) |
| `han.task.failed` | Counter | Tasks failed (with `task_type`, `outcome`, `confidence_bucket`) |
| `han.validation.run` | Counter | Validation runs (with `validation_type`, `passed`, `error_count`) |
| `han.mcp.tool_call` | Counter | MCP tool calls (with `tool_name`, `success`, `duration_ms`) |
| `han.session.start` | Counter | Han sessions started |
| `han.frustration.detected` | Counter | Frustration events detected (with `level`, `score_bucket`) |

## Events and Logs

Han exports structured events as logs:

| Event | Severity | Attributes |
|-------|----------|------------|
| `han.hook_result` | INFO | `hook_name`, `success`, `duration_ms`, `hook_type` |
| `han.validation_error` | WARN | `validation_type`, `error_count` |
| `han.task_outcome` | INFO | `task_type`, `outcome`, `confidence` |
| `han.plugin_event` | INFO | `action`, `plugin_name`, `scope`, `success` |

## Span Attributes and Trace Structure

All telemetry includes standard resource attributes:

- `service.name=han`
- `service.version=<han-version>`
- Custom attributes from `OTEL_RESOURCE_ATTRIBUTES`

## Example: Grafana Dashboard

After exporting to Grafana, you can create dashboards to visualize:

**Hook Success Rate:**

```promql
rate(han_hook_execution{success="true"}[5m])
/
rate(han_hook_execution[5m])
```

**Task Calibration:**

```promql
han_task_completed{outcome="success"}
by (confidence_bucket)
```

**Hook Duration P95:**

```promql
histogram_quantile(0.95,
  rate(han_hook_duration_ms_bucket[5m])
)
```

## Console Output (Debugging)

For local debugging, export to console instead of OTLP:

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=console
export OTEL_LOGS_EXPORTER=console
```

This prints all metrics and logs to stdout instead of sending them to a backend.

## Privacy Considerations

When exporting telemetry:

- **Aggregate data only** - Metrics are counters and histograms, not individual task details
- **No code content** - Only metadata like task types, hook names, and outcomes
- **Control** - You choose what to export and where it goes
- **Opt-in** - Telemetry is disabled by default

For team dashboards, consider:

- Using separate OTLP endpoints for team vs. personal metrics
- Setting `OTEL_RESOURCE_ATTRIBUTES` to identify projects without exposing personal data
- Only exporting aggregate metrics (`OTEL_LOGS_EXPORTER=none`)

## Disabling Telemetry

To disable OpenTelemetry export:

```bash
# Unset the environment variable
unset CLAUDE_CODE_ENABLE_TELEMETRY

# Or set to 0
export CLAUDE_CODE_ENABLE_TELEMETRY=0
```

Local metrics in `~/.claude/han/metrics/` continue to work regardless of OpenTelemetry settings.

## Getting Started

1. **Choose a backend** - Grafana Cloud, Honeycomb, self-hosted, etc.
2. **Get credentials** - API keys, endpoints, authentication
3. **Set environment variables** - Configure OTLP endpoint and headers
4. **Enable telemetry** - Set `CLAUDE_CODE_ENABLE_TELEMETRY=1`
5. **Use Han normally** - Metrics export automatically
6. **Build dashboards** - Visualize the data in your observability platform

## Learn More

- [Local Metrics](/docs/metrics) - Understanding Han's local metrics system
- [MCP Integrations](/docs/integrations) - How Han exposes metrics via MCP
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/) - Official OTel docs
