# Specification-driven project workflow

## Every new task plan

- Read [PRD](../docs/PRD.md), [DEVSPEC](../docs/DEVSPEC.md),
  [UISPEC](../docs/UISPEC.md) and [TESTSPEC](../docs/TESTSPEC.md) before planning
  project work, including follow-up tasks.
- Cite applicable P/D/U/T requirement IDs, module dependencies, acceptance
  criteria and intended validation in the plan. For unrelated documentation or
  tooling work, state why a specification area is not applicable.
- PRD owns intent; DEVSPEC owns behavior and build order; UISPEC owns
  presentation; TESTSPEC verifies them. Preserve the upstream/downstream chain.
- Resolve conflicts and obtain decisions for blocked/open scope before affected
  implementation. Do not treat draft/proposed decisions as approved. For an
  intentional behavior change, agree and update the normative requirement
  before coding; post-task reconciliation is not permission to drift.
- Distinguish required future tooling from commands actually implemented.
  Do not claim application tests passed when only documents exist.

## Completion and human approval

- Implement and validate the applicable requirements. Report evidence, failures
  and untested/blocked gates. Ask for explicit human approval; do not infer it
  from passing tests, silence or approval of an earlier task.
- Only after work is complete, tested and explicitly approved, offer:
  **"Next task: Update specifications for <approved task>."**
- Ask whether to start that separate task using the available user-input tool.
  Include the source task/approval, affected specs/IDs and evidence in its
  proposed scope. Do not automatically create a chat, enqueue work or update
  specs as if already authorized. If input is declined, leave it unstarted.

## Specification update task

- Reconcile intent -> behavior -> presentation -> verification. Follow the
  lifecycle in DEVSPEC and maintenance checks in TESTSPEC.
- For each altered spec, update Version, Status and Last update using the
  actual date and actual approval state. Do not automatically mark Approved.
- Add a newest-first entry under the bottom **Spec change log** heading:
  `YYYY-MM-DD — <author> — <one-sentence description of change>`.
  The requested 2026 format uses the actual year as time advances.
- Preserve existing source briefs and logs. Do not change metadata for specs
  with no substantive or approval-state changes; report "No changes" instead.
- Validate cross-references, coverage, numeric constants and approval-state
  consistency. For changed behavior, retain the relevant implementation/test
  evidence; documentation-only checks do not replace it.
- Return a per-document list of everything added, removed and replaced,
  old/new metadata, verification performed and outstanding decisions.
  Explicitly say "None" for removals when nothing was removed.
