# Stage 8: Complete-suite regression run and reporting

**Date:** 2026-11-05  
**Status:** Regression/reporting human-approved; implemented regression PASS; full acceptance incomplete  
**Source task:** [Full browser acceptance suite](../tasks/draft/browser-acceptance-suite.md)  
**Baseline revision:** `2b23b734c8de2fb9399dde5093c5b4d4602a851d`  
**Initial worktree:** Clean

## Scope and authority

This report consolidates stages 1-7; it does not implement missing acceptance
variants or change game behavior. It follows [PRD](../specs/PRD.md) P-01-P-12,
[DEVSPEC](../specs/DEVSPEC.md) D-01-D-10,
[UISPEC](../specs/UISPEC.md) U-01-U-05 and
[TESTSPEC](../specs/TESTSPEC.md) T-01-T-33.
The module chain remains M1 content/tooling and M2 state -> M3 services ->
M4-M6 presentation/input/motion -> M7 integration/release.

The acceptance criterion for this reporting task is a complete run of the
implemented checks, an evidence inventory, coverage/gap reconciliation and
explicit human review. It is **not** a declaration that all browser-applicable
requirements, all product requirements or release gates pass. Normative
specifications remain unchanged by this task.

Status vocabulary:

- **PASS:** The named executed assertion/variant passed, not every possible
  permutation of its requirement.
- **FAIL:** An executed assertion failed.
- **NOT RUN:** A required assertion/variant has no execution evidence in this
  run. Missing browser tests are not external gates or implicit passes.
- **BLOCKED:** A required gate lacks a prerequisite, approved decision, device,
  deliverable or assigned human reviewer.
- A group can contain passed assertions and still be **partial** because
  required not-run/blocked assertions remain.

## Commands and run result

```powershell
npm.cmd run test:unit
npm.cmd run validate:content
npm.cmd run test:e2e
```

The E2E command runs `tsc --noEmit` and the Vite production build first.
All browser cases run with one worker, zero retries and stop-on-first-failure;
there is no stage-number ordering dependency. Each case has an isolated
production-output copy and context/storage. HTTP uses an owned loopback server;
file uses `--allow-file-access-from-files` and no server.
The three file-only offline cases are excluded from HTTP selection, not skipped.

| Check | PASS | FAIL | Skipped / retries / flaky | Evidence |
|---|---|---|---|---|
| Browser, HTTP | 113 | 0 | 0 / 0 / 0 | All selected HTTP cases executed |
| Browser, file | 116 | 0 | 0 / 0 / 0 | Includes three offline cases |
| Browser total | 229 | 0 | 0 / 0 / 0 | No selected case left not-run |
| Unit | 90 tests, 8 files | 0 | No skipped tests reported | Full Vitest run |
| Content | 4 English levels | 0 | Not applicable | Current authored pack |
| Typecheck/build | Passed | 0 | Not applicable | E2E production prerequisite |

Browser run started `2026-11-05T11:42:21.172Z` and lasted 639,067.728 ms
(10 minutes 39 seconds). No first failure, test repair, focused recovery run
or retry was needed. Stage 8 adds no new application tests.

| Implemented stage | HTTP PASS | File PASS |
|---|---:|---:|
| 1: Harness/fixtures | 15 | 15 |
| 2: Content/core spelling | 15 | 15 |
| 3: Input interaction | 15 | 15 |
| 4: Movement/pause | 5 | 5 |
| 5: Persistence/progression | 10 | 10 |
| 6: Audio/loading/recovery | 34 | 34 |
| 7: Layout/accessibility/bridge/offline | 19 | 22 |
| Total | 113 | 116 |

The zero not-run/skipped **selected-case** counts do not count missing
required tests: those are recorded as NOT RUN/BLOCKED in the coverage ledger.
Required variants remain incomplete even though every implemented test passes.

### Environment and build identity

- Windows `10.0.26200.0`; Node `24.20.0`; npm `11.19.0`.
- Chromium `156.0.8078.4`; Playwright `1.64.1`;
  axe-core Playwright `4.14.0`.
- Great only; schema `1`, authored content `1.4.1`, synthetic packs `1.0.0`;
  default harness seed `12345` (domain tests also cover 1,000 seeds).
- Source/tests/configuration were unchanged from the baseline revision.
  Only this report, runbook and task status change in this task.

| Production file | SHA-256 |
|---|---|
| `index.html` | `b0430fa7fc26a61bf47e2b445fe25578972520c826c5c26270906b9f0925f57c` |
| `assets/index-D8k31P1w.js` | `3725630380d3d3552049429858c67123932369f29ea9809f85072fdd34815986` |
| `assets/index-B_ZDH_Km.css` | `f56e9d2694cd17d712a52b7367bac80cfa22292279a0d114fef39b2c191d282d` |

The complete emitted-file SHA-256/size inventory is retained with the evidence.

### Offline cold starts

| Fresh context | Ready, ms | <=10,000 ms |
|---|---:|---|
| 1 | 473.355 | PASS |
| 2 | 326.971 | PASS |
| 3 | 359.476 | PASS |
| 4 | 330.322 | PASS |
| 5 | 337.229 | PASS |
| 6 | 350.690 | PASS |
| 7 | 331.459 | PASS |
| 8 | 458.220 | PASS |
| 9 | 364.121 | PASS |
| 10 | 370.465 | PASS |

Ten out of ten pass, alternating motion presentations. These are desktop
offline file contexts, not extracted release ZIPs or a baseline phone.
Real-media restore/completion passes in both presentations. Native authored
decoding covers 21 audio files and four images; both output audits report
33 emitted files, 26 required media/font inventory items and content `1.4.1`.

### Diagnostics and accessibility review findings

All 229 harness diagnostic attachments were inspected: zero outbound attempts,
uncaught application errors, fixture-server errors, service-worker/Cache
Storage attempts or file-path fetches. Recorded API calls were 164 fetch
and 213 XHR attempts, confined to the owned HTTP origin or local files.
The ten extra cold contexts separately assert no warnings/errors/external
attempts inside their test.

Expected fault-injection diagnostics are **not** erased:

| Diagnostic | Recorded occurrences |
|---|---:|
| CONTENT_INVALID | 82 |
| BOOT_TIMEOUT | 4 |
| AUDIO_UNAVAILABLE | 32 |
| FONT_UNAVAILABLE | 2 |
| BRIDGE_FAILED | 2 |
| EVENT_INVALID | 2 |
| SAVE_UNAVAILABLE | 8 |
| SAVE_INVALID | 6 |
| Native missing-resource console errors | 12 |

Every native console error was tied to missing JSON/image/audio/font or
H-06 staged missing assets: HTTP 404 or file ERR_FILE_NOT_FOUND. These are
explained fault outcomes, not unexplained application exceptions.
The counts do not prove full per-identical-failure deduplication compliance.

Fourteen axe scans report zero automatic violations, but **12 scans contain
14 incomplete-rule occurrences** that remain open, not certified passes:

| Rule / observed finding | Affected states | Required follow-up |
|---|---|---|
| `aria-prohibited-attr`: aria-label support on generic div containers `.tile-pool`/`.answers` and generic visible-hint span | Ready, Playing, hint, correct and text-scaled states, both transports | Review and correct/verify grouping and hint naming semantics with actual assistive technology; existing DOM label assertions alone cannot close this. |
| `color-contrast`: axe cannot determine the dialog background due to overlap | Settings, both transports | Measure/review actual modal title/control contrast and distinguish automation limitation from a defect. |
| `color-contrast`: single-letter content too short for axe's text determination | Text-scaled tiles, both transports | Retain computed contrast checks, supplement with actual zoom/visual review; do not treat axe incomplete as PASS. |

Computed contrast tests passed for their tested elements, not every modal or
text-scaled rendering. This run retained 24 maximum-layout screenshot
attachments. Developer inspection of the file moving-preview 320x568 and
568x320 screenshots found the measured paired/wrapped layout consistent
with the tests; it is not independent design/accessibility approval.

### Retained evidence

The local [Stage 8 evidence directory](../../artifacts/browser-acceptance/stage-8-2026-11-05/)
is outside the next run's disposable report paths:

- [HTML report with bundled attachments](../../artifacts/browser-acceptance/stage-8-2026-11-05/playwright-report/index.html).
- [Original browser JSON](../../artifacts/browser-acceptance/stage-8-2026-11-05/browser-results.json)
  and [command log](../../artifacts/browser-acceptance/stage-8-2026-11-05/browser-command.log).
- [Execution/environment/timing summary](../../artifacts/browser-acceptance/stage-8-2026-11-05/execution-summary.json)
  and [case-by-case outcomes/attachment inventory](../../artifacts/browser-acceptance/stage-8-2026-11-05/case-results.json).
- [All harness diagnostics](../../artifacts/browser-acceptance/stage-8-2026-11-05/diagnostics.json)
  and [console-error/axe-incomplete review details](../../artifacts/browser-acceptance/stage-8-2026-11-05/review-findings.json).
- [Complete build hashes and sizes](../../artifacts/browser-acceptance/stage-8-2026-11-05/build-inventory.json)
  and the copied browser output/attachment tree.

Original raw JSON preserves source attachment paths. The case inventory maps
file attachments to copied archive paths; the HTML report bundles its own
attachments. No failure traces/screenshots were generated because there were
no failed cases. Unit/content results above are the observed successful
command outputs, not additional browser tests.

The evidence directory is Git-ignored local output, not a committed or
externally backed-up release evidence store. Preserve/transfer it before
cleaning ignored artifacts or moving machines. The tracked report retains
the summary, requirement ledger, findings and build identity.

No dependency install, clean-machine `npm ci`, physical-device run, CMS
operation or release packaging is claimed. Existing dependencies and the
installed pinned browser are used.

## Coverage reconciliation: T-01-T-33

This is the consolidated assertion/variant ledger. Executed case titles,
transport, outcomes and timings are retained in the browser report.
Fixture/input/motion/viewport detail is supplemented by the linked stage
manifests, not an assertion that every test crosses every axis.
All implemented assertions listed in the executed column passed in this run.
This does not pass their adjacent NOT RUN/BLOCKED assertions.

| Group | Executed assertions / evidence | NOT RUN or BLOCKED assertions / resulting boundary |
|---|---|---|
| T-01 | [Core](../../tests/e2e/core.spec.ts): invalid schema/path packs reject without partial play; authored F-11 loads. [Fixture units](../../tests/fixtures/browser-fixtures.test.ts): field/path diagnostics. [Content validation](../../scripts/validate-content.ts) and [output tests](../../tests/e2e/bridge-offline.spec.ts): current inventory, exact case, formats, complete license entries; staged missing/wrong-case/corrupt references reject. | Stage 7 closes the older wrong-case audit gap. NOT RUN: dedicated negative missing/incomplete/duplicate-license-record matrix; authored inventory success is not legal approval. |
| T-02 | [Domain units](../../tests/domain.test.ts): 1,000 seeds x CAT/BOOK/ELEPHANT, deterministic complete multisets and unique IDs. [Core geometry](../../tests/e2e/core.spec.ts): 12 nonoverlapping static tiles at all six viewports. | PASS for these seeded/domain/static geometry variants; not a claim about all input states. |
| T-03 | [Core](../../tests/e2e/core.spec.ts) and [interactions](../../tests/e2e/interactions.spec.ts): correct mouse/touch/keyboard/tap placement, one attempt, lock, source removal, destination cue. | NOT RUN: direct reacquisition/move attempts through every input. A test title saying "prevents reacquisition" checks disabled/source removal, not a subsequent input attempt. Partial. |
| T-04 | [Core](../../tests/e2e/core.spec.ts) and [domain](../../tests/domain.test.ts): wrong target remains available, no hint/removal, one attempt and relocation. | NOT RUN: one/no-alternative-cell relocation boundaries. Partial. |
| T-05 | [Core](../../tests/e2e/core.spec.ts) and [interactions](../../tests/e2e/interactions.spec.ts): Escape, outside/occupied drop, touchcancel, lost capture, blur and resize are neutral; later input remains usable. | PASS for listed reduced-motion cancellation variants; not exhaustive moving/touch permutations. |
| T-06 | [Core](../../tests/e2e/core.spec.ts): BOOK swaps distinct O identities, locks distinct bindings and uses destination-index cues; [domain](../../tests/domain.test.ts) checks value matching. | PASS for specified duplicate-letter assertions. |
| T-07 | [Audio/loading](../../tests/e2e/audio-loading.spec.ts): final-letter-before-word, 1,200 ms minimum animation, successful late word ending, 4,000 ms cue watchdogs, muted/failed/blocked/pending media, repeated pointerup/stale callbacks and one advance/post. | PASS for listed reduced-motion mocked-media variants; physical audible pronunciation is not established. |
| T-08 | [Core](../../tests/e2e/core.spec.ts): two F-04 and two authored F-11 cycles, once-per-cycle membership and no boundary repeat; one-level replay. [Persistence](../../tests/e2e/persistence.spec.ts) adds occurrence progression. | PASS for specified desktop cycle assertions. The older Stage 5 manifest's F-11 gap is superseded by the existing core test, not a new test or waiver. |
| T-09 | [Core](../../tests/e2e/core.spec.ts): foil B on second empty CAT slot removes only B, reveals only index 1, leaves slot empty, one attempt/correction. | NOT RUN: foil-specific outside/occupied neutral drops (generic target cancellation is not a substitute). Partial. |
| T-10 | [Core](../../tests/e2e/core.spec.ts): complete foil set, equivalent tile styles, visible-hint suppression after fill with persisted reveal retained; [layout](../../tests/e2e/layout-accessibility.spec.ts) adds no foil styling clues. | PASS for listed foil/hint assertions. |
| T-11 | [Movement](../../tests/e2e/movement.spec.ts): 12-tile lane travel/reappearance, spacing >=60 px, unique IDs, alternating lanes at 320x568. [Scheduler units](../../tests/movement.test.ts): 100 passes at four widths. [Interactions](../../tests/e2e/interactions.spec.ts): immediate stop and separate-gesture drag/capture. | NOT RUN: per-viewport maximum queued-wait computation and full 12-tile browser feedback/requeue/nonrespawn matrix. Partial; unit widths are not the complete browser matrix. |
| T-12 | [Movement](../../tests/e2e/movement.spec.ts): manual/keyboard/pointer/feedback/hidden reason composition and active-time exclusion; [Settings](../../tests/e2e/layout-accessibility.spec.ts) adds modal/manual/hidden composition. | NOT RUN: full dynamic reduced-motion transition matrix and actual OS background suspension. Hidden state is injected deterministically. Partial. |
| T-13 | [Persistence](../../tests/e2e/persistence.spec.ts): BOOK wrong/correct/swapped duplicate/foil outcomes restore attempts, hints, bindings and unique remaining IDs without saved movement coordinates. [Offline](../../tests/e2e/offline.spec.ts): partial reload/Resume/completion in both presentations. | NOT RUN: reload after each individual accepted outcome, exact elapsed restoration boundary and detailed moving mid-pass requeue assertions. Offline moving reload narrows, but does not close, the full mid-pass matrix. Partial. |
| T-14 | [Persistence](../../tests/e2e/persistence.spec.ts): user/mute isolation, stale content, malformed/null snapshots, denied reads/writes; [progress units](../../tests/progress.test.ts): invalid bindings/cycles/phases/counters. | NOT RUN: guest isolation, stale-schema browser case and full invalid-snapshot browser matrix. Partial. |
| T-15 | [Persistence](../../tests/e2e/persistence.spec.ts): completion-marker recovery advances without repeated completion event. | NOT RUN: independent before/after bridge-post and next-puzzle-save crash windows and permitted-loss observation. Best-effort reporting is not exactly-once delivery. Partial. |
| T-16 | [Audio/loading](../../tests/e2e/audio-loading.spec.ts): actual HTTP fetch/file XHR, valid status 0/200 text, malformed/empty/non-success, 9,999/10,000 ms content/image stalls, independent preloads, same-document Retry/late generation; [loader units](../../tests/loadContent.test.ts): response type/error/cancellation/abort. | BLOCKED compliance: D-06 requires a literal one-frame silent buffer; current HTML audio returns unavailable rather than allocating it. Device cold-start certification is separate. Partial despite passing loader assertions. |
| T-17 | [Interactions](../../tests/e2e/interactions.spec.ts): actual capture on stable playfield, moving tap-stop/later-drag, >8 px threshold, center hit, noncentral offset, whole-tile clamp and outline. | NOT RUN: shared-edge lower-index tie, second-pointer exclusion, exhaustive edge/corner offsets and moving-lane touch drag. Partial. |
| T-18 | [Interactions](../../tests/e2e/interactions.spec.ts): CAT/BOOK keyboard and touch tap completion, selection cancel/change, focus progression, hidden hints and polite live status; [layout](../../tests/e2e/layout-accessibility.spec.ts): muted keyboard completion. | PASS for desktop input/DOM assertions; BLOCKED human screen-reader review remains a separate T-21 gate. |
| T-19 | [Interactions](../../tests/e2e/interactions.spec.ts): orientation resize during drag preserves locked slots and fresh geometry. [Movement](../../tests/e2e/movement.spec.ts): simulated hidden feedback/audio suspension. | NOT RUN: complete moving/feedback orientation matrix and actual hidden-page drag cancellation/background lifecycle. Partial. |
| T-20 | [Layout](../../tests/e2e/layout-accessibility.spec.ts): both maximum previews at six viewports, slots/hints paired/ordered, 36-48 px portrait baseline, motion status above answers, no duplicate surface/target/grade/foil clues; [audio](../../tests/e2e/audio-loading.spec.ts): replay geometry/control states. | NOT RUN: exhaustive screenshots/measurement of every visual state and saved-preview clue permutation. Partial. |
| T-21 | [Layout](../../tests/e2e/layout-accessibility.spec.ts): targets >=44 px, body >=16 px, glyphs >=28 px, tested text >=4.5:1 and borders/focus >=3:1, focus/selection distinction, Settings trap/return, zero axe violations, muted cues, 200% root text and focused-slot reachability. | OPEN REVIEW: axe incomplete ARIA-label support on generic containers/hints and uncertain modal/single-letter contrast, detailed above. NOT RUN: actual browser-UI zoom, exhaustive visual/color/flashing review. BLOCKED: assigned human screen-reader/usability review. Partial; root text is not actual browser zoom. |
| T-22 | [Audio](../../tests/e2e/audio-loading.spec.ts): replay new/saved/mute/feedback/completion gates, enabled styling/tab order, stable six-viewport geometry, saved mute and gesture recovery. [Layout](../../tests/e2e/layout-accessibility.spec.ts): Settings/manual/hidden pause and focus. | NOT RUN: exhaustive pre-Start/Resume mouse drag, touch, keyboard tile/answer attempts across new/saved moving/reduced previews. Partial. |
| T-23 | [Audio](../../tests/e2e/audio-loading.spec.ts): fatal JSON/image Retry; per-CAT-word/index/shared cue failures; independent/current-occurrence/stale notices; native missing/corrupt WAV/font fallback, policy-block distinction, sanitized UI. [Persistence](../../tests/e2e/persistence.spec.ts): save-denial play. | NOT RUN: full identical-diagnostic deduplication matrix and every authored cue/fault permutation. PASS for listed failure cases, partial broader diagnostic coverage; audible policy/pronunciation remains external. |
| T-24 | [Bridge](../../tests/e2e/bridge-offline.spec.ts): one session/two completion milestones, exact fields/constants, fresh v4 UUIDs/UTC, user/empty identity, finite completion data and no per-tap/network events. | NOT RUN: explicit session event on first saved Resume and repeated-gesture once-only matrix. BLOCKED: production sub_app_id agreement. Partial; current ID is development-only. |
| T-25 | [Bridge](../../tests/e2e/bridge-offline.spec.ts): absent/throwing/oversized handling, no retry/gameplay interruption, UUID fallbacks. [Units](../../tests/bridge.test.ts): malformed/date/UUID/nonfinite and 65,535/65,536/65,537 UTF-8 ASCII/multibyte boundaries. | PASS for specified browser/unit failure-boundary variants. Actual container deduplication belongs to T-29, not this mock. |
| T-26 | [Output audit](../../tests/e2e/bridge-offline.spec.ts): relative/exact-case references, 26 media/font inventory items, signatures/licenses/OFL, forbidden API/SDK/map mutations; native 21-audio/four-image decode and local Lexend; harness rejects outbound/SW/cache/file-fetch attempts. | BLOCKED: archive audit and standalone release audit command. Static patterns are not exhaustive indirect-URL analysis. Partial. |
| T-27 | [Offline](../../tests/e2e/offline.spec.ts): 10 fresh offline file contexts, Ready <=10,000 ms, native five-cue CAT/shared decode/font; partial reload/Resume/completion in both presentations with zero warnings/external attempts and local XHR only. | BLOCKED: extracted merged engine/language archives and physical baseline-device performance. Dist copies are desktop evidence only. Partial. |
| T-28 | Supporting [output audit](../../scripts/audit-output.ts) only; no release archive acceptance executed. | BLOCKED / NOT RUN: engine/language ZIP construction/extraction, merge collisions/traversal, release asset selection, archive hashes/version manifest and true PNG icon >=192 px. Packaging scripts and approved release inputs are missing. |
| T-29 | Browser bridge mocks supply supporting outbound-contract evidence only. | BLOCKED / NOT RUN: registered Curious Reader launch, airplane-mode receipt/storage/sync, zero NETGUARD_BLOCK and identical-ID container deduplication; requires authorized real container/device integration and approved identifiers. |
| T-30 | Ten desktop cold starts supply diagnostic timing only. | BLOCKED / NOT RUN: approved physical baseline device/OS/WebView, 100-move p95 <=100 ms, 60-second frame p95 <=33.4 ms and 10 physical cold starts <=10 seconds. Optional desktop input/frame measurements were not run. |
| T-31 | Current media inventory, native decode and license-record completeness are supporting automated evidence. | BLOCKED / NOT RUN: independent word-picture/contextual/full-word pronunciation, distribution/title attribution, release-selected illustrations/icon, actual staff Publish and device manifest/version review. Restricted ElevenLabs records are not distribution approval. |
| T-32 | This plan/report reads all four specs, maps requirements/dependencies, separates approval from tests and leaves normative specs untouched. Previous Stage 7 implementation/reconciliation approvals are recorded in the source task. | NOT RUN: a dedicated automated lifecycle dry-run matrix. Stage 8 approval and any subsequent separately authorized reconciliation cannot be claimed in advance. Supporting maintenance evidence, not a browser case. |
| T-33 | [Content validation](../../scripts/validate-content.ts): current schema/media/license inventory; [core](../../tests/e2e/core.spec.ts): F-11 all-four reachability in two cycles; [output](../../tests/e2e/bridge-offline.spec.ts): native images/all 20 MP3s plus shared WAV decode, complete license records. | NOT RUN: dedicated fixed CAT/DOG/RABBIT/BIRD roster/ID/foil/alt/artwork assertion matrix beyond generic schema/current-pack inventory; BLOCKED independent depiction/production-media/legal review. Cycle membership derived from the pack alone cannot certify the prescribed roster. Partial. |

### Fixture, transport and interaction matrix

- [Harness](../../tests/e2e/harness.spec.ts): F-01-F-11 staging, isolation,
  seeded adapters and native synthetic audio/font smoke checks; 768x1024
  default, with touch smoke overrides.
- [Stage 2 manifest](../../tests/e2e/coverage.json): F-01/F-02/F-03/F-04/F-05/
  F-06/F-11; reduced spelling via mouse/touch/keyboard/tap; six-view static
  maximum geometry; seeded domain layouts.
- [Stage 3 manifest](../../tests/e2e/interaction-coverage.json): CAT/BOOK,
  reduced keyboard/touch spelling, mouse moving capture; touch at 568x320.
- [Stage 4 manifest](../../tests/e2e/movement-coverage.json): F-03 maximum
  movement at 320x568; CAT manual/keyboard/hidden composition; scheduler
  unit widths 320/568/768/1024 are not actual viewport runs.
- [Stage 5 manifest](../../tests/e2e/persistence-coverage.json): reduced
  BOOK/CAT synthetic snapshot/user/storage/cycle cases, mainly click/place.
- [Stage 6 manifest](../../tests/e2e/audio-loading-coverage.json): F-01/F-04/
  F-07/F-08/F-10; reduced spelling with deterministic media faults, moving/
  reduced preview replay geometry at all six viewports; native fault cases.
- [Stage 7 manifest](../../tests/e2e/layout-bridge-offline-coverage.json):
  maximum layout in both previews at all six viewports; reduced bridge,
  contrast and muted keyboard cases; moving Settings composition; authored
  native decode; file-only offline cold/restore in both presentations.
- Every implemented non-offline browser case runs on HTTP and file.
  The six viewports are 320x568, 568x320, 768x1024, 1024x768, 566x600,
  800x400. This is a union of tested variants, **not** a complete Cartesian
  product of content/input/viewport/motion/fault/state.
- Historical manifests retain their original narrower scope. This report
  reconciles later evidence without rewriting previous approvals or making
  unresolved normative decisions.

## U-05 named scenario mapping

Mappings refer to existing named executable cases; exact Gherkin scenario
text is not necessarily the literal Playwright title. Similar names alone
are not evidence for untested Then clauses.

| U-05 scenario | Existing executable mapping | Boundary |
|---|---|---|
| Start the offline Great puzzle | [Offline](../../tests/e2e/offline.spec.ts): real offline moving/reduced completes and restores; [harness](../../tests/e2e/harness.spec.ts): H-01 | Desktop file output, not extracted release archives/device. |
| Correct placement locks | [Core/interactions](../../tests/e2e/interactions.spec.ts): T-03 mouse/touch placement; [core](../../tests/e2e/core.spec.ts): destination cue | Direct attempted reacquisition variants remain T-03 NOT RUN. |
| Wrong target is not a foil | [Core](../../tests/e2e/core.spec.ts): T-04 wrong target remains available without hints/removal | Relocation boundaries remain NOT RUN. |
| A foil reveals one position | [Core](../../tests/e2e/core.spec.ts): T-09/T-10 removes foil/reveals hint/suppresses after fill | Neutral foil-specific branches remain NOT RUN. |
| A cancelled or occupied drop is neutral | [Core](../../tests/e2e/core.spec.ts): T-05 outside/occupied/Escape; [interactions](../../tests/e2e/interactions.spec.ts): touchcancel/capture/blur/resize | Listed reduced-motion cancellation paths only. |
| Duplicate letters and final feedback | [Core](../../tests/e2e/core.spec.ts): T-06 swapped BOOK O; [audio](../../tests/e2e/audio-loading.spec.ts): T-07 final-letter/word and single advance | Combined supporting cases, not every input/motion permutation. |
| Moving tile capture and recovery | [Interactions](../../tests/e2e/interactions.spec.ts): T-17 tap-stop/later-drag/clamp; [movement](../../tests/e2e/movement.spec.ts): recycle | Full requeue/input matrix remains open. |
| Play without drag or sound | [Layout](../../tests/e2e/layout-accessibility.spec.ts): T-21 named muted keyboard/text-scaling completion | Human screen reader and actual browser zoom remain unpassed. |
| Resize or background during drag | [Interactions](../../tests/e2e/interactions.spec.ts): T-19 orientation resize with locked placements | Resize branch mapped; actual hidden-page drag branch NOT RUN. Injected hidden feedback tests are not equivalent. |
| Settings, pause and focus | [Layout](../../tests/e2e/layout-accessibility.spec.ts): T-21/T-22 named Settings/pause/focus | Actual OS lifecycle remains untested. |
| Failed load versus failed audio | [Audio](../../tests/e2e/audio-loading.spec.ts): named T-16/T-23 fatal Retry and nonfatal audio branches | Listed native/mock faults; full diagnostic matrix remains open. |

## Dependent work and unresolved gates

1. **Browser coverage completion:** implement NOT RUN input/geometry/
   preview/recovery/roster assertions above without weakening their source
   requirements. Resolve initial instruction-message timing before asserting
   precise show/hide/reset times; no new timing decision is made here.
2. **Audio adapter/diagnostics:** resolve the D-06 literal one-frame
   silent-buffer implementation gap and verify per-identical-failure
   diagnostic deduplication. No fallback success is substituted for compliance.
3. **Release tooling:** supply D-09/D-10 `lint`, `build:standalone`,
   `audit:standalone`, `package`, archive merge/integrity checks and approved
   icon/release asset selection. The browser audit is not these commands.
4. **Accessibility/human QA:** assign reviewers for actual screen reader,
   real browser zoom, visual/flashing, facilitated usability, independent
   QA, architecture/security/business-logic review. No such review is
   performed or inferred by this regression task.
5. **Device/container:** agree baseline hardware/OS/WebView and production
   IDs; coordinate authorized Curious Reader launch/offline reporting/
   deduplication and measured physical performance. No upload/reservation/
   promotion/publication is authorized.
6. **Content/distribution:** obtain independent illustration/pronunciation/
   restricted-audio license/title-attribution review and staff/device
   publication evidence. Technical decode is not legal or linguistic approval.
7. **Approval:** this regression/reporting task received explicit approval;
   any specification reconciliation needs separate authorization.
   Specifications stay Draft and release remains unapproved.

## Reporting validation and approval

The complete run, diagnostic/evidence inspection and archive are finished.
Validation passed for all 33 groups, eleven scenario mappings, 126 local
links/anchors, 229 case results, 33 emitted-file hashes, all cold trials,
diagnostic/axe findings and raw report preservation. Whitespace checks pass.
Application/tests/configuration and all normative specifications were unchanged
by the regression/reporting task.
Successful fixture teardown completed suite-owned staging/server cleanup;
no detached helper service was started. Two session-only reporting helpers
were used to extract/validate evidence and are removed after validation.

On 2026-11-05 the user explicitly selected "Approve stage 8".
This approves the regression/reporting task only. Full browser acceptance,
the Draft specifications wholesale and release are not approved.
The user subsequently selected "Start specification update" for a separate
reconciliation. DEVSPEC 2.0.22, UISPEC 2.0.21 and TESTSPEC 2.1.20 record
the evidence and remaining boundaries, retaining Draft status and mandatory
criteria; PRD 2.0.1 is unchanged. On 2026-11-05 the user explicitly selected
"Approve reconciliation" for this evidence-only documentation update,
not full acceptance, wholesale specification approval or release.

Separate reconciliation validation passed for 76 specification links/anchors,
126 report/runbook/task links and 807 requirement references. Comparison with
the baseline confirmed unchanged normative requirements, constants, module
dependencies, lifecycle/maintenance criteria, historical evidence/logs and
source briefs. Metadata/approval consistency, all 33 groups/eleven scenarios
and retained 229-browser/90-unit results, timings, findings, attachments and
33 current build hashes passed checks. No application rerun was needed for
documentation-only changes; prior execution evidence is retained, not
reclassified as a new run.
