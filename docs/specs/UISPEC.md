# UISPEC - Drag Into Place Spelling

**Version:** 2.0.8<br>
**Status:** Draft - Great implementation and current-level audio notice behavior specified and implemented; awaiting product, accessibility and design review<br>
**Last update:** 2026-11-02<br>
**Author:** Copilot

## 1. Authority and visual intent

Implements [PRD](./PRD.md) and presents behavior defined in
[DEVSPEC](./DEVSPEC.md) D-01-D-10. Do not redefine letter matching, drop
outcomes, timings, movement or persistence here. This is a proposed reproducible
design, not a screenshot-derived description of an existing application.

Use a friendly, uncluttered, image-led activity with one dominant playfield.
No ads, external links, scores, countdowns, sign-in, tier selector or
leaderboard.

## 2. Design tokens and responsive geometry (U-01)

| Token | Required value / rule |
|---|---|
| Background | `#F7FAFC` |
| Surface / primary text | `#FFFFFF` / `#14213D` |
| Primary action / on-primary text | `#174EA6` / `#FFFFFF` |
| Correct / gentle correction | `#166534` / `#9A3412`; pair with icon/shape and words |
| Focus | 3 px solid `#174EA6`, 2 px offset; visible independently of selection |
| Type | Bundled reader font, system sans-serif fallback; body >=16 px; uppercase letter glyphs >=28 px |
| Interactive target | At least 44x44 CSS px, including icon-button hit areas |
| Spacing | 8 px grid, 8 px minimum outer padding plus safe-area insets; maximum content width 1,024 px |
| Tile | White rounded square, 2 px primary border, visible letter; minimum 44x44 px |
| Slot | Same minimum target size; dashed empty outline, solid occupied outline, index-order placement |

Validate actual rendered contrast, not just token values. Correctness must not
depend on color: use a checkmark/lock for correct and bounce plus gentle
correction cue for incorrect. Selected tile uses a thick outline and "selected"
accessible state, separate from keyboard focus. Keep the entire selection
outline visible and unclipped, including on moving-lane tiles. Never flash.

Portrait layout, top to bottom:

```text
[Sound]       Drag Into Place       [Settings] [Pause*]
                 [Target image]
                 [Replay word]
 [slot 1] [slot 2] ...              answer in reading order
 [hint 1] [hint 2] ...              reserved below each slot
            [Learner status]
 [shuffled letter pool]            Great with reduced motion
 [top moving lane   ->]            Great
 [lower moving lane ->]            Great
```

`*` Pause is present only in ordinary moving Great. Never show both the
static pool and moving lanes. Keep answer rows immediately above their hints;
when slots wrap, each slot and its hint remain one paired grid item.
Keep the motion-status row above the answer row so it does not separate answer
hints from learner feedback. The baseline-to-baseline distance from the hint
text to the learner-status text below it should be about 40 CSS px and must not
exceed 48 CSS px in the supported portrait layout.
Calculate columns as the largest count of 44 px cells and 8 px gaps that fits
the available width, capped at word length; center incomplete final rows.
Preserve left-to-right then top-to-bottom order and accessible position labels.
Tile grids use the same minimum geometry, with up to 12 tiles.

At 320x568, reduce the picture to 64x64 px and compact optional spacing before
reducing any interactive target. At larger sizes the picture is 128x128 px
(max 192x192). At landscape heights below 480 px, use two columns: image and
controls on the left, answer/hints/status and pool/lanes on the right. Letter
cells may wrap, but neither tiles nor answer positions may be clipped.
Reserve safe space for status messages so cues do not shift drop targets.
All supported default-zoom viewports must fit without horizontal scrolling;
browser text zoom may vertically scroll non-drag content while the focused
control remains reachable. The measurable minimum viewports are D-08.

Pool cells are visually unordered; moving lanes are left-to-right; answer slots
are visually ordered. Hint glyphs are pale but readable, fixed under the
corresponding position, and hidden until revealed. A correctly filled slot
suppresses its visible hint without deleting its recorded reveal state. Hints
are generated uppercase glyphs using the bundled font, not missing external
image assets.

## 3. Screens, states and visibility (U-02)

| State/surface | Visible | Enabled actions / transition |
|---|---|---|
| Loading | Local illustration/spinner and "Getting your letters ready..." | No gameplay; bounded by D-06 |
| Ready, new puzzle | Picture, slots and pool/lanes as static preview; "Let's spell!" Start button | Start unlocks sound and enables play/motion |
| Ready, saved puzzle | Restored locked slots/hints and "Keep going!" Resume button | Resume unlocks sound and enables remaining letters |
| Playing | Picture/replay, slots, hints, Great lanes or reduced-motion pool, sound and settings | Acquire/stop tile, select/drop, replay, mute, open settings; motion can pause |
| Selected/dragging | Selected outline or elevated tile under pointer; no duplicate source tile | Matching input can drop; Escape/cancel returns it |
| Placement feedback | Result cue on destination/tile, short status announcement | New acquisitions/replay/settings disabled; mute remains available |
| Completing | Locked answer, word celebration, "You spelled it!" | Gameplay/replay/settings disabled; mute remains available; next puzzle starts automatically |
| Paused/hidden | On manual pause: "Paused" overlay and Resume; hidden page has no visible work | Resume restores play; no clock/audio/motion advancement while hidden |
| Settings dialog | Sound toggle, Close | Opening cancels selection and pauses activity; closing resumes the same Great puzzle unless another pause reason applies |
| Fatal load/content error | Friendly message, Retry, short diagnostic code | Retry restarts load; no interactive partial puzzle |
| Nonfatal media/save notice | Nonblocking status strip, while puzzle remains usable | Show the sound-unavailable notice if any required cue for the current level is missing or fails; recompute on level change and do not carry a warning onto a complete level. Show sound enable/retry when playback is blocked; never show a false progress-save indicator |

On a new automatic puzzle, continue playing without another Start, unless
the browser again blocks audio. Pause/settings and hidden-page reasons are
independent: returning from a hidden page must
not dismiss an explicit pause or open settings. Resume does not play missed
audio from the background. Feedback resumes from its paused position.

Great is the only implementation. It shows moving lanes and Pause; when
reduced motion is active, use static tiles and a "Motion reduced" status.
Never visually identify which tiles are foils.

### Controls and copy (U-03)

| Control | Accessible label and behavior |
|---|---|
| Start / Resume | Text label; focus enters the first available tile after activation |
| Picture | Informative `image_alt`; not the only way to replay audio |
| Speaker by picture | "Hear the word"; plays the target-word cue without revealing written spelling |
| Sound toggle | "Sound on" / "Sound off", with pressed state; persists per user |
| Settings | Opens an accessible dialog, traps focus, returns focus on close |
| Pause / Resume motion | Labeled button; no play continues behind a manual pause overlay |
| Retry | "Try loading again"; repeats boot, not a page with an unchecked snapshot |
| Enable sound | "Enable sound"; visible only when playback was blocked/unavailable |

Learner messages: initial "Drag a letter, or choose a letter then a space.";
correct "Nice work!"; incorrect "Try another space."; foil "Here's a hint.";
completion "You spelled it!"; restored invalid save "Let's start a new puzzle.";
storage failure "You can play, but your progress can't be saved.";
audio failure "Sound isn't available. You can still play." Show this notice
while any required current-level cue (full word, any letter-position cue, or
the shared incorrect-placement cue) is unavailable. Recompute it when the
level changes; a successful cue does not hide it while another required cue
for that level remains unavailable. A complete level has no sound-unavailable
notice. A browser playback block uses the Enable sound control. Fatal content
error "We couldn't load this activity. Try again." Never display stack traces,
raw paths, user IDs or blame the learner.

## 4. Input and accessibility (U-04)

All letter tiles are focusable buttons with accessible names "Letter C".
Slots expose "Space 1 of 3, empty" or "Space 1 of 3, C, locked". Do not
announce unrevealed target letters. A revealed hint is announced as "Hint for
space 2: A". Locked tiles are no longer actionable, but remain readable.

- Pointer drag follows D-03; use `touch-action: none` on draggable tiles only,
  not on all controls or the entire document.
- Tap/click a moving tile to select it and stop its motion immediately. Drag
  it in a later gesture or tap an empty slot to place it. Selecting the
  selected tile again cancels; choosing another available tile changes selection.
- Tab follows controls -> available tiles -> answer positions in reading order.
  Enter/Space selects a tile or places it in a focused slot. Escape cancels a
  selection or closes settings. Occupied slots are readable but not drop actions.
- For keyboard/switch access in Great, keyboard navigation that focuses a tile
  pauses lane motion; focus/selection keeps its logical tile stable. A
  pointer-generated focus during tap or drag does not activate this pause.
  Beginning pointer interaction clears a keyboard-focus pause. Leaving the
  playfield without a selection resumes unless another pause reason applies.
- Announce outcomes once in a polite live region. After a correct placement,
  focus the next available tile; after wrong placement keep focus on that tile;
  after a removed foil focus the next available tile. On next puzzle focus the
  first available tile; do not move focus during pointer dragging.
- Honor `prefers-reduced-motion`: remove bounce/confetti/translations, retain
  static check/outline/announcement for the same feedback duration, and use
  D-04's static reduced-motion presentation. Muting does not suppress
  visual/ARIA cues.

## 5. Acceptance scenarios (U-05)

The timing values and domain outcomes referenced here are authoritative in
DEVSPEC, not duplicated constants in UI code.

```gherkin
Scenario: Start the offline Great puzzle
  Given a valid English pack and no saved game
  When loading completes and I activate Start
  Then I see a target picture, one empty slot per target letter, and target/foil tiles moving left to right
  And Great hints and foils are available

Scenario: Correct placement locks
  Given CAT with its first slot empty
  When I drag C into the first slot
  Then the slot displays C with a check/locked indication
  And contextual letter feedback is presented
  And C is not draggable again

Scenario: Wrong target is not a foil
  Given CAT in Great with A available
  When I place A in the first empty slot
  Then I receive the gentle correction cue and A returns to the pool
  And no hint appears and A is not removed

Scenario: A foil reveals one position
  Given CAT in Great with foil B and all hints hidden
  When I place B in the second empty slot
  Then B disappears and only the second position reveals A below it
  And the second slot remains empty

Scenario: A cancelled or occupied drop is neutral
  Given a selected available tile
  When I cancel or drop it outside the answer or onto a locked position
  Then it returns to availability without correction audio or a new hint

Scenario: Duplicate letters and final feedback
  Given BOOK with two distinct O tiles
  When I correctly place all four letters, exchanging the two O tile identities
  Then both O placements are accepted
  And the final letter cue precedes full-word celebration/audio
  And exactly one next puzzle appears after the completion sequence

Scenario: Moving tile capture and recovery
  Given Great with a target tile moving left to right
  When I acquire it
  Then it stops moving and can be dragged without leaving the visible playfield
  When I cancel it
  Then it returns to the scheduler rather than disappearing permanently

Scenario: Play without drag or sound
  Given muted audio and reduced motion in Great
  When I select a static tile and activate its correct slot using only the keyboard
  Then it locks with visible feedback and a live announcement
  And I can finish the puzzle without dragging or hearing audio

Scenario: Resize or background during drag
  Given a tile is being dragged
  When orientation changes or the page is hidden
  Then the drag is cancelled without an attempt
  And returning preserves placed letters and recalculates visible positions

Scenario: Settings, pause and focus
  Given an active Great puzzle
  When I open Settings
  Then motion and active time pause and focus stays inside the dialog
  When I close Settings
  Then focus returns to Settings and the prior puzzle resumes unless manually paused

Scenario: Failed load versus failed audio
  Given invalid JSON or a missing target image
  When boot settles or times out
  Then a recoverable error and Retry replace loading
  Given valid content but an unavailable sound
  When I start
  Then I can play with a nonfatal sound notice and visual feedback
```

## 6. Design approval evidence

Before release, capture Ready, both Playing layouts, selection, correct,
wrong, revealed hint, pause, completion, settings, load failure and nonfatal
notice at minimum portrait/landscape sizes and one tablet size. Record focus,
screen-reader and contrast review. Screenshots support review; interactive
behavior and audio require tests, not screenshots alone.

Maintain Status, Version, Last update and the bottom log under the lifecycle
defined in DEVSPEC. No design approval has been granted in this draft.

## 7. Prototype implementation evidence and gaps

The 2026-10-22 static prototype is historical evidence, not implementation or
approval of the normative Great design. Product, accessibility, design and
release approval remain outstanding.

The current static prototype presents the picture, Start/Resume, word replay,
sound toggle, answer positions, a static letter pool and foil/hint behavior.
Browser smoke checks confirmed `file://` content/image loading, tap-to-place,
a mouse drag, correct locking, foil removal with one position hint, and CAT
completion followed by automatic advance. Missing speech files produce the
specified nonfatal sound notice; they do not satisfy the pronunciation
requirements or verify Great's moving behavior.

The 2026-10-22 prototype evidence records a header `<select>` for MVP and
Better rather than the specified Settings dialog. That historical control is
not part of the Great design. Great lanes, the Settings dialog,
focus trap/return, full 320x568/landscape/tablet review, screen-reader and
contrast review, 200% zoom review, and reduced-motion review are not
implemented or verified. Pointer/tap/keyboard behavior has not received the
full U-04 acceptance review. These are recorded as implementation gaps, not changes to the normative design.

### Great implementation evidence (2026-10-27)

The current interface presents Great lane previews before Start, then moving
tiles and foils, pause/resume, keyboard-focus pause, position hints, and a
stationary tile pool under reduced-motion preference. A browser smoke check
verified lane movement and pause stability, a tile remaining stationary after
selection, and a foil disappearing while revealing one hint. This does not
verify dragging a moving tile, all U-02/U-04 states, focus behavior, screen
readers, contrast, zoom, full viewport coverage or physical devices. The
specified Settings dialog and complete design review remain outstanding; the
implementation evidence does not alter U-01–U-05 or grant design approval.

A follow-up browser regression check verified keyboard Tab focus pauses
motion, pointer interaction clears that pause, and dragging a moving target
letter to its correct slot completes without the keyboard-pause status. It does
not replace the complete U-04, viewport, accessibility or physical-device
review.

An additional browser smoke check tapped a moving tile and verified that it
remained at the same position for one second, then dragged that tile in a
separate gesture into its correct slot. The puzzle completed without the
keyboard-pause status. This does not replace full U-04, accessibility, viewport
or physical-device review.

After the compact spacing update, a browser check revealed a foil in reduced-
motion play and measured 40 CSS px baseline-to-baseline between its hint and
the "Here's a hint." status at 390x844. CSS text-range measurements at
320x568 and 768x1024 also measured 40 CSS px. This is focused layout evidence,
not the complete U-01 viewport or design review.

After the selected-outline fix, a browser check captured a selected tile at
the top of a moving lane. Its full outline was visible; measured upper
clearance from the clipping container was 4.4 CSS px. This focused check does
not replace the complete U-01 viewport or accessibility review.

## Spec change log

2026-11-02 — Copilot — Specified current-level sound-notice visibility and recovery on level changes; implementation is present, with UI review outstanding.
2026-10-27 — Copilot — Recorded browser evidence that the full selected-tile outline remains visible in a moving lane.
2026-10-27 — Copilot — Required the full selected-tile outline to remain visible, including in moving lanes.
2026-10-27 — Copilot — Recorded approved compact answer-hint-to-status spacing evidence and retained full visual review gates.
2026-10-27 — Copilot — Specified compact spacing between answer hints and learner feedback while reserving motion status above the answer row.
2026-10-27 — Copilot — Clarified that tapping a moving tile stops it immediately and recorded separate-gesture drag evidence.
2026-10-27 — Copilot — Clarified keyboard-versus-pointer focus pause behavior and recorded the drag regression check.
2026-10-27 — Copilot — Added current Great interface evidence and retained outstanding accessibility, design and interaction review gates.
2026-10-26 — Copilot — Replaced tier-specific presentation with one Great experience including hints, foils, moving lanes and reduced-motion presentation; formal design approval remains outstanding.
2026-10-26 — Copilot — Retired MVP presentation and defined Better as the minimum tier while retaining Great; formal design approval remains outstanding.
2026-10-22 — Copilot — Recorded static Better prototype presentation evidence and UI/accessibility gaps without changing normative design requirements.
2026-10-21 — Copilot — Added the initial draft responsive design, complete screen/control states, accessible interactions and Gherkin acceptance scenarios; removed nothing.
