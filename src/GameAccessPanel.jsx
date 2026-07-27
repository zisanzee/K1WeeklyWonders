import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  closestCenter,
  DndContext,
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
  let gameNumber = 0;

  return games.map((game) => ({
    ...game,
    positionLabel: game.isBonus ? 'Bonus' : `Game ${++gameNumber}`,
  }));
}

function SortableGameRow({
  game,
  isPending,
  isOrderSaving,
  onToggle,
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
    disabled: isOrderSaving,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: game.unlocked ? game.tint : '#F8FAFC',
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 shadow-sm sm:px-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label={`Drag ${game.label} to change its position`}
          disabled={isOrderSaving}
          {...attributes}
          {...listeners}
          className="touch-none cursor-grab rounded-lg px-1 text-lg text-slate-400 hover:text-slate-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
        >
          ⠿
        </button>

        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl shadow-sm"
          style={{
            backgroundColor: game.unlocked ? game.hue : '#E2E8F0',
            filter: game.unlocked ? 'none' : 'grayscale(1)',
            opacity: game.unlocked ? 1 : 0.55,
          }}
        >
          {game.emoji}
        </span>

        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-indigo-500">
            {game.positionLabel}
          </p>
          <p className="truncate text-sm font-extrabold text-slate-700 sm:text-base">
            {game.label}
          </p>
          <p
            className={`text-xs font-bold ${
              game.unlocked ? 'text-emerald-500' : 'text-slate-400'
            }`}
          >
            {isPending ? 'Saving…' : game.unlocked ? 'Unlocked' : 'Coming soon'}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={game.unlocked}
        aria-label={`${game.unlocked ? 'Lock' : 'Unlock'} ${game.label}`}
        disabled={isPending || isOrderSaving}
        onClick={() => onToggle(game.key, !game.unlocked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          game.unlocked ? 'bg-emerald-400' : 'bg-slate-300'
        }`}
      >
        <span
          className="absolute top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[0.6rem] shadow-md"
          style={{ left: game.unlocked ? '1.75rem' : '0.25rem' }}
        >
          {isPending ? '…' : game.unlocked ? '🔓' : '🔒'}
        </span>
      </button>
    </li>
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
  const [error, setError] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const labeledGames = useMemo(() => withGameLabels(games), [games]);
  const unlockedCount = labeledGames.filter((game) => game.unlocked).length;
  const allUnlocked = labeledGames.length > 0 && unlockedCount === labeledGames.length;

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

  const markPending = (key, isPending) => {
    setPendingKeys((previous) => {
      const next = new Set(previous);
      isPending ? next.add(key) : next.delete(key);
      return next;
    });
  };

  const handleToggle = async (gameKey, nextValue) => {
    setError(null);
    markPending(gameKey, true);

    try {
      await setGameUnlocked(gameKey, nextValue, teacherCode);
    } catch (err) {
      setError(err.message || 'Something went wrong — try again.');
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
      setError(err.message || 'Something went wrong — try again.');
    } finally {
      setBulkPending(false);
    }
  };

  const handleDragEnd = async ({ active, over }) => {
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
        className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0 }}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Game access"
          className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"
        >
          <div className="bg-gradient-to-br from-sky-400 via-indigo-400 to-violet-500 px-6 pb-6 pt-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white sm:text-2xl">
                  🔓 Game Access
                </h2>
                <p className="mt-1 text-sm font-bold text-white/85">
                  Drag games to change their homepage order.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/30"
              >
                ✕
              </button>
            </div>

            {loaded && (
              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-extrabold text-white">
                  {unlockedCount} of {labeledGames.length} unlocked
                </span>

                <button
                  type="button"
                  disabled={bulkPending || isOrderSaving}
                  onClick={() => handleBulk(!allUnlocked)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-indigo-600 disabled:opacity-60"
                >
                  {bulkPending ? 'Working…' : allUnlocked ? 'Lock all' : 'Unlock all'}
                </button>
              </div>
            )}
          </div>

          <div className="overflow-y-auto px-5 py-5 sm:px-6">
            {error && (
              <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-500">
                ⚠️ {error}
              </p>
            )}

            {isOrderSaving && (
              <p className="mb-3 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-500">
                Saving game order…
              </p>
            )}

            {!loaded ? (
              <p className="py-8 text-center font-bold text-slate-400">
                Loading games…
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={labeledGames.map((game) => game.key)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="flex flex-col gap-2">
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
              </DndContext>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}