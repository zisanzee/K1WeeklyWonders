import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
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
  setGameUnlocked,
  useGameAccessStore,
} from './gameAccess';

function withGameLabels(games) {
  let nextGameNumber = 0;

  return games.map((game) => ({
    ...game,
    positionLabel: game.isBonus ? 'Bonus' : `Game ${++nextGameNumber}`,
    displayNumber: game.isBonus ? '★' : nextGameNumber,
  }));
}

function GameIcon({ game, large = false }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-2xl shadow-sm ${
        large
          ? 'h-11 w-11 text-xl sm:h-12 sm:w-12 sm:text-2xl'
          : 'h-10 w-10 text-lg sm:h-11 sm:w-11 sm:text-xl'
      }`}
      style={{
        background: game.unlocked
          ? `linear-gradient(135deg, ${game.hue}, ${game.hue}B8)`
          : '#E2E8F0',
        filter: game.unlocked ? 'none' : 'grayscale(1)',
        opacity: game.unlocked ? 1 : 0.62,
      }}
    >
      {game.emoji}
    </span>
  );
}

function Toggle({ game, pending, disabled, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={game.unlocked}
      aria-label={`${game.unlocked ? 'Lock' : 'Unlock'} ${game.label}`}
      disabled={pending || disabled}
      onClick={() => onToggle(game.key, !game.unlocked)}
      className={`relative h-8 w-[3.65rem] shrink-0 rounded-full border-2 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-55 ${
        game.unlocked
          ? 'border-emerald-300 bg-emerald-400'
          : 'border-slate-200 bg-slate-200'
      }`}
    >
      <motion.span
        animate={{ x: game.unlocked ? 27 : 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 34 }}
        className="absolute left-[3px] top-[3px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-[10px] shadow-sm"
      >
        {pending ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
        ) : game.unlocked ? (
          '✓'
        ) : (
          '•'
        )}
      </motion.span>
    </button>
  );
}

function SortableGameRow({ game, isPending, isOrderSaving, onToggle }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: game.key,
    disabled: isOrderSaving,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group relative overflow-hidden rounded-[1.25rem] border transition-colors sm:rounded-[1.4rem] ${
        game.unlocked
          ? 'border-white bg-white shadow-[0_5px_18px_rgba(41,65,109,0.08)]'
          : 'border-slate-100 bg-slate-50/80'
      }`}
    >
      {game.unlocked && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 top-0 w-1"
          style={{ backgroundColor: game.hue }}
        />
      )}

      <div className="flex min-w-0 items-center gap-2 px-2.5 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <button
          type="button"
          aria-label={`Drag ${game.label} to change its position`}
          disabled={isOrderSaving}
          {...attributes}
          {...listeners}
          className="-ml-2 touch-none flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-xl text-xl text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
        >
          ⠿
        </button>

        <div
          className={`flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-1 text-[11px] font-black shadow-sm sm:h-9 sm:min-w-9 sm:rounded-xl sm:px-1.5 sm:text-xs ${
            game.isBonus
              ? 'bg-gradient-to-br from-fuchsia-400 to-violet-500 text-white'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {game.displayNumber}
        </div>

        <GameIcon game={game} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className={`truncate text-[10px] font-black uppercase tracking-[0.1em] ${
                game.isBonus ? 'text-fuchsia-500' : 'text-indigo-500'
              }`}
            >
              {game.positionLabel}
            </p>

            {game.isBonus && (
              <span className="hidden rounded-full bg-fuchsia-50 px-1.5 py-0.5 text-[9px] font-extrabold text-fuchsia-500 min-[390px]:inline">
                Does not count
              </span>
            )}
          </div>

          <p className="truncate text-[13px] font-extrabold text-slate-700 sm:text-base">
            {game.label}
          </p>

          <p
            className={`mt-0.5 truncate text-[11px] font-bold sm:text-xs ${
              game.unlocked ? 'text-emerald-500' : 'text-slate-400'
            }`}
          >
            {isPending
              ? 'Saving access…'
              : game.unlocked
                ? 'Available to players'
                : 'Coming soon'}
          </p>
        </div>

        <Toggle
          game={game}
          pending={isPending}
          disabled={isOrderSaving}
          onToggle={onToggle}
        />
      </div>
    </li>
  );
}

function DragPreview({ game }) {
  if (!game) return null;

  return (
    <div className="flex w-[min(390px,calc(100vw-1.5rem))] items-center gap-3 rounded-[1.4rem] border border-indigo-100 bg-white px-3 py-3 shadow-[0_20px_50px_rgba(51,65,149,0.25)] sm:px-4">
      <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-indigo-500 px-1 text-[11px] font-black text-white sm:h-9 sm:min-w-9 sm:rounded-xl sm:text-xs">
        {game.displayNumber}
      </span>

      <GameIcon game={game} />

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-500">
          Moving {game.positionLabel}
        </p>
        <p className="truncate text-sm font-extrabold text-slate-700">
          {game.label}
        </p>
      </div>
    </div>
  );
}

export default function GameAccessPanel({ onClose }) {
  const teacherCode = usePlayerStore((state) => state.teacherCode);
  const games = useGameAccessStore((state) => state.games);
  const loaded = useGameAccessStore((state) => state.loaded);
  const fetchGameAccess = useGameAccessStore((state) => state.fetchGameAccess);
  const setOrderLocal = useGameAccessStore((state) => state.setOrderLocal);

  const [pendingKeys, setPendingKeys] = useState(() => new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [isOrderSaving, setIsOrderSaving] = useState(false);
  const [activeKey, setActiveKey] = useState(null);
  const [error, setError] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const labeledGames = useMemo(() => withGameLabels(games), [games]);
  const activeGame = labeledGames.find((game) => game.key === activeKey);
  const unlockedCount = labeledGames.filter((game) => game.unlocked).length;
  const allUnlocked =
    labeledGames.length > 0 && unlockedCount === labeledGames.length;

  useEffect(() => {
    if (!loaded) fetchGameAccess();
  }, [loaded, fetchGameAccess]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const markPending = (key, pending) => {
    setPendingKeys((current) => {
      const next = new Set(current);
      pending ? next.add(key) : next.delete(key);
      return next;
    });
  };

  const handleToggle = async (gameKey, nextValue) => {
    setError(null);
    markPending(gameKey, true);

    try {
      await setGameUnlocked(gameKey, nextValue, teacherCode);
    } catch (err) {
      setError(err.message || 'Could not update game access.');
    } finally {
      markPending(gameKey, false);
    }
  };

  const handleBulk = async (nextValue) => {
    setError(null);
    setBulkPending(true);

    try {
      await Promise.all(
        labeledGames
          .filter((game) => game.unlocked !== nextValue)
          .map((game) => setGameUnlocked(game.key, nextValue, teacherCode))
      );
    } catch (err) {
      setError(err.message || 'Could not update every game.');
    } finally {
      setBulkPending(false);
    }
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveKey(null);

    if (!over || active.id === over.id) return;

    const oldIndex = games.findIndex((game) => game.key === active.id);
    const newIndex = games.findIndex((game) => game.key === over.id);
    const nextGames = arrayMove(games, oldIndex, newIndex);
    const gameKeys = nextGames.map((game) => game.key);

    setError(null);
    setOrderLocal(gameKeys);
    setIsOrderSaving(true);

    try {
      await setGameOrder(gameKeys, teacherCode);
    } catch (err) {
      setError(err.message || 'Could not save the new order.');
      await fetchGameAccess();
    } finally {
      setIsOrderSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-5"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 22 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 22 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Game access"
          className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] bg-[#F7F8FF] shadow-2xl sm:max-h-[90vh] sm:rounded-[2rem]"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-[#4f7cf5] via-[#7658dd] to-[#b64ccc] px-4 pb-4 pt-4 sm:px-7 sm:pb-6 sm:pt-6">
            <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full border-[18px] border-white/10" />
            <div className="pointer-events-none absolute -bottom-20 left-8 h-32 w-32 rounded-full bg-white/10" />

            <div className="relative mx-auto mb-3 h-1 w-10 rounded-full bg-white/30 sm:hidden" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-xl shadow-sm sm:h-12 sm:w-12 sm:text-2xl">
                  🎮
                </span>

                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">
                    Teacher controls
                  </p>
                  <h2 className="truncate text-xl font-black tracking-tight text-white sm:text-2xl">
                    Game Access
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close game access"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-lg font-bold text-white transition hover:bg-white/25"
              >
                ×
              </button>
            </div>

            <p className="relative mt-3 max-w-sm text-xs font-semibold leading-relaxed text-white/85 sm:mt-4 sm:text-sm">
              Drag games into your learning order. Changes save for every player.
            </p>

            {loaded && (
              <div className="relative mt-4 grid grid-cols-1 gap-2 min-[390px]:grid-cols-2 sm:mt-5">
                <div className="rounded-2xl border border-white/15 bg-white/15 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-white/65">
                    Player access
                  </p>
                  <p className="mt-0.5 text-lg font-black text-white">
                    {unlockedCount}
                    <span className="text-sm text-white/70">
                      {' '}
                      / {labeledGames.length} open
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  disabled={bulkPending || isOrderSaving}
                  onClick={() => handleBulk(!allUnlocked)}
                  className="rounded-2xl bg-white px-3 py-2.5 text-left shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="text-[10px] font-black uppercase tracking-wide text-indigo-400">
                    Quick action
                  </p>
                  <p className="mt-0.5 text-sm font-black text-indigo-600">
                    {bulkPending
                      ? 'Working…'
                      : allUnlocked
                        ? 'Lock all games'
                        : 'Unlock all games'}
                  </p>
                </button>
              </div>
            )}
          </div>

          <div className="min-h-0 overscroll-contain overflow-y-auto px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-3 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-600"
                >
                  ⚠️ {error}
                </motion.p>
              )}
            </AnimatePresence>

            {isOrderSaving && (
              <div className="mb-3 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-600">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" />
                Saving your new game order…
              </div>
            )}

            {!loaded ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div
                    key={item}
                    className="h-[72px] animate-pulse rounded-[1.25rem] bg-slate-200/70 sm:h-[76px] sm:rounded-[1.4rem]"
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className="text-base">↕️</span>
                  <p className="text-xs font-bold text-slate-500">
                    Hold the dots and drag to reorder.
                  </p>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={({ active }) => setActiveKey(active.id)}
                  onDragCancel={() => setActiveKey(null)}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={labeledGames.map((game) => game.key)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="flex flex-col gap-2.5">
                      {labeledGames.map((game) => (
                        <SortableGameRow
                          key={game.key}
                          game={game}
                          isPending={pendingKeys.has(game.key)}
                          isOrderSaving={isOrderSaving}
                          onToggle={handleToggle}
                        />
                      ))}
                    </ul>
                  </SortableContext>

                  <DragOverlay dropAnimation={null}>
                    <DragPreview game={activeGame} />
                  </DragOverlay>
                </DndContext>

                <p className="px-2 pb-1 pt-4 text-center text-[11px] font-semibold text-slate-400">
                  Bonus games stay in order but never use up a game number.
                </p>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}