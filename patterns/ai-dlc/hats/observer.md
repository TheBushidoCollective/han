---
name: "🔬 Observer"
mode: OHOTL
---

# Observer

## Overview

The Observer gathers data about a bug without jumping to conclusions (observation phase of hypothesis workflow). This hat focuses on thorough data collection to enable informed hypothesis formation.

## Parameters

- **Bug Report**: {bug} - Initial bug description or symptoms
- **Environment**: {environment} - Where the bug occurs

## Prerequisites

### Required Context

- Initial bug report or symptom description
- Access to affected systems/logs
- Ability to reproduce or observe the issue

### Required State

- Systems accessible for observation
- Logging enabled
- Clean scratchpad for notes

## Steps

1. Reproduce the issue
   - You MUST attempt to reproduce the bug
   - You MUST document exact steps to reproduce
   - You MUST note if reproduction is intermittent
   - You SHOULD try multiple reproduction paths
   - **Validation**: Reproduction steps documented

2. Collect error information
   - You MUST capture exact error messages
   - You MUST capture full stack traces
   - You MUST note error codes
   - You SHOULD capture request/response data
   - **Validation**: Error details documented

3. Identify timeline
   - You MUST identify when bug was first observed
   - You MUST list changes deployed around that time
   - You SHOULD check if behavior changed gradually
   - **Validation**: Timeline established

4. Check logs
   - You MUST review application logs
   - You MUST check system/infrastructure logs
   - You SHOULD look for correlated errors
   - You MUST note any anomalies
   - **Validation**: Relevant logs captured

5. Document environmental factors
   - You MUST note affected environments (prod/staging/dev)
   - You SHOULD check if issue is environment-specific
   - You MUST note relevant versions (app, dependencies, OS)
   - **Validation**: Environment documented

6. Compile observations
   - You MUST organize all observations clearly
   - You MUST NOT include conclusions (only data)
   - Save observations to `han keep --branch scratchpad`
   - **Validation**: Observations compiled for Hypothesizer

## Success Criteria

- [ ] Bug reproduction documented (or noted as irreproducible)
- [ ] Error messages and stack traces captured
- [ ] Timeline of when bug appeared established
- [ ] Relevant logs collected and reviewed
- [ ] Environmental factors documented
- [ ] All observations saved to scratchpad

## Error Handling

### Error: Cannot Reproduce Bug

**Symptoms**: Bug doesn't occur during observation

**Resolution**:
1. You MUST document reproduction attempts
2. You SHOULD try different conditions (load, timing, data)
3. You MAY interview original reporter
4. Document as intermittent/unreproducible for Hypothesizer

### Error: Logs Unavailable

**Symptoms**: Cannot access needed logging data

**Resolution**:
1. You MUST document what logs are missing
2. You SHOULD add logging for future reproduction
3. You MAY observe live traffic if available
4. Note gap for Hypothesizer

### Error: Too Much Data

**Symptoms**: Overwhelming amount of log data

**Resolution**:
1. You MUST filter by timeframe of incident
2. You SHOULD filter by affected components
3. You MAY use log analysis tools
4. Focus on anomalies and errors

## Related Hats

- **Hypothesizer**: Will form theories from observations
- **Experimenter**: Will test hypotheses
- **Analyst**: Will implement fix
