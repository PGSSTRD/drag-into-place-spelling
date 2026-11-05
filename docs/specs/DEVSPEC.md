# DEVSPEC - Drag Into Place Spelling

**Version:** 2.0.20<br>
**Status:** Draft - Stage 6 audio/loading/failure-recovery implementation human-approved; remaining browser variants, audio-adapter compliance, device, independent QA, audio distribution and release gates outstanding<br>
**Last update:** 2026-11-05<br>
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
1-8-letter and maximum-four-foil limits. The current pack uses `content_version` `1.4.1`; it includes the local Lexend font and the simplified
bird SVG, with the side wings and outer feather shapes removed, and the
user-approved head-only DOG illustration with floppy ears and a symmetric
muzzle. The user approved the DOG image as a sufficient depiction of a dog on
2026-11-02. This visual approval does not constitute production-media approval
or waive T-31.
All 20 referenced MP3s are present in the source tree: four full-word
recordings and 16 indexed letter clips for CAT, DOG, RABBIT and BIRD.
Each has a complete record in `content/licenses.json`, using the local
identifier `LicenseRef-ElevenLabs-Free-Plan` rather than a CC0 claim.
The contributor reports that all MP3s were generated using ElevenLabs'
free plan. ElevenLabs' publication guidance checked on 2026-11-03 states
that these recordings have no commercial license and that noncommercial
publication requires "elevenlabs.io" or "11.ai" in the title.
The manifest records this restriction but does not itself fulfill title
attribution or establish distribution approval. See
[ElevenLabs publication guidance](https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform)
and [terms](https://elevenlabs.io/terms).
The user approved the manifest update on 2026-11-03, not publication or
release. The Lexend font and its OFL license notice are now bundled; contextual
pronunciation, applicable terms and publication attribution still require
T-31 review. The SVGs remain repository-only placeholders and are not release
media unless selected and approved through T-31.

Reject missing/unknown fields, wrong types, invalid counts, duplicate level
IDs and ambiguous legacy schemas. Report JSON field path and reason. This
extends the brief's illustrative level object into a precise schema; a raw
array of legacy level objects requires an explicit conversion tool, not
guessing at runtime. Required shared media are
`assets/audios/incorrect.wav` and `assets/fonts/lexend-v26-latin-regular.woff2`.
The user selected and authorized integration of the supplied Lexend Latin
regular WOFF2 on 2026-11-03. Load it locally as the CSS family `Lexend`,
normal style and weight 400, with a system sans-serif fallback and swap
display. Retain its copyright and OFL-1.1 license in
`assets/fonts/OFL-Lexend.txt` and record attribution in `content/licenses.json`.
This replaces the placeholder font filename, not historical validation
records. Animation is implemented locally in CSS/SVG; Rive is not required.

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

Before initial Start or saved-progress Resume, letters and answer slots are
noninteractive previews. Guard pointer down/move/up, tile acquisition,
selection/cancellation and drop entry points with the current started state,
in addition to disabling controls. Input must not select or move a tile,
capture a pointer, change slots/hints/attempts, or produce placement feedback
before "Let's spell!" or "Keep going!" is activated. Preview tile focus must
not change the keyboard-motion pause state. Start/Resume enables the existing
input paths; it is not merely a movement toggle.

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
current cycle index, current occurrence counter (`occurrence_counter`), level
ID, slot-to-tile IDs (or null), removed foil IDs, revealed hints, attempts,
elapsed active milliseconds, phase (`playing`/`completed_pending_advance`) and
`completion_recorded`. The domain exposes the counter as `puzzleOccurrence`.
Settings (mute) use a user-scoped settings key. Moving positions, pointer
state, audio buffers and animation progress are ephemeral; restore an
incomplete Great puzzle with all remaining tiles requeued.

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
| M1 | React 19.1.1, TypeScript 5.9.2, Vite 7.1.7, Ajv 8.17.1; Node 24.20.0/npm 11.19.0; content schema and reference/license validator; CAT, DOG, RABBIT and BIRD source pack at content version 1.4.1 with local SVG illustrations; all 20 referenced MP3s and restricted-license records; local Lexend regular WOFF2 and OFL notice | Partial. On 2026-11-03, content validation, typecheck/build, all 23 existing unit tests and source/output hash checks passed; the production `file://` page decoded and applied Lexend to page and tile text. Stage 1 subsequently added schema/path fixture checks and the browser foundation in section 9.3; case-exact/true-format and full M1 exit coverage remain outstanding. ElevenLabs free-plan distribution/title-attribution review and contextual pronunciation review remain outstanding. |
| M2 | Pure reducer, value-based duplicate matching, attempts, random wrong-tile relocation, historical foil removal/hints, per-user snapshot validation, cycle order and completion marker; six domain and four progress tests | Historical static-core behavior is present; full injected-clock/invariant matrix and all F-01-F-10 fixture coverage remain outstanding. |
| M3 | Abortable HTTP fetch and bounded local XHR, whole-boot/image preloading and Retry generation guards, occurrence-scoped audio availability, serialized HTML audio with watchdog/mute, local progress/settings and bridge envelope | Partial. Stage 6 verifies listed boot, independent preload, Retry, playback-policy and stale-result variants on HTTP/file; Stage 4 verifies mocked pause/visibility. HTML audio failures settle as unavailable without creating D-06's literal one-frame silent buffer; that adapter requirement, broader variants and device checks remain open. `sub_app_id` is a development placeholder pending Q-02. |
| M4 | At the time of prototype evidence, responsive static UI, pointer capture, 8 px threshold, clamping, center hit-testing, tap/keyboard placement, live status and a historical MVP/Better tier control | Focused browser checks pass. This historical evidence is not normative. Full viewport, focus/screen-reader, contrast, cancellation and automated component/E2E acceptance remains outstanding. |
| M5 | Historical static prototype displayed per-position hints and removed foils; these mechanics are retained in the Great specification | Focused behavior is present. Full T-09/T-10 and regression suite remains outstanding. |
| M6 | Great moving lanes, tap-to-stop selection, pause, reduced-motion static presentation and FIFO recycle scheduler are implemented; focused scheduler tests cover 12 tiles for 100 passes at lane widths 320, 568, 768 and 1024 CSS px, and Stage 4 browser checks exercise movement and pause on HTTP/`file://`. | Partial. Full Great drag/recycle/persistence, viewport/device, performance and acceptance coverage remain outstanding. |
| M7 | Bridge envelope generation and call boundary are implemented | Partial. Release audit, ZIPs, icon, release configuration and device/container evidence are not implemented. |

Commands currently present in `package.json` are:

- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run test:unit`
- `npm run validate:content`
- `npm run test:e2e` (with an automatic production-build prerequisite)
- `npm run test:e2e:install`

The required `lint`, `build:standalone`, `audit:standalone` and `package`
commands are not present. At the 2026-10-22 prototype checkpoint, the clean
install used `--ignore-scripts --no-audit --offline`, plain `npm ci` was not
run, missing media blocked content validation, and npm reported five
advisories whose details could not be retrieved. Preserve that historical
evidence; current stage 1-6 checks and their narrower approvals are in
sections 9.3-9.8. No clean-machine install or security-review gate is inferred
from them.

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

### MP3 license-manifest approval recorded 2026-11-03

The user approved adding all 20 source MP3s to `content/licenses.json` with
ElevenLabs free-plan provenance and restrictions. Focused inventory checks
confirmed exactly one complete entry per MP3, no duplicate paths and
preservation of all five existing non-MP3 records. `npm.cmd run build`
passed typecheck and production compilation; source and emitted
`dist/licenses.json` SHA-256 hashes matched. `git diff --check` passed.
`npm.cmd run validate:content` reported only the absent reader font and its
license record. No application unit/browser tests or pronunciation review
were run for this metadata-only update. Earlier dated missing-audio evidence
above is historical; this inventory supersedes it, without approving
publication, independent QA or release.

### Lexend integration approval recorded 2026-11-03

The user approved integrating the supplied Lexend Latin regular WOFF2.
CSS loads it locally with `@font-face`, weight 400 and swap display; the
existing `font-synthesis: none` is preserved, and no bold font file is claimed.
The validator now requires the actual filename. Copyright, OFL-1.1 attribution
and the full upstream notice are bundled. The shared-media addition bumps
the English pack to content version 1.4.1 without altering level data.
Content validation, typecheck/build, all 23 unit tests and whitespace checks
passed. Source/output hashes matched for font, OFL notice, manifest and pack;
the emitted CSS font URL is relative and resolves. A production `file://`
browser check confirmed a loaded Lexend face and Lexend as the primary
page/tile family. This supersedes historical missing-font evidence but does
not pass full viewport, accessibility, physical-device or release review.

### Started-state guard approval recorded 2026-11-03

The user approved explicit current-started-state checks in pointer handlers,
acquisition/drop functions, tile click/focus and answer-slot click handling.
Build/typecheck, all 23 existing unit tests and whitespace checks passed.
Production `file://` checks in reduced-motion mode verified that attempted
pointer drag, tile selection and answer clicks leave new and restored
previews unchanged; correct placements work after Start/Resume and restored
placements remain intact. Tests used isolated progress storage, cleaned up
afterward. These browser checks were performed interactively, not added as
automated repository tests. Full moving-lane/device acceptance was not rerun.
The browser also reported an unavailable shared correction cue; these checks
do not establish audio acceptance or resolve that warning.

### 9.3 Approved browser acceptance stage 1: harness and fixtures (2026-11-03)

Source task: [browser acceptance suite](../tasks/draft/browser-acceptance-suite.md),
stage 1 only. The user explicitly selected "Approve stage 1" after validation,
then separately authorized specification reconciliation. This implements the
M1 testing foundation for D-01/D-09, with fixtures for M2 invariants and M3
offline/audio/storage/bridge tests; it does not change module dependencies or
approve their remaining exit criteria.

The locked `@playwright/test` 1.64.1 harness runs Chromium against copies of
the production `dist` output over HTTP and `file://`. Each test has an
independent context/storage and temporary staging folder. The HTTP server is
suite-owned, bound to loopback on an allocated port; the file project starts
no server and uses `--allow-file-access-from-files` for desktop local-module/
XHR loading. Teardown closes only owned connections and removes staging,
including on assertion failure. Authored content and existing servers are
not modified. One worker, zero retries and a one-failure stop enforce
incremental execution.

Fixture builders and integrity checks live under `tests/fixtures/`; browser
smoke cases and setup live under `tests/e2e/`. Pre-boot helpers supply seeded
RNG, deterministic v4 UUIDs retained across reloads, opt-in paused monotonic
time, isolated progress/settings, storage faults, bridge stubs, XHR stalls and
staged asset faults. Mock media is isolated from native loading and exposes
per-instance delayed callbacks; separate real local WAV/font checks preserve
decode/playback evidence. Generated SVG/tone assets are synthetic CC0 inputs
with staging notices; Lexend retains its OFL notice. These tones do not prove
pronunciation, and current-format snapshots do not resolve the specification/
serializer occurrence-counter and completion-phase differences.

Validation passed: production typecheck/build, source content validation for
four English levels, 63 unit tests (23 existing plus 40 fixture integrity
checks), and 30 sequential browser smoke executions (15 HTTP, 15 file; no
skips, retries or flaky results). The final JSON report records 30 expected
passes and zero unexpected results. No generated staging folders remained
after teardown. These results approve stage 1 implementation only, not full
T-01-T-33, the U-05 scenarios, independent QA, physical devices, performance,
container integration, packaging, media distribution or release.

### 9.4 Approved browser acceptance stage 2: content validation and core spelling (2026-11-04)

Source task: [browser acceptance suite](../tasks/draft/browser-acceptance-suite.md),
stage 2, covering T-01-T-10 and their applicable P-01/P-02/P-03/P-05/P-07,
D-01/D-02/D-03/D-05/D-06 and U-01-U-05 requirements. The user explicitly
approved the tested stage 2 implementation on 2026-11-04 and then authorized
this separate specification reconciliation. This approves the stage 2 task
only; it does not approve these Draft specifications, complete the remaining
acceptance variants or authorize release. No product behavior or module
dependencies changed.

`tests/e2e/core.spec.ts` exercises production builds over HTTP and `file://`.
It rejects the invalid schema/path fixture matrix without entering a partial
playable state, loads F-11 and a local image, verifies seeded CAT/BOOK/ELEPHANT
tile permutations and 12-tile geometry at all six specified viewports, and
checks mouse/touch/keyboard spelling, wrong and neutral drops, exchanged BOOK
O identities, completion cue order, seeded F-04/F-11 cycles, one-level replay,
foil removal and hint suppression. `tests/domain.test.ts` checks 1,000 seeds
across F-01/F-02/F-03. Stable `data-tile-id` attributes make tile identity
observable to browser assertions without changing visible or accessible text.
The [stage 2 coverage manifest](../../tests/e2e/coverage.json) maps each check
to its P/D/U/T references, fixture, transport, input method, motion mode and
result.

The final complete browser run passed 60 executions (30 HTTP and 30
`file://`, with no skips or retries); all 64 unit tests, authored content
validation, typecheck, production build and whitespace checks passed. This is
focused evidence, not a declaration that all T-01-T-10 groups passed: the
manifest keeps T-01, T-03, T-04, T-05, T-07 and T-09 partial for their
remaining variants. Wrong-case staged-media verification, complete input
reacquisition/cancellation coverage, one/no-cell relocation boundaries,
failed/blocked/pending/stale completion audio, and neutral foil drops remain
open. Full moving-tile acceptance, persistence/fault/accessibility/offline/
bridge/release cases, physical devices, independent QA and media
pronunciation/distribution review also remain outstanding.

### 9.5 Approved browser acceptance stage 3: pointer, touch and keyboard interaction (2026-11-04)

Source task: [browser acceptance suite](../tasks/draft/browser-acceptance-suite.md),
stage 3, covering P-02/P-04/P-06, D-02/D-03/D-04 and U-01-U-05. The user
explicitly approved the tested implementation on 2026-11-04 and authorized
this separate specification reconciliation. Approval is limited to stage 3;
this specification remains Draft, and full acceptance, device, independent-QA,
audio distribution and release gates remain open. No behavior or module
dependencies changed: the work exercises M2 domain rules through M4 input
adapters and M5/M6 foil and moving-tile behavior.

The [stage 3 interaction manifest](../../tests/e2e/interaction-coverage.json)
maps 15 production-browser cases to their requirements, fixtures, transports,
input methods and motion modes. The full Playwright run passed 90 executions
(45 HTTP and 45 `file://`), including all 15 stage 3 cases on each transport.
The tests cover correct mouse/touch placement, keyboard and tap-select CAT/BOOK
completion, neutral cancellation paths, moving-tile capture/stop/drag,
threshold and clamping behavior, keyboard focus and announcements, and resize
during an active drag. The related input/cancellation/focus fixes are recorded
with the implementation evidence, not as changes to D-02/D-03/D-04.

Coverage remains partial for T-03 (no direct cross-modality reacquisition
attempts), T-17 (second-pointer, shared-edge, exhaustive edge-offset and
moving-lane touch-drag variants), and T-19 (moving-motion, feedback-state and
actual hidden-page variants). Physical-device touch and human screen-reader
review are separate gates; this evidence does not establish full T-01-T-33
acceptance or release.

### 9.6 Approved browser acceptance stage 4: movement and pause behavior (2026-11-04)

Source task: [browser acceptance suite](../tasks/draft/browser-acceptance-suite.md),
stage 4, covering P-06; D-02/D-03/D-04/D-08; and U-02/U-03/U-04. The user
explicitly approved the tested implementation on 2026-11-04 and authorized
this separate specification reconciliation. Approval is limited to stage 4;
this specification remains Draft, and full acceptance, device, independent-QA,
audio distribution and release gates remain open. No normative behavior or
module dependencies changed: the work exercises M2 movement rules through M4
input/pause adapters and M5/M6 Great behavior, with M3 audio suspension.

The [Stage 4 movement manifest](../../tests/e2e/movement-coverage.json) maps
the production-browser cases and their partial variants. The full Playwright
run passed 100 executions (50 HTTP and 50 `file://`), including all five Stage
4 cases on each transport. F-03's valid saved snapshot selects its eight-letter
ELEPHANT level so the browser recycling case exercises all 12 target/foil
tiles; browser checks cover lane assignment, travel, spacing, unique IDs and
reappearance within 30 seconds at 320x568. Unit tests cover 100 passes per
tile at lane widths 320, 568, 768 and 1024 CSS px, plus no requeue after a tile
is consumed.

Pause checks cover manual position freeze, blocked slot input, paused-time
exclusion, keyboard-focus pause, pointer resume, simulated hidden-page
feedback/audio suspension and composition of manual/hidden pause reasons.
All 66 unit tests, authored content validation, production typecheck/build and
`git diff --check` passed. T-11 remains partial for stop/drag, correct/foil/
cancel requeue outcomes and the complete queued-wait viewport matrix. T-12
remains partial for pointer-generated focus, reduced-motion changes and other
variants; T-19's hidden-page simulation is not physical-device evidence, and
Stage 4 did not complete T-20's visual capture/measurement cases. This evidence
does not establish full T-01-T-33 acceptance or release.

### 9.7 Approved browser acceptance stage 5: persistence and progression (2026-11-04)

Source task: [browser acceptance suite](../tasks/draft/browser-acceptance-suite.md),
stage 5, covering P-03/P-09; D-02/D-05; U-02/U-03; and T-08/T-13/T-14/T-15.
The user explicitly approved the tested implementation and authorized this
separate specification reconciliation. Approval is limited to stage 5; this
specification remains Draft, and full acceptance, device, independent-QA,
audio distribution and release gates remain open. No product behavior or
module dependencies changed: the work exercises M2 occurrence/cycle state,
M3 snapshot persistence, and M4-M6 application and progression integration.

The [Stage 5 persistence manifest](../../tests/e2e/persistence-coverage.json)
maps browser and unit evidence. The full Playwright run passed 120 executions
(60 HTTP and 60 `file://`), including all ten Stage 5 cases on both transports.
The implementation serializes the D-05 occurrence counter as
`occurrence_counter` and the in-memory completing phase as
`completed_pending_advance`. Valid pending-completion snapshots advance once
without replaying completion telemetry; structurally invalid snapshots report
a diagnostic and start a fresh puzzle. Tests cover accepted-outcome restore,
user/mute isolation, storage denial, cycle boundaries and one-level replay.
All 68 unit tests, authored content validation, production typecheck/build and
whitespace checks passed.

T-08 remains partial because only synthetic F-04 fixtures, not the authored
F-04/F-11 packs, were cycled. T-13 remains partial for moving mid-pass recovery
and exact elapsed-time boundaries. T-14 remains partial for guest isolation
and the complete browser corruption matrix. T-15 covers the completion-marker
reload boundary; other crash windows and permitted telemetry loss remain open.
This evidence does not establish full T-01-T-33 acceptance or release.

### 9.8 Approved browser acceptance stage 6: audio, loading and failure recovery (2026-11-05)

Source task: [browser acceptance suite](../tasks/draft/browser-acceptance-suite.md),
stage 6, covering P-02/P-03/P-08/P-09; D-02/D-05/D-06/D-08;
U-02/U-03/U-05; and T-07/T-16/T-22/T-23. The user explicitly selected
"Approve stage 6" after validation and then "Start specification update" for
this separate reconciliation. Approval covers the implementation task only;
this specification remains Draft. PRD intent, normative behavior and module
dependencies are unchanged: M1 content and M2 puzzle/snapshot invariants
support M3 loading/audio services, exercised through M4-M6 application adapters.

The [Stage 6 manifest](../../tests/e2e/audio-loading-coverage.json) maps
[browser cases](../../tests/e2e/audio-loading.spec.ts) and supporting
[loader](../../tests/loadContent.test.ts) and [audio](../../tests/audio.test.ts)
unit checks. HTTP uses fetch with abort/timeout; local files use nonempty
text XHR with status 0/200 validation. A whole-boot 10,000 ms deadline includes
required-image preloading, while audio/font settlement is bounded independently.
In-document Retry invalidates the old boot generation; captured late callbacks
cannot replace the retried puzzle. Required JSON/image errors remain fatal;
audio and font failures preserve play with the specified notice or diagnosed
system-font fallback.

Audio checks cover destination-indexed cues, final-letter-before-word ordering,
the 1,200 ms celebration and 4,000 ms playback watchdogs, successful word
completion after animation, and single advancement under muted, failed, blocked,
pending and stale-callback conditions. Muting active feedback stops playback
and suppresses queued sound. Required-cue failures persist despite another cue
succeeding; complete destinations and new occurrences of the same level do not
inherit prior failures. Earlier-occurrence availability/playback results cannot
alter the current notice. Policy blocks offer Enable sound rather than an
unavailable-media warning.

The final production-build run passed 188 executions (94 HTTP and 94
`file://`), including all 68 Stage 6 executions (34 per transport), with zero
failures, skips, retries or flaky results. All 82 unit tests, authored
four-level content validation, typecheck/build, documentation link/reference
checks and whitespace checks passed. The manifest retains build hashes,
base revision plus uncommitted changes, seed, versions, diagnostics and the
generated report location. Initial preload synchronization and viewport-scroll
measurement assertions were corrected before the final clean run.

These are desktop Chromium results, not baseline-device performance,
physical WebView/container or production-pronunciation evidence. The HTML
audio failure path returns `unavailable`; it does not create D-06's literal
one-frame silent buffer, which remains an explicit implementation gap rather
than a waived requirement. Full diagnostic-deduplication/adapter compliance,
remaining T-22 Settings/preview/focus variants, the complete acceptance matrix,
independent QA, media distribution and release gates remain open.

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
| `node_modules/`, `dist/`, `.vite/`, `coverage/`, `test-results/`, `playwright-report/`, `artifacts/packages/` | Installed/generated output | Ephemeral; ignored and reproducible; preserve required release evidence separately |
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

Implemented stage 1-6 browser commands (not a substitute for the complete
release sequence above):

```text
npm run test:e2e:install
npm run test:e2e -- --project=http
npm run test:e2e -- --project=file
npm run test:e2e -- --project=http --grep "stage 2"
npm run test:e2e -- --project=file --grep "stage 2"
npm run test:e2e -- --project=http --grep "stage 3"
npm run test:e2e -- --project=file --grep "stage 3"
npm run test:e2e -- --project=http --grep "stage 4"
npm run test:e2e -- --project=file --grep "stage 4"
npm run test:e2e -- --grep "stage 5"
npm run test:e2e -- --grep "stage 6"
```

`test:e2e:install` invokes the locked `playwright install chromium` command;
the browser download needs internet once. `test:e2e` builds with
`tsc --noEmit && vite build` before running both projects, unless a project
selector is supplied. No Vite development server or physical phone is needed.
On Windows, use `npm.cmd`/`npx.cmd` when execution policy blocks the PowerShell
wrappers. The [README runbook](../../README.md#browser-testing-stages-1-5-harness-content-spelling-interaction-movement-pause-persistence-and-progression)
and [Stage 6 runbook](../../README.md#stage-6-audio-loading-and-failure-recovery)
document focused reruns, fixture options and limits. The stage 2-6 coverage
manifests record listed results and remaining variants; they are not the full
acceptance manifest.
HTML and JSON reports
are generated at `playwright-report/index.html` and
`test-results/browser-results.json`; failed cases retain screenshots/traces
under `test-results/browser`. Console/server errors and runtime network API
attempts are attached per case. Later runs replace reports, so archive evidence
needed for approval separately. Static emitted-output/offline audits, complete
acceptance assertions and release packaging remain future work.

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

2026-11-05 — Copilot — Recorded the user-approved stage 6 audio/loading/recovery implementation and 188 HTTP/file executions, updated implemented tooling evidence and preserved partial acceptance and audio-adapter gaps.
2026-11-04 — Copilot — Clarified D-05's `occurrence_counter` mapping and recorded the user-approved stage 5 persistence/progression evidence and partial gates without changing behavior.
2026-11-04 — Copilot — Recorded the user-approved stage 4 movement/pause implementation and 100 HTTP/file executions, including partial T-11/T-12/T-19/T-20 gates, without changing normative behavior or module dependencies.
2026-11-04 — Copilot — Recorded the user-approved stage 3 pointer/touch/keyboard evidence, 90 HTTP/file executions and remaining partial T-03/T-17/T-19 variants without changing behavior or module dependencies.
2026-11-04 — Copilot — Recorded the user-approved stage 2 content/core-spelling browser evidence and partial T-01-T-10 limits without changing behavior or module dependencies.
2026-11-03 — Copilot — Recorded the human-approved stage 1 production HTTP/file harness, implemented browser commands, isolated fixtures and passing smoke evidence while retaining full acceptance and release gates.
2026-11-03 — Copilot — Clarified the Ready-state input guards and recorded approved implementation with focused new/saved preview checks while preserving broader input, audio and release gates.
2026-11-03 — Copilot — Recorded approved Lexend integration, content-version 1.4.1 and passing content, unit, build and file-browser checks while preserving independent QA and release gates.
2026-11-03 — Copilot — Replaced the placeholder font requirement with the user-selected local Lexend regular WOFF2, CSS loading contract and bundled OFL notice; integration validation remains outstanding.
2026-11-03 — Copilot — Recorded the approved 20-MP3 ElevenLabs free-plan manifest update and validation evidence while retaining font, attribution, distribution and release gates.
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
