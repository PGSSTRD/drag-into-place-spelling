# TESTSPEC - Drag Into Place Spelling

**Version:** 0.2.0<br>
**Status:** Draft - partial unit/browser smoke checks executed; full acceptance suite not executed; awaiting independent QA review<br>
**Last update:** 2026-10-22<br>
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

Implementation must create these under `tests/fixtures/`, isolated from the
production language pack. Use a seeded RNG, fake monotonic clock and an
injected UUID source; assert seed and expected values in each randomized test.
Do not use real delays for reducer/scheduler timing tests.

| Fixture ID | Definition | Purpose |
|---|---|---|
| F-01 | Valid CAT: letters C/A/T, foils B/D, three position-specific letter clips, image and word clip | Baseline all tiers |
| F-02 | Valid BOOK: letters B/O/O/K, foils A/Z, four indexed clips | Duplicate-instance matching and restore |
| F-03 | Valid A and ELEPHANT, with four allowed non-target foils for ELEPHANT | Minimum/maximum word and 12-tile layout |
| F-04 | One-level pack; separate three-level pack with stable IDs and distinct images/audio | Infinite replay, cycle coverage and no boundary repeat |
| F-05 | Invalid pack variants, one defect each | Schema version, empty pack, duplicate IDs, unsafe IDs, invalid lengths/chars, multiset mismatch, overlapping/excess foils, missing/unknown fields, wrong pack language |
| F-06 | Paths with `/root`, `https:`, `C:`, `..`, backslashes, encoded traversal/separators, query/fragment; wrong-case and missing files | Path confinement and media validation |
| F-07 | Valid/malformed/truncated JSON, empty XHR response, missing image, corrupt audio, wrong true-format PNG, missing font, stalled XHR | Loader/error/retry/watchdog behavior |
| F-08 | Valid partial/completed snapshots, invalid JSON, duplicate tile mapping, wrong letter, out-of-range index, stale schema/content | Restoration and namespace isolation |
| F-09 | Bridge absent, recording bridge, throwing bridge; valid/invalid/oversized envelopes; duplicate UUID replay at container boundary | Contract and failure isolation |
| F-10 | Audio resolves, rejects, is autoplay-blocked, stays pending, or fires stale callbacks | Sequencing, mute and bounded advance |

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
| T-01 | P-07; D-01 | Load F-01-F-06 and each individual invalid mutation | Valid packs pass; invalid ones fail with precise field/path; no partial playable pack; traversal/absolute/unknown fields rejected |
| T-02 | P-01/P-07; D-01/D-03 | Shuffle CAT/BOOK with fixed seeds; run 1,000 valid seeded layouts | Exact letter multiset, unique tile IDs, no overlap/out-of-bounds cells; deterministic seed results; do not assert every shuffle differs |
| T-03 | P-02/P-04; D-02 | Drop correct tile, then attempt reacquisition/move by pointer, tap and keyboard | Exactly one locked mapping and attempt; positive/contextual cue once; locked tile cannot move |
| T-04 | P-02; D-02/D-03 | Drop target A onto CAT's C position; include case with one/no alternative pool cell | One attempt and gentle cue; tile remains available in free randomized/previous cell per policy; no hint/removal |
| T-05 | P-02/P-04; D-02/D-03 | Drop outside/on occupied slot; Escape, pointercancel, lost capture, blur and resize | No attempts, correction cues, hints or loss of tile; availability restored; occupied tile unchanged |
| T-06 | P-02/P-03; D-01/D-02 | Complete BOOK with swapped O instance IDs | All positions accept correct letter values; each tile used once; destination-index audio used |
| T-07 | P-03; D-02/D-06 | Final correct drop, repeated pointerup and stale callbacks; F-10 media variants | One completion/advance; final-letter cue before word cue; advance waits for animation/audio or watchdog; mute/failure never hangs |
| T-08 | P-03; D-05 | Complete two cycles of F-04 using fixed RNG, plus one-level pack | Every level once per cycle; no immediate boundary repeat for multi-level; one-level replay works |
| T-09 | P-05; D-02 | Drop B on CAT's empty second slot in Better; repeat in Great; try occupied/outside | Empty drop removes only B, reveals only index 1, one attempt and negative cue; neutral drops don't consume foil |
| T-10 | P-05; D-02 | Run CAT in MVP with foils in JSON; reveal then fill hint slot in Better | MVP never instantiates foils/hints; filled slot suppresses hint presentation but keeps reveal state |
| T-11 | P-06; D-04 | Advance fake time through entry/travel/exit; acquire/cancel/wrong/correct/foil; run 100 passes | Direction and travel time per D-04; exactly one instance per ID; unplaced targets recycle, placed/removed never respawn; queued wait <=30 s |
| T-12 | P-06; D-04/D-08 | Manual pause, keyboard focus, feedback, hidden page, reduced motion and resume | Correct pause reasons compose; active clock excludes pauses, no teleport, reduced-motion Great uses static cells |
| T-13 | P-09; D-05 | Save/reload each accepted outcome in every tier, including BOOK and Great mid-pass | Placements, hints, removals, attempts/cycle and elapsed time match; remaining Great tiles requeue without duplicates |
| T-14 | P-09; D-05 | Change user/tier, content/schema version; corrupt F-08 snapshots; simulate storage throw | No cross-user/tier restore; stale/corrupt state reset with diagnostic/notice; settings preserved; in-memory play survives storage denial |
| T-15 | P-03/P-09/P-10; D-05/D-07 | Reload before/after completion marker save, bridge post and next-puzzle save | No completed-pending event replay; restored pending advances; crash window permits telemetry loss, never promises exactly-once delivery |
| T-16 | P-08; D-06/D-08 | XHR status 0/200/non-success, HTTP errors, empty/stalled responses, Retry and late old completion | Valid nonempty local data accepted; settled preloads; <=10 s Ready/error; Retry invalidates old generation; silent audio fallback only with notice/diagnostic |

For T-11, compute maximum queued wait across 320x568, 568x320, 768x1024 and
1024x768 layouts with F-03's maximum tiles, rather than timing only CAT.
For timing boundaries use just-before/exactly-at/just-after each D-02/D-04
constant and confirm the independent clock cannot advance while paused.

## 4. Presentation and interaction cases

| ID | References | Procedure and pass criteria |
|---|---|---|
| T-17 | P-04; D-03; U-01/U-04 | Drag each corner/edge with noncentral grab offset; tile stays fully inside playfield; center-based hit tests, shared-edge tie and >8 px drag threshold match D-03; second pointers cannot steal tile |
| T-18 | P-04; U-03/U-04/U-05 | Complete CAT and BOOK by keyboard only and by tap-select/place; cancel/change selection; correct focus progression; hidden hints not announced; one outcome live announcement |
| T-19 | P-04/P-06; D-03/D-04; U-01/U-02 | Resize/rotate during drag, feedback and Great; no stale hit-testing, lost tile, clipped answer/hint pairs or active background motion |
| T-20 | P-01/P-05/P-06; U-01/U-02/U-03 | Capture all specified states and control visibility for each tier; no foil styling clues, child-facing grade, written target spelling or duplicate pool/lane surfaces |
| T-21 | P-04; D-08; U-01/U-04 | Verify 44 px targets, contrast ratios, focus trap/return, labels, reading order, 200% text zoom, muted cues, reduced motion and screen reader; no color/audio-only essential feedback |
| T-22 | P-03/P-09; D-02/D-05/D-06; U-02/U-03 | Exercise Start/Resume, replay, sound toggle, autoplay rejection, Settings tier changes, explicit pause plus hidden-page return; state and control enablement match U-02 |
| T-23 | P-08/P-09; D-06/D-08; U-02/U-03 | Trigger content, image, audio, font and storage failures; fatal cases offer Retry, nonfatal ones preserve play with notices; no raw paths/IDs/stack traces in learner UI |

Each U-05 Gherkin scenario must be implemented as a named component/E2E
test, not left as a prose-only scenario. Automate a DOM accessibility scan and
supplement it with actual keyboard/screen-reader review; a scan alone is
insufficient.

## 5. Bridge, offline and delivery cases

| ID | References | Procedure and pass criteria |
|---|---|---|
| T-24 | P-10; D-07 | Record bridge strings for first gesture and completion; exactly one event per milestone, expected schema/fields, fresh UUID v4/variant, UTC timestamp, URL ID or empty string, stable `sub_app_id`, JSON-finite data, no `options`; score always accompanied by max_score |
| T-25 | P-10; D-07/D-08 | Bridge absent/throws; invalid data and payload size boundary tests; UUID APIs unavailable | Absence silently no-ops; other failures diagnosed without breaking gameplay; byte count (including multibyte values) <65,536; no retries/queues/network/per-tap events; fallback IDs retain v4 format |
| T-26 | P-08/P-11; D-06/D-08/D-09 | Audit production JS/CSS/HTML/JSON/font/media and archive | Relative base; zero external URLs/root-relative runtime dependencies, source maps, forbidden SDK/runtime registrations; no file-path fetch or Cache Storage; image true-format and complete audio inventory |
| T-27 | P-08/P-09; D-05/D-06/D-09 | Launch extracted merged production assets under `file://` with network unavailable; complete/reload all modes | Playable <=10 s on 10/10 cold starts, real media, zero external attempts, progress restored; no unexplained console errors |
| T-28 | P-11; D-10 | Inspect/extract archives into empty directory and test merged content | Root index, no wrapper/lang in engine, lang-only pack, no overwrites/traversal/symlinks/maps, hashes/version manifest match; icon true PNG square >=192 px outside ZIP |
| T-29 | P-08/P-10/P-11; D-07/D-10 | In actual container, launch via registered template; play in airplane mode; reconnect | Correct English/user routing, zero NETGUARD_BLOCK, events accepted/stored offline and later synced; replaying identical payload_id deduplicates at container, not game |
| T-30 | P-04/P-06/P-08; D-08 | On approved baseline device measure 100 pointer moves and 60 s of Great; 10 cold launches | p95 response <=100 ms, p95 animation frame interval <=33.4 ms, all cold launches <=10 s; evidence includes device/build versions and raw observations |
| T-31 | P-11; D-01/D-10 | Independently review production word-picture match, each contextual clip, full-word clip and licenses; verify actual published manifest/device | All content correct and legally distributable; no placeholder IDs/media; promotion alone not treated as release; staff Publish and device version verified |
| T-32 | P-12; DEVSPEC section 15 lifecycle; all spec metadata | Dry-run a new task plan, completed/unapproved task, approved task and affected-spec update | Plan cites all four specs and relevant IDs; no approval inferred; approved work prompts separate reconciliation; altered specs update metadata/log and report added/removed/replaced items |

For T-26 use emitted-asset scanning plus instrumented runtime URL/API spies;
a text search alone can miss dynamically constructed requests. Fail on
attempted outbound requests even if offline blocking prevents transmission.

## 6. Coverage map

This index is a minimum acceptance mapping, not a substitute for individual
assertions in the tables above.

| Product requirement | Test groups |
|---|---|
| P-01 | T-02, T-20, T-27 |
| P-02 | T-03, T-04, T-06 |
| P-03 | T-07, T-08, T-15, T-22 |
| P-04 | T-03, T-05, T-17-T-19, T-21, T-30 |
| P-05 | T-09, T-10, T-20 |
| P-06 | T-11, T-12, T-19, T-30 |
| P-07 | T-01, T-02, T-06, T-26 |
| P-08 | T-16, T-23, T-26, T-27, T-30 |
| P-09 | T-13-T-15, T-22, T-27 |
| P-10 | T-15, T-24, T-25, T-29 |
| P-11 | T-26-T-29, T-31 |
| P-12 | T-32 |

## 7. Execution, evidence and gates

Follow D-09's clean-machine sequence once M1 supplies the scripts. During
development run the smallest relevant test groups after typecheck; before
phase approval run all applicable groups and static-tier regressions.
Release requires the full sequence plus physical/manual gates.

Production-artifact dry run:

1. Build and package from a clean lockfile install; record commit/revision,
   Node/npm versions, schema/content version, tier, seed and ZIP hashes.
2. Extract engine then English pack into an empty test folder; assert no
   overwrite and inspect root `index.html`.
3. Open `index.html?cr_lang=english` as a local file, not through a dev server.
   For browser bridge tests install a stub before scripts; plain-browser tests
   must run without that stub.
4. Disable network before boot. Collect attempted-request logs, console
   diagnostics, startup timing and state captures. Play CAT/BOOK and maximum
   content in every tier, reload, mute, rotate and background/restore.
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

The user approved the Foundation/MVP/Better static code deliverable on
2026-10-22. The following focused unit evidence is real but partial; no
acceptance group is declared passed in full.

| Evidence | Results | Partial coverage |
|---|---|---|
| [content.test.ts](../../tests/content.test.ts) | 3 passing unit tests | T-01: valid English pack, letter multiset mismatch, encoded traversal; remaining F-05/F-06 variants and file-format cases are untested. |
| [domain.test.ts](../../tests/domain.test.ts) | 6 passing unit tests | Subsets of T-03 through T-10: repeated-letter matching, foil removal/hint, wrong target relocation, MVP foil omission, neutral occupied drop and one-level cycle. Does not cover full pointer/audio/timing/cycle matrices. |
| [progress.test.ts](../../tests/progress.test.ts) | 4 passing unit tests | Subsets of T-13 through T-15: user/tier key, partial snapshot and cycle restore, completion marker and duplicate bindings. No ten-trial or physical storage matrix. |
| [bridge.test.ts](../../tests/bridge.test.ts) | 3 passing unit tests | T-24/T-25 subsets: envelope schema, finite/size validation and UUID v4 shape. No recording/throwing bridge or container dedup test. |
| Typecheck and production build | `npm run typecheck` and `npm run build` passed with Node 24.20.0/npm 11.19.0. | Does not establish runtime asset completeness or any device gate. |
| Browser smoke checks | Production output opened from `file://`; CAT load, tap placement, Better foil/hint and completion/advance observed. A mouse drag was also observed in the local HTTP preview. | Not automated E2E; no instrumented outbound-request counter, viewport matrix, keyboard-only completion, accessibility scan or 10-cold-launch trial. T-17/T-18/T-27 are not passed in full. |

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

## Spec change log

2026-10-22 — Copilot — Recorded partial unit/build/browser evidence and explicitly retained missing-media, E2E, device and release gates.
2026-10-21 — Copilot — Added the initial draft fixtures, 32 traceable test groups, offline/device protocols, coverage matrix and approval/spec-maintenance gates; removed nothing.
