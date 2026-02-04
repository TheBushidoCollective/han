---
name: sre-reliability-engineering
description: Use when building reliable and scalable distributed systems.
allowed-tools: []
---

# SRE Reliability Engineering

Building reliable and scalable distributed systems.

## Service Level Objectives (SLOs)

### Defining SLOs

```
SLI: Availability = successful requests / total requests
SLO: 99.9% availability (measured over 30 days)
Error Budget: 0.1% = 43 minutes downtime per month
```

### SLO Document Template

```markdown
# API Service SLO

## Availability SLO

**Target**: 99.9% of requests succeed (measured over 30 days)

**SLI Definition**: 
- Success: HTTP 200-399 responses
- Failure: HTTP 500-599 responses, timeouts
- Excluded: HTTP 400-499 (client errors)

**Measurement**: 
```prometheus
sum(rate(http_requests_total{status=~"[23].."}[30d]))
/
sum(rate(http_requests_total{status!~"4.."}[30d]))
```

**Error Budget**: 0.1% = ~43 minutes/month

**Consequences**:

- Budget remaining > 0: Ship features fast
- Budget exhausted: Feature freeze, focus on reliability
- Budget at 50%: Increase caution

```

## Error Budgets

### Tracking

```prometheus
# Error budget remaining
error_budget_remaining = 1 - (
  (1 - current_sli) / (1 - slo_target)
)

# Example: 99.9% SLO, currently at 99.95%
# Error budget remaining = 1 - ((1 - 0.9995) / (1 - 0.999))
# = 1 - (0.0005 / 0.001) = 0.5 (50% remaining)
```

### Burn Rate

```prometheus
# How fast are we consuming error budget?
error_budget_burn_rate = 
  (1 - current_sli_1h) / (1 - slo_target)
  
# Alert if burning budget 10x faster than sustainable
- alert: FastErrorBudgetBurn
  expr: error_budget_burn_rate > 10
  for: 1h
```

### Policy

```
Error Budget > 75%: Ship aggressively
Error Budget 25-75%: Normal velocity
Error Budget < 25%: Slow down, increase testing
Error Budget = 0%: Feature freeze, reliability only
```

## Reliability Patterns

### Circuit Breaker

```javascript
class CircuitBreaker {
  constructor({ threshold = 5, timeout = 60000 }) {
    this.state = 'CLOSED';
    this.failures = 0;
    this.threshold = threshold;
    this.timeout = timeout;
  }
  
  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}
```

### Retry with Exponential Backoff

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      const jitter = Math.random() * 1000;
      
      await sleep(delay + jitter);
    }
  }
}
```

### Rate Limiting

```javascript
class TokenBucket {
  constructor({ capacity, refillRate }) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }
  
  tryConsume(tokens = 1) {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }
  
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(
      this.capacity,
      this.tokens + tokensToAdd
    );
    this.lastRefill = now;
  }
}
```

### Bulkhead

```javascript
class Bulkhead {
  constructor({ maxConcurrent }) {
    this.maxConcurrent = maxConcurrent;
    this.current = 0;
    this.queue = [];
  }
  
  async execute(fn) {
    while (this.current >= this.maxConcurrent) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    
    this.current++;
    try {
      return await fn();
    } finally {
      this.current--;
      if (this.queue.length > 0) {
        const resolve = this.queue.shift();
        resolve();
      }
    }
  }
}
```

## Graceful Degradation

```javascript
async function getRecommendations(userId) {
  try {
    // Try personalized recommendations
    return await recommendationService.getPersonalized(userId, {
      timeout: 500, // Fail fast
    });
  } catch (error) {
    logger.warn('Personalized recommendations failed, falling back', {
      userId,
      error: error.message,
    });
    
    try {
      // Fall back to popular items
      return await cache.get('popular_items');
    } catch (fallbackError) {
      // Final fallback
      return DEFAULT_RECOMMENDATIONS;
    }
  }
}
```

## Capacity Planning

### Utilization Tracking

```prometheus
# Current utilization
current_utilization = 
  sum(rate(http_requests_total[5m]))
  / capacity_requests_per_second

# Alert when approaching capacity
- alert: HighUtilization
  expr: current_utilization > 0.80
  for: 10m
```

### Growth Projection

```
Current QPS: 1,000
Growth rate: 20% per month
Capacity per instance: 100 QPS
Current instances: 12

In 6 months:
Projected QPS: 1,000 * (1.20)^6 = 2,986
Instances needed: 2,986 / 100 = 30
```

### Load Testing

```javascript
// k6 load test
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 100 },   // Steady state
    { duration: '2m', target: 200 },   // Spike
    { duration: '5m', target: 200 },   // Higher steady
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% under 500ms
    http_req_failed: ['rate<0.01'],     // Less than 1% errors
  },
};

export default function () {
  const res = http.get('https://api.example.com/endpoint');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

## Chaos Engineering

### Fault Injection

```javascript
// Inject latency
function withLatencyInjection(fn, { probability = 0.1, delayMs = 1000 }) {
  return async (...args) => {
    if (Math.random() < probability) {
      await sleep(delayMs);
    }
    return fn(...args);
  };
}

// Inject failures
function withFailureInjection(fn, { probability = 0.05 }) {
  return async (...args) => {
    if (Math.random() < probability) {
      throw new Error('Injected failure');
    }
    return fn(...args);
  };
}
```

## Best Practices

### Design for Failure

- Assume all dependencies can fail
- Have fallback options
- Fail fast and timeout quickly
- Implement retries with backoff

### Measure User Impact

- SLOs should reflect user experience
- Don't alert on internal metrics alone
- Track real user monitoring (RUM)

### Balance Velocity and Reliability

- Use error budgets to make decisions
- Don't target 100% reliability
- Spend error budget on innovation

### Automate Everything

- Automate deployments
- Automate rollbacks
- Automate capacity scaling
- Automate incident response
