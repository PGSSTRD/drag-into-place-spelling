# Retire MVP and make Better the minimum tier

**Status:** Draft — specification reconciliation approved; implementation not approved
**Created:** 2026-10-26

## Goal

Remove MVP as a planned delivery phase and learner-selectable tier. Keep Better
as the minimum playable tier, including its foils and position hints, and retain
Great as the higher tier with its existing Better behavior plus moving letters.
On a fresh install, Better should be selected by default.

This task records the requested direction. The user approved specification
reconciliation on 2026-10-26; no application implementation is authorized.

## Scope

- Remove MVP as a current product phase and selectable gameplay mode.
- Make Better the baseline for a new installation and preserve Better's
  existing foils, foil-removal, and hint behavior.
- Retain Great and its existing inheritance of Better behavior.
- Reconcile product, behavior, presentation, and verification requirements
  before changing application code.
- Update learner-facing tier names, tier-dependent behavior, persistence, and
  newly emitted reporting values consistently with the approved specifications.
- Preserve the original workshop brief and historical implementation evidence
  as historical records; do not rewrite them as if MVP had never existed.

## Requirements and dependencies

- **Product:** [PRD](../../specs/PRD.md) P-05, P-06 and P-12. Before this
  reconciliation, PRD section 4 defined MVP as a phase and required MVP,
  Better, and Great as selectable tiers, with MVP selected on a fresh install.
  The revised draft now defines Better and Great as the supported tiers.
- **Behavior and build order:** [DEVSPEC](../../specs/DEVSPEC.md) D-02, D-05,
  D-07, M4, M5 and M6. D-02 applies foils to Better/Great; D-05 defines
  tier-scoped saves and legacy handling; D-07 includes the tier in reports.
  M5 depends on M4, and M6 depends on M5.
- **Presentation:** [UISPEC](../../specs/UISPEC.md) U-02, U-03 and U-05.
  The original settings, tier labels, visible controls, and acceptance
  scenarios included MVP; the revised draft removes it from current behavior.
- **Verification:** [TESTSPEC](../../specs/TESTSPEC.md) T-09, T-10, T-11,
  T-13-T-15, T-20, T-22, T-24, and T-32. In particular, T-10 currently
  verifies Better as the default minimum tier and Better/Great foil and hint
  behavior.

### Prerequisite

The affected specifications have been reconciled in PRD -> DEVSPEC -> UISPEC ->
TESTSPEC order. They remain Draft pending their product, design, accessibility
and independent QA approval gates. Do not implement before those approvals.

## Decisions confirmed on 2026-10-26

1. **Existing MVP saves:** Discard incomplete legacy MVP progress and start a
   new Better puzzle. Do not import MVP placements into Better.
2. **Pending completion reports:** Report an unrecorded legacy MVP completion
   as Better once, then advance without replay. Already delivered historical
   reports remain unchanged.
3. **Meaning of removal:** Remove MVP as both a future phase and selectable
   runtime mode. Preserve the original workshop brief and historical prototype
   records.

The approved scope authorizes specification reconciliation only. It does not
authorize application implementation; the specifications remain Draft pending
their existing approval gates.

## Acceptance criteria

- Draft specifications now define Better as the minimum/fresh-install tier,
  keep Better's foils and hints, and retain Great with its Better behavior.
- MVP is not offered in current learner-facing controls or as a current
  delivery phase. Historical source material and evidence remain clearly
  historical.
- Fresh installations start in Better. Incomplete MVP saves are discarded and
  a legacy selected tier resolves to Better without cross-tier or cross-user
  state leakage.
- An unrecorded legacy MVP completion is emitted as Better once; a previously
  recorded completion is not re-emitted.
- Better foil and hint behavior remains correct; Great retains its moving
  behavior and solvability guarantees.
- Newly emitted events use only the approved current tier values, and the
  external reporting contract remains valid.
- Tier selection, persistence, learner-facing copy, accessibility, and tests
  agree across all affected surfaces.
- The applicable updated acceptance tests pass, including Better foil/hint
  behavior, Great regression, save/restore and tier changes, and bridge
  reporting. No release approval is implied by these results.

## Intended validation

Specification reconciliation is complete, but the normative documents remain
Draft and application behavior is unimplemented. After formal spec approval,
run focused domain and persistence tests for default selection, Better
behavior, tier changes, discarded legacy progress, and pending-event mapping;
focused UI tests for available tiers and labels; Great regression tests; and
bridge contract tests for current tier values. Then run the repository's
typecheck, unit tests, and production build. Record unavailable or blocked
acceptance gates rather than treating them as passed.

No application tests were run; no application code was changed.
