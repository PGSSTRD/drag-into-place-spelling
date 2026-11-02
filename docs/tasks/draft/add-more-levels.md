# Add more English animal levels

**Task ID:** `add-more-levels`  
**Status:** Draft — implementation approved; specification update awaiting approval; audio/media validation blocked  
**Created:** 2026-11-02

## Goal

Expand `content/lang/english/levels.json` with levels matching the existing
repository illustrations for dog, rabbit, and bird. Keep CAT as the first
level and preserve the existing content-pack schema.

## Scope

- Add DOG, RABBIT, and BIRD as levels with stable IDs 2, 3, and 4.
- Reference `assets/images/dog.svg`, `assets/images/rabbit.svg`, and
  `assets/images/bird.svg`; these original illustrations already have complete
  records in `content/licenses.json`.
- Use the matching lowercase animal name as `target_word`, with its uppercase
  spelling in `letters`.
- Give each new level exactly two foil characters, matching CAT's foil count.
  Choose uppercase A-Z characters that do not occur in that level's
  `target_word`; the content contract permits duplicates.
- Reference the anticipated word and position-specific MP3 filenames listed
  below. Use the existing CAT convention: one word clip named
  `<word>.mp3`, and one zero-based `<word>-<index>.mp3` clip per letter.
- Bump `content_version` from `1.0.0` to `1.1.0` for the additive content.
- Do not create placeholder audio files or claim that unavailable clips are
  licensed or validated.

## Requirements and dependencies

- **Product intent:** [PRD](../../specs/PRD.md) P-01, P-03, P-07, P-11.
  Levels must pair a pictured word with its spelling; all levels remain
  reachable, and content/media is local and licensed.
- **Behavior and build order:** [DEVSPEC](../../specs/DEVSPEC.md) D-01 and
  D-05. The implemented level roster, stable IDs, media names, foil counts, and
  `content_version` are specified in D-01. Each level must satisfy the schema,
  use an existing local image path, provide one contextual audio path per
  letter and a word-audio path, and participate in normal shuffled level
  cycles.
- **Presentation:** [UISPEC](../../specs/UISPEC.md) U-01, U-02, and U-03.
  Preserve the target-picture presentation and supply an accurate,
  learner-facing `image_alt` for each animal.
- **Verification:** [TESTSPEC](../../specs/TESTSPEC.md) T-01, T-08, T-26,
  T-28, T-31, and T-33. Validate the pack and media references, progression
  across multiple levels, package inventory, and media/license review.

### Expected level media references

| Level | ID | Image | Word audio | Letter audio |
|---|---:|---|---|---|
| DOG | 2 | `assets/images/dog.svg` | `lang/english/audios/dog.mp3` | `lang/english/audios/dog-0.mp3` through `dog-2.mp3` |
| RABBIT | 3 | `assets/images/rabbit.svg` | `lang/english/audios/rabbit.mp3` | `lang/english/audios/rabbit-0.mp3` through `rabbit-5.mp3` |
| BIRD | 4 | `assets/images/bird.svg` | `lang/english/audios/bird.mp3` | `lang/english/audios/bird-0.mp3` through `bird-3.mp3` |

### Audio dependency and release gate

The audio files listed above do not exist yet. Their creation and complete
license records are prerequisites for passing `npm run validate:content` and
the production-media gates. Do not invent audio files, license provenance, or
successful pronunciation review to make validation appear to pass. The level
JSON may be prepared with these intended paths, but until the corresponding
files and license records are supplied, report content validation as blocked.
Use reviewed, contextually correct pronunciation for each letter position,
not letter names.

## Acceptance criteria

- CAT remains level 1; DOG, RABBIT, and BIRD have IDs 2, 3, and 4, with
  matching lowercase targets, uppercase target letters, and the SVG image
  paths listed above.
- Each new level has exactly two foils, all outside its target word, and
  exactly one position-specific audio path for each target letter.
- Word and letter audio paths follow the names and zero-based indexing in the
  table. They resolve to real, locally licensed MP3 files before content/media
  validation is considered passed.
- `content_version` is updated to `1.1.0`; all other pack fields and CAT data
  remain valid.
- The new levels are included in level-cycle coverage and remain reachable.
- Content validation, focused content/progression tests, typecheck, unit tests,
  and build are run. Any missing media or other blocked gate is reported
  explicitly; passing schema or unit tests alone does not establish release
  readiness.
- The three existing SVG license records remain complete; each supplied audio
  file receives an accurate license record before it is treated as releasable.

## Decisions and boundaries

- Two foils per added level follows the current CAT level because the
  specifications set a maximum of four but do not require a fixed count.
- Audio file creation, audio licensing, and independent pronunciation review
  are external prerequisites to full content and release validation; no
  placeholder media is in scope.
- Specification reconciliation is tracked separately. This task does not
  authorize publishing/release.

## Implementation evidence

Implemented in `content/lang/english/levels.json`: CAT remains first, followed
by DOG, RABBIT, and BIRD with IDs 2-4, matching image paths, uppercase target
letters, two non-target foils each, the expected indexed MP3 references, and
`content_version` `1.1.0`. No audio files or audio license records were
fabricated.

Unit tests (20/20), typecheck, production build, and focused level-pack
structure/path checks passed. `npm run validate:content` remains blocked by
missing shared correction audio, reader font, CAT audio, the newly referenced
animal audio, and corresponding complete media license records. Production
pronunciation and placeholder-illustration review also remain outstanding.
