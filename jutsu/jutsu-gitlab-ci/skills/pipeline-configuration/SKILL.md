---
name: gitlab-ci-pipeline-configuration
description: Use when configuring GitLab CI/CD pipelines, defining stages, or setting up workflow rules. Covers pipeline structure, stage ordering, and execution flow.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# GitLab CI - Pipeline Configuration

Configure GitLab CI/CD pipelines with proper stage ordering, workflow rules, and execution flow.

## Pipeline Structure

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - deploy

default:
  image: node:20-alpine
  before_script:
    - npm ci --cache .npm --prefer-offline
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - .npm/

workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

## Stage Configuration

### Sequential Stages

```yaml
stages:
  - install
  - lint
  - test
  - build
  - deploy
```

### Parallel Jobs Within Stages

```yaml
test:unit:
  stage: test
  script: npm run test:unit

test:integration:
  stage: test
  script: npm run test:integration

test:e2e:
  stage: test
  script: npm run test:e2e
```

## Workflow Rules

### Branch-Based Pipelines

```yaml
workflow:
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      variables:
        DEPLOY_ENV: production
    - if: $CI_COMMIT_BRANCH =~ /^release\//
      variables:
        DEPLOY_ENV: staging
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_TAG
```

### Auto-Cancel Redundant Pipelines

```yaml
workflow:
  auto_cancel:
    on_new_commit: interruptible
```

## Using Needs for DAG Pipelines

```yaml
build:
  stage: build
  script: npm run build

test:unit:
  stage: test
  needs: ["build"]
  script: npm run test:unit

test:lint:
  stage: test
  needs: []  # No dependencies, runs immediately
  script: npm run lint

deploy:
  stage: deploy
  needs: ["build", "test:unit"]
  script: npm run deploy
```

## Include External Configurations

```yaml
include:
  - local: .gitlab/ci/build.yml
  - local: .gitlab/ci/test.yml
  - project: 'my-group/my-templates'
    ref: main
    file: '/templates/deploy.yml'
  - template: Security/SAST.gitlab-ci.yml
```

## Best Practices

1. Define clear stage ordering
2. Use `needs` to optimize pipeline execution
3. Configure workflow rules to prevent unnecessary pipelines
4. Use `include` to split large configurations
5. Set appropriate `interruptible` flags for cancelable jobs
