# Mission Control Operational Knowledge Architecture

## Purpose

Define a single architecture for building, validating, and continuously improving the operational knowledge base (KB) that powers KubeStellar Console Mission Control.

This plan is **strictly scoped** to:
- Operational knowledge content (runbooks, install/upgrade/rollback flows, YAML templates, known fixes)
- End-to-end mission-control pipeline validation (`user query -> KB retrieval -> command generation -> cluster execution`)
- Autonomous nightly re-validation and stale-content detection
- KB gap detection and draft generation for missing coverage

This plan explicitly excludes:
- UI test infrastructure
- Generic test coverage programs
- Production telemetry/GA4 error analysis
- Companion bug-discovery or test-coverage mentorship tracks

---

## High-Level Architecture

```text
User Question
   |
   v
Mission Control API / Assistant
   |
   v
KB Retrieval Layer (console-kb index + documents)
   |
   v
Command Synthesis Layer (steps, kubectl/helm commands, YAML refs)
   |
   v
Execution Harness (ephemeral test clusters)
   |
   v
Outcome Verifier (health checks + assertions)
   |
   +--> Validation Reports (pass/fail + root cause)
   |
   +--> Nightly GitHub Action (re-validation)
   |
   +--> Auto-Issue Creator (stale/failed content)
   |
   +--> Query Gap Analyzer (no-result / low-confidence queries)
           |
           v
       Draft Content Generator (PR-ready runbook/template skeletons)
```

---

## Repository Responsibilities

### `kubestellar/console-kb`
- Canonical operational content source.
- Contains runbooks, mission definitions, YAML templates, prerequisites, and troubleshooting fixes.
- Includes metadata needed for automated validation:
  - Supported KubeStellar/Kubernetes version ranges
  - Preconditions
  - Safety level (`read-only`, `safe-write`, `destructive`)
  - Expected outcomes and rollback steps

### `kubestellar/console`
- Hosts Mission Control API integration and validation automation entry points.
- Owns:
  - E2E pipeline tests
  - Nightly GitHub Actions workflows
  - Gap tracking and stale-content issue automation

---

## Content Model (for each KB operation)

Each operation entry should include:

1. **Intent**: What user outcome this achieves.
2. **Prerequisites**: Cluster state, permissions, tool versions.
3. **Inputs**: Required parameters with defaults/examples.
4. **Execution Plan**: Ordered commands and YAML artifacts.
5. **Verification**: Machine-checkable assertions (resource exists, status healthy, logs clean).
6. **Rollback/Recovery**: Steps to safely undo changes.
7. **Failure Signatures**: Known errors and remediations.
8. **Compatibility Matrix**: Supported versions.
9. **Validation Metadata**: Last validated date, workflow run id, environment profile.

---

## End-to-End Validation Pipeline

## 1) Query-to-KB validation
- Feed representative user questions per operation category.
- Assert a deterministic KB retrieval target (or top-N relevance threshold).
- Flag no-result and low-confidence hits.

## 2) KB-to-command validation
- Ensure generated command sequence references only approved tools (`kubectl`, `helm`, `kustomize`, etc.).
- Validate syntax and placeholders before execution.
- Block unsafe/destructive steps unless in explicit destructive test lanes.

## 3) Command-to-cluster validation
- Execute in disposable clusters (kind/k3d or cloud sandbox).
- Capture stdout/stderr, events, and resource diffs.
- Assert post-conditions from KB metadata.

## 4) Result classification
- `PASS`: all assertions satisfied.
- `FAIL_CONTENT`: outdated or incorrect KB instructions.
- `FAIL_ENV`: infrastructure drift / missing dependency.
- `FAIL_GENERATION`: assistant generated incorrect command sequence.

---

## Nightly Autonomous Workflow Design

Nightly GitHub Action should run four stages:

1. **Inventory Stage**
   - Enumerate all operational KB entries.
   - Build a validation matrix by operation type and version profile.

2. **Execution Stage**
   - Provision test clusters.
   - Run operation validations in parallel shards.

3. **Analysis Stage**
   - Compute pass rate and staleness signals.
   - Enforce SLO: `>= 90%` operational entries passing on current supported versions.

4. **Response Stage**
   - Auto-file issues for:
     - stale content
     - broken command paths
     - prerequisite drift
   - Attach logs, failing step, suggested owner labels, and repro commands.

---

## KB Gap Feedback Loop

1. Collect query logs from Mission Control where:
   - no KB match returned, or
   - command execution failed due to insufficient guidance.
2. Cluster similar missing intents.
3. Auto-generate content drafts (runbook/template skeletons) with:
   - intent
   - prerequisites
   - candidate commands
   - validation checklist
4. Open draft PRs/issues for human review and merge.

Success metric: gap backlog trends downward week-over-week.

---

## Deliverables Map (Mentorship Outcomes)

1. Runbooks for install, upgrade, rollback, disaster recovery, and multi-cluster sync failures.
2. Validated YAML/fix library for common operational issues.
3. End-to-end mission-control execution tests with real cluster assertions.
4. Nightly autonomous validation workflow with auto-issue filing.
5. Gap analysis and draft generation automation for missing content.
6. `>=90%` validated operational KB pass rate on current KubeStellar versions.
7. KB contribution guide for future contributors.
8. Midpoint and final community call reports.

---

## Suggested Milestones (Jun-Aug)

- **Weeks 1-2**: Baseline audit and taxonomy for all operations.
- **Weeks 3-5**: Core runbook + YAML template generation and first validation harness.
- **Week 6**: Midpoint presentation with pass-rate baseline.
- **Weeks 7-9**: Full E2E pipeline hardening + nightly issue automation.
- **Weeks 10-11**: Gap-driven draft generation loop and contributor guide.
- **Week 12**: Final presentation with coverage/pass-rate outcomes and next-step backlog.

---

## Governance and Quality Gates

- Every KB change must include executable verification steps.
- No operation is marked complete without a passing cluster execution record.
- Failing nightly validations auto-open issues and block "validated" status.
- Track three KPIs:
  - Operational KB validation pass rate
  - No-result query rate
  - Mean time to refresh stale content

This architecture keeps Mission Control operational knowledge continuously testable, measurable, and self-healing as the KubeStellar ecosystem evolves.
