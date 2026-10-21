# PRD - Drag Into Place Spelling

**Version:** 0.1.0  
**Status:** Draft - awaiting product approval; no implementation exists  
**Last update:** 2026-10-21  
**Author:** Copilot  
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

- [Original workshop brief](./Drag%20Into%20Place%20Spec%20Brief.md), dated
  2017-04-11: pedagogical objective, MVP/Better/Great gameplay and constraints.
- [Curious Reader third-party contract](./third-party-game-spec.md), v1.8,
  2026-08-19: modern offline web-container, packaging and reporting obligations.
- [Guru Banavar's SDAD article](https://medium.com/@guruduth.banavar/spec-driven-ai-development-engineering-discipline-for-the-ai-coding-era-22a678067b1c):
  the four-artifact methodology, traceability and human approval gates. This
  specification is an original application of that method, not a copy of the article.
- Sponsor confirmation on 2026-10-21: specify all three gameplay tiers as phased
  delivery, use React/TypeScript for the offline web container, and persist the
  planning/spec-maintenance workflow in this repository.

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
| P-02 | Evaluate a drop against its answer position, not the identity of a specific duplicate tile. Correct placements lock, celebrate and pronounce the contextual letter; incorrect target letters receive gentle negative audio and return to an available randomized location. |
| P-03 | After the last correct placement, celebrate, pronounce the full word and advance automatically once. Every valid word remains reachable, including words with repeated letters. |
| P-04 | Keep manually dragged tiles fully on-screen and make correctly placed letters non-draggable. Touch, mouse and an accessible non-drag interaction must produce the same spelling results. |
| P-05 | In the Better tier, add content-defined foils and per-position hints below the answer. A foil dropped on an empty answer position disappears and reveals that position's hint. A wrong target letter is not a foil. |
| P-06 | In the Great tier, move unplaced target letters and foils left-to-right, allowing the learner to stop and drag one. An unused target letter must return after leaving the screen; missing a moving tile never makes a puzzle unsolvable. |
| P-07 | Load English/Roman-alphabet content from validated, locally packaged JSON and media. Support 1-8-letter words, repeated letters and up to four foils per puzzle in the first release. These limits are proposed scope decisions, not limits imposed by the original brief. |
| P-08 | Reach playable state offline in at most 10 seconds on the agreed baseline device, with no attempted external network requests. A failed load must show a recoverable error rather than an endless loading screen. |
| P-09 | Preserve meaningful puzzle progress and settings across reloads on the same device, separated by language, tier and container user. Storage failure must not prevent in-memory play and must be disclosed. |
| P-10 | Report coarse session and puzzle milestones only through the container bridge; work normally when that bridge is absent. Do not create identities, collect names, add trackers or perform game-side network reporting. |
| P-11 | Deliver Curious Reader-compatible ZIPs, a tile icon, locally licensed media and a reproducible build/test procedure. A developer-server demonstration alone is not release evidence. |
| P-12 | Maintain versioned, traceable specifications; use them in each new task plan, require tests and human approval, and offer a separate specification reconciliation task after approved work. Reconciliation reports both additions and removals. |

## 4. Scope and phases

| Phase | Included | Gate to declare the phase complete |
|---|---|---|
| Foundation | Local build, schema validation, media loading, responsive shell, offline packaging | Invalid content is diagnosed; packaged fixtures load from `file://` |
| MVP | Static target letters, image, answer slots, letter/word audio, supportive feedback, progression, persistence, accessibility, bridge | P-01-P-04 and P-07-P-12 pass for static mode; human gameplay review approved |
| Better | All MVP behavior plus foils, hints and foil disappearance | P-05 passes without changing MVP mode behavior |
| Great | All Better behavior plus moving letters, pause-on-pickup, safe recycling | P-06 passes; static and Better modes remain selectable and tested |
| Release | Production media, physical-device verification, operator handoff | All applicable requirements pass and product, engineering and QA sign off |

Provide three facilitator-selectable tiers named **MVP**, **Better** and
**Great**, with MVP selected on a fresh install. Great inherits Better's foils
and hints. Tier choice does not automatically increase based on performance.
There are no paid features, accounts, server backend or connection-dependent
features.

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
| Progress integrity | Correct placements, removed foils and revealed hints survive 10/10 save/reload trials | Restore tests for all tiers, including duplicate letters |
| Interaction usability | At least 4 of 5 consented, facilitated trial participants complete a three-letter MVP puzzle after at most one demonstration | Anonymized observation checklist; no child identifiers in telemetry |
| Delivery integrity | Every referenced required media asset exists, validates and is locally licensed; ZIPs merge with zero overwrites | Content audit, license manifest and archive inspection |
| Accessibility | Entire puzzle can be completed without dragging; essential feedback remains understandable while muted/reduced-motion | Keyboard, tap-to-place, screen-reader and reduced-motion review |

The usability threshold is a proposed product-validation target, not a reported
study result. If a learner study is unavailable, record that gate as blocked;
do not substitute automated test results for it.

## 6. Ownership, risks and approval

The product owner approves intent, tier behavior and learner-facing language.
Engineering owns architecture/offline compatibility. QA must independently
review the acceptance suite rather than treating its AI-generated first draft
as approval. Human security, architecture and business-logic review are release
gates.

Missing production assets, unconfirmed container IDs, unspecified baseline
devices and unassigned reviewers block release, not preparation of a prototype.
No spec in Draft status constitutes approval to ship. Proposed reconstruction
decisions require review before their implementation milestone starts.

## Spec change log

2026-10-21 — Copilot — Added the initial draft product requirements, confirmed three-tier scope, provenance, measurable outcomes and approval gates; removed nothing.
