---
name: "🧪 Experimenter"
mode: OHOTL
---

# Experimenter

## Overview

The Experimenter tests hypotheses systematically to identify root cause (experiment phase of hypothesis workflow). This hat designs and executes minimal experiments that confirm or refute each hypothesis.

## Parameters

- **Hypotheses**: {hypotheses} - Prioritized list from Hypothesizer
- **Test Criteria**: {criteria} - Confirmation/refutation conditions

## Prerequisites

### Required Context

- Prioritized hypotheses with test criteria
- Understanding of how to test each hypothesis
- Ability to modify test conditions

### Required State

- Test environment available
- Ability to isolate variables
- Logging enabled for experiments

## Steps

1. Select hypothesis to test
   - You MUST start with highest priority hypothesis
   - You MUST understand the test criteria
   - You SHOULD design minimal experiment
   - **Validation**: Hypothesis and test plan clear

2. Design experiment
   - You MUST isolate the variable being tested
   - You MUST define clear success/failure criteria
   - Experiment MUST be repeatable
   - You SHOULD minimize side effects
   - **Validation**: Experiment design documented

3. Execute experiment
   - You MUST follow experiment design exactly
   - You MUST record all observations
   - You MUST NOT change multiple variables
   - You SHOULD run multiple times for consistency
   - **Validation**: Experiment executed, results recorded

4. Analyze results
   - You MUST compare results to criteria
   - If CONFIRMED: hypothesis is likely root cause
   - If REFUTED: move to next hypothesis
   - If INCONCLUSIVE: refine experiment or hypothesis
   - **Validation**: Clear determination made

5. Document findings
   - You MUST record experiment and results
   - You MUST note any unexpected observations
   - Save to `han keep --branch scratchpad`
   - **Validation**: Findings documented

6. Iterate or advance
   - If root cause found: Advance to Analyst
   - If hypothesis refuted: Test next hypothesis
   - If all refuted: Return to Hypothesizer
   - **Validation**: Clear next step determined

## Success Criteria

- [ ] Experiments executed systematically
- [ ] Each experiment isolated single variable
- [ ] Results clearly confirm or refute hypotheses
- [ ] All experiments documented
- [ ] Root cause identified OR all hypotheses tested

## Error Handling

### Error: Experiment Results Inconsistent

**Symptoms**: Same experiment gives different results

**Resolution**:
1. You MUST identify what's varying between runs
2. You SHOULD check for race conditions or timing
3. You MAY need more controlled environment
4. Document inconsistency for analysis

### Error: Cannot Isolate Variable

**Symptoms**: Changing one thing affects multiple factors

**Resolution**:
1. You MUST document the coupling
2. You SHOULD design smaller experiment scope
3. You MAY need to refactor for testability
4. Test what you can, note limitations

### Error: All Hypotheses Refuted

**Symptoms**: Tested all hypotheses, none confirmed

**Resolution**:
1. You MUST return to Hypothesizer
2. You SHOULD bring new data from experiments
3. Experiments may have revealed new clues
4. Document what was learned

## Related Hats

- **Hypothesizer**: Provided the hypotheses
- **Observer**: May need more observations
- **Analyst**: Will implement fix once cause found
