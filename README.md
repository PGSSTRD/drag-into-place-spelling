"# Drag Into Place Spelling

Offline English spelling activity, implemented with React and TypeScript.

## Development

Use Node.js 24.20.0 LTS with npm 11.19.0.

```sh
npm ci
npm run dev
```

## Checks

```sh
npm run typecheck
npm run test:unit
npm run build
npm run validate:content
```

The source pack contains CAT, DOG, RABBIT and BIRD, local audio and the bundled
Lexend font. `npm run validate:content` must pass before release. Synthetic
test audio does not verify pronunciation. Production MP3 distribution approval
and ElevenLabs free-plan publication restrictions remain separate release
gates; see [the license manifest](content/licenses.json).

The learner-facing implementation is Great: target letters and foils move
left-to-right, can be stopped and dragged into the answer, and recycle until
placed or removed. Foils reveal position hints. Reduced-motion mode presents
the same puzzle with stationary tiles. Full browser acceptance, release ZIP/icon
tooling and physical container/device verification remain outstanding. The
engine uses a development `sub_app_id`; the approved
Curious Reader identifier and production content are still required before
release.

## Browser testing: stages 1-5 harness, content, spelling, interaction, movement, pause, persistence and progression

Stages 1-4 of [the browser acceptance task](docs/tasks/draft/browser-acceptance-suite.md)
are implemented and human-approved. Stage 5 persistence/progression
implementation was human-approved on 2026-11-04. Stage 1 supplies
the production HTTP/file harness and fixtures; stage 2 adds content rejection,
seeded layout, core placement, duplicate-letter, cycle, foil and hint assertions;
stage 3 covers pointer, touch and keyboard interaction; stage 4 adds movement
and pause coverage; stage 5 validates saved state, user isolation, completion
recovery and progression. This is **not full T-01-T-33
acceptance** and does not resolve open application/specification decisions or
authorize release.

Stage 6 adds [audio, loading and failure recovery](#stage-6-audio-loading-and-failure-recovery);
the user explicitly approved its implementation on 2026-11-05.

On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`:

```powershell
npm.cmd ci
npm.cmd run test:e2e:install
npm.cmd run test:unit
npm.cmd run test:e2e -- --project=http
npm.cmd run test:e2e -- --project=file
```

The install command downloads the pinned Playwright Chromium runtime (internet
needed once). Subsequent runs use local assets. `test:e2e` builds production
output first; never substitute a Vite development server. Both projects run
with `npm.cmd run test:e2e`. One worker, zero retries and `maxFailures: 1` ensure
the next test is not run after a failure. Correct and rerun the failing test
before continuing, for example:

```powershell
npm.cmd run test:e2e -- --project=http --grep H-03
```

Each test gets its own browser context, storage and temporary copy of `dist`.
HTTP uses a suite-owned loopback server on an allocated port; `file` starts no
server and uses Chromium's `--allow-file-access-from-files` flag for local
modules/XHR. This flag is a desktop test prerequisite, not WebView acceptance
evidence. Servers and temporary staging directories are removed on teardown,
including failed assertions. No source content is rewritten, and existing
servers (including port 8000) are not used or stopped.

### Fixture and helper inventory

- [F-01-F-10 builders](tests/fixtures/browser-content.ts): CAT, BOOK with
  separate indexed O clips, A/ELEPHANT (12 tiles), one-/three-level cycles,
  independently invalid packs, unsafe paths, asset faults, current-format
  snapshots and exact UTF-8 bridge-boundary/duplicate-UUID inputs.
- [Browser setup](tests/e2e/support/app.ts): select a fixture with
  `app.launch({ fixture: "F-02" })`; `F-11` retains the authored four-level
  pack. `content`, `rawContent`, `removeFiles`, `corruptFiles`, `files` and
  `missingFont` modify only staged copies. Missing-font injection removes
  both the source copy and Vite's hashed font. Wrong-case paths still need a
  case-exact asset audit on case-insensitive Windows; they are not proven by a
  successful local file read.
- [Pre-boot runtime adapters](tests/e2e/support/runtime.ts): seeded RNG and
  sequential v4 UUIDs; opt-in paused Playwright monotonic clock (`clock: true`,
  advance with `page.clock.runFor`); saved progress/mute; read/write storage
  failures; absent/recording/throwing bridge; stalled content requests on either
  transport (`stallContentXHR` is the retained compatibility option name;
  HTTP now uses fetch). `contentResponses` supplies ordered status/body/pending
  responses; `emitContent` delivers captured late callbacks. `stallImages`
  bounds required-image loading. `rawContent` supports malformed, truncated
  and empty responses.
- Audio defaults to real playback. `audio: "mock"` enables per-path played,
  unavailable, autoplay-blocked and pending outcomes. Manual `emitAudio`
  delivers delayed/stale callbacks (optionally target the recorded media
  instance ID); a pending outcome has no automatic ending. Mock sources are
  isolated from native media loading, and pause cancels automatic completion.
  `audioPlayOutcomes` overrides playback independently of preload availability.
  These adapters simulate media lifecycle only, not decoding or speech.
- Generated 100ms PCM tones and SVG shapes are original CC0 test assets,
  distinct by level/cue. Staging includes a fixture notice and license records;
  Lexend retains its bundled OFL notice. Production recordings are not
  relicensed by the harness.
- The six required viewport sizes are exported for later tests. Tests can use
  Playwright's `test.use({ viewport, hasTouch: true })` and
  `app.launch({ reducedMotion: "reduce" })`; mouse, touch and keyboard use the
  real browser drivers, not forced clicks.

Snapshot builders deliberately describe the current serializer, not approval of
the unresolved occurrence-counter/completion-phase contract. Bridge boundary
inputs are not evidence of real container validation/deduplication.

### Smoke coverage and evidence

All smoke cases run over HTTP and `file://`:

| Smoke | Fixture / requirement foundation | What is verified |
|---|---|---|
| H-01 | F-01; P-07/P-08, D-06, U-02; T-01/T-16/T-26 foundation | Production preview, local Lexend, real WAV decoding and playback after a gesture |
| H-02 | F-02/F-03/F-04/F-11; D-01/D-09 | Independent staged packs boot; fresh contexts cannot see a prior test's storage |
| H-03 | F-09/F-10; D-07/D-09 | Exact RNG sequence, UUID source, clock increments, recorded bridge calls and controlled media outcomes |
| H-04 | F-08; D-05 | Seeded partial snapshot reaches Resume and survives reload |
| H-05/H-06/H-07 | F-07; D-06, U-02 | Malformed/missing/corrupt staging and pre-boot XHR stall injection |
| H-08 | F-08/F-09; D-05/D-07 | Storage and throwing-bridge fault adapters are observable |
| H-09/H-10 | F-01; P-04, D-03 | Mobile touch/reduced-motion setup and keyboard driver can activate Start |

[Fixture integrity unit tests](tests/fixtures/browser-fixtures.test.ts) validate
the catalogs separately. H-07 verifies injection, not the application's timeout
boundary. The smoke tests do not yet test full puzzle completion, timing
boundaries, every input/viewport combination, all U-05 scenarios or the full
T-01-T-33 matrix. Those remain later stages.

Results are written to `playwright-report/index.html` and
`test-results/browser-results.json`. Each case attaches console warnings/errors,
uncaught errors, HTTP-server errors, outbound requests and runtime API attempts
(fetch/XHR/beacon/WebSocket/EventSource, including across reloads).
Uncaught application errors or detected external attempts fail a test. HTTP
requests outside the owned origin are blocked. A static emitted-asset/API audit
and desktop offline checks are now covered by stage 7, not by these smoke cases.
Failure screenshots/traces are retained under `test-results/browser`; inspect
with `npx.cmd playwright show-report` or `npx.cmd playwright show-trace <trace>`.
Reports are replaced by the next run; retain a copy externally when needed.

Physical Android/iOS WebViews, Curious Reader integration, baseline-device
performance, human/media review and release ZIP checks remain separate gates.

### Stage 2 content and spelling coverage

Run the stage 2 browser cases on both production transports:

```powershell
npm.cmd run test:e2e -- --project=http --grep "stage 2"
npm.cmd run test:e2e -- --project=file --grep "stage 2"
```

The [stage 2 coverage manifest](tests/e2e/coverage.json) maps T-01-T-10 cases
to fixture, transport, input method and motion mode. T-01 checks every
catalogued invalid schema/path fixture in the browser; the fixture unit tests
assert field/path diagnostics, and `npm.cmd run validate:content` separately
checks the authored media/license inventory. T-02 runs 1,000 deterministic
domain layouts and checks the 12-tile presentation at the six configured
viewports. The 2026-11-04 complete run passed 60 browser executions (30 per
transport), with 64 unit tests, authored content validation, typecheck and
production build passing. The manifest marks partial T-01/T-03/T-04/T-05/
T-07/T-09 variants explicitly; failed/blocked/pending/stale completion media
and all requirements outside T-01-T-10 remain open. The user approved the
stage 2 implementation on 2026-11-04. This approves that task only, not the
Draft specifications, the full acceptance suite or any release gate.

### Stage 3 pointer, touch and keyboard interaction

Run the stage 3 production-browser checks on both transports:

```powershell
npm.cmd run test:e2e -- --project=http --grep "stage 3"
npm.cmd run test:e2e -- --project=file --grep "stage 3"
```

The [stage 3 interaction coverage manifest](tests/e2e/interaction-coverage.json)
maps T-03, T-05, T-17, T-18 and T-19 assertions. It exercises mouse and
emulated-touch dragging, moving-tile stop and later drag, stable pointer
capture, the >8 CSS px threshold, an offset drag with whole-tile clamping,
keyboard-only and tap-select completion of CAT and BOOK, focus progression,
selection/cancellation, and resize during an active drag. The complete
Playwright run passed 90 executions (45 per transport), including all 15
stage 3 cases on HTTP and `file://`; 64 unit tests, authored content
validation, typecheck, production build and whitespace checks passed.
T-03 remains partial because direct reacquisition attempts across input
methods are not covered; T-17 remains partial for second-pointer/shared-edge/
exhaustive-offset variants, and T-19 for moving-motion/feedback/hidden-page
variants. Physical-device touch and human screen-reader review remain open.
The user approved the stage 3 implementation on 2026-11-04. This is not full
T-01-T-33 acceptance, specification approval or release authorization.

### Stage 4 movement and pause behavior

Run the Stage 4 production-browser checks on both transports:

```powershell
npm.cmd run test:e2e -- --project=http --grep "stage 4"
npm.cmd run test:e2e -- --project=file --grep "stage 4"
```

The [Stage 4 movement coverage manifest](tests/e2e/movement-coverage.json)
maps T-11/T-12 and their partial variants. The tests cover 12-tile travel,
lane spacing, unique IDs and browser recycling within 30 seconds; manual pause
and active-time exclusion; keyboard-focus pause and pointer resume; hidden-page
feedback/audio suspension; and composition of manual and hidden-page reasons.
The F-03 recycling case restores a valid saved snapshot at its eight-letter
level to exercise all 12 target/foil tiles. The complete Playwright run passed
100 executions across HTTP and `file://`; the Stage 4 cases also passed
individually on both transports. All 66 unit tests, authored content
validation, typecheck, production build and whitespace checks passed.

T-11 remains partial for stop/drag and feedback-outcome recycling, maximum
queued-wait measurements at every required viewport and other untested
variants. T-12 remains partial for pointer-generated focus, reduced-motion
changes and other untested variants. Hidden-page behavior is simulated in
desktop Chromium, not physical-device acceptance. The user approved the Stage 4
implementation on 2026-11-04. This approval covers Stage 4 only, not full
acceptance, the Draft specifications or release.

### Stage 5 persistence and progression

Run the Stage 5 production-browser checks on both transports:

```powershell
npm.cmd run test:e2e -- --grep "stage 5"
```

The [Stage 5 persistence coverage manifest](tests/e2e/persistence-coverage.json)
maps T-08/T-13/T-14/T-15 and records partial gates. The tests cover wrong and
correct placements, duplicate-letter identity, foil/hint restoration, active
elapsed time, requeued unique tiles without saved movement coordinates,
per-user progress and mute isolation, stale-content reset, readable storage
failure behavior, completion-marker recovery without duplicate completion
telemetry, two synthetic multi-level cycles and one-level replay. The full
Playwright run passed 120 executions across HTTP and `file://`; the 20 Stage 5
executions (ten scenarios per transport) also passed. All unit tests,
authored content validation, typecheck, production build and whitespace checks
passed.

T-08 remains partial because these are synthetic fixtures, not the authored
F-04/F-11 packs. T-13 remains partial for exact elapsed-time boundaries,
moving mid-pass recovery and reload after every individual outcome. T-14
remains partial for guest isolation and the complete corrupt-snapshot browser
matrix. T-15 covers the completion-marker reload boundary only; other crash
windows and permitted telemetry loss remain open. The user approved Stage 5 on
2026-11-04; that approval does not approve full T-01-T-33 acceptance, the Draft
specifications or release.

### Stage 6 audio, loading and failure recovery

```powershell
npm.cmd run test:e2e -- --grep "stage 6"
```

The [Stage 6 coverage manifest](tests/e2e/audio-loading-coverage.json) maps
[the executable cases](tests/e2e/audio-loading.spec.ts) to T-07/T-16/T-22/T-23.
They exercise production HTTP and `file://` builds, with deterministic media
outcomes for sequencing/boundaries and real staged WAV/font failures for native
decoding/fallback checks. Synthetic tones do not prove pronunciation.

Coverage includes final-letter-before-word ordering, the 1,200 ms celebration,
4,000 ms media watchdogs, successful long-word playback, muted/blocked/failed
completion and exactly one advance; no sound before Start/Resume; saved mute;
replay visibility, disabled states and stable geometry at all six viewports;
and mute during active feedback. Autoplay rejection offers Enable sound without
misclassifying media as missing.

HTTP content now uses abortable fetch; `file://` uses bounded XHR with nonempty
text and status 0/200 validation. The whole boot, including required-image
preloading, is bounded at 10 seconds. Failed loads offer in-document Retry;
old generations cannot overwrite the retried puzzle. Required audio failures
remain nonfatal and independently diagnosed. Availability is recomputed per
occurrence, so another successful cue cannot hide a failure and a complete
destination cannot inherit a prior occurrence's warning. Missing Lexend uses
the system-font fallback with a diagnostic.

Validation on 2026-11-05: all 68 Stage 6 executions passed (34 per transport);
the complete browser suite passed 188 executions (94 per transport), with zero
skips, failures, retries or flaky results. All 82 unit tests, production
typecheck/build, four-level authored content validation and whitespace checks
passed. The manifest retains environment/build hashes and evidence details.
Initial test synchronization and viewport-scroll measurement issues were
corrected before the final clean run. The user explicitly approved Stage 6 on
2026-11-05; this does not approve full acceptance, the Draft specifications or release.

The named U-05 "Failed load versus failed audio" cases cover both branches.
The manifest records remaining T-22 Settings/focus/preview variants and external
device, container, pronunciation, media-distribution and release gates.
The implementation task left normative specifications unchanged; a separately
authorized reconciliation records the approved evidence while preserving Draft
status and outstanding gates.

### Stage 7 layout, accessibility, bridge and offline checks

```powershell
npm.cmd run test:e2e -- --grep "stage 7"
```

The [Stage 7 coverage manifest](tests/e2e/layout-bridge-offline-coverage.json)
maps T-20-T-27 to the
[layout/accessibility](tests/e2e/layout-accessibility.spec.ts),
[bridge/output-audit](tests/e2e/bridge-offline.spec.ts) and
[file-only offline](tests/e2e/offline.spec.ts) cases. The offline cases are
selected only by the file project, not skipped by HTTP.

Maximum eight-letter/12-tile previews run in both motion presentations at all
six acceptance viewports, retaining screenshots and measuring target sizes,
text, wrapping, paired hints and learner-visible clues. Rendered contrast,
focus versus selection, keyboard-only muted completion and 200% root text
scaling supplement pinned axe-core scans. Axe uses a running clock; a paused
Playwright clock prevents its asynchronous analysis from settling. Root text
scaling is not evidence of actual browser-UI zoom or human screen-reader use.

The specified Settings dialog now traps focus, cancels selection, pauses
motion/audio/active time, closes with Escape and returns focus to Settings.
Settings, manual pause and hidden-page reasons compose independently.
Answer cells are 44px with 8px gaps, preserving the largest permitted column
count; selected keyboard focus remains distinguishable from selection alone.
An existing text-selection/drag regression is covered without declaring the
unreconciled CSS rule a new normative gate.

Bridge checks cover exact milestones and fields, URL user routing, UUID
sources/fallbacks, absent/throwing bridges and oversized-event rejection
without blocking play. [Linked unit tests](tests/bridge.test.ts) test malformed
events and exact 65,535/65,536/65,537-byte ASCII/multibyte boundaries.

The [emitted-output auditor](scripts/audit-output.ts) checks relative/exact-case
references, media signatures and license inventory, fonts, maps and forbidden
API/SDK patterns; negative staged mutations verify rejection. It is a
pattern-based browser-support audit, not exhaustive indirect-URL analysis or
an implemented `audit:standalone` release command. Runtime instrumentation also
rejects external attempts, service-worker/Cache Storage registration and
`fetch(file:)`, including blocked attempts.

Native decoding covers all 21 authored audio files and four images, with
loaded local Lexend. Ten fresh offline file contexts measure Ready <=10
seconds; real-media offline play completes and restores progress in both
motion presentations. These use isolated production-output copies, not
extracted release archives, physical baseline devices or Curious Reader.
Pronunciation, restricted-audio distribution, human accessibility/visual
review, actual container registration/receipt/deduplication and release
packaging remain unpassed gates. The D-06 literal one-frame silent-buffer
implementation gap also remains open.

Validation on 2026-11-05: all 41 Stage 7 executions passed (19 HTTP, 22 file);
the complete suite passed 229 executions (113 HTTP, 116 file), with zero
failures, skips, retries or flaky results. All 90 unit tests, production
typecheck/build, four-level content validation, manifest/reference/link checks
and whitespace checks passed. The ten measured cold starts reached Ready in
0.36-1.29 seconds. Initial harness/selector issues were corrected and targeted
reruns passed before the final clean suite.

The user explicitly approved Stage 7 on 2026-11-05; this does not approve full
acceptance or release. A separately authorized reconciliation records that
evidence in DEVSPEC 2.0.21, UISPEC 2.0.20 and TESTSPEC 2.1.19, preserving
Draft status and normative criteria; PRD is unchanged. The user explicitly
approved the reconciliation on 2026-11-05; this does not approve the
specifications wholesale or release.

### Stage 8 complete-suite regression run and reporting

```powershell
npm.cmd run test:unit
npm.cmd run validate:content
npm.cmd run test:e2e
```

The [Stage 8 consolidated report](docs/reports/browser-acceptance-stage-8.md)
maps T-01-T-33 and all eleven U-05 scenarios to current executable evidence,
not-run assertions and blocked external gates. This reruns all implemented
stages together against production output; it does not require stage-number
execution order or add missing browser variants.

The report distinguishes a passing implemented regression from full browser,
product, device and release acceptance. Historical manifests retain their
original scope; later evidence is reconciled in the consolidated ledger.
For example, the existing core tests already cover two authored F-11 cycles,
despite the narrower Stage 5 manifest's remaining-gate text.

Stage 8 regression on 2026-11-05 passed all 229 browser executions (113 HTTP,
116 file), all 90 unit tests, four-level content validation and production
typecheck/build, with zero browser failures/skips/retries/flaky results.
Ten offline cold starts reached Ready in 0.327-0.473 seconds. The
[retained local evidence](artifacts/browser-acceptance/stage-8-2026-11-05/)
contains JSON/HTML reports, attachments, diagnostics, timings and build hashes;
it survives later test runs but is Git-ignored and must be backed up separately.

Fourteen axe scans reported zero automatic violations, but 12 scans contain
incomplete ARIA-label/contrast checks requiring follow-up. Those findings,
missing browser variants, the known D-06 silent-buffer gap and external
human/device/container/media/packaging gates keep full acceptance incomplete.
The user explicitly approved Stage 8 regression/reporting on 2026-11-05.
This does not approve full acceptance or release; normative specifications
were unchanged by the regression task. The separately authorized
reconciliation records its evidence in DEVSPEC 2.0.22, UISPEC 2.0.21 and
TESTSPEC 2.1.20, preserving Draft status and mandatory criteria; PRD 2.0.1
is unchanged. On 2026-11-05 the user explicitly selected
"Approve reconciliation" for this evidence-only documentation update,
not full acceptance, wholesale specification approval or release.
Reconciliation checks pass for 202 local links/anchors, 807 requirement
references, metadata/logs, unchanged normative/module/history/source
sections and retained result/timing/finding/build-hash evidence. No
application rerun was needed for this documentation-only reconciliation.
