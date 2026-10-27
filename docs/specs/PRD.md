# PRD - Drag Into Place Spelling

**Version:** 2.0.1<br>
**Status:** Draft - Great implementation evidence recorded; awaiting product approval; release not approved<br>
**Last update:** 2026-10-27<br>
**Author:** Copilot<br>
**Product owner:** To be assigned by the project sponsor

## 1. Purpose and authority

Enable a beginning reader to order individual letters to spell a pictured
English word, with immediate, supportive visual and spoken feedback. The
product must work offline inside Curious Reader and be reproducible by a new
team without access to an earlier codebase.

This document owns product intent, scope, outcomes and release gates. Detailed
engineering and presentation decisions are subordinate to that intent. MUST
means required for the applicable phase; SHOULD means a recommendation with a
documented reason required for deviation.

### Sources and provenance

- [Original workshop brief](../Drag%20Into%20Place%20Spec%20Brief.md), dated
  2017-04-11: pedagogical objective, shared gameplay fundamentals and
  constraints; this product specifies Great Implementation only.
- [Curious Reader third-party contract](../third-party-game-spec.md), v1.8,
  2026-08-19: modern offline web-container, packaging and reporting obligations.
- [Guru Banavar's SDAD article](https://medium.com/@guruduth.banavar/spec-driven-ai-development-engineering-discipline-for-the-ai-coding-era-22a678067b1c):
  the four-artifact methodology, traceability and human approval gates. This
  specification is an original application of that method, not a copy of the article.
- Sponsor confirmation on 2026-10-21: use React/TypeScript for the offline web
  container and persist the planning/spec-maintenance workflow in this
  repository. The earlier multi-tier planning direction is superseded by the
  Great-only scope below.
- User-validated task scope on 2026-10-26: specify Great as the sole product
  implementation, including foil removal and position-hint reveal behavior
  described in the source brief's Better section. This task validation does not
  replace formal product approval.

There is no existing game implementation to reverse-engineer. Exact visual
styling, numeric limits, audio sequencing and edge-case policies below are
proposed reconstruction decisions, not claims about an existing shipped game.
The 2017 React Native workshop framing is superseded by the confirmed web
target; the learning interaction is retained. Changes to the external container
contract require coordination with Curious Learning rather than local redefinition.

## 2. Users and needs

| Persona | Need | Success |
|---|---|---|
| Beginning reader, including a pre-reader | Understand the picture and manipulate letters without reading instructions | Can start and complete a puzzle using picture, gesture, sound and feedback |
| Adult facilitator | Start an offline activity, replay pronunciation and recover a failed load | No account, internet connection or specialist setup needed during play |
| Content editor | Supply correct words, images, contextual letter sounds and foils | Invalid packs are rejected before shipping with actionable diagnostics |
| Container/content operator | Package, validate and publish the game safely | Independently versioned engine/language packs and compliant offline events |

The product does not assess a child's reading age or claim a measured learning
improvement without a separate research study.

## 3. Product requirements

| ID | Requirement and observable acceptance |
|---|---|
| P-01 | Show a pictorial target, one ordered answer position per letter, and a randomized set of draggable target-letter instances. Completing CAT requires exactly three correct placements. |
| P-02 | Evaluate a drop against its answer position, not the identity of a specific duplicate tile. Correct placements lock, celebrate and pronounce the contextual letter; incorrect target letters receive gentle negative audio and re-enter the available-tile scheduler after feedback. |
| P-03 | After the last correct placement, celebrate, pronounce the full word and advance automatically once. Every valid word remains reachable, including words with repeated letters. |
| P-04 | Keep manually dragged tiles fully on-screen and make correctly placed letters non-draggable. Touch, mouse and an accessible non-drag interaction must produce the same spelling results. |
| P-05 | Include content-defined foils and per-position hints below the answer. A foil dropped on an empty answer position disappears and reveals that position's hint. A wrong target letter is not a foil. |
| P-06 | Move unplaced target letters and foils left-to-right, allowing the learner to stop a tile and drag it to the answer. Any unplaced target letter or foil must return after leaving the screen; missing a moving target tile never makes a puzzle unsolvable. |
| P-07 | Load English/Roman-alphabet content from validated, locally packaged JSON and media. Support 1-8-letter words, repeated letters and up to four foils per puzzle in the first release. These limits are proposed scope decisions, not limits imposed by the original brief. |
| P-08 | Reach playable state offline in at most 10 seconds on the agreed baseline device, with no attempted external network requests. A failed load must show a recoverable error rather than an endless loading screen. |
| P-09 | Preserve meaningful puzzle progress and settings across reloads on the same device, separated by language and container user. Great is the only implementation; storage failure must not prevent in-memory play and must be disclosed. |
| P-10 | Report coarse session and puzzle milestones only through the container bridge; work normally when that bridge is absent. Do not create identities, collect names, add trackers or perform game-side network reporting. |
| P-11 | Deliver Curious Reader-compatible ZIPs, a tile icon, locally licensed media and a reproducible build/test procedure. A developer-server demonstration alone is not release evidence. |
| P-12 | Maintain versioned, traceable specifications; use all four in each new task plan, cite applicable requirement IDs, dependencies, acceptance criteria and validation, and require tests plus explicit human approval. After approved work, offer a separate specification-update task; it updates Status, Last update and a bottom change log on altered specs, and reports additions, removals and replacements. |

## 4. Scope and phases

| Phase | Included | Gate to declare the phase complete |
|---|---|---|
| Foundation | Local build, schema validation, media loading, responsive shell and offline packaging | Invalid content is diagnosed; packaged fixtures load from `file://` |
| Great | Complete game: pictured spelling, answer positions, letter/word audio, supportive feedback, progression, persistence, accessibility, bridge, foils, hints, moving target/foil lanes, pause-on-pickup and safe recycling | P-01-P-12 pass for the Great implementation; human gameplay review approved |
| Release | Production media, physical-device verification and operator handoff | All applicable requirements pass and product, engineering and QA sign off |

Great is the sole learner-facing implementation; there is no tier selector,
static Better mode or MVP delivery phase. Reduced-motion and accessible input
alternatives are accommodations within Great, not separate tiers. There are no
paid features, accounts, server backend or connection-dependent features.

### Non-goals

- Additional languages, non-Roman writing systems, multiword phrases or words
  longer than eight letters in this version.
- Graded exams, timers that fail a puzzle, punitive scores, lives, leaderboards,
  adaptive difficulty, cloud saves or parental dashboards.
- Rebuilding the Curious Reader container, CMS, authentication or sync service.
- Reserving permanent CMS identifiers or uploading/publishing content without
  explicit operator authorization.
- Pixel-perfect reproduction of an unavailable existing design or delivery of
  licensed illustrations/audio that have not been supplied.

## 5. Outcomes and release acceptance

| Measure | Threshold | Evidence |
|---|---|---|
| Functional correctness | 100% of phase-applicable acceptance tests pass; no open blocker/critical defects | Automated results plus manual device checklist |
| Offline readiness | 10/10 cold launches become playable within 10 seconds, with zero outbound attempts | Timestamped `file://` baseline-device runs and container diagnostics |
| Progress integrity | Correct placements, removed foils and revealed hints survive 10/10 save/reload trials | Great restore tests, including duplicate letters and moving-tile requeue |
| Interaction usability | At least 4 of 5 consented, facilitated trial participants complete a three-letter Great puzzle after at most one demonstration | Anonymized observation checklist; no child identifiers in telemetry |
| Delivery integrity | Every referenced required media asset exists, validates and is locally licensed; ZIPs merge with zero overwrites | Content audit, license manifest and archive inspection |
| Accessibility | Entire puzzle can be completed without dragging; essential feedback remains understandable while muted/reduced-motion | Keyboard, tap-to-place, screen-reader and reduced-motion review |

The usability threshold is a proposed product-validation target, not a reported
study result. If a learner study is unavailable, record that gate as blocked;
do not substitute automated test results for it.

## 6. Ownership, risks and approval

The product owner approves intent, Great behavior and learner-facing language.
Engineering owns architecture/offline compatibility. QA must independently
review the acceptance suite rather than treating its AI-generated first draft
as approval. Human security, architecture and business-logic review are release
gates.

Missing production assets, unconfirmed container IDs, unspecified baseline
devices and unassigned reviewers block release, not preparation of a prototype.
No spec in Draft status constitutes approval to ship. Proposed reconstruction
decisions require review before their implementation milestone starts.

### Prototype evidence (2026-10-22)

A static prototype predating this Great-only specification was recorded on
2026-10-22. Historical focused unit, typecheck and build checks, plus browser
smoke checks for local-file loading, placement, progression and foil/hint
behavior, do not verify Great moving-tile behavior or establish any release
measure in section 5. The content audit failed on missing licensed audio/font
assets; packaging, device, independent QA and usability gates remain
outstanding. This historical prototype is not a second product tier.

### Great implementation evidence (2026-10-27)

The Great implementation now includes left-to-right moving letter/foil lanes,
tap-to-stop selection, pause and reduced-motion presentation, foil removal
with position-hint reveal, and FIFO recycling for unplaced tiles. Typecheck,
all 20 unit tests and the production build passed; a browser smoke check
verified movement, pause stability, stopped-tile selection, foil/hint behavior
and reduced-motion presentation. These checks do not establish the full P-01–
P-12 acceptance suite or the release measures in section 5. Production media
and licenses remain missing, and physical-device, Curious Reader, independent
QA, accessibility, usability and release reviews remain outstanding.

## Spec change log

2026-10-27 — Copilot — Recorded the implemented Great interaction and focused validation evidence while retaining product and release approval gates.
2026-10-26 — Copilot — Replaced multi-tier scope with Great as the sole product implementation, carrying forward foils/hints and specifying moving tiles; formal product approval remains outstanding.
2026-10-26 — Copilot — Retired MVP as a current phase and selectable tier, established Better as the minimum/default tier, and retained Great; formal product approval remains outstanding.
2026-10-22 — Copilot — Recorded approved static-prototype evidence and outstanding release gates without changing product intent.
2026-10-21 — Copilot — Added the initial draft product requirements, confirmed three-tier scope, provenance, measurable outcomes and approval gates; removed nothing.
