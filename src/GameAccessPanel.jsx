import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePlayerStore } from './playerStore';
import {
  setGameOrder,
  setGameShiny,
  setGameUnlocked,
  useGameAccessStore,
} from './gameAccess';

function copyGames(games) {
  return games.map((game) => ({ ...game }));
}

function addSlotLabels(games) {
  let nextGameNumber = 0;

  return games.map((game) => ({
    ...game,
    slotLabel: game.isBonus ? 'BONUS' : String(++nextGameNumber),
  }));
}

function GameIcon({ game }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base shadow-sm sm:h-10 sm:w-10 sm:text-lg"
      style={{
        background: game.unlocked
          ? `linear-gradient(135deg, ${game.hue}, ${game.hue}B8)`
          : '#CBD5E1',
        filter: game.unlocked ? 'none' : 'grayscale(1)',
        opacity: game.unlocked ? 1 : 0.65,
      }}
    >
      {game.emoji}
    </span>
  );
}

function AccessToggle({ game, disabled, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={game.unlocked}
      aria-label={`${game.unlocked ? 'Lock' : 'Unlock'} ${game.label}`}
      disabled={disabled}
      onClick={() => onToggle(game.key, !game.unlocked)}
      className={`relative h-8 w-[3.25rem] shrink-0 rounded-full border-2 [--switch-x:20px] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-55 sm:h-10 sm:w-[3.85rem] sm:[--switch-x:25px] ${
        game.unlocked
          ? 'border-emerald-500 bg-emerald-500'
          : 'border-slate-300 bg-slate-200'
      }`}
    >
      <motion.span
        animate={{ x: game.unlocked ? 'var(--switch-x)' : 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 34 }}
        className="absolute left-[3px] top-[3px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-[9px] font-black text-slate-700 shadow-sm sm:h-7 sm:w-7 sm:text-xs"
      >
        {game.unlocked ? '✓' : '—'}
      </motion.span>
    </button>
  );
}

function SlotLabel({ game }) {
  return (
    <span
      className={`pointer-events-none absolute left-2 top-2 z-20 flex min-w-7 items-center justify-center rounded-lg px-1.5 py-1 text-[10px] font-black shadow-sm ${
        game.isBonus
          ? 'bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white'
          : 'bg-indigo-600 text-white'
      }`}
    >
      {game.slotLabel}
    </span>
  );
}

function SortableGameSlot({
  game,
  isHoveredSlot,
  isJustMoved,
  disabled,
  onToggleAccess,
  onToggleShiny,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: game.key,
    disabled,
  });

  const cardTransform = isDragging
    ? transform
    : isHoveredSlot
      ? { x: 0, y: 12, scaleX: 1, scaleY: 1 }
      : null;

  return (
    <motion.li
      layout="position"
      transition={{
        layout: {
          type: 'spring',
          stiffness: 420,
          damping: 34,
          mass: 0.7,
        },
      }}
      className={`relative min-h-[84px] overflow-hidden rounded-2xl border-2 border-dashed p-1.5 transition-colors duration-200 ${
        isHoveredSlot
          ? 'border-indigo-400 bg-indigo-100/70'
          : game.isBonus
            ? 'border-fuchsia-200 bg-fuchsia-50/45'
            : 'border-indigo-100 bg-indigo-50/40'
      } ${isJustMoved ? 'ring-2 ring-amber-300 ring-offset-2' : ''}`}
    >
      <SlotLabel game={game} />

      <AnimatePresence>
        {isHoveredSlot && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -4 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-none absolute right-2 top-2 z-20 rounded-full bg-indigo-600 px-2 py-1 text-[9px] font-black text-white shadow-sm"
          >
            Drop here
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isJustMoved && !isHoveredSlot && (
          <motion.span
            initial={{ opacity: 0, scale: 0.85, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -4 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute right-2 top-2 z-20 rounded-full bg-amber-400 px-2 py-1 text-[9px] font-black text-amber-950 shadow-sm"
          >
            ✓ Placed here
          </motion.span>
        )}
      </AnimatePresence>

      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(cardTransform),
          transition: transition || 'transform 170ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          opacity: isDragging ? 0.32 : 1,
          willChange: 'transform',
        }}
        className={`relative min-h-[72px] overflow-hidden rounded-xl border transition-shadow duration-150 sm:min-h-[78px] ${
          game.unlocked
            ? 'border-white bg-white shadow-[0_5px_16px_rgba(41,65,109,0.1)]'
            : 'border-slate-200 bg-slate-100'
        }`}
      >
        {game.unlocked && (
          <span
            className="absolute inset-y-0 left-0 w-1"
            style={{ backgroundColor: game.hue }}
          />
        )}

        <div className="flex min-w-0 items-center gap-2 px-2 py-2.5 pl-10 sm:gap-3 sm:px-3 sm:py-3 sm:pl-11">
          <button
            type="button"
            aria-label={`Drag ${game.label} into another slot`}
            disabled={disabled}
            {...attributes}
            {...listeners}
            className="touch-none flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-8"
          >
            ⠿
          </button>

          <GameIcon game={game} />

          <div className="min-w-0 flex-1">
            {game.isBonus && (
              <p className="mb-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-fuchsia-700 sm:text-[10px]">
                Bonus game
              </p>
            )}

            <p className="text-[13px] font-extrabold leading-tight text-slate-900 sm:text-base">
              {game.label}
            </p>

            <p className="mt-1 whitespace-pre-line text-[10px] font-semibold leading-snug text-slate-600 sm:text-xs">
              {game.subtitle}
            </p>

            {game.shiny && (
              <span className="mt-1 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-black text-amber-700 sm:text-[9px]">
                ✨ Featured
              </span>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1.5 sm:flex-row sm:gap-2">
            <button
              type="button"
              onClick={() => onToggleShiny(game.key, !game.shiny)}
              disabled={disabled}
              aria-pressed={game.shiny}
              aria-label={`${game.shiny ? 'Remove shiny mark from' : 'Mark as shiny'} ${game.label}`}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10 sm:rounded-xl sm:text-lg ${
                game.shiny
                  ? 'bg-gradient-to-br from-amber-300 to-orange-400 text-white shadow-sm'
                  : 'bg-slate-200 text-slate-500 hover:bg-amber-100 hover:text-amber-600'
              }`}
            >
              ✨
            </button>

            <AccessToggle
              game={game}
              disabled={disabled}
              onToggle={onToggleAccess}
            />
          </div>
        </div>
      </div>
    </motion.li>
  );
}

function DragPreview({ game }) {
  if (!game) return null;

  return (
    <motion.div
      initial={{ opacity: 0.5, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1.02 }}
      transition={{ duration: 0.12 }}
      className="flex w-[min(380px,calc(100vw-1.5rem))] items-center gap-3 rounded-2xl border border-indigo-200 bg-white px-3 py-3 shadow-[0_20px_50px_rgba(51,65,149,0.25)]"
    >
      <GameIcon game={game} />

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-700">
          Moving game
        </p>
        <p className="truncate text-sm font-extrabold text-slate-900">
          {game.label}
        </p>
      </div>
    </motion.div>
  );
}

export default function GameAccessPanel({ onClose }) {
  const teacherCode = usePlayerStore((state) => state.teacherCode);
  const games = useGameAccessStore((state) => state.games);
  const loaded = useGameAccessStore((state) => state.loaded);
  const fetchGameAccess = useGameAccessStore((state) => state.fetchGameAccess);

  const [draftGames, setDraftGames] = useState([]);
  const [originalGames, setOriginalGames] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const initializedRef = useRef(false);
  const moveTimerRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!loaded) {
      fetchGameAccess();
      return;
    }

    if (!initializedRef.current) {
      const snapshot = copyGames(games);
      setDraftGames(snapshot);
      setOriginalGames(copyGames(snapshot));
      initializedRef.current = true;
    }
  }, [loaded, games, fetchGameAccess]);

  useEffect(() => {
    return () => {
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSaving, onClose]);

  const visibleGames =
    initializedRef.current && draftGames.length > 0 ? draftGames : games;

  const slottedGames = useMemo(
    () => addSlotLabels(visibleGames),
    [visibleGames]
  );

  const activeGame = useMemo(
    () => slottedGames.find((game) => game.key === activeKey),
    [activeKey, slottedGames]
  );

  const unlockedCount = visibleGames.filter((game) => game.unlocked).length;
  const allUnlocked =
    visibleGames.length > 0 && unlockedCount === visibleGames.length;

  const isReady = loaded && initializedRef.current && draftGames.length > 0;

  const hasChanges = useMemo(() => {
    if (!isReady || originalGames.length !== draftGames.length) return false;

    return draftGames.some((game, index) => {
      const original = originalGames[index];

      return (
        original.key !== game.key ||
        original.unlocked !== game.unlocked ||
        original.shiny !== game.shiny
      );
    });
  }, [draftGames, isReady, originalGames]);

  const changeCount = useMemo(() => {
    if (!isReady) return 0;

    const originalByKey = new Map(
      originalGames.map((game) => [game.key, game])
    );

    const settingChanges = draftGames.filter((game) => {
      const original = originalByKey.get(game.key);

      return (
        original &&
        (original.unlocked !== game.unlocked ||
          original.shiny !== game.shiny)
      );
    }).length;

    const orderChanged = draftGames.some(
      (game, index) => originalGames[index]?.key !== game.key
    );

    return settingChanges + (orderChanged ? 1 : 0);
  }, [draftGames, isReady, originalGames]);

  const handleToggleAccess = (gameKey, unlocked) => {
    setDraftGames((current) =>
      current.map((game) =>
        game.key === gameKey ? { ...game, unlocked } : game
      )
    );
  };

  const handleToggleShiny = (gameKey, shiny) => {
    setDraftGames((current) =>
      current.map((game) =>
        game.key === gameKey ? { ...game, shiny } : game
      )
    );
  };

  const handleBulk = (unlocked) => {
    setDraftGames((current) =>
      current.map((game) => ({
        ...game,
        unlocked,
      }))
    );
  };

  const handleReset = () => {
    setDraftGames(copyGames(originalGames));
    setLastMove(null);
    setError(null);
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveKey(null);
    setOverKey(null);

    if (!over || active.id === over.id || !isReady) return;

    const oldIndex = draftGames.findIndex((game) => game.key === active.id);
    const newIndex = draftGames.findIndex((game) => game.key === over.id);
    const nextGames = arrayMove(draftGames, oldIndex, newIndex);
    const movedGame = addSlotLabels(nextGames).find(
      (game) => game.key === active.id
    );

    setDraftGames(nextGames);
    setLastMove({
      gameKey: active.id,
      slotLabel: movedGame?.slotLabel || '',
    });

    if (moveTimerRef.current) clearTimeout(moveTimerRef.current);

    moveTimerRef.current = setTimeout(() => {
      setLastMove(null);
    }, 1800);
  };

  const handleConfirm = async () => {
    if (!hasChanges || isSaving) return;

    setError(null);
    setIsSaving(true);

    try {
      const originalByKey = new Map(
        originalGames.map((game) => [game.key, game])
      );

      const orderChanged = draftGames.some(
        (game, index) => originalGames[index]?.key !== game.key
      );

      if (orderChanged) {
        await setGameOrder(
          draftGames.map((game) => game.key),
          teacherCode
        );
      }

      const accessChanges = draftGames.filter((game) => {
        const original = originalByKey.get(game.key);
        return original && original.unlocked !== game.unlocked;
      });

      const shinyChanges = draftGames.filter((game) => {
        const original = originalByKey.get(game.key);
        return original && original.shiny !== game.shiny;
      });

      await Promise.all([
        ...accessChanges.map((game) =>
          setGameUnlocked(game.key, game.unlocked, teacherCode)
        ),
        ...shinyChanges.map((game) =>
          setGameShiny(game.key, game.shiny, teacherCode)
        ),
      ]);

      setOriginalGames(copyGames(draftGames));
    } catch (err) {
      setError(err.message || 'Could not save your changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/75 sm:items-center sm:p-4"
        onClick={() => {
          if (!isSaving) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Game access"
          className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-[#f5f7ff] shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-[2rem]"
        >
          <header className="shrink-0 bg-gradient-to-br from-[#315ed8] via-[#5a3fc4] to-[#972aa8] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-7 sm:pt-6">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/35 sm:hidden" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl shadow-sm">
                  🎮
                </span>

                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/80">
                    Teacher controls
                  </p>
                  <h2 className="truncate text-2xl font-black tracking-tight text-white">
                    Game Access
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                aria-label="Close game access"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-2xl font-bold text-white transition hover:bg-white/30 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <p className="mt-3 text-sm font-semibold leading-relaxed text-white">
              Rearrange, lock, unlock, and feature games freely. Save all changes together when ready.
            </p>

            <div className="mt-4 flex items-stretch gap-2">
              <div className="min-w-0 flex-1 rounded-2xl border border-white/20 bg-white/15 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-wide text-white/80">
                  Player access
                </p>
                <p className="mt-0.5 text-lg font-black text-white">
                  {unlockedCount}
                  <span className="text-sm font-bold text-white/90">
                    {' '}
                    / {visibleGames.length} open
                  </span>
                </p>
              </div>

              <button
                type="button"
                disabled={!isReady || isSaving}
                onClick={() => handleBulk(!allUnlocked)}
                className="min-h-14 rounded-2xl bg-white px-3 text-left text-sm font-black text-indigo-800 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {allUnlocked ? 'Lock all' : 'Unlock all'}
              </button>
            </div>
          </header>

          <main className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-3 py-4 sm:px-5">
            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-3 rounded-2xl border border-rose-300 bg-rose-50 px-3 py-3 text-sm font-bold text-rose-800"
                >
                  ⚠️ {error}
                </motion.p>
              )}
            </AnimatePresence>

            {!isReady && (
              <div className="mb-3 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-700">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                Loading saved access settings…
              </div>
            )}

            

            <p className="mb-3 px-1 text-sm font-bold text-slate-700">
              Hover over a slot to preview the new placement.
            </p>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              measuring={{
                droppable: {
                  strategy: MeasuringStrategy.WhileDragging,
                },
              }}
              onDragStart={({ active }) => {
                setActiveKey(active.id);
                setOverKey(null);
              }}
              onDragOver={({ over }) => {
                const nextOverKey = over?.id || null;

                setOverKey((current) =>
                  current === nextOverKey ? current : nextOverKey
                );
              }}
              onDragCancel={() => {
                setActiveKey(null);
                setOverKey(null);
              }}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={slottedGames.map((game) => game.key)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="flex flex-col gap-2.5">
                  {slottedGames.map((game) => (
                    <SortableGameSlot
                      key={game.key}
                      game={game}
                      isHoveredSlot={
                        overKey === game.key && activeKey !== game.key
                      }
                      isJustMoved={lastMove?.gameKey === game.key}
                      disabled={!isReady || isSaving}
                      onToggleAccess={handleToggleAccess}
                      onToggleShiny={handleToggleShiny}
                    />
                  ))}
                </ul>
              </SortableContext>

              <DragOverlay dropAnimation={null}>
                <DragPreview game={activeGame} />
              </DragOverlay>
            </DndContext>
          </main>

          <footer className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={!hasChanges || isSaving}
                className="min-h-11 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Reset
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={!hasChanges || isSaving}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-black text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isSaving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                    Saving…
                  </>
                ) : (
                  <>
                    Confirm changes
                    {changeCount > 0 && (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                        {changeCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>

            {hasChanges && !isSaving && (
              <p className="mt-2 text-center text-[11px] font-semibold text-amber-600">
                You have unsaved changes.
              </p>
            )}
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}