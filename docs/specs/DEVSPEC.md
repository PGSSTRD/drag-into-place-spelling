# DEVSPEC - Drag Into Place Spelling

**Version:** 2.0.10<br>
**Status:** Draft - DOG depiction approved; current-level audio availability behavior implemented; media validation and release gates outstanding<br>
**Last update:** 2026-11-02<br>
**Author:** Copilot

## 1. Authority and reading order

Implements [PRD](./PRD.md) P-01-P-12. This document owns system behavior,
contracts, implementation sequence and technical decisions. Presentation belongs
to [UISPEC](./UISPEC.md); [TESTSPEC](./TESTSPEC.md) verifies both. Test ordering
must not override the module dependencies here.

The [external container contract](../third-party-game-spec.md), v1.8, governs
integration. This spec selects its Layout A, not an optional book/core content
tier. Great is the sole game implementation. A historical static prototype is
recorded in section 9.1 as evidence only; it is not a release candidate and
does not define an alternate runtime tier.

## Part I - Functional requirements

## 2. Domain and content contract (D-01)

An engine loads `lang/english/levels.json`. JSON is UTF-8, schema version 1.
The first release supports only `english`; no silent fallback from a requested
unsupported language. In a plain browser, missing `cr_lang` defaults explicitly
to `english`. A container launch must provide it; absence is a configuration
error. Unknown query parameters, including `cr_book`, are ignored because this
engine has no book tier.

```json
{
  "schema_version": 1,
  "content_version": "1.0.0",
  "language": "english",
  "levels": [
    {
      "level_id": 1,
      "target_word": "cat",
      "letters": ["C", "A", "T"],
      "foils": ["B", "D"],
      "image_path": "assets/images/cat.png",
      "word_audio_path": "lang/english/audios/cat.mp3",
      "letter_audio_paths": [
        "lang/english/audios/cat-0-c.mp3",
        "lang/english/audios/cat-1-a.mp3",
        "lang/english/audios/cat-2-t.mp3"
      ],
      "image_alt": "A cat"
    }
  ]
}
```

| Field | Required validation |
|---|---|
| `schema_version` | Integer, exactly 1; unsupported versions fail explicitly |
| `content_version` | Nonempty semantic version `major.minor.patch`; bump for any level/media change |
| `language` | Exactly `english`, matching the requested pack |
| `levels` | Nonempty array; all entries validated before play |
| `level_id` | Positive safe integer, unique within the pack; stable across releases |
| `target_word` | Lowercase ASCII `[a-z]{1,8}`; position order is authoritative |
| `letters` | Array of uppercase single ASCII `[A-Z]`; same length and multiset as uppercase `target_word`, not necessarily in target order |
| `foils` | Array of 0-4 uppercase `[A-Z]` characters; duplicates allowed, but no character may occur in `target_word` |
| `image_path` | Existing true-format local image under `assets/images/` |
| `word_audio_path` | Existing MP3/WAV under `lang/english/audios/` |
| `letter_audio_paths` | Exactly one existing MP3/WAV path per target position; pronunciation in that word's context, not an alphabet-name substitute |
| `image_alt` | Nonempty learner-facing image description; do not expose file names |

The English pack retains CAT as level 1 and implements these added levels with
stable IDs and media references:

| Level ID | Target word | Letters | Foil count | Image | Image alt | Word audio | Letter audio |
|---:|---|---|---:|---|---|---|---|
| 2 | `dog` | `D`, `O`, `G` | 2 | `assets/images/dog.svg` | A dog looking forward | `lang/english/audios/dog.mp3` | `lang/english/audios/dog-0.mp3` through `dog-2.mp3` |
| 3 | `rabbit` | `R`, `A`, `B`, `B`, `I`, `T` | 2 | `assets/images/rabbit.svg` | A rabbit looking forward | `lang/english/audios/rabbit.mp3` | `lang/english/audios/rabbit-0.mp3` through `rabbit-5.mp3` |
| 4 | `bird` | `B`, `I`, `R`, `D` | 2 | `assets/images/bird.svg` | A blue bird facing forward | `lang/english/audios/bird.mp3` | `lang/english/audios/bird-0.mp3` through `bird-3.mp3` |

Each added level uses an accurate `image_alt` and exactly two uppercase foil
instances whose letters do not occur in its target word; the general D-01
allowance for duplicate foils still applies. These additions fit P-07's
1-8-letter and maximum-four-foil limits. The additive pack uses `content_version` `1.4.0`; it includes the simplified
bird SVG, with the side wings and outer feather shapes removed, and the
user-approved head-only DOG illustration with floppy ears and a symmetric
muzzle. The user approved the DOG image as a sufficient depiction of a dog on
2026-11-02. This visual approval does not constitute production-media approval
or waive T-31.
Full-word recordings for CAT, DOG, RABBIT and BIRD and the six indexed RABBIT
clips are now present in the source tree. Indexed letter clips for CAT, DOG
and BIRD are still missing, and the supplied animal recordings lack complete
license records. Do not treat the expanded pack as media-valid until every
referenced clip exists, has a complete license record and passes contextual
pronunciation review. The SVGs remain repository-only placeholders and are
not release media unless selected and approved through T-31.

Reject missing/unknown fields, wrong types, invalid counts, duplicate level
IDs and ambiguous legacy schemas. Report JSON field path and reason. This
extends the brief's illustrative level object into a precise schema; a raw
array of legacy level objects requires an explicit conversion tool, not
guessing at runtime. Required shared media are
`assets/audios/incorrect.wav` and `assets/fonts/reader.woff2`. Animation is
implemented locally in CSS/SVG; Rive is not required.

All paths use ZIP/web-style `/`, resolve relative to `index.html`, and must be
nonempty, confined to the specified subtree and free of `..`, backslashes,
leading `/`, drive prefixes, schemes, query strings and fragments. Validate
after percent-decoding and reject encoded traversal or encoded separators.
Build validation enumerates every reference, checks exact case, real file
format and decoding, and records media license/attribution in `content/licenses.json`.
The license manifest records path, creator, license identifier, source and
permission/attribution notes; self-created assets are explicitly identified.

Each runtime tile has immutable ID `t:<source-index>` or `f:<source-index>`,
letter, kind (`target`/`foil`), and availability state. IDs are scoped to a
puzzle occurrence, not globally unique identities. Correctness compares letter
values, so either O tile can fill either O position in BOOK. Foils can never
be confused with a repeated target letter.

## 3. Puzzle rules and transitions (D-02)

Model behavior in a pure reducer driven by commands; coordinates and media are
adapters, not the source of correctness. Store `puzzleOccurrence`, level ID,
slot-to-tile mapping, removed foil IDs, revealed-hint indices, attempt count
and active elapsed milliseconds. A new occurrence is allocated when a new
puzzle starts, even if its level ID appeared in an earlier cycle.

| Command/condition | Required result |
|---|---|
| Acquire an available tile | Reserve it for one active pointer/selection; freeze its movement |
| Acquire a locked/removed tile or a second pointer | Ignore; do not mutate state |
| Drop outside all slots or on an occupied slot | Neutral cancellation; no attempt, no hint and no negative audio |
| Drop a target onto an empty matching slot | Increment attempts once, occupy/lock that tile, positive animation and contextual audio for the destination position |
| Drop a target onto an empty nonmatching slot | Increment attempts once, play negative audio and return/requeue the tile after feedback; no hint. Great motion requeues at the lane scheduler's tail; reduced-motion Great returns it to a free shuffled cell |
| Drop a foil onto an empty slot in Great | Increment attempts once, negative audio, remove foil from this occurrence, reveal that slot's expected-letter hint |
| Cancel (`Escape`, pointer cancel, lost capture, blur, resize, hidden page) | Neutral cancellation; preserve logical availability and return/requeue tile |
| All slots filled | Enter completing state once, freeze puzzle input/motion, finish final-letter feedback, then celebrate and play full-word audio; advance once |

One accepted drop on an empty slot is one attempt. Acquiring, moving or
cancelling is not. No per-attempt analytics are emitted. Correct placements
cannot be undone. Great instantiates the full content-defined foil array.

Audio ordering: process logical results synchronously; do not await media
before locking a correct tile. Serialize letter/negative cues in drop order.
While a placement-feedback sequence is running, disallow new acquisitions
to prevent overlapping cues. A final drop's letter cue precedes the word cue.
Visual correct/incorrect feedback lasts 300 ms; foil disappearance lasts
250 ms. Completion animation lasts 1,200 ms and runs alongside word audio.
Advance after both word audio and the completion animation finish. Any cue
that fails, is muted, is blocked, or reaches a 4,000 ms watchdog is considered
finished; emit a diagnostic for failures/watchdog, never for intentional mute.
Suspend timers/audio while the page is hidden. Media callbacks carry an
occurrence/generation token: stale callbacks cannot complete a new puzzle.

## 4. Geometry and interaction adapters (D-03)

Use Pointer Events with pointer capture, not HTML drag-and-drop. Convert
client coordinates to the current playfield coordinate system. Preserve the
initial finger-to-tile offset; clamp the entire dragged tile inside the visible
playfield rectangle. Drop hit-testing uses the tile center against current
slot rectangles; shared-edge ties choose the lower slot index. No overlapping
slot rectangles or partially off-screen manual tiles are allowed.

Hold pointer capture on the stable playfield rather than the moving tile:
acquiring a moving tile removes it from its lane, but must not interrupt the
active pointer gesture. Pointer-generated focus is not keyboard lane focus and
must not pause other moving tiles.

Only one drag or tap/keyboard selection may exist. Pointer-down on an
available tile acquires it immediately and freezes its movement when
applicable, so a tap visibly stops a moving tile before any drag. A pointer
movement of more than 8 CSS px starts a drag; a shorter press-release leaves
the tile selected for tap-to-place or a later drag. Tapping the selected tile
again cancels it. Clicking/tapping an empty slot with a selected tile dispatches
the same drop command. Keyboard selection/drop uses the same reducer.
Dragging is disabled during feedback, pause, completion or fatal load error.

Static pool: shuffle tiles into nonoverlapping available cells using
Fisher-Yates with an injectable RNG. On a wrong drop choose randomly among
free cells other than the tile's previous cell; if no alternative fits,
return to its previous cell. Placed/removed tiles release their cells.
Restoration recalculates layout instead of restoring pixel coordinates.

Resize/orientation cancels any active drag, recalculates hit areas and pool
cells, and preserves placements/hints. Never accept a drop using stale geometry.

## 5. Moving mode (D-04)

Great is the sole implementation and includes the shared spelling behavior,
foil removal and position hints, plus moving letters and foils. Use two
horizontal lanes with at least 44 CSS px tile height and 8 px vertical separation.
Each tile travels linearly from fully outside the left edge to fully outside
the right edge in 8,000 active milliseconds. Drive motion with one
`requestAnimationFrame` clock, not per-tile interval timers.

Keep a FIFO queue of unplaced/unremoved tile IDs. At each lane opportunity,
spawn the queue's next tile if that lane's newest tile has moved at least one
tile width plus 8 px from the spawn position. Alternate available lanes,
starting with the top lane. An exiting tile goes to the queue's tail; it is
not deleted. At most one instance of any tile ID may exist across lanes,
selection and queue. The left-to-right automated off-screen entry/exit is the
intended Great behavior; the on-screen constraint applies to manual dragging.

Acquisition removes a tile from the lane scheduler and freezes it. Correct
drop locks it; foil drop removes it; wrong/cancelled drop requeues it at the
tail after its feedback. Pause all lanes during placement feedback, manual
pause, hidden page and completion. Clock deltas exclude paused time; returning
from background never teleports tiles. Under continuous unpaused operation,
every queued tile must begin another pass within 30 seconds for all supported
layouts and content limits.

Reduced-motion preference uses stationary shuffled cells as an accessible
presentation of Great, keeping foils/hints and correctness unchanged. A
facilitator may pause/resume motion; pause freezes the activity until Resume.
There is no failure on timeout.

## 6. Progression and persistence (D-05)

Shuffle the level-ID list once per cycle and visit each exactly once. At a
cycle boundary reshuffle and avoid an immediate repeat of the last level if
more than one level exists. One-level packs repeat indefinitely. Tests inject
RNG and clock; production randomness is not a security mechanism.

Persist after each accepted drop, settings change, puzzle initialization,
completion transition and pause/page-hide checkpoint. Great is the sole
implementation. Save under
`drag-into-place:v1:<encoded-user>:english` in `localStorage`, where the opaque
`cr_user_id` is used only as a namespace, with `guest` when absent. Do not
create or persist a separate user/device identifier.

Snapshot fields: `schema_version=1`, `content_version`, shuffled cycle IDs,
current cycle index, current occurrence counter, level ID, slot-to-tile IDs
(or null), removed foil IDs, revealed hints, attempts, elapsed active
milliseconds, phase (`playing`/`completed_pending_advance`) and
`completion_recorded`. Settings (mute) use a user-scoped settings key. Moving
positions, pointer state, audio buffers and animation progress are ephemeral;
restore an incomplete Great puzzle with all remaining tiles requeued.

Active elapsed time starts at Start/Resume (or automatic puzzle activation),
not while Ready/loading, and excludes placement/completion feedback, hidden
page, settings and manual pause. Snapshot elapsed time includes earlier
restored play for the same occurrence. A completion event uses that accumulated
time up to the final accepted drop.

Validate the entire snapshot against current content and invariants before
use. A content-version/schema mismatch, invalid JSON, duplicate tile binding
or invalid slot letter discards only this namespace's unusable snapshot,
logs a diagnostic and shows a nonfatal "new puzzle" notice. Keep valid settings.
Changing user never restores another user's state. No reset-progress control
in v1. Migration from prototype-only MVP/Better settings or snapshots is out
of scope for this from-scratch product specification.

Completion handling saves `completed_pending_advance`, marks
`completion_recorded` before bridge invocation and never re-emits that
completion on restore; then saves the next puzzle after feedback. On restoring
a completed pending state, advance immediately without repeating feedback or
events. This is best-effort at-most-once across reload: a crash between the
marker save and posting may lose telemetry. Exactly-once cross-process delivery
is not promised because the bridge has no acknowledgment and game-side retry
is forbidden. If storage fails, preserve in-memory play, show a nonfatal
progress warning and report a diagnostic, not a false save-success message.

## 7. Offline boot and media (D-06)

1. Render the root element before loading scripts; parse launch parameters.
2. Load/validate JSON using the protocol-aware loader.
3. Validate required references and preload the current puzzle, font and
   shared cues using `Promise.allSettled`.
4. Restore or initialize the puzzle and present Start/Resume, requiring a
   user gesture to unlock audio.
5. If boot cannot reach usable state within 10 seconds, show Retry with an
   error code. Retrying cancels/invalidates the previous load generation.

For `file:` load local JSON/binary via XHR with explicit timeout; accept status
0 or 200 only when a nonempty response of the expected type is received.
For HTTP(S) development use fetch with abort/timeout. Neither path may call
Cache Storage, register a service worker, or need a server in production.
Use `FontFace` buffers or bundled CSS fonts and Web Audio buffers/relative
HTML audio. A system-font fallback remains playable and is diagnosed.

Required JSON/schema/image failure blocks that puzzle with Retry; never skip
a bad puzzle silently. Audio decode/load failure is nonfatal: log the path and
reason, supply a one-frame silent buffer for that failed asset, show a sound
unavailable notice and allow play. Derive sound availability from the complete
required cue set for the active level: its full-word cue, every
letter-position cue, and the shared incorrect-placement cue. If any required
cue is missing, unsupported, or fails to load/decode/play, show the notice for
that level. Do not clear it merely because another cue succeeds. On level
advance, recompute availability for the destination level; a complete level
must not inherit a prior level's warning. Associate asynchronous availability
results with the level occurrence that requested them so stale results cannot
change the current level's notice. A browser playback-policy block is
transient: show the Enable sound control and do not classify otherwise
loadable assets as missing. Speech/image correctness still blocks release via
build-time validation. Preload failures settle independently and never strand
loading. No speech synthesis/remote pronunciation dependency.

Sound defaults on for a new user, but must not play before a user gesture.
Mute is persistent, replaying the picture's word audio requires an explicit
learner action, and replay is disabled during feedback/completion. Initial
Start and Resume try to unlock audio; blocked playback displays an enable-sound
control, does not crash or hold advancement indefinitely.

## 8. Container reporting (D-07)

Detect `typeof window.ReactNativeWebView?.postMessage === 'function'`.
When absent, silently no-op without attempting `postMessage`. When present,
fire-and-forget one serialized string per event, with exception diagnostics
but no thrown gameplay error, batching, queue, retry or outbound I/O.

```json
{
  "type": "cr_event",
  "payload": {
    "payload_id": "f4f9c2aa-1f3f-4f0e-9d1a-7b6f0c2f3a11",
    "cr_user_id": "",
    "sub_app_id": "<agreed-stable-sub-app-id>",
    "payload_version": 1,
    "collection": "user_sessions_data",
    "timestamp": "2026-10-21T07:00:00.000Z",
    "data": {
      "type": "level_completed",
      "lang": "english",
      "level_id": 1,
      "tier": "great",
      "attempts": 3,
      "duration_ms": 4200,
      "score": 3,
      "max_score": 3
    }
  }
}
```

Use a fresh UUID v4 per envelope, ISO-8601 UTC timestamp and exact
`cr_user_id` from the URL or `""` when absent. No `options` field for
`user_sessions_data` (the explicit prohibition in external section 6.5 wins
over its illustrative empty `options` object). No extra top-level payload
fields. UUID generation uses `crypto.randomUUID` when available, otherwise
`getRandomValues` with v4/variant bits; if both are absent use a pure-JS random
byte fallback with those same bits. It is a dedup token, never an identity.

| Event | Moment | `data` fields |
|---|---|---|
| `session_started` | First Start/Resume gesture in a page lifecycle, once | `type`, `lang`, `tier` (`great`) |
| `level_completed` | First transition to fully filled slots per occurrence | `type`, `lang`, `level_id`, `tier` (`great`), `attempts`, `duration_ms`, `score`, `max_score` |

The `tier` field is the constant value `great`; there is no learner-selectable
tier. No legacy MVP-completion mapping is required.

`score` is number of filled positions and `max_score` word length; completion
therefore has equal values, not a penalized child-facing grade. Duration is
active milliseconds, excluding hidden/manual pause and feedback. No summary
collection is used in v1. Enforce serialized UTF-8 message size strictly less
than 65,536 bytes and JSON-finite values. An invalid/oversized message is
dropped with a diagnostic; the game must not retry it or block.

## 9. Modules and implementation order

| Module | Goal and tasks | Depends on | Measurable exit criterion |
|---|---|---|---|
| M1 Toolchain/content | Scaffold React/TypeScript; lock dependencies; implement schema, fixtures, media validator and local-path audit | Approved proposed decisions | Valid fixture passes; each invalid fixture fails with field/path; typecheck passes |
| M2 Domain | Implement tiles, reducer, cycles, injectable RNG/clock and completion guards | M1 | D-02/D-05 invariant tests pass, including BOOK and one-level cycle |
| M3 Offline services | Implement loader, audio sequencing, bounded errors, persistence and diagnostics | M1; M2 for snapshot shape | `file://` load/restore/failure tests pass; no indefinite loading |
| M4 Static UI foundation | Implement responsive puzzle presentation and pointer/tap/keyboard adapters as a build step | M2, M3 | Static interaction foundation passes UI and accessible-input cases; it is not a separate product mode |
| M5 Foils and hints | Add foil validation, disappearance and position-hint reveal to the Great puzzle | M4 | Great foil/hint cases pass, including persistence and repeated-letter coverage |
| M6 Great movement | Add FIFO lanes, tap-to-stop, pause/recycle and reduced-motion static presentation | M5 | Great movement timing/solvability tests pass on all supported viewports |
| M7 Integration/release | Implement bridge, build audits, ZIP tool, icon and device runbook | M3 for bridge; M4-M6 for complete release | Bridge contract tests and all offline/device/package gates pass |

Tests accompany each module, not just M7. M3 work independent of M2 may proceed
in parallel; persistence cannot finalize before the domain snapshot contract.

### 9.1 Approved static prototype evidence and remaining work

This is an implementation-status record, not a waiver or replacement of D-01
through D-10 exit criteria. The 2026-10-22 prototype evidence predates this
Great-only specification and does not constitute approval of Great or release.

| Module | Evidence in the current prototype | Status / unmet exit criteria |
|---|---|---|
| M1 | React 19.1.1, TypeScript 5.9.2, Vite 7.1.7, Ajv 8.17.1; Node 24.20.0/npm 11.19.0; content schema and reference/license validator; CAT, DOG, RABBIT and BIRD source pack at content version 1.4.0 with local SVG illustrations | Partial. Unit validation and focused four-level structure/path checks pass; typecheck/build pass and emitted pack matches the source. `npm run validate:content` remains blocked by missing CAT/DOG/BIRD indexed letter recordings, `assets/fonts/reader.woff2` and complete license records for supplied animal audio. Individual invalid-fixture coverage is incomplete. |
| M2 | Pure reducer, value-based duplicate matching, attempts, random wrong-tile relocation, historical foil removal/hints, per-user snapshot validation, cycle order and completion marker; six domain and four progress tests | Historical static-core behavior is present; full injected-clock/invariant matrix and all F-01-F-10 fixture coverage remain outstanding. |
| M3 | Bounded XHR content loader, current-level audio cue availability checks, serialized HTML audio cues with watchdog, local progress/settings, and fire-and-forget bridge envelope | Partial. Current-level word, letter and shared correction cues are checked independently; unavailable state is level-scoped and browser playback blocks are distinguished. Three focused audio-service tests, typecheck, unit suite and build pass. HTTP development still uses XHR rather than the specified fetch path; broader preload settlement, hidden-page audio suspension (the active clock pauses), component/browser failure-generation tests and device checks remain outstanding. `sub_app_id` is a development placeholder pending Q-02. |
| M4 | At the time of prototype evidence, responsive static UI, pointer capture, 8 px threshold, clamping, center hit-testing, tap/keyboard placement, live status and a historical MVP/Better tier control | Focused browser checks pass. This historical evidence is not normative. Full viewport, focus/screen-reader, contrast, cancellation and automated component/E2E acceptance remains outstanding. |
| M5 | Historical static prototype displayed per-position hints and removed foils; these mechanics are retained in the Great specification | Focused behavior is present. Full T-09/T-10 and regression suite remains outstanding. |
| M6 | Great moving lanes, tap-to-stop selection, pause, reduced-motion static presentation and FIFO recycle scheduler are implemented; focused scheduler tests cover 12 tiles at lane widths 320, 568, 768 and 1024 CSS px. | Partial. Full Great drag/recycle/persistence, viewport/device, performance and acceptance coverage remain outstanding. |
| M7 | Bridge envelope generation and call boundary are implemented | Partial. Release audit, ZIPs, icon, release configuration and device/container evidence are not implemented. |

Commands currently present in `package.json` are:

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run test:unit`
- `npm run validate:content`

The required `lint`, `build:standalone`, `test:e2e`, `audit:standalone` and
`package` commands are not present. The lockfile was created and a clean
install passed with `--ignore-scripts --no-audit --offline`; the documented
plain `npm ci` was not run. The production build and `file://` smoke check
succeed, but the content audit correctly blocks a release. npm reported five
advisories during installation; the registry audit request timed out, so their
details and remediation are unknown.

### 9.2 Great implementation evidence recorded 2026-10-27

The current Great implementation adds a pure two-lane scheduler with 8,000 ms
left-to-right travel, alternating lane opportunities, queue-tail recycling and
stopped-tile release/requeue behavior. The React presentation includes static
Ready previews, pause/resume, keyboard-focus pause and a stationary pool when
reduced motion is requested. Great is the only selectable implementation;
foils are always instantiated and reveal the dropped position's hint.

`tests/movement.test.ts` adds four focused cases for initial lane order and
movement, stop/requeue, duplicate-free recycling, and the 30-second queue bound
with 12 tiles at lane widths 320, 568, 768 and 1024 CSS px. The final focused
run passed typecheck, all 20 unit tests and the production build. A browser
smoke check observed moving tiles, a stable pause, a stopped tile, foil removal
with one revealed hint and the reduced-motion pool.

This evidence is partial, not an M6 or release sign-off. A follow-up browser
regression check on the development server verified that Tab focus pauses
motion, pointer interaction clears that pause, and dragging A into its correct
answer slot completes without showing the keyboard-pause message. It does not
verify a production `file://` artifact or full automated input coverage. Full
D-02/D-04 invariants, save/reload and occurrence recovery, viewport and
physical-WebView coverage, measured motion performance, standalone audit,
packaging and independent QA remain outstanding. `npm run validate:content`
still fails because production audio, the shared correction cue, the reader
font and complete license records are missing. Release therefore remains
blocked.

A further browser check tapped a moving tile, confirmed its position remained
fixed across a one-second interval, then dragged that same tile in a separate
gesture into its answer slot.

### DOG artwork approval recorded 2026-11-02

The approved head-only DOG SVG replaced the earlier image at
`content/assets/images/dog.svg`; the level path and complete CC0-1.0 license
record remain unchanged. The English pack content version is 1.4.0. The user
approved the image as a sufficient depiction of a dog. SVG/XML and license
checks passed, as did all 20 unit tests and the production build; SHA-256
checks confirmed the emitted DOG SVG and language pack match their sources.
`npm run validate:content` remains blocked by absent CAT/animal audio, shared
correction audio, reader font and complete license records. This approval is
for visual depiction only: the SVG remains repository-only placeholder media
until the independent production review in T-31 passes.

## Part II - Non-functional requirements

## 10. Quality, safety and diagnostics (D-08)

- Support visible CSS viewports at least 320x568 portrait and 568x320 landscape,
  including tablet sizes and orientation changes; use 44x44 px minimum
  interactive targets, safe-area insets and no off-screen manual tiles.
- On the approved baseline device, p95 pointer-to-visual response <=100 ms over
  100 measured moves; Great animation p95 frame interval <=33.4 ms over 60
  seconds. Record model, OS, WebView version, content and measurement method.
- Pin supported Android System WebView and iOS WKWebView versions during
  device agreement; test current desktop Chromium for development. Do not
  claim old WebView support without evidence. Startup <=10 seconds is D-06.
- Bundle all runtime code, assets and fonts. No external SDKs, CDN links,
  feature flags, trackers, service workers or remote config; exclude forbidden
  modules at build time, not just with runtime guards.
- Treat JSON/query/storage as untrusted input; render strings as text, never
  injected HTML. No dynamic evaluation. Do not log raw user IDs or snapshots.
- Diagnostics use stable codes (`CONTENT_INVALID`, `ASSET_LOAD_FAILED`,
  `AUDIO_UNAVAILABLE`, `BOOT_TIMEOUT`, `SAVE_UNAVAILABLE`, `SAVE_INVALID`,
  `BRIDGE_FAILED`, `EVENT_INVALID`) and sanitized context. Warn at most once
  per identical failure per page; critical load errors expose Retry. Bridge
  absence, mute and ordinary wrong answers are not errors.
- Treat visibility, manual pause, settings, keyboard lane focus and feedback
  as independent pause reasons. Only resume clocks/motion when no applicable
  reason remains; feedback sequencing may continue while the feedback reason
  itself prevents gameplay. A hidden page suspends feedback as well.
- Accessibility: visible focus, keyboard/tap alternatives, live announcements,
  text contrast >=4.5:1, non-text/focus >=3:1, feedback not dependent on color
  or audio, reduced motion and no flashing >3 times per second.
- No child names, birth dates, location or device fingerprints. Only the
  container's opaque identity is passed back to that container. Content must
  have documented redistribution rights.

## Part III - Implementation guide

## 11. Stack, layout and lifecycle

Proposed stack: React + strict TypeScript for maintainable UI/domain boundaries,
Vite with `base: './'` and `build.sourcemap: false`, CSS/SVG for lightweight local
animation, Vitest/Testing Library for unit/components, Playwright for browser
flows, and JSON Schema/Ajv for runtime/build content validation. Avoid adding a
game engine, backend or WASM dependency without a demonstrated requirement.

| Proposed path | Responsibility | Lifecycle |
|---|---|---|
| `docs/`, `.github/`, source manifests and lockfile | Specifications, workflow and reproducible tooling | Versioned |
| `src/domain/` | Pure puzzle/cycle/snapshot models | Versioned |
| `src/services/` | Loader, audio, storage, bridge and diagnostics | Versioned |
| `src/components/`, `src/styles/` | Presentation and input adapters | Versioned |
| `content/lang/english/`, `content/assets/`, `content/licenses.json` | Authored JSON, language audio, shared images/fonts/audio, license manifest | Versioned; originals retained |
| `scripts/`, `tests/fixtures/`, `tests/unit/`, `tests/e2e/` | Validation, packaging and repeatable verification | Versioned |
| `node_modules/`, `dist/`, `.vite/`, `coverage/`, `test-results/`, `artifacts/packages/` | Installed/generated output | Ephemeral; ignored and reproducible |
| Browser `localStorage` | On-device progress/settings | Durable per device; no cloud backup in scope |
| Approved release evidence/archive store | Signed-off ZIP hashes, reports and device review records | Durable; externally backed up by release owner |

Keep language files outside the engine archive; copy shared content/license
manifest into engine output and the language subtree into a separate staging
directory. Tests/validation fixtures are not production language content.

## 12. Clean-machine runbook and required commands (D-09)

Implementation must supply these scripts and document the exact supported
Node LTS/npm versions in `package.json` engines and its README. Choose versions
at M1 and commit `package-lock.json`; no unpinned "latest" installs.

```text
npm ci
npm run validate:content
npm run typecheck
npm run lint
npm run test:unit -- --run
npm run build:standalone
npm run test:e2e
npm run audit:standalone
npm run package
```

`test:e2e` must test production artifacts, including `file://`, not just Vite.
Its documented browser-install prerequisite is `npx playwright install chromium`
using the locked Playwright dependency. `build:standalone` stages engine plus
the selected pack for local testing. `audit:standalone` inspects emitted output
for network paths, root-relative references, maps, missing media and forbidden
runtime modules. Packaging refuses an audit/content failure.

Local development may use `npm run dev`; this is never proof of offline support.
No runtime credentials/environment secrets are needed. Approved engine slug and
`sub_app_id` are build configuration, not learner-supplied query overrides.
Before approval use explicit development placeholders; packaging for release
must reject placeholders.

## 13. Packaging and authorized delivery (D-10)

Choose Layout A: `<engine>-core.zip` contains root `index.html`, bundled JS/CSS,
release-selected shared assets and `content/licenses.json`, with no wrapper
directory, `lang/`, source maps or dev files. `<engine>-lang-english.zip`
contains only `lang/english/levels.json` and `lang/english/audios/`. They extract
into one directory with no path collisions. No core/book ZIP or `cr_book` is
needed.

The repository-only illustrations `content/assets/images/dog.svg`,
`content/assets/images/rabbit.svg` and `content/assets/images/bird.svg` are
placeholders, not approved production media. Keep them out of release archives
unless they are selected as production content and pass T-31 review.

Use MP3/WAV audio, true-format PNG/JPEG/WebP/SVG images and local WOFF2 font.
Provide a separate true-PNG square icon, recommended 512x512 and never below
192x192, outside the language ZIP. Archive names use the operator-approved
stable lowercase slug. Publish SHA-256 hashes and versions for both archives.
Avoid absolute paths, traversal entries and symlinks in packages.

Operator handoff, only after explicit authorization:

1. Obtain CMS URL, personal token held outside the repo, approved identity and
   catalog language `english`. Confirm reservation is permanent before creating
   an engine slug; reuse its established slug for later versions.
2. Reserve if necessary, upload engine with title/URL template and
   `hasCoreLevel: false`, then upload English pack plus tile icon.
   URL template query is `?cr_lang={lang}`; the container appends `cr_user_id`.
3. For ZIPs over approximately 10 MB use chunked upload: declare total size,
   sequential 0-based chunks of 4-8 MB (max 16 MB decoded), then upload by
   `uploadId` with SHA-256. Max ZIP size is 200 MB; abort abandoned sessions.
4. Verify development inventory/manifest and preview extracted content.
5. Coordinate authorized promotion of engine then language; confirm actual
   permission with staff because the source contract describes both edit-token
   capabilities and staff-only promotion restrictions.
6. Coordinate Curious Learning staff **Publish**. Promotion is not delivery.
   Verify the published manifest/version on a device; retain earlier known-good
   versions for staff-controlled rollback.

This repository does not implement CMS endpoints or automate irreversible
reservations, promotion or publishing.

## Part IV - Decisions and maintenance

## 14. Open questions

| ID | Question / owner | Blocks |
|---|---|---|
| Q-01 | Product owner: formal approval of proposed limits, timings, scoring and Draft behavior; the user validated Great-only scope including foils/hints on 2026-10-26, but the product owner remains unassigned | Product/release approval |
| Q-02 | Curious Learning: approved engine slug, `sub_app_id`, language catalog entry and promotion permissions | Release packaging/upload |
| Q-03 | Content owner: provide production level set, contextual recordings, illustrations, icon, font and redistribution evidence | Production content gate |
| Q-04 | Engineering/QA: select baseline device and minimum OS/WebView versions; Node.js 24.20.0/npm 11.19.0 selected for the prototype on 2026-10-22 | Performance/support claims; device and OS/WebView selection |
| Q-05 | Sponsor: assign product approver, independent QA owner, human architecture/security reviewers and facilitated usability review | Approval/release |

## 15. Resolved and proposed decisions

| Date | Decision | State / rationale |
|---|---|---|
| 2026-10-21 | React/TypeScript offline web game, repository-level workflow | Confirmed by sponsor; resolves native-workshop versus current container target. Earlier three-tier direction is superseded. |
| 2026-10-26 | Great is the sole product implementation and includes foil removal/hint reveal plus moving tiles | User-validated task scope; formal product approval remains outstanding |
| 2026-10-21 | Layout A engine + English language pack | Proposed; no shared book/content-unit tier is needed |
| 2026-10-21 | Compare duplicate letters by value; contextual audio by destination index | Proposed; repeated letters must remain solvable |
| 2026-10-21 | Runtime-rendered letter glyph hints, not a required authored hint sprite | Proposed deviation from brief's media consideration; same per-position clue, avoids sprite/language coupling |
| 2026-10-21 | Static Great alternative under reduced motion; no failure timer | Proposed; preserves accessibility and unlimited practice |
| 2026-10-21 | Local snapshots and best-effort at-most-once bridge calls across reload | Proposed; no bridge acknowledgment or game-side retries exist |
| 2026-10-22 | Node.js 24.20.0 LTS/npm 11.19.0 | Selected by the user for the prototype; device and minimum OS/WebView versions remain open |

Out of scope is defined in the PRD. Lessons log:

- 2026-10-22: Keep synthetic schema/unit fixtures distinct from releasable
  content; the local pack can be schema-valid while the media/license audit
  still blocks release.
- 2026-10-22: A successful `file://` browser smoke check demonstrates local
  JSON/image boot and interaction only; it does not replace the production
  artifact, outbound-request, device or container gates.

### Specification lifecycle

Each new task plan reads the four specs and records applicable P/D/U/T IDs,
dependencies, acceptance tests and any conflict/open question. Approve intended
behavior changes before implementation; do not retrofit a failing test into a
new requirement. After implementation and testing, request explicit human
approval. After approval, offer a separate **Update specifications for
<approved task>** task; do not start it or a new chat automatically.

That task reconciles affected specs in product -> behavior -> presentation ->
verification order. Update each altered spec's Version, Status and Last update
date, and add a newest-first bottom change-log entry in the exact form
`YYYY-MM-DD — <author> — <one-sentence description of change>`, using the actual
calendar date. Use patch/minor/major increments for clarification/additive/
breaking changes; preserve these canonical filenames. Draft -> In review ->
Approved are human gates, not automatic transitions; accepted docs needing
behavior changes return to In review. Do not imply tested code means approved
specs. Leave untouched specs' metadata unchanged.

Completion report lists each affected document, old/new metadata, all added,
removed and replaced requirements/decisions (say "None" if none), tests/evidence
and outstanding approvals. A no-impact review reports no changes; do not bump
dates or invent a change-log entry for untouched specs.

## Spec change log

2026-11-02 — Copilot — Specified and implemented current-level audio completeness, warning recovery on level changes, stale-result handling and playback-block distinction.
2026-11-02 — Copilot — Recorded the user-approved DOG depiction, active SVG replacement and content-version 1.4.0 while retaining T-31 and release gates.
2026-11-02 — Copilot — Recorded the simplified bird artwork, final image alt text and content-version 1.3.0 while retaining media and release gates.
2026-11-02 — Copilot — Recorded the revised frontal bird illustration and required content-version bump while retaining missing-media and release gates.
2026-11-02 — Copilot — Recorded implementation evidence for the four-level English animal pack while retaining missing-media, release and approval gates.
2026-11-02 — Copilot — Specified the planned DOG, RABBIT and BIRD content records, stable IDs, two-foil counts and outstanding audio/release gates.
2026-11-02 — Copilot — Marked the new animal illustrations as repository-only placeholders and required their exclusion from release archives until production review.
2026-10-27 — Copilot — Specified immediate pointer-down acquisition for moving tiles and recorded tap-stop-then-drag browser evidence.
2026-10-27 — Copilot — Clarified stable pointer capture and separated pointer-generated focus from keyboard lane pause; recorded browser regression evidence.
2026-10-27 — Copilot — Recorded partial Great scheduler, presentation and test evidence without claiming module exit or release approval.
2026-10-26 — Copilot — Reconciled the behavior and build sequence to one Great implementation with foils/hints and moving tiles; formal product approval remains outstanding.
2026-10-26 — Copilot — Retired MVP as a runtime tier, made Better the default minimum, and defined legacy save/report handling; formal product approval remains outstanding.
2026-10-22 — Copilot — Recorded prototype implementation evidence, selected toolchain and remaining module/release gaps without changing normative contracts.
2026-10-21 — Copilot — Added the initial draft behavioral contracts, module sequence, offline architecture, delivery runbook, explicit decisions and specification lifecycle; removed nothing.
