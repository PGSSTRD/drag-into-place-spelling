# TESTSPEC - Drag Into Place Spelling

**Version:** 2.1.5<br>
**Status:** Draft - DOG visual approval and current-level audio implementation approval recorded; focused audio tests pass; full acceptance suite not executed; awaiting independent QA review<br>
**Last update:** 2026-11-02<br>
**Author:** Copilot<br>
**Independent QA owner:** To be assigned

## 1. Authority and verification strategy

Verifies [PRD](./PRD.md), [DEVSPEC](./DEVSPEC.md) and
[UISPEC](./UISPEC.md); it does not introduce product behavior or reorder
engineering dependencies. Consult those sources for authoritative constants
and policies. Test data below is synthetic, not production learning content.
The [container contract](../third-party-game-spec.md) section 7 is a mandatory
external release checklist.

The repository now contains an application, dependency manifest and focused
unit tests. The acceptance groups, production-artifact E2E, device, human and
release checks below remain requirements; this document and partial test
results do not constitute evidence that the complete game passes them.

Layer testing:

1. Unit: reducer, schema, seeded layout, clock, serialization, scheduler,
   snapshot validation and envelope contract.
2. Component: visible states, keyboard/tap/pointer adapters, live messages and
   settings/focus; fake audio/media adapters for deterministic outcomes.
3. Production-artifact E2E: Chromium HTTP and `file://`, offline interception,
   touch and mouse, reload, orientation and bounded failures.
4. Physical-device/container: actual Android/iOS WebViews, audio gestures,
   storage, performance, bridge receipt and NetGuard diagnostics.
5. Human: independent QA, product/usability, architecture/security,
   accessibility, media and delivery review.

Automated emulation is not a substitute for the physical `file://` WebView
and in-container gates.

## 2. Deterministic fixtures

Create F-01-F-10 under `tests/fixtures/`, isolated from the production language
pack. F-11 refers to the current source language pack, not a synthetic fixture.
Use a seeded RNG, fake monotonic clock and an injected UUID source; assert seed
and expected values in each randomized test. Do not use real delays for
reducer/scheduler timing tests.

| Fixture/content ID | Definition | Purpose |
|---|---|---|
| F-01 | Valid CAT: letters C/A/T, foils B/D, three position-specific letter clips, image and word clip | Baseline Great puzzle |
| F-02 | Valid BOOK: letters B/O/O/K, foils A/Z, four indexed clips | Duplicate-instance matching and restore |
| F-03 | Valid A and ELEPHANT, with four allowed non-target foils for ELEPHANT | Minimum/maximum word and 12-tile layout |
| F-04 | One-level pack; separate three-level pack with stable IDs and distinct images/audio | Infinite replay, cycle coverage and no boundary repeat |
| F-05 | Invalid pack variants, one defect each | Schema version, empty pack, duplicate IDs, unsafe IDs, invalid lengths/chars, multiset mismatch, overlapping/excess foils, missing/unknown fields, wrong pack language |
| F-06 | Paths with `/root`, `https:`, `C:`, `..`, backslashes, encoded traversal/separators, query/fragment; wrong-case and missing files | Path confinement and media validation |
| F-07 | Valid/malformed/truncated JSON, empty XHR response, missing image, corrupt audio, wrong true-format PNG, missing font, stalled XHR | Loader/error/retry/watchdog behavior |
| F-08 | Valid partial/completed snapshots, invalid JSON, duplicate tile mapping, wrong letter, out-of-range index, stale schema/content | Restoration and namespace isolation |
| F-09 | Bridge absent, recording bridge, throwing bridge; valid/invalid/oversized envelopes; duplicate UUID replay at container boundary | Contract and failure isolation |
| F-10 | Audio resolves, rejects, is autoplay-blocked, stays pending, or fires stale callbacks | Sequencing, mute and bounded advance |
| F-11 | Implemented source pack `content/lang/english/levels.json` at content version 1.4.0: CAT plus DOG, RABBIT, and BIRD using their repository SVG paths, stable IDs 1-4, target-letter arrays, two non-target foil instances per added level and expected indexed MP3 paths. Full-word recordings for all four animals and six RABBIT letter clips are now present; CAT/DOG/BIRD letter clips, complete animal-audio license records and the reader font are still missing | Pack structure and media-reference intent; incomplete audio and license records remain explicit file/media validation failures |

Generate short test audio locally with documented creation rights. It proves
loading/ordering, not correct pronunciation; use independently reviewed
production recordings for the speech acceptance gate. Include a redistributable
test image/font and license records. Do not download unlicensed media or
record learner identities in fixtures.

## 3. Core/domain acceptance cases

Each row is a mandatory test group; parameterize stated variants rather than
choosing only the easiest example.

| ID | References | Setup/action | Required assertions |
|---|---|---|---|
| T-01 | P-07; D-01 | Load F-01-F-06 and F-11 and each individual invalid mutation | Valid schemas pass; invalid schemas fail with precise field/path; no partial playable pack; traversal/absolute/unknown fields rejected. F-11 structural data must match the animal words, images, letter arrays, foil counts and audio naming. Separately, file/media validation must diagnose absent audio and license records; structural acceptance alone does not pass T-01 |
| T-02 | P-01/P-07; D-01/D-03 | Shuffle CAT/BOOK with fixed seeds; run 1,000 valid seeded layouts | Exact letter multiset, unique tile IDs, no overlap/out-of-bounds cells; deterministic seed results; do not assert every shuffle differs |
| T-03 | P-02/P-04; D-02 | Drop correct tile, then attempt reacquisition/move by pointer, tap and keyboard | Exactly one locked mapping and attempt; positive/contextual cue once; locked tile cannot move |
| T-04 | P-02; D-02/D-03 | In reduced-motion Great, drop target A onto CAT's C position; include case with one/no alternative pool cell | One attempt and gentle cue; tile remains available in a free shuffled/previous cell per policy; no hint/removal |
| T-05 | P-02/P-04; D-02/D-03 | Drop outside/on occupied slot; Escape, pointercancel, lost capture, blur and resize | No attempts, correction cues, hints or loss of tile; availability restored; occupied tile unchanged |
| T-06 | P-02/P-03; D-01/D-02 | Complete BOOK with swapped O instance IDs | All positions accept correct letter values; each tile used once; destination-index audio used |
| T-07 | P-03; D-02/D-06 | Final correct drop, repeated pointerup and stale callbacks; F-10 media variants | One completion/advance; final-letter cue before word cue; advance waits for animation/audio or watchdog; mute/failure never hangs |
| T-08 | P-03; D-05 | Complete two cycles of F-04 and F-11 using fixed RNG, plus one-level pack | Every level once per cycle; no immediate boundary repeat for multi-level; the four F-11 levels are each reachable once per cycle; one-level replay works |
| T-09 | P-05; D-02 | In Great, drop B on CAT's empty second slot; repeat with occupied/outside drops | Empty drop removes only B, reveals only index 1, one attempt and negative cue; neutral drops don't consume foil |
| T-10 | P-05; D-02 | Start Great with CAT foils in JSON; reveal then fill a hint slot | Great instantiates the full foil/hint content; filling a hinted slot suppresses hint presentation but keeps reveal state |
| T-11 | P-06; D-03/D-04 | Advance fake time through entry/travel/exit; tap to stop, verify stationary position, then drag the same tile in a separate gesture; cancel, wrong/correct/foil; run 100 passes | Tiles travel left-to-right; pointer-down acquires and freezes the selected tile immediately; short release retains selection; a later drag moves it without losing pointer capture; pointer-generated focus does not trigger keyboard pause; exactly one instance per ID; unplaced targets/foils recycle, placed/removed never respawn; queued wait <=30 s |
| T-12 | P-06; D-03/D-04/D-08 | Manual pause, keyboard focus, pointer-generated focus/drag, feedback, hidden page, reduced motion and resume | Keyboard focus pauses lanes; pointer-generated focus does not; pointer input clears keyboard-focus pause; pause reasons compose, active clock excludes pauses, no teleport, reduced-motion Great uses static cells |
| T-13 | P-09; D-05 | Save/reload each accepted Great outcome, including BOOK and mid-pass | Placements, hints, removals, attempts/cycle and elapsed time match; remaining moving tiles requeue without duplicates |
| T-14 | P-09; D-05 | Change user and content/schema version; corrupt F-08 snapshots; simulate storage throw | No cross-user restore; stale/corrupt state resets with diagnostic/notice; settings are preserved where valid; in-memory play survives storage denial |
| T-15 | P-03/P-09/P-10; D-05/D-07 | Reload before/after completion marker save, bridge post and next-puzzle save | No completed-pending event replay; restored pending advances; crash window permits telemetry loss, never promises exactly-once delivery |
| T-16 | P-08; D-06/D-08 | XHR status 0/200/non-success, HTTP errors, empty/stalled responses, Retry and late old completion | Valid nonempty local data accepted; settled preloads; <=10 s Ready/error; Retry invalidates old generation; silent audio fallback only with notice/diagnostic |

For T-11, compute maximum queued wait across 320x568, 568x320, 768x1024 and
1024x768 layouts with F-03's maximum tiles, rather than timing only CAT.
For timing boundaries use just-before/exactly-at/just-after each D-02/D-04
constant and confirm the independent clock cannot advance while paused.

## 4. Presentation and interaction cases

| ID | References | Procedure and pass criteria |
|---|---|---|
| T-17 | P-04; D-03; U-01/U-04 | Tap a moving tile and verify it stops; then drag it in a separate gesture to a slot. Verify the complete selected-tile outline is visible, including at the upper edge of a moving lane. Drag each corner/edge with noncentral grab offset, including a moving tile removed from its lane; tile stays fully inside playfield and pointer capture survives acquisition; pointer focus does not trigger keyboard pause; center-based hit tests, shared-edge tie and >8 px drag threshold match D-03; second pointers cannot steal tile |
| T-18 | P-04; U-03/U-04/U-05 | Complete CAT and BOOK by keyboard only and by tap-select/place; cancel/change selection; correct focus progression; hidden hints not announced; one outcome live announcement |
| T-19 | P-04/P-06; D-03/D-04; U-01/U-02 | Resize/rotate during drag, feedback and Great; no stale hit-testing, lost tile, clipped answer/hint pairs or active background motion |
| T-20 | P-01/P-05/P-06; U-01/U-02/U-03 | Capture Great's moving and reduced-motion states and control visibility; in portrait measure hint-text to learner-status-text baseline distance (about 40 CSS px, no more than 48 px); motion-status row stays above answers; no foil styling clues, child-facing grade, written target spelling or duplicate pool/lane surfaces |
| T-21 | P-04; D-08; U-01/U-04 | Verify 44 px targets, contrast ratios, focus trap/return, labels, reading order, 200% text zoom, muted cues, reduced motion and screen reader; no color/audio-only essential feedback |
| T-22 | P-03/P-09; D-02/D-05/D-06; U-02/U-03 | Exercise Start/Resume, replay, sound toggle, autoplay rejection, Settings open/close, explicit pause plus hidden-page return; state and control enablement match U-02 |
| T-23 | P-08/P-09; D-06/D-08; U-02/U-03 | Trigger content, image, audio, font and storage failures; fatal cases offer Retry, nonfatal ones preserve play with notices; for a multi-level pack, verify the sound notice reflects the active level's full-word cue, every letter-position cue and shared incorrect-placement cue; show it when any required cue is unavailable, retain it after another cue succeeds, recompute on level advance, omit it on a complete level, and ignore stale results from the prior level; verify browser playback-policy blocks show Enable sound without misclassifying loadable assets; no raw paths/IDs/stack traces in learner UI |

Each U-05 Gherkin scenario must be implemented as a named component/E2E
test, not left as a prose-only scenario. Automate a DOM accessibility scan and
supplement it with actual keyboard/screen-reader review; a scan alone is
insufficient.

## 5. Bridge, offline and delivery cases

| ID | References | Procedure and pass criteria |
|---|---|---|
| T-24 | P-10; D-07 | Record bridge strings for first gesture and completion; exactly one event per milestone with `tier: "great"`, expected schema/fields, fresh UUID v4/variant, UTC timestamp, URL ID or empty string, stable `sub_app_id`, JSON-finite data, no `options`; score always accompanied by max_score |
| T-25 | P-10; D-07/D-08 | Bridge absent/throws; invalid data and payload size boundary tests; UUID APIs unavailable | Absence silently no-ops; other failures diagnosed without breaking gameplay; byte count (including multibyte values) <65,536; no retries/queues/network/per-tap events; fallback IDs retain v4 format |
| T-26 | P-08/P-11; D-06/D-08/D-09 | Audit production JS/CSS/HTML/JSON/font/media and archive | Relative base; zero external URLs/root-relative runtime dependencies, source maps, forbidden SDK/runtime registrations; no file-path fetch or Cache Storage; image true-format and complete audio inventory |
| T-27 | P-08/P-09; D-05/D-06/D-09 | Launch extracted merged production assets under `file://` with network unavailable; complete/reload all modes | Playable <=10 s on 10/10 cold starts, real media, zero external attempts, progress restored; no unexplained console errors |
| T-28 | P-11; D-10 | Inspect/extract archives into empty directory and test merged content | Root index, no wrapper/lang in engine, lang-only pack, only release-selected shared assets (repository-only animal placeholders excluded), no overwrites/traversal/symlinks/maps, hashes/version manifest match; icon true PNG square >=192 px outside ZIP |
| T-29 | P-08/P-10/P-11; D-07/D-10 | In actual container, launch via registered template; play in airplane mode; reconnect | Correct English/user routing, zero NETGUARD_BLOCK, events accepted/stored offline and later synced; replaying identical payload_id deduplicates at container, not game |
| T-30 | P-04/P-06/P-08; D-08 | On approved baseline device measure 100 pointer moves and 60 s of Great; 10 cold launches | p95 response <=100 ms, p95 animation frame interval <=33.4 ms, all cold launches <=10 s; evidence includes device/build versions and raw observations |
| T-31 | P-11; D-01/D-10 | Independently review production word-picture match, each contextual clip, full-word clip and licenses; verify actual published manifest/device | All content correct and legally distributable; no placeholder IDs/media; promotion alone not treated as release; staff Publish and device version verified |
| T-32 | P-12; DEVSPEC section 15 lifecycle; all spec metadata | Dry-run a new task plan, completed/unapproved task, approved task and affected-spec update | Plan cites all four specs and relevant IDs; no approval inferred; approved work prompts separate reconciliation; altered specs update metadata/log and report added/removed/replaced items |
| T-33 | P-01/P-03/P-07/P-11; D-01/D-05; U-01/U-03 | Validate and cycle F-11; inspect each expected image, foil set, word/letter audio path and license record | DOG/RABBIT/BIRD use stable IDs 2/3/4, matching target letters and SVG paths, accurate alt text, two non-target foils and one zero-based contextual clip per letter; the DOG is a head-only tan illustration with paired floppy ears and a symmetric muzzle, accepted by the user as a sufficient depiction of a dog on 2026-11-02; the BIRD illustration faces forward with two visible eyes, a centered beak, and no side-wing or outer-feather shapes; all four pack levels are reachable in a cycle. Missing CAT/DOG/BIRD letter clips and incomplete animal-audio license records fail content validation; repository-only SVGs do not pass release review by themselves |

For T-26 use emitted-asset scanning plus instrumented runtime URL/API spies;
a text search alone can miss dynamically constructed requests. Fail on
attempted outbound requests even if offline blocking prevents transmission.

## 6. Coverage map

This index is a minimum acceptance mapping, not a substitute for individual
assertions in the tables above.

| Product requirement | Test groups |
|---|---|
| P-01 | T-02, T-20, T-27, T-33 |
| P-02 | T-03, T-04, T-06 |
| P-03 | T-07, T-08, T-15, T-22, T-33 |
| P-04 | T-03, T-05, T-17-T-19, T-21, T-30 |
| P-05 | T-09, T-10, T-20 |
| P-06 | T-11, T-12, T-19, T-30 |
| P-07 | T-01, T-02, T-06, T-26, T-33 |
| P-08 | T-16, T-23, T-26, T-27, T-30 |
| P-09 | T-13-T-15, T-22, T-27 |
| P-10 | T-15, T-24, T-25, T-29 |
| P-11 | T-26-T-29, T-31, T-33 |
| P-12 | T-32 |

## 7. Execution, evidence and gates

Follow D-09's clean-machine sequence once M1 supplies the scripts. During
development run the smallest relevant test groups after typecheck; before
phase approval run all applicable groups, including Great moving and
reduced-motion presentation.
Release requires the full sequence plus physical/manual gates.

Production-artifact dry run:

1. Build and package from a clean lockfile install; record commit/revision,
   Node/npm versions, schema/content version, Great build variant, seed and
   ZIP hashes.
2. Extract engine then English pack into an empty test folder; assert no
   overwrite and inspect root `index.html`.
3. Open `index.html?cr_lang=english` as a local file, not through a dev server.
   For browser bridge tests install a stub before scripts; plain-browser tests
   must run without that stub.
4. Disable network before boot. Collect attempted-request logs, console
   diagnostics, startup timing and state captures. Play CAT/BOOK and maximum
   Great content, reload, mute, rotate and background/restore.
5. Repeat on agreed physical Android/iOS WebViews in airplane mode; coordinate
   container diagnostic/event-sync verification with Curious Learning.
6. Store concise results with case ID, expected/actual, PASS/FAIL/BLOCKED,
   platform/build, artifacts and reviewer. Test assets/reports remain outside
   release ZIPs; redact opaque user IDs.

Required matrix: Chromium desktop mouse and emulated touch; 320x568,
568x320, 768x1024 and 1024x768 CSS viewports; baseline Android WebView and
iOS WKWebView physical devices; audio on/muted/blocked; motion normal/reduced;
storage available/denied; bridge absent/present/throwing. QA records actual
minimum supported versions when Q-04 is resolved.

Release gates:

- 100% applicable cases passed, no skipped case counted as pass and no open
  critical/blocker defect. Record blocked device/content/usability gates as
  BLOCKED, never infer a pass from mock services.
- Independent QA review covers every D requirement and U scenario, with a
  named human owner distinct from the behavioral spec author.
- Product confirms P-01-P-12 including the PRD usability target; engineering
  signs architecture/security/business logic, media owner signs pronunciation
  and licensing, operator signs container/published-version verification.
- Explicit human approval follows the tested implementation report. Only then
  offer the separate spec-update task; a green suite is not human approval.

The document validation for this initial documentation task checks links,
requirement coverage, metadata, source preservation and change-log format.
It does not run nonexistent application tests.

## 8. Specification maintenance verification

After an approved task, the proposed reconciliation task must identify its
source task and approval, affected requirements and evidence, and update only
specs whose meaning or approval state actually changes. Verify Status,
Version and Last update match that work, with newest-first bottom entries:

```text
2026-MM-DD — <author> — <one-sentence description of change>
```

Replace MM/DD with the actual month/day (and year when it is no longer 2026).
Completion output lists additions, removals and replacements per document and
notes unchanged documents; a clarification replacing an old rule must not be
reported as "added only". Re-run the affected coverage/link/consistency checks.

## 9. Implementation evidence recorded 2026-10-22

The 2026-10-22 static code deliverable is historical prototype evidence and
does not verify the Great implementation. The following focused unit evidence
is real but partial; no acceptance group is declared passed in full.

| Evidence | Results | Partial coverage |
|---|---|---|
| [content.test.ts](../../tests/content.test.ts) | 3 passing unit tests | T-01: valid English pack, letter multiset mismatch, encoded traversal; remaining F-05/F-06 variants and file-format cases are untested. |
| [domain.test.ts](../../tests/domain.test.ts) | 6 passing unit tests | Subsets of T-03 through T-10: repeated-letter matching, foil removal/hint, wrong target relocation, historical prototype behavior, neutral occupied drop and one-level cycle. These are historical results, not verification of Great moving behavior. Does not cover full pointer/audio/timing/cycle matrices. |
| [progress.test.ts](../../tests/progress.test.ts) | 4 passing unit tests | Subsets of T-13 through T-15: user-scoped key, partial snapshot and cycle restore, completion marker and duplicate bindings. No ten-trial or physical storage matrix. |
| [bridge.test.ts](../../tests/bridge.test.ts) | 3 passing unit tests | T-24/T-25 subsets: envelope schema, finite/size validation and UUID v4 shape. No recording/throwing bridge or container dedup test. |
| Typecheck and production build | `npm run typecheck` and `npm run build` passed with Node 24.20.0/npm 11.19.0. | Does not establish runtime asset completeness or any device gate. |
| Browser smoke checks | Production output opened from `file://`; CAT load, tap placement, foil/hint and completion/advance observed. A mouse drag was also observed in the local HTTP preview. | Not automated E2E; no instrumented outbound-request counter, viewport matrix, keyboard-only completion, accessibility scan or 10-cold-launch trial. Great moving behavior and T-17/T-18/T-27 are not passed in full. |

`npm run validate:content` fails as expected: the English demo pack references
missing production word/letter MP3s, the shared incorrect WAV and reader WOFF2,
and there are no license records for those assets. Therefore T-01/T-26/T-31
remain blocked. Browser smoke checks also observed the missing local audio
requests and the nonfatal sound-unavailable notice.

The documented plain `npm ci` was not run; clean install verification used
`npm ci --ignore-scripts --no-audit --offline`. `npm audit` could not retrieve
the registry advisory report because the audit endpoint timed out after npm
reported five advisories during install. No advisory was verified or resolved.
`lint`, `build:standalone`, `test:e2e`, `audit:standalone` and `package` are not
implemented. Physical Android/iOS WebView, Curious Reader container, licensed
media, independent QA, accessibility and usability reviews remain blocked or
unrun; no release criterion is inferred from the passing unit/build checks.

### Great implementation evidence recorded 2026-10-27

The focused unit run passed 20 tests across five files, including four new
scheduler tests in [movement.test.ts](../../tests/movement.test.ts). These
exercise alternating-lane movement, stopped-tile queue recovery, duplicate-free
recycling and the 30-second return bound for 12 tiles at lane widths 320, 568,
768 and 1024 CSS px. Typecheck and production build also passed.

A development-server browser smoke check observed moving lane content, stable
manual pause, a selected tile holding its position, a foil being removed with
one position hint revealed, and reduced-motion presentation using the static
pool. It is not a production-artifact, automated E2E, full drag, keyboard,
screen-reader, performance or device test. T-11/T-12 and related presentation
groups remain partial until their complete procedures pass.

The follow-up browser regression check verified keyboard Tab focus pauses
motion, pointer interaction clears that pause, and a moving A tile can be
dragged into its correct answer slot without the keyboard-pause status. This is
a focused smoke check, not a complete automated T-11/T-12/T-17 run or
production-artifact test.

An additional browser smoke check tapped a moving C tile, confirmed its
bounding-box position was unchanged for one second, then dragged it in a
separate pointer gesture into the empty answer slot. The puzzle completed
without the keyboard-pause status. Typecheck, all 20 unit tests and the
production build passed, and `git diff --check` was clean. This remains
focused manual evidence, not full automated T-11/T-12/T-17 coverage.

After the compact spacing update, a browser check revealed a foil in reduced-
motion play and measured a 40 CSS px baseline distance between hint and status
at 390x844. CSS text-range measurements at 320x568 and 768x1024 also measured
40 CSS px. Typecheck, all 20 unit tests, production build and `git diff --check`
passed. T-20 and the full viewport/design review remain partial.

After the selected-outline fix, a browser check confirmed the complete outline
was visible on a tile at the top of a moving lane, with 4.4 CSS px clearance
from the clipping container. Typecheck, all 20 unit tests, production build
and `git diff --check` passed. This is focused evidence for T-17, not complete
pointer/accessibility or viewport acceptance.

### Four-level animal content implementation evidence recorded 2026-11-02

At this implementation stage, the English source pack contained CAT, DOG,
RABBIT and BIRD at `content_version` 1.3.0, with stable IDs 1-4, matching image paths, uppercase
letter arrays, two non-target foils for each added level, and the specified
zero-based MP3 references. Focused structure/path checks passed, and the
production build's emitted `dist/lang/english/levels.json` matched the source
pack by SHA-256. The 20 unit tests, typecheck, production build and
`git diff --check` passed.

`npm run validate:content` remains blocked: the 16 newly referenced animal
MP3s do not exist and have no license records. Existing CAT audio, shared
correction audio, reader font and their complete license records are also
missing. This implementation evidence does not pass full T-01; T-08 cycle
coverage and T-33's end-to-end content/media assertions have not been run.
T-26/T-28/T-31, production pronunciation review, approval of repository-only
illustrations for release, and all release/device gates remain unpassed or blocked.

After feedback that the original bird beak was unclear and only one eye showed,
`content/assets/images/bird.svg` was redrawn as a frontal bird with two
symmetrical visible eyes and a simple centered triangular beak. A further
review based on `Kladd/BirdEdit.png` removed both side-wing paths and the outer
feather path, leaving the forward-facing body, face, beak, and feet. Its level
alt text is now "A blue bird facing forward". Browser preview, SVG/XML and
accessibility-label checks passed; the existing CC0 license record and level
image path are unchanged. In accordance with D-01, content version was bumped
to 1.3.0. The rebuilt SVG and language pack matched their sources by SHA-256;
build, all 20 unit tests and `git diff --check` passed. This focused visual
review does not pass full T-33 or any release gate.

`npm run validate:content` remains blocked by missing pronunciation audio,
shared correction audio, reader font and complete license records. No T-01,
T-26, T-27 or release/media gate is declared passed from the code checks above.

After the user approved the revised head-only DOG illustration as a sufficient
depiction of a dog, it replaced `content/assets/images/dog.svg` without
changing the level path or CC0-1.0 license record. The pack version was bumped
to 1.4.0. SVG/XML, license, active-reference and whitespace checks passed; all
20 unit tests and the production build passed, and SHA-256 checks confirmed
that emitted DOG SVG and pack files match their sources. This visual approval
does not pass T-31: production-media review, audio/font completeness,
independent QA, device and release gates remain outstanding. At the time of
this DOG approval check, validation was also blocked by missing CAT/animal
recordings and shared correction audio. Subsequent asset additions changed
that inventory: all four full-word animal recordings, the six RABBIT letter
clips and the shared incorrect WAV are now present. CAT/DOG/BIRD indexed
letter clips and the reader font remain missing, and animal-audio license
records are incomplete; see the current-level audio evidence below for the
latest validation result.

### Current-level audio availability implementation evidence recorded 2026-11-02

The app now checks the active level's full-word cue, every letter-position
cue and the shared incorrect-placement cue. Missing/unloadable cues show the
notice only for that level; advancing to a complete level removes the old
warning, and late results from an earlier level are ignored. Browser
playback-policy rejection is handled separately with an Enable sound control.
Three focused audio-service tests, all 23 unit tests, typecheck and the
production build passed. `npm run validate:content` remains blocked by
missing CAT/DOG/BIRD letter clips, missing `assets/fonts/reader.woff2` and
incomplete license records for supplied animal audio. Component/browser
verification of level transitions and T-23, contextual pronunciation review,
physical-device audio checks and release gates remain outstanding. The user
confirmed that the behavior works as intended and approved the implementation
on 2026-11-02; this does not constitute specification, independent QA or
release approval.

## Spec change log

2026-11-02 — Copilot — Recorded user approval of the current-level audio implementation and corrected the current media-validation inventory while retaining Draft and QA gates.
2026-11-02 — Copilot — Added current-level audio notice acceptance coverage and recorded focused implementation/test evidence; component/browser T-23 verification remains outstanding.
2026-11-02 — Copilot — Recorded user approval of the DOG depiction, updated F-11 to content-version 1.4.0, and retained production-media gates.
2026-11-02 — Copilot — Recorded the BirdEdit-guided removal of side wings/outer feathers, corrected alt text and content-version 1.3.0 while retaining release gates.
2026-11-02 — Copilot — Recorded the revised two-eye frontal bird artwork, T-33 visual check and content-version 1.2.0 evidence without passing release gates.
2026-11-02 — Copilot — Recorded implementation evidence for the four-level English pack while retaining unrun cycle and blocked media/release gates.
2026-11-02 — Copilot — Added F-11 and acceptance coverage for the planned four-level English animal pack, indexed audio references, foil counts and outstanding-media gates.
2026-11-02 — Copilot — Added a package assertion excluding the repository-only animal illustrations until they are approved as production media.
2026-10-27 — Copilot — Recorded selected-outline browser evidence and focused validation while retaining full T-17 gates.
2026-10-27 — Copilot — Added a selected-outline clipping assertion for moving-lane tiles to T-17.
2026-10-27 — Copilot — Recorded approved compact spacing measurements and focused validation while retaining full acceptance gates.
2026-10-27 — Copilot — Added a measurable visual acceptance check for compact answer-hint-to-status spacing.
2026-10-27 — Copilot — Added a distinct tap-stop-then-drag acceptance procedure and recorded browser regression evidence.
2026-10-27 — Copilot — Clarified keyboard-versus-pointer pause assertions in T-11/T-12/T-17 and recorded the drag regression smoke check.
2026-10-27 — Copilot — Added focused Great scheduler, browser smoke and build evidence while keeping full acceptance and release gates outstanding.
2026-10-26 — Copilot — Replaced multi-tier and legacy-migration checks with single-Great coverage for foil/hint behavior, moving tiles and reduced motion; full acceptance suite and independent QA remain outstanding.
2026-10-26 — Copilot — Replaced MVP-specific acceptance with Better-default, legacy-save, pending-report, and Great regression coverage; full test execution and independent QA remain outstanding.
2026-10-22 — Copilot — Recorded partial unit/build/browser evidence and explicitly retained missing-media, E2E, device and release gates.
2026-10-21 — Copilot — Added the initial draft fixtures, 32 traceable test groups, offline/device protocols, coverage matrix and approval/spec-maintenance gates; removed nothing.
