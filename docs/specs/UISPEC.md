# UISPEC - Drag Into Place Spelling

**Version:** 0.1.0  
**Status:** Draft - awaiting product, accessibility and design review  
**Last update:** 2026-10-21  
**Author:** Copilot

## 1. Authority and visual intent

Implements [PRD](./PRD.md) and presents behavior defined in
[DEVSPEC](./DEVSPEC.md) D-01-D-10. Do not redefine letter matching, drop
outcomes, timings, movement or persistence here. This is a proposed reproducible
design, not a screenshot-derived description of an existing application.

Use a friendly, uncluttered, image-led activity with one dominant playfield.
No ads, external links, scores, countdowns, sign-in or leaderboard. Adult-facing
tier controls must not obscure the learner's letters or answer positions.

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
accessible state, separate from keyboard focus. Never flash.

Portrait layout, top to bottom:

```text
[Sound]       Drag Into Place       [Settings] [Pause*]
                 [Target image]
                 [Replay word]
 [slot 1] [slot 2] ...              answer in reading order
 [hint 1] [hint 2] ...              reserved below each slot in Better/Great
            [Learner status]
 [shuffled letter pool]            MVP/Better or reduced-motion Great
 [top moving lane   ->]            ordinary Great only
 [lower moving lane ->]            ordinary Great only
```

`*` Pause is present only in ordinary moving Great. Never show both the
static pool and moving lanes. Keep answer rows immediately above their hints;
when slots wrap, each slot and its hint remain one paired grid item.
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

Pool cells are visually unordered; answer slots are visually ordered. Hint
glyphs are pale but readable, fixed under the corresponding position, and
hidden until revealed. A correctly filled slot suppresses its visible hint
without deleting its recorded reveal state. Hints are generated uppercase
glyphs using the bundled font, not missing external image assets.

## 3. Screens, states and visibility (U-02)

| State/surface | Visible | Enabled actions / transition |
|---|---|---|
| Loading | Local illustration/spinner and "Getting your letters ready..." | No gameplay; bounded by D-06 |
| Ready, new puzzle | Picture, slots and pool/lanes as static preview; "Let's spell!" Start button | Start unlocks sound and enables play/motion |
| Ready, saved puzzle | Restored locked slots/hints and "Keep going!" Resume button | Resume unlocks sound and enables remaining letters |
| Playing | Picture/replay, slots, applicable hints, pool/lanes, sound and settings | Acquire tile, select/drop, replay, mute, open settings; Great motion can pause |
| Selected/dragging | Selected outline or elevated tile under pointer; no duplicate source tile | Matching input can drop; Escape/cancel returns it |
| Placement feedback | Result cue on destination/tile, short status announcement | New acquisitions/replay/settings disabled; mute remains available |
| Completing | Locked answer, word celebration, "You spelled it!" | Gameplay/replay/settings disabled; mute remains available; next puzzle starts automatically |
| Paused/hidden | On manual pause: "Paused" overlay and Resume; hidden page has no visible work | Resume restores play; no clock/audio/motion advancement while hidden |
| Settings dialog | Tier selection MVP/Better/Great, sound toggle, Close | Opening cancels selection and pauses activity; changing tier uses D-05 save/restore and returns to Ready |
| Fatal load/content error | Friendly message, Retry, short diagnostic code | Retry restarts load; no interactive partial puzzle |
| Nonfatal media/save notice | Nonblocking status strip, while puzzle remains usable | Sound enable/retry control when relevant; no false progress-save indicator |

On a new automatic puzzle, continue playing without another Start, unless
the browser again blocks audio; manual tier switches show Ready. Pause/settings
and hidden-page reasons are independent: returning from a hidden page must
not dismiss an explicit pause or open settings. Resume does not play missed
audio from the background. Feedback resumes from its paused position.

MVP has no hints or foils and hides Pause. Better reserves hint cells and adds
foils, but has no movement/Pause. Great shows lanes/Pause unless reduced motion
is active, in which case show static tiles and a "Motion reduced" status.
Never visually identify which tiles are foils.

### Controls and copy (U-03)

| Control | Accessible label and behavior |
|---|---|
| Start / Resume | Text label; focus enters the first available tile after activation |
| Picture | Informative `image_alt`; not the only way to replay audio |
| Speaker by picture | "Hear the word"; plays the target-word cue without revealing written spelling |
| Sound toggle | "Sound on" / "Sound off", with pressed state; persists per user |
| Settings | Opens an accessible dialog, traps focus, returns focus on close |
| Tier selector | Labeled "Activity"; radio group with "MVP - letters", "Better - letters and hints", "Great - moving letters" |
| Pause / Resume motion | Labeled button; no play continues behind a manual pause overlay |
| Retry | "Try loading again"; repeats boot, not a page with an unchecked snapshot |
| Enable sound | "Enable sound"; visible only when playback was blocked/unavailable |

Learner messages: initial "Drag a letter, or choose a letter then a space.";
correct "Nice work!"; incorrect "Try another space."; foil "Here's a hint.";
completion "You spelled it!"; restored invalid save "Let's start a new puzzle.";
storage failure "You can play, but your progress can't be saved.";
audio failure "Sound isn't available. You can still play."; fatal content
error "We couldn't load this activity. Try again." Never display stack traces,
raw paths, user IDs or blame the learner.

## 4. Input and accessibility (U-04)

All letter tiles are focusable buttons with accessible names "Letter C".
Slots expose "Space 1 of 3, empty" or "Space 1 of 3, C, locked". Do not
announce unrevealed target letters. A revealed hint is announced as "Hint for
space 2: A". Locked tiles are no longer actionable, but remain readable.

- Pointer drag follows D-03; use `touch-action: none` on draggable tiles only,
  not on all controls or the entire document.
- Tap/click a tile to select it, then an empty slot to place. Selecting the
  selected tile again cancels; choosing another available tile changes selection.
- Tab follows controls -> available tiles -> answer positions in reading order.
  Enter/Space selects a tile or places it in a focused slot. Escape cancels a
  selection or closes settings. Occupied slots are readable but not drop actions.
- For keyboard/switch access in Great, focusing a tile pauses lane motion;
  focus/selection keeps its logical tile stable. Leaving the playfield without
  a selection resumes unless another pause reason applies.
- Announce outcomes once in a polite live region. After a correct placement,
  focus the next available tile; after wrong placement keep focus on that tile;
  after a removed foil focus the next available tile. On next puzzle focus the
  first available tile; do not move focus during pointer dragging.
- Honor `prefers-reduced-motion`: remove bounce/confetti/translations, retain
  static check/outline/announcement for the same feedback duration, and use
  D-04's static Great alternative. Muting does not suppress visual/ARIA cues.

## 5. Acceptance scenarios (U-05)

The timing values and domain outcomes referenced here are authoritative in
DEVSPEC, not duplicated constants in UI code.

```gherkin
Scenario: Start an offline MVP puzzle
  Given a valid English pack and no saved game
  When loading completes and I activate Start
  Then I see a target picture, one empty slot per target letter and shuffled target tiles
  And I see no hints, foils or moving lanes

Scenario: Correct placement locks
  Given CAT with its first slot empty
  When I drag C into the first slot
  Then the slot displays C with a check/locked indication
  And contextual letter feedback is presented
  And C is not draggable again

Scenario: Wrong target is not a foil
  Given CAT in Better with A available
  When I place A in the first empty slot
  Then I receive the gentle correction cue and A returns to the pool
  And no hint appears and A is not removed

Scenario: A foil reveals one position
  Given CAT in Better with foil B and all hints hidden
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
  When I close Settings without changing tier
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

Before release, capture Ready, all three Playing layouts, selection, correct,
wrong, revealed hint, pause, completion, settings, load failure and nonfatal
notice at minimum portrait/landscape sizes and one tablet size. Record focus,
screen-reader and contrast review. Screenshots support review; interactive
behavior and audio require tests, not screenshots alone.

Maintain Status, Version, Last update and the bottom log under the lifecycle
defined in DEVSPEC. No design approval has been granted in this draft.

## Spec change log

2026-10-21 — Copilot — Added the initial draft responsive design, complete screen/control states, accessible interactions and Gherkin acceptance scenarios; removed nothing.
