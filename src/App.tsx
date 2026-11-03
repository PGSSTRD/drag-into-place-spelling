import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPuzzle, makeCycle, reducePuzzle, type PuzzleState, type Tier } from "./domain/puzzle";
import {
  advanceMovement,
  createMovementState,
  releaseStoppedTile,
  stopMovingTile,
  type MovementState,
} from "./domain/movement";
import type { ContentPack, Level } from "./domain/content";
import { loadContentPack } from "./services/loadContent";
import { readProgress, restoreCycle, restoreProgress, saveProgress } from "./services/progress";
import { areAudioCuesAvailable, playAudioCue, unlockAudio } from "./services/audio";
import { postGameEvent } from "./services/bridge";
import "./styles.css";

interface LoadedGame {
  pack: ContentPack;
  level: Level;
  tier: Tier;
  puzzle: PuzzleState;
  cycleIds: number[];
  currentCycleIndex: number;
}

function reducer(_state: LoadedGame | null, next: LoadedGame | null): LoadedGame | null {
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function findSlotAt(x: number, y: number): number {
  const matches = [...document.querySelectorAll<HTMLElement>("[data-slot-index]")]
    .filter((slot) => {
      const rect = slot.getBoundingClientRect();
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    })
    .map((slot) => Number(slot.dataset.slotIndex))
    .sort((left, right) => left - right);
  return matches[0] ?? -1;
}

function persistSnapshot(state: PuzzleState, game: LoadedGame, userId: string | null): boolean {
  try {
    return saveProgress(
      window.localStorage,
      userId,
      state,
      game.pack.content_version,
      game.cycleIds,
      game.currentCycleIndex,
    );
  } catch {
    return false;
  }
}

export default function App() {
  const [game, setGame] = useReducer(reducer, null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [audioStatus, setAudioStatus] = useState<{ levelId: number; unavailable: boolean } | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [correctionId, setCorrectionId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);
  const [movement, setMovement] = useState<MovementState | null>(null);
  const [manualPause, setManualPause] = useState(false);
  const [keyboardPause, setKeyboardPause] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [pageVisible, setPageVisible] = useState(document.visibilityState === "visible");
  const [message, setMessage] = useState("Drag a letter, or choose a letter then a space.");
  const pointer = useRef<{ id: string; pointerId: number; x: number; y: number; offsetX: number; offsetY: number; moved: boolean; selectedOnDown: boolean } | null>(null);
  const ignoreClick = useRef(false);
  const pointerDrop = useRef(false);
  const keyboardNavigation = useRef(false);
  const puzzleRef = useRef<PuzzleState | null>(null);
  const activeSince = useRef<number | null>(null);
  const accumulatedMs = useRef(0);
  const sessionStarted = useRef(false);
  const startedRef = useRef(false);
  const movementRef = useRef<MovementState | null>(null);
  const activeAudioLevelId = useRef<number | null>(null);
  const failedAudioPaths = useRef(new Map<number, Set<string>>());
  const lanesRef = useRef<HTMLDivElement | null>(null);
  const playfieldRef = useRef<HTMLElement | null>(null);
  activeAudioLevelId.current = game?.level.level_id ?? null;
  const setMotion = (next: MovementState) => {
    movementRef.current = next;
    setMovement(next);
  };

  useEffect(() => {
    let alive = true;
    loadContentPack().then((pack) => {
      if (!alive) return;
      const query = new URLSearchParams(window.location.search);
      const requestedLanguage = query.get("cr_lang");
      if (window.ReactNativeWebView && !requestedLanguage) {
        throw new Error("CONTENT_INVALID: missing cr_lang");
      }
      if (requestedLanguage && requestedLanguage !== "english") {
        throw new Error("CONTENT_INVALID: unsupported language");
      }
      const requestedUser = query.get("cr_user_id");
      let storage: Storage | null = null;
      try {
        storage = window.localStorage;
      } catch {
        setNotice("You can play, but your progress can't be saved.");
      }
      const savedTier: Tier = "great";
      try {
        const key = `drag-into-place:v1:${encodeURIComponent(requestedUser || "guest")}:english:settings`;
        const settings = storage ? JSON.parse(storage.getItem(key) ?? "null") as { muted?: unknown } | null : null;
        setMuted(settings?.muted === true);
      } catch {
        setMuted(false);
      }
      const progressRead = storage
        ? readProgress(storage, requestedUser)
        : { kind: "unavailable" as const };
      const snapshot = progressRead.kind === "value" ? progressRead.snapshot : null;
      if (progressRead.kind === "invalid") setNotice("Let's start a new puzzle.");
      if (progressRead.kind === "unavailable") setNotice("You can play, but your progress can't be saved.");
      const savedLevelId = isRecord(snapshot) ? snapshot.level_id : null;
      const levelIds = pack.levels.map((entry) => entry.level_id);
      const generatedCycle = makeCycle(levelIds, Math.random);
      const savedCycle = restoreCycle(snapshot, levelIds, typeof savedLevelId === "number" ? savedLevelId : -1);
      const cycleIds = savedCycle?.cycleIds ?? generatedCycle;
      const currentCycleIndex = savedCycle?.currentCycleIndex ?? 0;
      let level = pack.levels.find((entry) => entry.level_id === cycleIds[currentCycleIndex]) ?? pack.levels[0];
      const restored = storage && snapshot !== null && savedCycle
        ? restoreProgress(snapshot, level, savedTier, pack.content_version)
        : null;
      if (snapshot !== null && !restored) setNotice("Let's start a new puzzle.");
      let puzzle = restored ?? createPuzzle(level, "great");
      let activeCycleIndex = currentCycleIndex;
      let activeCycleIds = cycleIds;
      if (restored?.phase === "completing") {
        activeCycleIndex += 1;
        if (activeCycleIndex >= activeCycleIds.length) {
          activeCycleIds = makeCycle(levelIds, Math.random);
          if (activeCycleIds.length > 1 && activeCycleIds[0] === level.level_id) {
            [activeCycleIds[0], activeCycleIds[1]] = [activeCycleIds[1], activeCycleIds[0]];
          }
          activeCycleIndex = 0;
        }
        level = pack.levels.find((entry) => entry.level_id === activeCycleIds[activeCycleIndex]) ?? pack.levels[0];
        puzzle = createPuzzle(level, "great");
      }
      accumulatedMs.current = puzzle.elapsedMs;
      movementRef.current = createMovementState(puzzle.availableTileIds);
      setMovement(movementRef.current);
      setHasSavedProgress(Boolean(restored && (restored.attempts > 0 || restored.slots.some((slot) => slot !== null) || restored.removedFoilIds.length > 0)));
      setGame({
        pack,
        level,
        tier: savedTier,
        puzzle,
        cycleIds: activeCycleIds,
        currentCycleIndex: activeCycleIndex,
      });
    }).catch((reason: unknown) => {
      if (!alive) return;
      const code = reason instanceof Error ? reason.message.match(/^(CONTENT_INVALID|BOOT_TIMEOUT)/)?.[1] : undefined;
      setError(code ?? "CONTENT_INVALID");
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!game) return;
    let active = true;
    const { level } = game;
    const requiredAudioPaths = [
      level.word_audio_path,
      ...level.letter_audio_paths,
      "assets/audios/incorrect.wav",
    ];
    void areAudioCuesAvailable(requiredAudioPaths).then((available) => {
      if (!active || activeAudioLevelId.current !== level.level_id) return;
      const failures = failedAudioPaths.current.get(level.level_id);
      setAudioStatus({
        levelId: level.level_id,
        unavailable: !available || (failures?.size ?? 0) > 0,
      });
    });
    return () => {
      active = false;
    };
  }, [game?.level]);

  function recordAudioFailure(levelId: number, path: string) {
    let failures = failedAudioPaths.current.get(levelId);
    if (!failures) {
      failures = new Set();
      failedAudioPaths.current.set(levelId, failures);
    }
    failures.add(path);
    if (activeAudioLevelId.current === levelId) {
      setAudioStatus({ levelId, unavailable: true });
    }
  }

  function handleAudioResult(levelId: number, path: string, result: Awaited<ReturnType<typeof playAudioCue>>) {
    if (result === "unavailable") recordAudioFailure(levelId, path);
    if (activeAudioLevelId.current !== levelId) return;
    if (result === "blocked") setAudioBlocked(true);
    if (result === "played") setAudioBlocked(false);
  }

  const puzzle = game?.puzzle ?? null;
  startedRef.current = started;
  puzzleRef.current = puzzle;
  const tileMap = useMemo(() => new Map(puzzle?.tiles.map((tile) => [tile.id, tile]) ?? []), [puzzle?.tiles]);
  const availableTiles = puzzle?.availableTileIds.map((id) => tileMap.get(id)).filter((tile) => tile !== undefined) ?? [];
  const movingNow = started && !reducedMotion && !manualPause && !keyboardPause &&
    !feedbackBusy && pageVisible && puzzle?.phase === "playing";

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!puzzle) return;
    const availableIds = puzzle.availableTileIds.filter((id) => id !== puzzle.selectedTileId);
    const next = createMovementState(availableIds);
    if (puzzle.selectedTileId) next.stopped = { id: puzzle.selectedTileId, lane: 0, x: 0 };
    setMotion(next);
  }, [reducedMotion]);

  useEffect(() => {
    if (!movingNow) return;
    let frame = 0;
    let previousTime: number | null = null;
    const animate = (time: number) => {
      if (previousTime !== null && movementRef.current) {
        const width = lanesRef.current?.clientWidth ?? 0;
        if (width > 0) setMotion(advanceMovement(movementRef.current, Math.min(time - previousTime, 100), width));
      }
      previousTime = time;
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [movingNow]);

  useEffect(() => {
    if (started && (manualPause || keyboardPause || document.visibilityState === "hidden")) pauseClock();
    else resumeClock();
  }, [started, manualPause, keyboardPause, pageVisible]);

  useEffect(() => {
    if (game) {
      const userId = new URLSearchParams(window.location.search).get("cr_user_id");
      try {
        if (!persistSnapshot(game.puzzle, game, userId)) {
          setNotice("You can play, but your progress can't be saved.");
        }
      } catch {
        setNotice("You can play, but your progress can't be saved.");
      }
    }
  }, [game]);

  function setPuzzle(nextPuzzle: PuzzleState, result: ReturnType<typeof reducePuzzle>["result"]) {
    if (!game) return;
    const previousTileId = puzzleRef.current?.selectedTileId;
    if (!reducedMotion && movementRef.current) {
      let nextMovement = movementRef.current;
      if (previousTileId && !nextPuzzle.selectedTileId) {
        nextMovement = releaseStoppedTile(nextMovement, nextPuzzle.availableTileIds.includes(previousTileId));
      }
      if (!previousTileId && nextPuzzle.selectedTileId) {
        nextMovement = stopMovingTile(nextMovement, nextPuzzle.selectedTileId);
      }
      setMotion(nextMovement);
    }
    puzzleRef.current = nextPuzzle;
    setGame({ ...game, puzzle: nextPuzzle });
    setSelectedId(nextPuzzle.selectedTileId);
    if (result === "correct") setMessage("Nice work!");
    if (result === "wrong") setMessage("Try another space.");
    if (result === "foil") setMessage("Here's a hint.");
  }

  function pauseClock(): number {
    if (activeSince.current !== null) {
      accumulatedMs.current += performance.now() - activeSince.current;
      activeSince.current = null;
    }
    return Math.floor(accumulatedMs.current);
  }

  function resumeClock(): void {
    if (startedRef.current && !feedbackBusy && puzzleRef.current?.phase === "playing" && activeSince.current === null) {
      activeSince.current = performance.now();
    }
  }

  function acquire(tileId: string) {
    const current = puzzleRef.current;
    if (!startedRef.current || !current || feedbackBusy) return;
    const result = reducePuzzle(current, { type: "acquire", tileId });
    setPuzzle(result.state, result.result);
  }

  function drop(slotIndex: number) {
    const current = puzzleRef.current;
    if (!startedRef.current || !current || !game || feedbackBusy) return;
    const currentGame = game;
    const result = reducePuzzle(current, { type: "drop", slotIndex });
    if (result.result === "neutral") {
      pointerDrop.current = false;
      return;
    }
    if (result.result === "wrong") setCorrectionId(current.selectedTileId);
    const nextPuzzle = { ...result.state, elapsedMs: pauseClock() };
    setPuzzle(nextPuzzle, result.result);
    if ((result.result === "correct" || result.result === "foil") && !pointerDrop.current) {
      window.setTimeout(() => document.querySelector<HTMLButtonElement>(".tile-pool button:not(:disabled)")?.focus(), 0);
    }
    pointerDrop.current = false;
    const nextGame = { ...currentGame, puzzle: nextPuzzle };
    setFeedbackBusy(true);
    const cuePath = result.result === "correct"
      ? currentGame.level.letter_audio_paths[slotIndex]
      : "assets/audios/incorrect.wav";
    const cue = playAudioCue(cuePath, muted).then((played) => {
      handleAudioResult(currentGame.level.level_id, cuePath, played);
      return played;
    });

    if (result.result === "correct" && result.state.phase === "completing") {
      if (!current.completionRecorded) {
        const userId = new URLSearchParams(window.location.search).get("cr_user_id");
        if (!persistSnapshot(nextPuzzle, currentGame, userId)) {
          setNotice("You can play, but your progress can't be saved.");
        }
        const score = nextPuzzle.slots.filter((slot) => slot !== null).length;
        postGameEvent({
          type: "level_completed",
          lang: "english",
          level_id: currentGame.level.level_id,
          tier: currentGame.tier,
          attempts: nextPuzzle.attempts,
          duration_ms: nextPuzzle.elapsedMs,
          score,
          max_score: nextPuzzle.slots.length,
        });
      }
      setMessage("You spelled it!");
      const wordCue = cue.then(() => playAudioCue(currentGame.level.word_audio_path, muted)).then((played) => {
        handleAudioResult(currentGame.level.level_id, currentGame.level.word_audio_path, played);
        return played;
      });
      Promise.all([wordCue, wait(1200)]).then(() => {
        advance(nextGame);
        setFeedbackBusy(false);
        setMessage("Drag a letter, or choose a letter then a space.");
      });
    } else {
      Promise.all([cue, wait(result.result === "foil" ? 250 : 300)]).then(() => {
        setFeedbackBusy(false);
        setCorrectionId(null);
        resumeClock();
      });
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (!startedRef.current || !puzzle || puzzle.phase !== "playing" || feedbackBusy || pointer.current) return;
    keyboardNavigation.current = false;
    setKeyboardPause(false);
    resumeClock();
    const selectedOnDown = puzzleRef.current?.selectedTileId === id;
    const rect = event.currentTarget.getBoundingClientRect();
    pointer.current = {
      id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
      selectedOnDown,
    };
    ignoreClick.current = true;
    playfieldRef.current?.setPointerCapture(event.pointerId);
    if (!selectedOnDown) acquire(id);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (!startedRef.current) return;
    const current = pointer.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) {
      current.moved = true;
      ignoreClick.current = true;
      acquire(current.id);
    }
    if (current.moved) {
      const bounds = playfieldRef.current?.getBoundingClientRect();
      if (!bounds) return;
      setDrag({
        id: current.id,
        x: clamp(event.clientX - current.offsetX, bounds.left, bounds.right - 52),
        y: clamp(event.clientY - current.offsetY, bounds.top, bounds.bottom - 52),
      });
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (!startedRef.current) return;
    const current = pointer.current;
    pointer.current = null;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.moved) {
      if (current.selectedOnDown && puzzleRef.current?.selectedTileId === current.id) {
        const result = reducePuzzle(puzzleRef.current, { type: "cancel" });
        setPuzzle(result.state, result.result);
      }
      window.setTimeout(() => { ignoreClick.current = false; }, 0);
      return;
    }
    setDrag(null);
    const bounds = playfieldRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const x = clamp(event.clientX - current.offsetX, bounds.left, bounds.right - 52) + 26;
    const y = clamp(event.clientY - current.offsetY, bounds.top, bounds.bottom - 52) + 26;
    const index = findSlotAt(x, y);
    if (index >= 0) {
      pointerDrop.current = true;
      drop(index);
    }
    else if (puzzleRef.current) {
      const result = reducePuzzle(puzzleRef.current, { type: "cancel" });
      setPuzzle(result.state, result.result);
    }
    window.setTimeout(() => { ignoreClick.current = false; }, 0);
  }

  function advance(currentGame: LoadedGame, startClock = started) {
    let cycleIds = currentGame.cycleIds;
    let currentCycleIndex = currentGame.currentCycleIndex + 1;
    if (currentCycleIndex >= cycleIds.length) {
      cycleIds = makeCycle(currentGame.pack.levels.map((level) => level.level_id), Math.random);
      if (cycleIds.length > 1 && cycleIds[0] === currentGame.level.level_id) {
        [cycleIds[0], cycleIds[1]] = [cycleIds[1], cycleIds[0]];
      }
      currentCycleIndex = 0;
    }
    const nextLevel = currentGame.pack.levels.find((level) => level.level_id === cycleIds[currentCycleIndex]) ?? currentGame.pack.levels[0];
    const nextPuzzle = createPuzzle(nextLevel, "great");
    setMotion(createMovementState(nextPuzzle.availableTileIds));
    accumulatedMs.current = 0;
    puzzleRef.current = nextPuzzle;
    setGame({ ...currentGame, level: nextLevel, puzzle: nextPuzzle, cycleIds, currentCycleIndex });
    setSelectedId(null);
    setHasSavedProgress(false);
    if (startClock) activeSince.current = performance.now();
    window.setTimeout(() => document.querySelector<HTMLButtonElement>(".tile-pool button:not(:disabled)")?.focus(), 0);
  }

  function startOrResume() {
    if (!game) return;
    unlockAudio();
    setStarted(true);
    if (!sessionStarted.current) {
      sessionStarted.current = true;
      postGameEvent({ type: "session_started", lang: "english", tier: game.tier });
    }
    if (game.puzzle.phase === "completing") {
      advance(game, true);
      setMessage("Drag a letter, or choose a letter then a space.");
    } else {
      activeSince.current = performance.now();
      window.setTimeout(() => document.querySelector<HTMLButtonElement>(".tile-pool button:not(:disabled)")?.focus(), 0);
    }
  }

  function toggleMute() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    const userId = new URLSearchParams(window.location.search).get("cr_user_id");
    const key = `drag-into-place:v1:${encodeURIComponent(userId || "guest")}:english:settings`;
    try {
      window.localStorage.setItem(key, JSON.stringify({ muted: nextMuted }));
    } catch {
      setNotice("You can play, but your settings can't be saved.");
    }
  }

  function renderTile(tile: NonNullable<typeof availableTiles[number]>, style?: CSSProperties) {
    if (!puzzle) return null;
    return (
      <button
        key={tile.id}
        className={`tile${selectedId === tile.id ? " selected" : ""}${correctionId === tile.id ? " wrong" : ""}${drag?.id === tile.id ? " dragging" : ""}`}
        style={style}
        aria-label={`Letter ${tile.letter}`}
        aria-pressed={selectedId === tile.id}
        disabled={!started || puzzle.phase !== "playing" || feedbackBusy || manualPause}
        onFocus={() => {
          if (!startedRef.current) return;
          if (keyboardNavigation.current) {
            setKeyboardPause(true);
            pauseClock();
          }
        }}
        onClick={() => {
          if (!startedRef.current || ignoreClick.current) return;
          if (selectedId === tile.id) {
            const result = reducePuzzle(puzzleRef.current ?? puzzle, { type: "cancel" });
            setPuzzle(result.state, result.result);
          } else acquire(tile.id);
        }}
        onPointerDown={(event) => onPointerDown(event, tile.id)}
      >
        {tile.letter}
      </button>
    );
  }

  const tilePool = reducedMotion ? (
    <div className="tile-pool" aria-label="Available letters">
      {availableTiles.map((tile) => renderTile(tile))}
    </div>
  ) : (
    <div
      className={`moving-lanes${manualPause ? " paused" : ""}`}
      ref={lanesRef}
      aria-label="Moving letters"
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof HTMLElement && next.classList.contains("tile"))) {
          setKeyboardPause(false);
          resumeClock();
        }
      }}
    >
      {[0, 1].map((lane) => (
        <div className={`moving-lane${started ? "" : " preview"}`} key={lane} aria-label={`Letter lane ${lane + 1}`}>
          {!started
            ? availableTiles.filter((_, index) => index % 2 === lane).map((tile) => renderTile(tile))
            : movement?.lanes.filter((tile) => tile.lane === lane).map((position) => {
                const tile = tileMap.get(position.id);
                return tile ? renderTile(tile, { left: `${position.x}px` }) : null;
              })}
          {started && movement?.stopped?.lane === lane && tileMap.has(movement.stopped.id) &&
            renderTile(tileMap.get(movement.stopped.id)!, { left: `${movement.stopped.x}px` })}
        </div>
      ))}
    </div>
  );

  useEffect(() => {
    const cancelInput = () => {
      pointer.current = null;
      setDrag(null);
      const current = puzzleRef.current;
      if (current?.selectedTileId) {
        const result = reducePuzzle(current, { type: "cancel" });
        setPuzzle(result.state, result.result);
      }
    };
    const visibilityChanged = () => {
      setPageVisible(document.visibilityState === "visible");
      if (document.visibilityState === "hidden") {
        const elapsedMs = pauseClock();
        cancelInput();
        if (game && puzzleRef.current) {
          const checkpoint = { ...puzzleRef.current, elapsedMs };
          const updated = { ...game, puzzle: checkpoint };
          puzzleRef.current = checkpoint;
          setGame(updated);
          try {
            if (!persistSnapshot(checkpoint, game, new URLSearchParams(window.location.search).get("cr_user_id"))) {
              setNotice("You can play, but your progress can't be saved.");
            }
          } catch {
            setNotice("You can play, but your progress can't be saved.");
          }
        }
      } else {
        resumeClock();
      }
    };
    window.addEventListener("blur", cancelInput);
    window.addEventListener("resize", cancelInput);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      window.removeEventListener("blur", cancelInput);
      window.removeEventListener("resize", cancelInput);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [game]);

  if (error) {
    return <main className="shell"><section className="card"><h1>We couldn't load this activity.</h1><p>Try again. Error code: {error}</p><button onClick={() => window.location.reload()}>Try loading again</button></section></main>;
  }
  if (!game || !puzzle) {
    return <main className="shell"><p role="status">Getting your letters ready...</p></main>;
  }

  return (
    <main className="shell" onKeyDown={(event) => {
      if (event.key === "Tab" || event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") {
        keyboardNavigation.current = true;
      }
      if (event.key === "Escape" && puzzleRef.current?.selectedTileId) {
        event.preventDefault();
        setPuzzle(reducePuzzle(puzzleRef.current, { type: "cancel" }).state, "neutral");
      }
    }} onPointerDown={() => {
      keyboardNavigation.current = false;
    }}>
      <header className="topbar">
        <h1>Drag Into Place</h1>
        {!reducedMotion && started && <button className="pause" aria-label={manualPause ? "Resume motion" : "Pause motion"} onClick={() => {
          if (manualPause) {
            setManualPause(false);
            resumeClock();
          } else {
            pauseClock();
            setManualPause(true);
          }
        }}>{manualPause ? "Resume" : "Pause"}</button>}
      </header>
      <section
        ref={playfieldRef}
        className={`card playfield${puzzle.phase === "completing" ? " completing" : ""}`}
        aria-label="Spelling activity"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointer.current = null;
          setDrag(null);
          if (puzzleRef.current?.selectedTileId) {
            setPuzzle(reducePuzzle(puzzleRef.current, { type: "cancel" }).state, "neutral");
          }
        }}
      >
        {!started && <button className="start" onClick={startOrResume}>{hasSavedProgress ? "Keep going!" : "Let's spell!"}</button>}
        <img className="target-image" src={new URL(game.level.image_path, document.baseURI).href} alt={game.level.image_alt} onError={() => setError("CONTENT_INVALID")} />
        <button className="replay" disabled={muted || !started || feedbackBusy || puzzle.phase !== "playing"} onClick={() => {
          playAudioCue(game.level.word_audio_path, muted).then((played) => {
            handleAudioResult(game.level.level_id, game.level.word_audio_path, played);
          });
        }}>Hear the word</button>
        <button className="sound-toggle" aria-label={muted ? "Sound off" : "Sound on"} aria-pressed={!muted} onClick={toggleMute}>{muted ? "Sound off" : "Sound on"}</button>
        {audioBlocked && <button className="enable-sound" onClick={() => {
          void unlockAudio().then((unlocked) => {
            if (unlocked) setAudioBlocked(false);
          });
        }}>Enable sound</button>}
        {!reducedMotion && <p className="motion-label">{keyboardPause ? "Motion paused for keyboard access." : manualPause ? "Paused" : ""}</p>}
        {reducedMotion && <p className="motion-label">Motion reduced</p>}
        {manualPause && <div className="pause-overlay"><p>Paused</p><button className="start" onClick={() => {
          setManualPause(false);
          resumeClock();
        }}>Resume</button></div>}
        {tilePool}
        <div className="answers" aria-label={`Answer spaces for ${game.level.target_word.length} letters`}>
          {puzzle.slots.map((tileId, index) => {
            const tile = tileId ? tileMap.get(tileId) : null;
            const revealed = puzzle.revealedHints.includes(index) && tileId === null;
            return (
              <div className="answer-cell" key={index}>
                <button
                  className={`slot${tile ? " locked" : ""}`}
                  data-slot-index={index}
                  aria-label={`Space ${index + 1} of ${puzzle.slots.length}, ${tile ? `${tile.letter}, locked` : "empty"}`}
                  disabled={!started || tile !== null || puzzle.phase !== "playing" || feedbackBusy}
                  onClick={() => {
                    if (!startedRef.current || ignoreClick.current) return;
                    if (selectedId) drop(index);
                  }}
                >
                  {tile?.letter ?? ""}
                  {tile && <span className="lock-mark" aria-hidden="true">✓</span>}
                </button>
                <span className={`hint${revealed ? " visible" : ""}`} aria-label={revealed ? `Hint for space ${index + 1}: ${game.level.target_word[index].toUpperCase()}` : undefined}>{revealed ? game.level.target_word[index].toUpperCase() : ""}</span>
              </div>
            );
          })}
        </div>
        <p className="status" role="status" aria-live="polite">{message}</p>
        {notice && <p className="notice" role="status">{notice}</p>}
        {audioStatus?.levelId === game.level.level_id && audioStatus.unavailable && (
          <p className="notice" role="status">Sound isn't available. You can still play.</p>
        )}
        {drag && <span className="drag-ghost" aria-hidden="true" style={{ left: drag.x, top: drag.y }}>{tileMap.get(drag.id)?.letter}</span>}
      </section>
    </main>
  );
}
