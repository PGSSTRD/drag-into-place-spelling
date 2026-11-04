# Full browser acceptance suite

**Task ID:** `browser-acceptance-suite`  
**Status:** Draft full-suite scope; stages 1-2 implementation human-approved; stages 3-8 not implemented
**Created:** 2026-11-03  
**Author:** Copilot

## Goal and authority

Implement a repeatable, automated desktop-browser acceptance suite for the
production Great game, including mobile viewport and touch emulation. Cover
all browser-applicable acceptance requirements, not only previously successful
spot checks. No physical phone is needed to run this suite.

Read the current normative documents before implementation:

- [PRD](../../specs/PRD.md), P-01-P-12: intent, observable outcomes and approval.
- [DEVSPEC](../../specs/DEVSPEC.md), D-01-D-10: content, behavior, input,
  movement, persistence, offline loading, bridge, quality and delivery.
- [UISPEC](../../specs/UISPEC.md), U-01-U-05: presentation, states, copy,
  accessible interactions and named scenarios.
- [TESTSPEC](../../specs/TESTSPEC.md), F-01-F-11 and T-01-T-33: mandatory
  variants, numerical assertions, evidence and acceptance gates.

This draft is subordinate to those documents, not a new source of behavior.
Use PRD -> DEVSPEC -> UISPEC -> TESTSPEC to resolve conflicts. Obtain decisions
before implementing tests whose expected behavior is ambiguous; do not make a
test pass by silently changing a requirement. All existing specs remain Draft;
this task does not approve their proposed decisions or authorize release.

## Current baseline and deliverables

Before stage 1, the repository had Vitest unit tests, content validation,
typecheck, build and development commands, but no project `test:e2e` command,
Playwright dependency/configuration or repeatable production browser suite.
Earlier interactive browser checks are evidence for their narrow scopes only.

Stage 1 provides production HTTP/file harness smoke checks and fixture
builders; see the [implemented runbook and smoke inventory](../../../README.md#browser-testing-stages-1-2-harness-content-and-core-spelling).
Stage 2 adds content-validation and core-spelling assertions for T-01-T-10.
These stages do not complete T-01-T-33; stages 3-8 and remaining partial
T-01-T-10 variants remain future work. The original instruction to implement
stage 1 only is retained as historical scope.

Stage 1 verification (2026-11-03): 63 unit tests passed (including 40 fixture
integrity checks); production typecheck/build and four-level content validation
passed; all 30 Chromium harness smoke executions passed sequentially (15 HTTP,
15 file, zero skips/retries). Initial harness clock/locator failures were
corrected and rerun before continuing. The final JSON report records 30
expected passes, zero unexpected/flaky results, and zero skips. Suite-owned
temporary staging was removed. These results are not full browser acceptance,
physical-device evidence or release approval. No application behavior or
normative specifications were changed.

Stage 1 human approval (2026-11-03): the user explicitly selected
"Approve stage 1". This approves the harness/fixtures task only, not the
remaining suite, normative specifications or release.

Separate specification reconciliation (2026-11-03): after authorizing the
update, the user explicitly selected "Approve reconciliation". DEVSPEC
2.0.15 and TESTSPEC 2.1.13 record the implemented tooling, fixtures and partial
evidence; both remain Draft. PRD and UISPEC were unchanged. This approves the
documentation update, not the specifications wholesale or later stages.

Stage 2 implementation evidence (2026-11-04): `tests/e2e/core.spec.ts` adds
content rejection, authored-pack, 1,000-seed layout, six-viewport maximum-tile,
mouse/touch/keyboard placement, wrong/neutral drop, swapped BOOK duplicate,
completion/audio-order, cycle, foil and hint assertions. The final complete
Playwright run passed all 60 executions (30 HTTP, 30 `file://`; no skips or
retries); all 64 unit tests, content validation, typecheck and production build
also passed. `tests/e2e/coverage.json` records per-group status: T-01, T-03,
T-04, T-05, T-07 and T-09 remain partial for the listed variants. The stage 2
implementation received explicit user approval on 2026-11-04, followed by
authorization for this separate specification reconciliation. Approval
covers the stage 2 implementation only; it does not pass the remaining
acceptance groups or any physical-device, independent-QA,
pronunciation/distribution or release gate.

Separate specification reconciliation (2026-11-04): the user authorized
updating DEVSPEC and TESTSPEC with stage 2 evidence while preserving their
Draft status and partial gates. PRD and UISPEC remain unchanged. This
documentation update does not approve the specifications wholesale or later
stages.

Deliver:

- A locked Playwright test dependency, configuration and `test:e2e` command.
- Production-build/staging setup, an owned local HTTP server on an allocated
  port, and direct `file://` execution without an HTTP-server requirement.
- Isolated fixtures, deterministic clock/RNG and fault-injection helpers.
- Named executable tests, including every U-05 scenario and the matrix below.
- A coverage manifest mapping each assertion to P/D/U/T IDs, fixture,
  transport, input method and motion mode, with execution status/evidence.
- Reproducible reports, traces/screenshots on failure, console/network
  diagnostics and an operator runbook with exact implemented commands.
- A clearly separated manual/device/packaging handoff and unresolved blockers.

Do not install packages for this documentation task. During implementation,
change the dependency manifest before installing; pin/lock the selected
testing versions and document the browser-install prerequisite.

## Dependencies and implementation order

Follow DEVSPEC's module graph rather than treating test order as build order:

1. **M1** supplies valid/invalid content and tooling; **M2 depends on M1**
   for domain and snapshot invariants.
2. **M3 depends on M1 and M2 for snapshots**; offline, audio, storage and
   bridge tests require these services.
3. **M4 depends on M2/M3**, **M5 on M4**, and **M6 on M5**. Exercise the
   actual application adapters, foils/hints and moving scheduler in browsers.
4. **M7 depends on M3 for bridge and M4-M6 for release**. Production-artifact
   audits and merged-package browser checks need working staging/packaging.

Set up the test harness first, then fixtures and the coverage manifest,
core interactions, movement, persistence, faults, accessibility and offline/
bridge checks. Record application gaps as failing/blocked requirements;
implement tightly coupled fixes only within approved scope. Missing Settings,
focus behavior or protocol-specific loading must not be hidden with mocks.
If remediation grows beyond this task, identify a dependent task and keep the
affected acceptance gate open.

## Execution matrix and harness rules

- Run production output, not the Vite development server, over HTTP and
  `file://`. Test clean and restored state in Great's moving and reduced-motion
  presentations. There is no separate MVP/Better mode.
- Use desktop Chromium; exercise mouse drag, tap-select/place, emulated touch
  drag and keyboard-only completion. Do not equate emulation with a real phone.
- Cover 320x568, 568x320, 768x1024 and 1024x768. Add the previously checked
  566x600 and 800x400 replay-layout regressions. Use the complete viewport
  matrix for geometry and maximum-tile motion, and record a justified
  case/input/transport mapping rather than silently dropping variants.
- Allocate isolated browser contexts, storage namespaces and staging folders.
  Never replace authored content or use real learner identities. Clear only
  suite-owned data and stop only suite-owned processes.
- Seed randomness and inject an independent monotonic clock. Use fake time
  for timing boundaries; keep real-browser smoke paths for actual pointer
  capture, rendering, file loading and media decode/playback.
- Mock media outcomes for deterministic error/order tests, but retain real
  packaged-media checks. A mocked `ended` event is not audio-decoding evidence.
- Install spies/faults before application boot. Use HTTP route failures where
  appropriate; use isolated staged files and protocol-aware instrumentation
  for `file://`, not an assumption that HTTP interception covers local files.
- Observe pointer capture, tile IDs, accessibility state, media calls, bridge
  payloads and saved state without bypassing the UI for normal gameplay.
  Direct state setup is allowed for controlled fixtures/crash-window tests.
- No fixed sleeps as success proxies, forced clicks as ordinary-user evidence,
  success-shaped fallbacks, blanket retries or unexplained ignored errors.
  Distinguish application failures from harness failures.
- Capture outbound attempts using runtime network/API instrumentation as well
  as emitted-asset inspection; fail even if the request was blocked/offline.
  Metadata source/license URLs are not automatically runtime network requests.

## Fixtures

Implement all F-01-F-10 as isolated synthetic packs/adapters and use F-11 as a
separate authored-content integration case:

- F-01 CAT, F-02 BOOK with distinct duplicate-O IDs, F-03 A/ELEPHANT with
  maximum foils/12 tiles, F-04 one-level and multi-level cycles.
- F-05 one-invalid-field-at-a-time schema mutations; F-06 unsafe, encoded,
  wrong-case and missing paths. Include exact-case checks on Windows.
- F-07 malformed/truncated/empty/stalled content, image/font/media failures.
- F-08 valid and invalid snapshots, stale versions, completion checkpoints,
  user isolation, corrupt JSON and denied storage.
- F-09 bridge absent/recording/throwing, malformed and oversized envelopes,
  duplicate UUID boundary cases.
- F-10 successful, rejected, blocked, muted, pending and stale audio callbacks.
- F-11 the current four-animal pack, all indexed/word audio, SVGs, Lexend and
  license inventory. Read its current version rather than assuming old values.

Retain local redistribution notices for fixture media; synthetic sound proves
sequencing/loading, not pronunciation. No downloaded unlicensed replacements.

## Required acceptance coverage

Every numbered group below is mandatory. Supporting unit/static checks may
cover non-browser portions, but must be linked to browser evidence rather
than substituted for actual UI outcomes.

| Group | Required cases and assertions |
|---|---|
| T-01; P-07; D-01 | F-01-F-06/F-11 valid packs and individual invalid mutations: schema/version, counts, unique safe IDs, uppercase multisets, foil constraints, language, unknown fields and confined decoded paths. Reject the entire invalid pack with field/path diagnostics; no partial playable state. Separately validate referenced files, formats, case and license inventory. |
| T-02; P-01/P-07; D-01/D-03 | CAT/BOOK and 1,000 seeded layouts: exact letter/foil multiset, immutable unique IDs, deterministic layouts, no overlap or out-of-bounds static cells. Do not assert every shuffle differs. Browser geometry checks supplement seeded domain checks. |
| T-03; P-02/P-04; D-02 | Correct drop locks exactly once with one attempt, positive visual/contextual cue and no reacquisition or movement by mouse, touch/tap or keyboard. |
| T-04; P-02; D-02/D-03 | Wrong target in reduced motion: one attempt and correction cue, no hint/removal, available tile returns to a different free cell where possible or previous cell when no alternative exists. Cover one/no alternative cells. |
| T-05; P-02/P-04; D-02/D-03 | Outside/occupied drops, Escape, pointercancel, lost capture, blur and resize are neutral: no attempt/correction/hint, no lost tile, occupied placement unchanged. |
| T-06; P-02/P-03; D-01/D-02 | Complete BOOK with exchanged O instance IDs: value-based matching, each tile used once and contextual audio indexed by destination, not tile identity. |
| T-07; P-03; D-02/D-06 | Final drop, repeated pointerup and stale callbacks: synchronous lock, one completion/advance, final-letter cue before word cue; wait for word audio and animation. F-10 muted/failed/blocked/pending media cannot hang or advance twice. |
| T-08; P-03; D-05 | Complete two seeded cycles of F-04 and F-11: each level once per cycle, no immediate multi-level boundary repeat, all four animals reachable; one-level packs replay indefinitely. |
| T-09; P-05; D-02 | Drop CAT foil B on second empty slot: only B removed, only index 1 hint revealed, slot remains empty, one attempt/correction cue. Outside/occupied drops do not consume foils. |
| T-10; P-05; D-02 | Instantiate the complete content-defined foil set. Revealed hint is suppressed when its slot is filled without deleting persisted reveal state. No visual foil-identification clues. |
| T-11; P-06; D-03/D-04 | Two-lane entry/travel/exit, FIFO spacing and alternating lanes; immediate pointer-down stop, short tap retaining selection, later drag preserving capture. Wrong/cancel requeues, correct/foil never respawns, one instance per ID. Run 100 passes and compute maximum queued wait with 12 tiles across all required viewports, not CAT alone. |
| T-12; P-06; D-03/D-04/D-08 | Manual pause, keyboard focus, pointer-generated focus, feedback, hidden page and reduced-motion changes. Independent pause reasons compose; pointer input clears keyboard-only pause; active time excludes pauses and resume does not teleport or replay background audio. |
| T-13; P-09; D-05 | Reload after every accepted outcome, BOOK and mid-pass: placements/hints/removals/attempts/cycle/active elapsed time restored; remaining tiles requeue with no duplicate IDs or restored pixel coordinates. |
| T-14; P-09; D-05 | User/guest isolation, valid mute settings, corrupt/stale schema/content snapshots, invalid bindings/cycles, storage get/set failures. Reset only unusable namespace with diagnostic/new-puzzle notice; no identity creation; in-memory play survives and save success is never falsely claimed. |
| T-15; P-03/P-09/P-10; D-05/D-07 | Reload at completion-marker save, bridge post and next-puzzle save boundaries. Pending completion advances without replayed celebration/event; no completed event duplication. Acknowledge permitted telemetry loss in the crash window, not exactly-once delivery. |
| T-16; P-08; D-06/D-08 | Local XHR status 0/200/non-success, nonempty expected response type, HTTP failure, empty/stalled responses, Retry and late callbacks from old boot generations. Reach Ready/error within 10 seconds, preloads settle independently, no endless spinner; audio fallback requires notice and diagnostics. Verify protocol-specific loader behavior. |
| T-17; P-04; D-03; U-01/U-04 | Real pointer/touch capture on stable playfield survives source removal; noncentral offsets and every edge/corner clamp the whole tile. Center hit-testing, lower-index shared-edge tie, >8 px drag threshold, second-pointer exclusion, tap-stop-then-drag and unclipped selected outlines. Pointer focus does not activate keyboard pause. |
| T-18; P-04; U-03-U-05 | Complete CAT/BOOK by keyboard only and tap-select/place, change/cancel selection, Enter/Space/Escape, correct focus progression and one polite outcome announcement. Hidden hints stay unannounced; occupied slots remain readable but nonactionable. |
| T-19; P-04/P-06; D-03/D-04; U-01/U-02 | Resize/orientation and background changes during drag, feedback and motion: neutral cancellation, fresh geometry, preserved placements/hints, no clipping, lost tiles or hidden-page advancement. |
| T-20; P-01/P-05/P-06; U-01-U-03 | Screens/states and both presentations: slots/hints paired and ordered, no duplicate pool/lanes, no written target/grade/foil clues. Portrait hint-to-status baseline about 40 px and <=48 px, motion status above answers. Removed movement-preview sentence absent. Check all design tokens and portrait/short-landscape geometry. |
| T-21; P-04; D-08; U-01/U-04 | DOM accessibility scan plus keyboard review: >=44x44 px controls, >=16 px body/28 px letters, text contrast >=4.5:1 and non-text/focus >=3:1, focus distinct from selection, labels/order, Settings trap/return, 200% text zoom, no color/audio-only outcomes, reduced motion and no flashing >3 Hz. Human screen-reader review remains a separate required gate. |
| T-22; P-03/P-04/P-09; D-02/D-03/D-05/D-06; U-02/U-03 | New/saved preview ignores tile/slot mouse, touch and keyboard manipulation before Start/Resume: no capture/selection/ghost/attempt/hint/feedback change. Both input modes work afterward. Replay always visible and gray/disabled before Start, muted and during feedback/completion; no disabled tab stop, no layout shift, restored availability after unmute, saved mute honored. Exercise Start/Resume, replay, sound, autoplay rejection, Settings, explicit pause plus hidden return. |
| T-23; P-08/P-09; D-06/D-08; U-02/U-03 | JSON/image fatal errors offer Retry; font/audio/storage failures preserve play with specified notices. Independently fail word, each indexed letter and correction audio; partial success must not clear another required failure. Destination-level complete cues clear prior-level warning; stale earlier-occurrence callbacks cannot change it. Blocked playback shows Enable sound, not missing-media status. Validate sanitized diagnostics and learner copy. |
| T-24; P-10; D-07 | Recording browser bridge: one session event on first Start/Resume and one completion milestone per occurrence, exact envelope/fields, constant great tier, fresh v4 UUID/variant, UTC timestamp, exact URL user or empty string, configured sub_app_id, finite values, score/max_score and no options/extra fields. No per-tap or outbound telemetry. |
| T-25; P-10; D-07/D-08 | Bridge absent silently no-ops; throwing bridge diagnoses without breaking play. Invalid/nonfinite/oversized events rejected, serialized UTF-8 size strictly <65,536 bytes including multibyte boundaries; UUID fallbacks retain v4/variant. No retry/queue/network. Pure envelope boundaries may use linked unit tests, with browser integration assertions retained. |
| T-26; P-08/P-11; D-01/D-06/D-08/D-09; U-01 | Audit emitted HTML/JS/CSS/JSON/media/fonts and runtime URL/API attempts: relative base, no external/root-relative runtime dependency, maps, forbidden SDKs, service workers, Cache Storage or file-path fetch. Lexend actually decodes/applies under file://; font/OFL/manifest included and relative CSS URL resolves. Verify real media inventory/formats, not only mocked availability. |
| T-27; P-08/P-09; D-05/D-06/D-09 | Merged extracted production output under file:// with network unavailable: 10/10 cold starts <=10 seconds, real local media, zero external attempts, complete/reload both Great presentations and restore progress; no unexplained console errors. Desktop measurements do not certify baseline-phone performance. |
| T-28; P-11; D-10 | Packaging prerequisite plus merged-artifact browser check: engine/language Layout A archives, root index/no wrapper, no lang in engine, lang-only pack, no overwrites/traversal/symlinks/maps, hashes/version match, release-selected media only and true PNG icon >=192 px outside ZIPs. Test isolated staging now; final archive acceptance remains blocked until actual packaging exists. |
| T-29; P-08/P-10/P-11; D-07/D-10 | Browser bridge mocks cover only launch parameters and outbound contract. Actual registered Curious Reader launch, airplane-mode play, zero NETGUARD_BLOCK, stored/synced receipt and container deduplication require real container/device evidence; never mark these passed from a browser mock. |
| T-30; P-04/P-06/P-08; D-08 | Collect optional desktop diagnostic measurements using 100 pointer moves, 60 seconds of motion and 10 cold starts. Required p95 <=100 ms input, <=33.4 ms frame interval and <=10-second boot are certified only on the approved physical baseline device; keep that gate separate. |
| T-31; P-11; D-01/D-10 | Automate inventory, load/decode and license-record checks; independently review word-picture correctness, contextual/full-word pronunciation, distribution terms and actual publication/device version. Browser success is not legal, linguistic or release approval. |
| T-32; P-12; DEVSPEC lifecycle | Retain task/spec traceability, version/status/date/log checks and explicit human approval workflow. This is supporting maintenance verification, not a browser behavior test or automatic approval. |
| T-33; P-01/P-03/P-07/P-11; D-01/D-05; U-01/U-03 | Validate current CAT/DOG/RABBIT/BIRD roster, stable IDs 1-4, uppercase letters, two non-target foils per added animal, exact indexed media and alt/image references, animal depiction requirements and full-cycle reachability. Each MP3 has one complete accurate restricted-license record; placeholders and automated checks do not pass T-31. |

### Numerical boundaries and scenario completeness

Use before/at/after boundaries for 300 ms correct/incorrect feedback, 250 ms
foil disappearance, 1,200 ms completion, 4,000 ms media watchdog, >8 CSS px
drag threshold, 8,000 active ms full lane traversal and <=30-second maximum
queued wait. Assert spacing >=one tile width +8 px, lane height >=44 px and
vertical separation >=8 px. Test independent pause clocks, not only DOM delay.
Do not weaken these assertions to match current behavior.

Implement all eleven U-05 scenarios as named tests:

1. Start the offline Great puzzle.
2. Correct placement locks.
3. Wrong target is not a foil.
4. A foil reveals one position.
5. A cancelled or occupied drop is neutral.
6. Duplicate letters and final feedback.
7. Moving tile capture and recovery.
8. Play without drag or sound.
9. Resize or background during drag.
10. Settings, pause and focus.
11. Failed load versus failed audio (both fatal and nonfatal branches).

Add a regression for browser text selection competing with letter manipulation:
actual mouse drags over title/status/tile text must not select text, while
game dragging, focus and keyboard completion still work. This was previously
user-validated interactively; formal specification reconciliation for the CSS
selection rule must be confirmed before treating it as a new normative gate.

## Decisions, blocked gates and exclusions

- Resolve the timing of the initial "Drag a letter..." message before adding
  precise show/hide/reset expectations. Its text/location are specified; exact
  pre-Start and post-feedback timing is not. Do not block unrelated tests.
- Resolve any DEVSPEC snapshot phase/occurrence contract versus implemented
  storage-shape differences explicitly; do not canonize the implementation
  merely because a saved-state fixture passes it.
- Test browser backgrounding with actual visibility changes where supported;
  deterministic event injection alone is not proof of hidden-page suspension.
- Settings/focus handling, HTTP-versus-file loader behavior, media failure
  recovery and generation guards may expose unfinished application work.
  Report results honestly rather than excluding these cases.
- Browser automation proves calls/events/decode, not that a human heard correct
  speech or that a physical speaker worked.
- Production audio uses ElevenLabs free-plan restricted records; successful
  tests do not license commercial use or satisfy publication title attribution.
  Repository illustrations, product approval and independent media review
  remain release gates. Use releasable synthetic fixtures for harness work.
- Physical Android/iOS WebViews, device performance, actual Curious Reader
  reporting/deduplication and CMS Publish are excluded from desktop execution,
  but retained as explicitly unpassed T-29/T-30/T-31 handoffs.
- Human screen-reader, facilitated usability, pronunciation, independent QA
  and release sign-off are not replaced by automated accessibility scans.
- Q-01-Q-05 remain owned by the parties listed in DEVSPEC. No uploads, new
  identities, external telemetry or implicit product/release approval.

## Commands, validation and completion criteria

Existing commands: `npm run validate:content`, `npm run typecheck`,
`npm run test:unit` and `npm run build`.

Planned, not currently implemented: `npm run test:e2e` and its Playwright
browser installation/setup. DEVSPEC also requires `lint`, `build:standalone`,
`audit:standalone` and `package`; supply the portions approved for this task
or record explicit dependent-task blockers. Do not document missing scripts
as commands already proven to work.

Before declaring full browser acceptance:

1. The harness runs reproducibly on the documented Windows/Node/npm setup;
   the runbook includes a clean-install path and browser prerequisites.
2. Every T-01-T-33 group and U-05 scenario has a mapped executable test,
   linked supporting check or justified external gate. Browser-applicable
   requirements cannot be marked complete while skipped, failing or blocked.
3. All applicable HTTP/file, viewport, input and motion variants pass against
   production output. Include merged-package tests once packaging is ready.
4. Report pass/fail/blocked/not-run separately, per assertion and variant.
   Capture build revision/hash, content/schema versions, browser/OS/runtime,
   seeds, timings, viewport/input, expected diagnostics and failure artifacts.
   Distinguish browser acceptance from full product/device/release acceptance.
5. Run related unit/content/typecheck/build checks and the complete browser
   suite; inspect console/network and clean up owned fixtures/processes.
6. Obtain explicit human approval after presenting evidence and outstanding
   gates. Only then offer the separate specification-update task.

## Draft validation

This file is a proposed work item only. Validate relative links, T-01-T-33
coverage, all eleven scenario names, numerical constants and separation of
desktop/physical/manual gates. No application changes, dependency installs
or acceptance-test execution are authorized merely by creating this draft.
