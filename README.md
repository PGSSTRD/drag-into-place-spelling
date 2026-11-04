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

## Browser testing: stages 1-2 harness, content and core spelling

Stages 1-2 of [the browser acceptance task](docs/tasks/draft/browser-acceptance-suite.md)
are implemented. Stage 1 supplies the production HTTP/file harness and fixtures;
stage 2 adds content rejection, seeded layout, core placement, duplicate-letter,
cycle, foil and hint assertions. This is **not full T-01-T-33 acceptance** and
does not resolve open application/specification decisions or authorize release.

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
  failures; absent/recording/throwing bridge; stalled content XHR on either
  transport. `rawContent` supports malformed, truncated and empty responses.
- Audio defaults to real playback. `audio: "mock"` enables per-path played,
  unavailable, autoplay-blocked and pending outcomes. Manual `emitAudio`
  delivers delayed/stale callbacks (optionally target the recorded media
  instance ID); a pending outcome has no automatic ending. Mock sources are
  isolated from native media loading, and pause cancels automatic completion.
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
and full offline checks remain later-stage work, not claims of this smoke suite.
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
