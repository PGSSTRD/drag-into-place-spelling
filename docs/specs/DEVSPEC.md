# DEVSPEC - Drag Into Place Spelling

**Version:** 0.2.0<br>
**Status:** Draft - implementation in progress; release not approved<br>
**Last update:** 2026-10-22<br>
**Author:** Copilot

## 1. Authority and reading order

Implements [PRD](./PRD.md) P-01-P-12. This document owns system behavior,
contracts, implementation sequence and technical decisions. Presentation belongs
to [UISPEC](./UISPEC.md); [TESTSPEC](./TESTSPEC.md) verifies both. Test ordering
must not override the module dependencies here.

The [external container contract](../third-party-game-spec.md), v1.8, governs
integration. This spec selects its two-tier Layout A, not an optional book/core
content tier. A Foundation/MVP/Better static prototype now implements part of
the contracts below; section 9.1 records evidence and gaps. Requirements remain
normative, and this prototype is not a release candidate.

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
tier, slot-to-tile mapping, removed foil IDs, revealed-hint indices, attempt
count and active elapsed milliseconds. A new occurrence is allocated when a
new puzzle starts, even if its level ID appeared in an earlier cycle.

| Command/condition | Required result |
|---|---|
| Acquire an available tile | Reserve it for one active pointer/selection; freeze its movement |
| Acquire a locked/removed tile or a second pointer | Ignore; do not mutate state |
| Drop outside all slots or on an occupied slot | Neutral cancellation; no attempt, no hint and no negative audio |
| Drop a target onto an empty matching slot | Increment attempts once, occupy/lock that tile, positive animation and contextual audio for the destination position |
| Drop a target onto an empty nonmatching slot | Increment attempts once, negative audio and bounce to a new available pool position; no hint |
| Drop a foil onto an empty slot in Better/Great | Increment attempts once, negative audio, remove foil from this occurrence, reveal that slot's expected-letter hint |
| Cancel (`Escape`, pointer cancel, lost capture, blur, resize, hidden page) | Neutral cancellation; preserve logical availability and return/requeue tile |
| All slots filled | Enter completing state once, freeze puzzle input/motion, finish final-letter feedback, then celebrate and play full-word audio; advance once |

One accepted drop on an empty slot is one attempt. Acquiring, moving or
cancelling is not. No per-attempt analytics are emitted. Correct placements
cannot be undone. Foils are never instantiated in MVP, even if present in
content. Better and Great use the full foil array.

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

Only one drag or tap/keyboard selection may exist. A pointer movement of more
than 8 CSS px starts a drag; a shorter press-release selects a tile for
tap-to-place. Clicking/tapping an empty slot with a selected tile dispatches
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

Great uses the same content, correctness and hints as Better. Use two horizontal
lanes with at least 44 CSS px tile height and 8 px vertical separation.
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

Reduced-motion preference uses stationary shuffled cells in Great, keeping
foils/hints and correctness unchanged. A facilitator may pause/resume motion;
pause freezes the activity until Resume. There is no failure on timeout.

## 6. Progression and persistence (D-05)

Shuffle the level-ID list once per cycle and visit each exactly once. At a
cycle boundary reshuffle and avoid an immediate repeat of the last level if
more than one level exists. One-level packs repeat indefinitely. Tests inject
RNG and clock; production randomness is not a security mechanism.

Persist after each accepted drop, mode/settings change, puzzle initialization,
completion transition and pause/page-hide checkpoint. Save under
`drag-into-place:v1:<encoded-user>:english:<tier>` in `localStorage`, where
the opaque `cr_user_id` is used only as a namespace, with `guest` when absent.
Do not create or persist a separate user/device identifier.

Snapshot fields: `schema_version=1`, `content_version`, tier, shuffled cycle
IDs, current cycle index, current occurrence counter, level ID, slot-to-tile
IDs (or null), removed foil IDs, revealed hints, attempts, elapsed active
milliseconds, phase (`playing`/`completed_pending_advance`) and
`completion_recorded`. Settings (mute and selected tier) use a user-scoped
settings key. Moving positions, pointer state, audio buffers and animation
progress are ephemeral; restore an incomplete Great puzzle with all remaining
tiles requeued.

Active elapsed time starts at Start/Resume (or automatic puzzle activation),
not while Ready/loading, and excludes placement/completion feedback, hidden
page, settings and manual pause. Snapshot elapsed time includes earlier
restored play for the same occurrence. A completion event uses that accumulated
time up to the final accepted drop.

Validate the entire snapshot against current content and invariants before
use. A content-version/schema mismatch, invalid JSON, duplicate tile binding
or invalid slot letter discards only this namespace's unusable snapshot,
logs a diagnostic and shows a nonfatal "new puzzle" notice. Keep valid settings.
Changing tier saves the old tier and restores/starts the new one. User change
never restores another user's state. No reset-progress control in v1.

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
unavailable notice and allow play. Speech/image correctness still blocks
release via build-time validation. Preload failures settle independently and
never strand loading. No speech synthesis/remote pronunciation dependency.

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
      "tier": "mvp",
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
| `session_started` | First Start/Resume gesture in a page lifecycle, once | `type`, `lang`, `tier` |
| `level_completed` | First transition to fully filled slots per occurrence | `type`, `lang`, `level_id`, `tier`, `attempts`, `duration_ms`, `score`, `max_score` |

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
| M4 Static UI | Implement responsive presentation and pointer/tap/keyboard adapters | M2, M3 | Full MVP puzzle passes UI and accessible-input cases |
| M5 Better | Add foils, disappearance and position hints | M4 | Better cases pass and MVP regression remains green |
| M6 Great | Add FIFO lanes, pause/recycle and reduced-motion static alternative | M5 | Great timing/solvability tests pass on all supported viewports |
| M7 Integration/release | Implement bridge, build audits, ZIP tool, icon and device runbook | M3 for bridge; M4-M6 for complete release | Bridge contract tests and all offline/device/package gates pass |

Tests accompany each module, not just M7. M3 work independent of M2 may proceed
in parallel; persistence cannot finalize before the domain snapshot contract.

### 9.1 Approved static prototype evidence and remaining work

This is an implementation-status record, not a waiver or replacement of D-01
through D-10 exit criteria. The user approved implementation through Better
and approved the code deliverable on 2026-10-22; release approval remains
outstanding.

| Module | Evidence in the current prototype | Status / unmet exit criteria |
|---|---|---|
| M1 | React 19.1.1, TypeScript 5.9.2, Vite 7.1.7, Ajv 8.17.1; Node 24.20.0/npm 11.19.0; content schema and reference/license validator; CAT fixture | Partial. Unit validation works, but `npm run validate:content` fails because production word/letter recordings, `assets/audios/incorrect.wav`, `assets/fonts/reader.woff2` and their licenses are missing. Individual invalid-fixture coverage is incomplete. |
| M2 | Pure reducer, value-based duplicate matching, attempts, random wrong-tile relocation, Better foil removal/hints, per-user snapshot validation, cycle order and completion marker; six domain and four progress tests | Core behavior is present; full injected-clock/invariant matrix and all F-01-F-10 fixture coverage remain outstanding. |
| M3 | Bounded XHR content loader, serialized HTML audio cues with watchdog, local progress/settings, and fire-and-forget bridge envelope | Partial. HTTP development uses XHR rather than the specified fetch path; preload settlement, hidden-page audio suspension (the active clock pauses), and full failure-generation tests remain outstanding. `sub_app_id` is a development placeholder pending Q-02. |
| M4 | Responsive static UI, pointer capture, 8 px threshold, clamping, center hit-testing, tap/keyboard placement, live status, MVP/Better tier control | Focused browser checks pass. Full viewport, focus/screen-reader, contrast, cancellation and automated component/E2E acceptance remains outstanding. |
| M5 | Better tier displays per-position hints and removes foils; MVP excludes foils; domain/browser smoke checks exercised both tiers | Focused behavior is present; full T-09/T-10 and regression suite remains outstanding. |
| M6 | Not included in the approved scope | Great moving lanes and their reduced-motion/pause/recycle behavior are not implemented. |
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
`assets/` and `content/licenses.json`, with no wrapper directory, `lang/`,
source maps or dev files. `<engine>-lang-english.zip` contains only
`lang/english/levels.json` and `lang/english/audios/`. They extract into one
directory with no path collisions. No core/book ZIP or `cr_book` is needed.

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
| Q-01 | Product owner: formal approval of proposed limits, timings, scoring and Draft behavior; user approved implementation through Better on 2026-10-22, but the product owner remains unassigned | Product/release approval; implementation scope through Better is authorized |
| Q-02 | Curious Learning: approved engine slug, `sub_app_id`, language catalog entry and promotion permissions | Release packaging/upload |
| Q-03 | Content owner: provide production level set, contextual recordings, illustrations, icon, font and redistribution evidence | Production content gate |
| Q-04 | Engineering/QA: select baseline device and minimum OS/WebView versions; Node.js 24.20.0/npm 11.19.0 selected for the prototype on 2026-10-22 | Performance/support claims; device and OS/WebView selection |
| Q-05 | Sponsor: assign product approver, independent QA owner, human architecture/security reviewers and facilitated usability review | Approval/release |

## 15. Resolved and proposed decisions

| Date | Decision | State / rationale |
|---|---|---|
| 2026-10-21 | React/TypeScript offline web game, all three tiers, repository-level workflow | Confirmed by sponsor; resolves native-workshop versus current container target |
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

2026-10-22 — Copilot — Recorded prototype implementation evidence, selected toolchain and remaining module/release gaps without changing normative contracts.
2026-10-21 — Copilot — Added the initial draft behavioral contracts, module sequence, offline architecture, delivery runbook, explicit decisions and specification lifecycle; removed nothing.
