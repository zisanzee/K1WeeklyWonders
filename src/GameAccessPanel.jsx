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
  setGameShiny,
  setGameUnlocked,
  useGameAccessStore,
} from './gameAccess';

function GameIcon({ game }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg shadow-sm sm:h-11 sm:w-11 sm:text-xl"
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

function AccessToggle({ game, pending, disabled, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={game.unlocked}
      aria-label={`${game.unlocked ? 'Lock' : 'Unlock'} ${game.label}`}
      disabled={pending || disabled}
      onClick={() => onToggle(game.key, !game.unlocked)}
      className={`relative h-10 w-[3.85rem] shrink-0 rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-55 ${
        game.unlocked
          ? 'border-emerald-500 bg-emerald-500'
          : 'border-slate-300 bg-slate-200'
      }`}
    >
      <motion.span
        animate={{ x: game.unlocked ? 25 : 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 34 }}
        className="absolute left-[3px] top-[3px] flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-slate-700 shadow-sm"
      >
        {pending ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        ) : game.unlocked ? (
          '✓'
        ) : (
          '—'
        )}
      </motion.span>
    </button>
  );
}

function SortableGameRow({
  game,
  isPending,
  isOrderSaving,
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
    disabled: isOrderSaving,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
      className={`relative overflow-hidden rounded-2xl border ${
        game.unlocked
          ? 'border-slate-200 bg-white shadow-[0_5px_18px_rgba(41,65,109,0.1)]'
          : 'border-slate-200 bg-slate-100'
      }`}
    >
      {game.unlocked && (
        <span
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ backgroundColor: game.hue }}
        />
      )}

      <div className="flex min-w-0 items-center gap-2 px-2.5 py-3 sm:gap-3 sm:px-4">
        <button
          type="button"
          aria-label={`Drag ${game.label} to change its position`}
          disabled={isOrderSaving}
          {...attributes}
          {...listeners}
          className="touch-none flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-xl text-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
        >
          ⠿
        </button>

        <GameIcon game={game} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={`truncate text-[10px] font-black uppercase tracking-[0.1em] ${
                game.isBonus ? 'text-fuchsia-700' : 'text-indigo-700'
              }`}
            >
              {game.isBonus ? 'Bonus game' : 'Learning game'}
            </p>

            {game.shiny && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-700">
                ✨ Featured
              </span>
            )}
          </div>

          <p className="truncate text-[14px] font-extrabold leading-5 text-slate-900 sm:text-base">
            {game.label}
          </p>

          <p className="mt-0.5 whitespace-pre-line text-[11px] font-semibold leading-snug text-slate-600 sm:text-xs">
            {game.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onToggleShiny(game.key, !game.shiny)}
          disabled={isPending || isOrderSaving}
          aria-pressed={game.shiny}
          aria-label={`${game.shiny ? 'Remove shiny mark from' : 'Mark as shiny'} ${game.label}`}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition disabled:cursor-not-allowed disabled:opacity-50 ${
            game.shiny
              ? 'bg-gradient-to-br from-amber-300 to-orange-400 text-white shadow-sm'
              : 'bg-slate-200 text-slate-500 hover:bg-amber-100 hover:text-amber-600'
          }`}
        >
          ✨
        </button>

        <AccessToggle
          game={game}
          pending={isPending}
          disabled={isOrderSaving}
          onToggle={onToggleAccess}
        />
      </div>
    </li>
  );
}

function DragPreview({ game }) {
  if (!game) return null;

  return (
    <div className="flex w-[min(390px,calc(100vw-1.5rem))] items-center gap-3 rounded-2xl border border-indigo-200 bg-white px-3 py-3 shadow-[0_20px_50px_rgba(51,65,149,0.25)]">
      <GameIcon game={game} />

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-700">
          Moving game
        </p>
        <p className="truncate text-sm font-extrabold text-slate-900">
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

  const activeGame = useMemo(
    () => games.find((game) => game.key === activeKey),
    [activeKey, games]
  );

  const unlockedCount = games.filter((game) => game.unlocked).length;
  const allUnlocked = games.length > 0 && unlockedCount === games.length;

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

  const handleToggleAccess = async (gameKey, unlocked) => {
    setError(null);
    markPending(gameKey, true);

    try {
      await setGameUnlocked(gameKey, unlocked, teacherCode);
    } catch (err) {
      setError(err.message || 'Could not update game access.');
    } finally {
      markPending(gameKey, false);
    }
  };

  const handleToggleShiny = async (gameKey, shiny) => {
    setError(null);
    markPending(gameKey, true);

    try {
      await setGameShiny(gameKey, shiny, teacherCode);
    } catch (err) {
      setError(err.message || 'Could not update featured game.');
    } finally {
      markPending(gameKey, false);
    }
  };

  const handleBulk = async (unlocked) => {
    setError(null);
    setBulkPending(true);

    try {
      await Promise.all(
        games
          .filter((game) => game.unlocked !== unlocked)
          .map((game) => setGameUnlocked(game.key, unlocked, teacherCode))
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
        className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4"
        onClick={onClose}
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
                aria-label="Close game access"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-2xl font-bold text-white transition hover:bg-white/30"
              >
                ×
              </button>
            </div>

            <p className="mt-3 text-sm font-semibold leading-relaxed text-white">
              Choose player access, mark featured games, and drag to reorder.
            </p>

            {loaded && (
              <div className="mt-4 flex items-stretch gap-2">
                <div className="min-w-0 flex-1 rounded-2xl border border-white/20 bg-white/15 px-3 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wide text-white/80">
                    Player access
                  </p>
                  <p className="mt-0.5 text-lg font-black text-white">
                    {unlockedCount}
                    <span className="text-sm font-bold text-white/90">
                      {' '}
                      / {games.length} open
                    </span>
                  </p>
                </div>

                <button
                  type="button"
                  disabled={bulkPending || isOrderSaving}
                  onClick={() => handleBulk(!allUnlocked)}
                  className="min-h-14 rounded-2xl bg-white px-3 text-left text-sm font-black text-indigo-800 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkPending
                    ? 'Working…'
                    : allUnlocked
                      ? 'Lock all'
                      : 'Unlock all'}
                </button>
              </div>
            )}
          </header>

          <main className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
            {error && (
              <p className="mb-3 rounded-2xl border border-rose-300 bg-rose-50 px-3 py-3 text-sm font-bold text-rose-800">
                ⚠️ {error}
              </p>
            )}

            {isOrderSaving && (
              <div className="mb-3 flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-sm font-bold text-indigo-800">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                Saving your new game order…
              </div>
            )}

            {!loaded ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div
                    key={item}
                    className="h-20 animate-pulse rounded-2xl bg-slate-200"
                  />
                ))}
              </div>
            ) : (
              <>
                <p className="mb-3 px-1 text-sm font-bold text-slate-700">
                  Use the ⠿ handle to reorder games.
                </p>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={({ active }) => setActiveKey(active.id)}
                  onDragCancel={() => setActiveKey(null)}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={games.map((game) => game.key)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="flex flex-col gap-2.5">
                      {games.map((game) => (
                        <SortableGameRow
                          key={game.key}
                          game={game}
                          isPending={pendingKeys.has(game.key)}
                          isOrderSaving={isOrderSaving}
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

                <p className="px-2 py-4 text-center text-xs font-semibold text-slate-600">
                  Bonus games remain in order but never use up a homepage game number.
                </p>
              </>
            )}
          </main>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}