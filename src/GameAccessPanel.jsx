import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  addGameToClass,
  removeGameFromClass,
  mergeRows,
  GAME_CATALOG,
  useGameAccessStore,
} from './gameAccess';
import { CLASS_TYPE_CONFIG } from './teacherCodes';
import { useStudentStore, addStudent } from './students';
import { fetchClassInfo } from './classInfo';

const CLASS_TYPE_LABELS = {
  k1: { label: 'K1 Games', icon: '🎮', description: 'Manage K1 (Kindergarten 1) game arrangement — reorder, lock/unlock, and feature games.' },
  k2: { label: 'K2 Games', icon: '🎯', description: 'Manage K2 (Kindergarten 2) game arrangement — reorder, lock/unlock, and feature games.' },
};

function AdminTabBar({ activeTab, onChange, disabled, adminClassType }) {
  const tabs = [
    { key: 'k1-games', label: 'K1 Games', icon: '🎮', description: CLASS_TYPE_LABELS.k1.description },
    { key: 'k2-games', label: 'K2 Games', icon: '🎯', description: CLASS_TYPE_LABELS.k2.description },
    { key: 'students', label: 'Students', icon: '🧑‍🎓', description: 'Manage the students enrolled in this class.' },
    { key: 'settings', label: 'Settings', icon: '⚙️', description: 'Configure settings for this class.' },
  ];

  return (
    <div className="mx-auto max-w-5xl overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div role="tablist" aria-label="Admin panel sections" className="flex min-w-max gap-1 border-b border-white/15 sm:min-w-0 sm:gap-2">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              disabled={disabled}
              className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1 sm:justify-center sm:px-4 sm:text-sm ${
                isActive ? 'text-white' : 'text-white/60 hover:text-white/85'
              }`}
            >
              <span className="text-sm sm:text-base">{tab.icon}</span>
              {tab.label}
              {isActive && (
                <motion.span
                  layoutId="access-tab-indicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-white sm:inset-x-4"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeacherTabBar({ activeTab, onChange, disabled }) {
  const tabs = [
    { key: 'games', label: 'Games', icon: '🎮', description: 'View your class\'s current game arrangement.' },
    { key: 'students', label: 'Students', icon: '🧑‍🎓', description: 'Manage the students enrolled in this class.' },
    { key: 'settings', label: 'Settings', icon: '⚙️', description: 'Configure settings for this class.' },
  ];

  return (
    <div className="mx-auto max-w-5xl overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div role="tablist" aria-label="Teacher panel sections" className="flex min-w-max gap-1 border-b border-white/15 sm:min-w-0 sm:gap-2">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              disabled={disabled}
              className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1 sm:justify-center sm:px-4 sm:text-sm ${
                isActive ? 'text-white' : 'text-white/60 hover:text-white/85'
              }`}
            >
              <span className="text-sm sm:text-base">{tab.icon}</span>
              {tab.label}
              {isActive && (
                <motion.span
                  layoutId="access-tab-indicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-white sm:inset-x-4"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StudentAvatar({ name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-black text-white">
      {initial}
    </span>
  );
}

function AddStudentForm({ onAdd, isSaving, error }) {
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedName = fullName.trim();
    if (!trimmedName) return;
    onAdd({ fullName: trimmedName, nickname: nickname.trim() }, () => {
      setFullName('');
      setNickname('');
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 flex flex-col gap-2 rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm sm:flex-row sm:items-end sm:gap-3 sm:p-4"
    >
      <div className="flex-1">
        <label htmlFor="student-full-name" className="mb-1 block text-[11px] font-black text-slate-600">
          Full name
        </label>
        <input
          id="student-full-name"
          type="text"
          value={fullName}
          maxLength={80}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="e.g. Nur Aisyah binti Rahman"
          disabled={isSaving}
          className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="flex-1">
        <label htmlFor="student-nickname" className="mb-1 block text-[11px] font-black text-slate-600">
          Nickname (optional)
        </label>
        <input
          id="student-nickname"
          type="text"
          value={nickname}
          maxLength={40}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="e.g. Aisyah"
          disabled={isSaving}
          className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <button
        type="submit"
        disabled={isSaving || !fullName.trim()}
        className="flex min-h-[2.75rem] shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-black text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
            Adding…
          </>
        ) : (
          '+ Add new student'
        )}
      </button>

      {error && (
        <p className="w-full rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 sm:basis-full" role="alert">
          ⚠️ {error}
        </p>
      )}
    </form>
  );
}

function StudentsTab({ isReady, students, onAdd, isSaving, error }) {
  return (
    <div>
      <AddStudentForm onAdd={onAdd} isSaving={isSaving} error={error} />

      {!isReady && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-700">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          Loading students…
        </div>
      )}

      {isReady && students.length === 0 && (
        <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 px-5 py-10 text-center">
          <span className="text-4xl">🧑‍🎓</span>
          <p className="mt-3 text-base font-black text-indigo-950">No students yet</p>
          <p className="mt-1 text-sm font-semibold text-indigo-700">
            Add your first student using the form above.
          </p>
        </div>
      )}

      {isReady && students.length > 0 && (
        <ul className="flex flex-col gap-2">
          {students.map((student) => (
            <li
              key={student.studentId}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"
            >
              <StudentAvatar name={student.nickname || student.fullName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-800">{student.fullName}</p>
                {student.nickname && (
                  <p className="truncate text-xs font-bold text-slate-500">"{student.nickname}"</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold text-slate-500">
                {student.studentId.slice(0, 8)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClassImage({ image, className }) {
  if (image) {
    return (
      <img
        src={image}
        alt={className || 'Class photo'}
        className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-sm sm:h-24 sm:w-24"
      />
    );
  }

  return (
    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-200 to-violet-200 text-3xl shadow-sm sm:h-24 sm:w-24">
      🏫
    </span>
  );
}

function ClassInfoTab({ status, classInfo, error }) {
  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-700">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
        Loading class information…
      </div>
    );
  }

  if (status === 'error' || !classInfo) {
    return (
      <p className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-3 text-sm font-bold text-rose-800">
        ⚠️ {error || 'Could not load class information.'}
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-4">
        <ClassImage image={classInfo.image} className={classInfo.className} />
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-slate-900">{classInfo.className}</p>
          <p className="mt-0.5 font-mono text-xs font-bold text-slate-500">{classInfo.classId}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
          Teachers
        </p>
        {classInfo.teachers.length === 0 ? (
          <p className="text-sm font-semibold text-slate-500">No teachers assigned to this class yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {classInfo.teachers.map((name) => (
              <li
                key={name}
                className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

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

// Admin-only: full edit controls for a specific class type (k1 or k2).
// Uses classId-based endpoints as a fallback until the server supports
// classType-scoped reads/writes (Phases 1-4 in the server repo).
// Uses writeCode (a teacher code that resolves to the target classId on the
// server) for all API writes, since the server derives classId from the
// teacher code rather than from body.classId. K1 uses 12/10/22 → k12026-pny,
// K2 uses 92702689 → test2026-jyx.
function GameAccessTypeEditor({
  classType,
  classId,
  teacherCode,     // the logged-in user's code (for auth display only)
  writeCode,       // the code whose classId matches this editor's target
  isSaving,
  onGlobalError,
  onGlobalSavingChange,
}) {
  const [games, setGames] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draftGames, setDraftGames] = useState([]);
  const [originalGames, setOriginalGames] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [localSaving, setLocalSaving] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [shopSavingKey, setShopSavingKey] = useState(null);

  const initializedRef = useRef(false);
  const moveTimerRef = useRef(null);
  const fetchAttemptedRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  // Fetch games via classId-based endpoint (server doesn't support
  // ?classType= yet — Phases 1-4). Merge raw rows with GAME_CATALOG
  // so the sortable slots have emoji, label, hue, subtitle, etc.
  useEffect(() => {
    if (fetchAttemptedRef.current) return;
    fetchAttemptedRef.current = true;
    setLoading(true);

    fetch(`${API_BASE}/api/game-access?classId=${encodeURIComponent(classId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((rows) => {
        const merged = mergeRows(rows);
        setGames(merged);
        setLoaded(true);
        setLoading(false);
      })
      .catch((err) => {
        setLocalError(err.message);
        setLoading(false);
      });
  }, [classId, teacherCode]);

  // Initialize draft once games are loaded
  useEffect(() => {
    if (!loaded || initializedRef.current) return;
    const snapshot = copyGames(games);
    setDraftGames(snapshot);
    setOriginalGames(copyGames(snapshot));
    initializedRef.current = true;
  }, [loaded, games]);

  useEffect(() => {
    return () => {
      if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
    };
  }, []);

  const visibleGames = initializedRef.current ? draftGames : games;

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

  const isReady = loaded && initializedRef.current;

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
    setLocalError(null);
    onGlobalError(null);
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
    if (!hasChanges || localSaving || isSaving) return;

    setLocalError(null);
    onGlobalError(null);
    setLocalSaving(true);
    onGlobalSavingChange(true);

    try {
      const originalByKey = new Map(
        originalGames.map((game) => [game.key, game])
      );

      const orderChanged = draftGames.some(
        (game, index) => originalGames[index]?.key !== game.key
      );

      // Use classId-based mutators until the server supports classType
      // (Phases 1-4 in the server repo). Swap to setGameOrderForType/
      // setGameUnlockedForType etc. once the server is updated.
      if (orderChanged) {
        await setGameOrder(
          draftGames.map((game) => game.key),
          writeCode,
          classId
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
          setGameUnlocked(game.key, game.unlocked, writeCode, classId)
        ),
        ...shinyChanges.map((game) =>
          setGameShiny(game.key, game.shiny, writeCode, classId)
        ),
      ]);

      setOriginalGames(copyGames(draftGames));
    } catch (err) {
      setLocalError(err.message || 'Could not save your changes. Please try again.');
    } finally {
      setLocalSaving(false);
      onGlobalSavingChange(false);
    }
  };

  const handleShopToggle = async (game) => {
    if (shopSavingKey || localSaving || isSaving) return;
    const isAdded = visibleGames.some((item) => item.key === game.key);
    setLocalError(null);
    onGlobalError(null);
    setShopSavingKey(game.key);

    try {
      if (isAdded) {
        await removeGameFromClass(game.key, writeCode, classId);
      } else {
        await addGameToClass(game.key, writeCode, classId);
      }
      // Refresh games after shop change using classId-based endpoint
      const res = await fetch(`${API_BASE}/api/game-access?classId=${encodeURIComponent(classId)}`);
      const rows = await res.json();
      const nextGames = mergeRows(rows);
      setGames(nextGames);
      const snapshot = copyGames(nextGames);
      setDraftGames(snapshot);
      setOriginalGames(copyGames(snapshot));
    } catch (err) {
      setLocalError(err.message || 'Could not update this class type. Please try again.');
    } finally {
      setShopSavingKey(null);
    }
  };

  const displayError = localError;

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="min-w-0 flex-1 rounded-2xl border border-indigo-100 bg-white px-4 py-3 shadow-sm sm:max-w-xs sm:px-5">
          <p className="text-[10px] font-black uppercase tracking-wide text-indigo-400">
            Player access
          </p>
          <p className="mt-0.5 text-lg font-black text-slate-900 sm:text-xl">
            {unlockedCount}
            <span className="text-sm font-bold text-slate-500">
              {' '}
              / {visibleGames.length} open
            </span>
          </p>
        </div>

        <button
          type="button"
          disabled={!isReady || localSaving || isSaving}
          onClick={() => handleBulk(!allUnlocked)}
          className="min-h-[3.25rem] shrink-0 rounded-2xl bg-white px-4 text-sm font-black text-indigo-800 shadow-sm ring-1 ring-inset ring-indigo-100 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[9rem]"
        >
          {allUnlocked ? 'Lock all' : 'Unlock all'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {displayError && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-3 rounded-2xl border border-rose-300 bg-rose-50 px-3 py-3 text-sm font-bold text-rose-800"
          >
            ⚠️ {displayError}
          </motion.p>
        )}
      </AnimatePresence>

      {!isReady && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-700">
          {loading ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
              Loading {CLASS_TYPE_LABELS[classType]?.label || classType} games…
            </>
          ) : (
            'Preparing games…'
          )}
        </div>
      )}

      <p className="mb-3 px-1 text-sm font-bold text-slate-700">
        Drag a slot to reorder, or hover over one to preview the new placement.
      </p>

      {/* Shop section */}
      <div className="mb-6 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
        <p className="mb-3 text-sm font-semibold text-violet-900">
          Game shop — <strong>+</strong> adds this game to {CLASS_TYPE_LABELS[classType]?.label || classType}, <strong>Remove</strong> takes it out.
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {GAME_CATALOG.map((game) => {
            const isAdded = visibleGames.some((item) => item.key === game.key);
            const isSavingThis = shopSavingKey === game.key;
            return (
              <li key={game.key} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: game.tint }}>{game.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-800">{game.label}</p>
                  <p className="mt-0.5 whitespace-pre-line text-[11px] font-semibold leading-snug text-slate-500">{game.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleShopToggle(game)}
                  disabled={Boolean(shopSavingKey) || !isReady || localSaving || isSaving}
                  className={`min-h-10 shrink-0 rounded-xl px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-55 ${
                    isAdded ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {isSavingThis ? 'Saving…' : isAdded ? 'Remove' : '+ Add'}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

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
                disabled={!isReady || localSaving || isSaving}
                onToggleAccess={handleToggleAccess}
                onToggleShiny={handleToggleShiny}
              />
            ))}
          </ul>

          {isReady && slottedGames.length === 0 && (
            <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 px-5 py-8 text-center">
              <span className="text-4xl">&#127918;</span>
              <p className="mt-3 text-base font-black text-indigo-950">
                {CLASS_TYPE_LABELS[classType]?.label || classType} has no games yet
              </p>
              <p className="mt-1 text-sm font-semibold text-indigo-700">
                Add games from the shop above.
              </p>
            </div>
          )}
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          <DragPreview game={activeGame} />
        </DragOverlay>
      </DndContext>

      {/* Footer */}
      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasChanges || localSaving || isSaving}
            className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!hasChanges || localSaving || isSaving}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-black text-white shadow-sm transition hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none sm:min-w-[12rem]"
          >
            {(localSaving || isSaving) ? (
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

        {hasChanges && !localSaving && !isSaving && (
          <p className="mt-2 text-center text-[11px] font-semibold text-amber-600">
            You have unsaved changes.
          </p>
        )}
      </div>
    </>
  );
}

// Non-admin teacher: read-only game list for their own class.
// Uses ?classId= endpoint (the only one the server supports before
// Phases 1-4). The server resolves classId → classType internally.
function ReadOnlyGameList({ classId }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

  useEffect(() => {
    let active = true;
    setLoading(true);

    fetch(`${API_BASE}/api/game-access?classId=${encodeURIComponent(classId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((rows) => {
        if (!active) return;
        setGames(Array.isArray(rows) ? rows : []);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { active = false; };
  }, [classId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-xs font-bold text-indigo-700">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
        Loading games…
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-3 text-sm font-bold text-rose-800">
        ⚠️ {error}
      </p>
    );
  }

  if (games.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 px-5 py-10 text-center">
        <span className="text-4xl">🎮</span>
        <p className="mt-3 text-base font-black text-indigo-950">No games configured yet</p>
        <p className="mt-1 text-sm font-semibold text-indigo-700">
          Ask an admin to add games for this class type.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm font-bold text-slate-700">
        Current game arrangement for your class (read-only).
      </p>
      <ul className="flex flex-col gap-2.5">
        {games.map((game, index) => (
          <li
            key={game.gameKey || index}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base shadow-sm sm:h-12 sm:w-12 sm:text-lg"
              style={{
                background: game.unlocked
                  ? `linear-gradient(135deg, ${game.hue || '#38BDF8'}, ${(game.hue || '#38BDF8')}B8)`
                  : '#CBD5E1',
                filter: game.unlocked ? 'none' : 'grayscale(1)',
                opacity: game.unlocked ? 1 : 0.65,
              }}
            >
              {game.emoji || '🎮'}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold leading-tight text-slate-900 sm:text-base">
                {game.label || game.gameKey}
              </p>
              <p className="mt-1 whitespace-pre-line text-[10px] font-semibold leading-snug text-slate-600 sm:text-xs">
                {game.subtitle || ''}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                  game.unlocked
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {game.unlocked ? '🔓 Unlocked' : '🔒 Locked'}
              </span>
              {game.shiny && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">
                  ✨ Featured
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function GameAccessPanel({ onClose }) {
  const teacherCode = usePlayerStore((state) => state.teacherCode);
  const classId = usePlayerStore((state) => state.classId);
  const isAdmin = usePlayerStore((state) => state.isAdmin);
  const userClassType = usePlayerStore((state) => state.classType);

  const students = useStudentStore((state) => state.students);
  const studentsLoaded = useStudentStore((state) => state.loaded);
  const fetchStudents = useStudentStore((state) => state.fetchStudents);

  const [activeTab, setActiveTab] = useState(null);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [studentError, setStudentError] = useState(null);

  const [classInfo, setClassInfo] = useState(null);
  const [classInfoStatus, setClassInfoStatus] = useState('idle');
  const [classInfoError, setClassInfoError] = useState(null);

  // Determine initial tab based on role and classType
  useEffect(() => {
    if (activeTab) return;
    if (isAdmin) {
      setActiveTab(userClassType === 'k2' ? 'k2-games' : 'k1-games');
    } else {
      setActiveTab('games');
    }
  }, [isAdmin, userClassType, activeTab]);

  // Only fetch each tab's data the first time it's opened
  useEffect(() => {
    if (activeTab === 'students' && !studentsLoaded) {
      fetchStudents(teacherCode);
    }
  }, [activeTab, studentsLoaded, fetchStudents, teacherCode]);

  useEffect(() => {
    if (activeTab !== 'settings' || !classId) return;
    if (classInfo?.classId === classId) return;

    let active = true;
    setClassInfoStatus('loading');
    setClassInfoError(null);

    fetchClassInfo(classId)
      .then((data) => {
        if (!active) return;
        setClassInfo(data);
        setClassInfoStatus('ready');
      })
      .catch((err) => {
        if (!active) return;
        setClassInfoError(err.message || 'Could not load class information.');
        setClassInfoStatus('error');
      });

    return () => {
      active = false;
    };
  }, [activeTab, classId, classInfo]);

  const handleAddStudent = async ({ fullName, nickname }, onSuccess) => {
    if (isAddingStudent) return;
    setStudentError(null);
    setIsAddingStudent(true);

    try {
      await addStudent({ fullName, nickname, teacherCode });
      onSuccess?.();
    } catch (err) {
      setStudentError(err.message || 'Could not add this student. Please try again.');
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setGlobalError(null);
    setActiveTab(tab);
  };

  const isGameTab = (tab) => tab === 'k1-games' || tab === 'k2-games' || tab === 'games';

  const activeTabConfig = (() => {
    if (activeTab === 'students') return { description: 'Manage the students enrolled in this class.' };
    if (activeTab === 'settings') return { description: 'Configure settings for this class.' };
    if (activeTab === 'k1-games') return { description: CLASS_TYPE_LABELS.k1.description };
    if (activeTab === 'k2-games') return { description: CLASS_TYPE_LABELS.k2.description };
    if (activeTab === 'games') return { description: "View your class's current game arrangement." };
    return { description: '' };
  })();

  return (
    <div className="min-h-[100dvh] w-full bg-[#f5f7ff]">
      <header className="sticky top-0 z-30 bg-gradient-to-br from-[#315ed8] via-[#5a3fc4] to-[#972aa8] px-4 pb-0 pt-[max(1rem,env(safe-area-inset-top))] shadow-[0_4px_24px_rgba(49,94,216,0.28)] sm:px-6 sm:pt-6 lg:px-10">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-3 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={globalSaving}
              aria-label="Back home"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-xl text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ←
            </button>

            <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl shadow-sm sm:flex sm:h-12 sm:w-12">
              🏫
            </span>

            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/80">
                {isAdmin ? 'Admin controls' : 'Teacher controls'}
              </p>
              <h1 className="truncate text-xl font-black tracking-tight text-white sm:text-2xl lg:text-3xl">
                {isAdmin ? 'Class management' : 'Class controls'}
              </h1>
            </div>
          </div>
        </div>

        <p className="mx-auto max-w-5xl pb-4 text-xs font-semibold leading-relaxed text-white/90 sm:text-sm">
          {activeTabConfig.description}
        </p>

        {isAdmin ? (
          <AdminTabBar
            activeTab={activeTab}
            onChange={handleTabChange}
            disabled={globalSaving}
            adminClassType={userClassType}
          />
        ) : (
          <TeacherTabBar
            activeTab={activeTab}
            onChange={handleTabChange}
            disabled={globalSaving}
          />
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-32 sm:px-6 sm:py-8 lg:max-w-4xl lg:px-8 lg:pb-8">
        <AnimatePresence mode="wait">
          {globalError && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-3 rounded-2xl border border-rose-300 bg-rose-50 px-3 py-3 text-sm font-bold text-rose-800"
            >
              ⚠️ {globalError}
            </motion.p>
          )}
        </AnimatePresence>

        {activeTab === 'students' && (
          <StudentsTab
            isReady={studentsLoaded}
            students={students}
            onAdd={handleAddStudent}
            isSaving={isAddingStudent}
            error={studentError}
          />
        )}

        {activeTab === 'settings' && (
          <ClassInfoTab
            status={classInfoStatus}
            classInfo={classInfo}
            error={classInfoError}
          />
        )}

        {activeTab === 'k1-games' && (
          <GameAccessTypeEditor
            key="k1-editor"
            classType="k1"
            classId={CLASS_TYPE_CONFIG.k1.classId}
            writeCode={CLASS_TYPE_CONFIG.k1.writeCode}
            teacherCode={teacherCode}
            isSaving={globalSaving}
            onGlobalError={setGlobalError}
            onGlobalSavingChange={setGlobalSaving}
          />
        )}

        {activeTab === 'k2-games' && (
          <GameAccessTypeEditor
            key="k2-editor"
            classType="k2"
            classId={CLASS_TYPE_CONFIG.k2.classId}
            writeCode={CLASS_TYPE_CONFIG.k2.writeCode}
            teacherCode={teacherCode}
            isSaving={globalSaving}
            onGlobalError={setGlobalError}
            onGlobalSavingChange={setGlobalSaving}
          />
        )}

        {activeTab === 'games' && !isAdmin && (
          <ReadOnlyGameList classId={classId} />
        )}
      </main>
    </div>
  );
}
