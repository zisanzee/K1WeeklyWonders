import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { confirmDialog } from './confirmDialog';
import {
  addGameForClass,
  fetchGameAccessForClass,
  GAME_CATALOG,
  GAME_TERMS,
  groupGamesByTerm,
  mergeRows,
  removeGameForClass,
  setGameOrderForClass,
  setGameShinyForClass,
  setGameUnlockedForClass,
  setGameUnlockScheduleForClass,
} from './gameAccess';
import {
  checkCodeAvailable,
  createClass,
  fetchClassInfo,
  fetchClasses,
  setClassCode,
  setClassDetails,
  setClassPublic,
  updateClass,
  updateOwnTeacher,
} from './classInfo';
import {
  addStudentToClass,
  deleteIdentityInClass,
  deleteStudentInClass,
  fetchClassIdentities,
  generateStudentCode,
  mergeIdentities,
  unmergeIdentity,
  updateStudentInClass,
} from './students';
import { useSystemConfigStore } from './systemConfig';

// Badge printing drags in jsPDF + html-to-image (~600KB combined) and the stats
// surfaces are ~64KB, but NONE of that is needed to paint the panel's default
// tab. Loading them on demand keeps "Teacher controls" gated on the roster and
// game list only, instead of on the whole badge/PDF toolchain. Both StudentBadge
// exports share a single chunk because they come from the same import().
const StudentBadge = lazy(() => import('./StudentBadge'));
const PrintAllBadgesButton = lazy(() =>
  import('./StudentBadge').then((m) => ({ default: m.PrintAllBadgesButton }))
);
const StatsPanel = lazy(() => import('./StatsPanel'));
const MissionHeroes = lazy(() => import('./MissionHeroes'));

// ---------------------------------------------------------------------------
// Role-split navigation
// ---------------------------------------------------------------------------
// A teacher manages exactly their own class; the admin manages every class plus
// global settings. The tab sets differ by role so neither sees controls they
// can't actually use.
const TEACHER_TABS = [
  {
    key: 'games',
    label: 'Games',
    icon: '🎮',
    description: 'Reorder games and choose what is locked or featured for your class.',
  },
  {
    key: 'catalogue',
    label: 'Catalogue',
    icon: '📚',
    description: 'Browse the game catalogue and add or remove games for your class.',
  },
  {
    key: 'students',
    label: 'Students',
    icon: '🧑‍🎓',
    description: 'Manage your class roster, student codes, badges, and merged identities.',
  },
  {
    key: 'stats',
    label: 'Stats',
    icon: '📊',
    description: 'See who has been playing and how they are doing.',
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: '⚙️',
    description: 'Your class details, privacy, class code, and your own name and access code.',
  },
];

const ADMIN_TABS = [
  {
    key: 'classes',
    label: 'Classes',
    icon: '🏫',
    description: 'Create classes, edit their details and teachers, and manage each class\'s games.',
  },
  {
    key: 'catalogue',
    label: 'Catalogue',
    icon: '📚',
    description: 'Browse the game catalogue and add or remove games for your own class.',
  },
  {
    key: 'stats',
    label: 'Stats',
    icon: '📊',
    description: 'Every class at a glance, with a per-class drill-down.',
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: '⚙️',
    description: 'Admin identity and the global maintenance mode.',
  },
];

function TabBar({ tabs, activeTab, onChange, disabled }) {
  return (
    <div className="mx-auto max-w-5xl overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        role="tablist"
        aria-label="Panel sections"
        className="flex min-w-max items-stretch border-b border-white/20 sm:min-w-0"
      >
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
              className={`relative flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-3.5 py-3 text-xs font-black leading-none tracking-tight transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1 sm:gap-2 sm:px-4 sm:text-sm ${
                isActive ? 'text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              <span className="text-sm leading-none sm:text-base">{tab.icon}</span>
              {tab.label}
              {isActive && (
                <motion.span
                  layoutId="access-tab-indicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-white sm:inset-x-4"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live code availability (backed by POST /api/codes/check). The backend still
// hard-rejects duplicates on save, so this is only a UI affordance.
// ---------------------------------------------------------------------------
function codeReasonLabel(reason) {
  switch (reason) {
    case 'duplicate-teacher':
      return 'Taken by a teacher code';
    case 'duplicate-class':
      return 'Taken by a class code';
    case 'duplicate-student':
      return 'Taken by a student code';
    case 'conflicts-with-admin':
      return 'Reserved (admin code)';
    default:
      return 'Already taken';
  }
}

function useCodeCheck(code, exclude) {
  // exclude is a fresh object each render; stringify so the effect only re-runs
  // when the *values* change.
  const excludeKey = JSON.stringify(exclude || null);
  const [state, setState] = useState({ status: 'idle' });

  useEffect(() => {
    const trimmed = (code || '').trim();
    if (!trimmed) {
      setState({ status: 'idle' });
      return undefined;
    }
    let cancelled = false;
    setState({ status: 'checking' });
    const timer = setTimeout(async () => {
      try {
        const parsed = JSON.parse(excludeKey);
        // The server reads excludeTeacherId / excludeClassId / excludeStudentId.
        // Callers pass the shorter { teacherId }/{ classId }/{ studentId }, so
        // map them across — without this the exclusion was silently dropped and
        // an entity's OWN code came back "taken", which disabled the save button
        // on every student/class edit.
        const exclude = parsed
          ? {
              excludeTeacherId: parsed.teacherId,
              excludeClassId: parsed.classId,
              excludeStudentId: parsed.studentId,
            }
          : undefined;
        const res = await checkCodeAvailable(trimmed, exclude);
        if (cancelled) return;
        setState(
          res.available
            ? { status: 'available' }
            : { status: 'taken', reason: res.reason }
        );
      } catch {
        if (!cancelled) setState({ status: 'idle' });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, excludeKey]);

  return state;
}

function CodeCheckBadge({ state }) {
  if (!state || state.status === 'idle') return null;
  if (state.status === 'checking') {
    return <span className="text-[11px] font-bold aura-muted">Checking…</span>;
  }
  if (state.status === 'available') {
    return <span className="text-[11px] font-black text-emerald-200">✓ Available</span>;
  }
  return (
    <span className="text-[11px] font-black text-amber-200">
      ✕ {codeReasonLabel(state.reason)}
    </span>
  );
}

// Reusable labelled field with an availability badge under the input.
function CodeField({ id, label, value, onChange, placeholder, check, disabled, hint }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-black aura-soft">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="aura-input px-3 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="mt-1 flex min-h-[1rem] items-center justify-between gap-2">
        {hint ? <span className="text-[11px] font-semibold aura-muted">{hint}</span> : <span />}
        <CodeCheckBadge state={check} />
      </div>
    </div>
  );
}

// Converts an ISO timestamp into the `YYYY-MM-DDTHH:mm` shape a datetime-local
// input expects (and back to nothing when absent/invalid).
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// Human-readable label for a pending scheduled unlock, e.g. "Sat 13 Sep, 9:00 am".
function formatUnlockAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Defaults the datetime-local input to 9am tomorrow — always in the future, so
// the teacher has a valid starting point to adjust rather than an empty field.
function defaultUnlockInput() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalInput(d.toISOString());
}

const textInputCls =
  'aura-input px-3 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60';

// ---------------------------------------------------------------------------
// Games editor — class-scoped (teacher's own class, or any class for an admin).
// Reads/writes go through the classId mutators in gameAccess.js.
// ---------------------------------------------------------------------------
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

// A clock glyph for the schedule control. Drawn rather than emoji so it
// matches the other vector buttons in the row at every size.
function ClockIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 7.6V12l3 1.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
          : 'border-white/40 bg-white/15'
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
  onSchedule,
  onCancelSchedule,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: game.key, disabled });

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
          ? 'border-indigo-400 bg-indigo-500/25'
          : game.isBonus
            ? 'border-fuchsia-400/50 bg-fuchsia-500/15'
            : 'border-white/20 bg-transparent'
      } ${isJustMoved ? 'ring-2 ring-amber-300/70' : ''}`}
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
          game.unlocked ? 'border-indigo-400/40 aura-card' : 'border-white/20 bg-white/10'
        }`}
      >
        {game.unlocked && (
          <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: game.hue }} />
        )}

        <div className="flex min-w-0 items-center gap-2 px-2 py-2.5 pl-10 sm:gap-3 sm:px-3 sm:py-3 sm:pl-11">
          <button
            type="button"
            aria-label={`Drag ${game.label} into another slot`}
            disabled={disabled}
            {...attributes}
            {...listeners}
            className="touch-none flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-lg aura-muted transition hover:bg-white/15 hover:text-white active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-8"
          >
            ⠿
          </button>

          <GameIcon game={game} />

          <div className="min-w-0 flex-1">
            {game.isBonus && (
              <p className="mb-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-fuchsia-200 sm:text-[10px]">
                Bonus game
              </p>
            )}
            <p className="text-[13px] font-extrabold leading-tight aura-text sm:text-base">
              {game.label}
            </p>
            <p className="mt-1 whitespace-pre-line text-[10px] font-semibold leading-snug aura-soft sm:text-xs">
              {game.subtitle}
            </p>
            {game.shiny && (
              <span className="mt-1 inline-flex rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[8px] font-black text-amber-100 sm:text-[9px]">
                ✨ Featured
              </span>
            )}
            {/* Only meaningful while the game is still locked — once it is
                unlocked the schedule has served its purpose. */}
            {!game.unlocked && game.unlockAt && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-500/25 px-1.5 py-0.5 text-[8px] font-black text-sky-100 sm:text-[9px]">
                ⏰ Unlocks {formatUnlockAt(game.unlockAt)}
              </span>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1.5 sm:flex-row sm:gap-2">
            {/* Scheduling only makes sense for a game that is still locked;
                once it is unlocked the panel hides the control entirely. */}
            {!game.unlocked && (
              <>
                <button
                  type="button"
                  onClick={() => onSchedule(game)}
                  disabled={disabled}
                  title={
                    game.unlockAt
                      ? `Scheduled for ${formatUnlockAt(game.unlockAt)} — tap to change`
                      : 'Schedule unlock'
                  }
                  aria-label={`Schedule an unlock time for ${game.label}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10 sm:rounded-xl ${
                    game.unlockAt
                      ? 'bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-sm'
                      : 'bg-sky-500/25 text-sky-100 hover:bg-sky-500/40'
                  }`}
                >
                  <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>

                {/* Only shown once something is actually scheduled — there is
                    nothing to cancel otherwise. Clears the schedule WITHOUT
                    unlocking the game, which is why it is separate from the
                    unlock toggle rather than a second click on it. */}
                {game.unlockAt && (
                  <button
                    type="button"
                    onClick={() => onCancelSchedule(game)}
                    disabled={disabled}
                    title={`Cancel the scheduled unlock for ${formatUnlockAt(game.unlockAt)}`}
                    aria-label={`Cancel the scheduled unlock for ${game.label}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/25 text-rose-100 transition hover:bg-rose-500/45 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10 sm:rounded-xl"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" aria-hidden="true">
                      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => onToggleShiny(game.key, !game.shiny)}
              disabled={disabled}
              aria-pressed={game.shiny}
              aria-label={`${game.shiny ? 'Remove shiny mark from' : 'Mark as shiny'} ${game.label}`}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10 sm:rounded-xl sm:text-lg ${
                game.shiny
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm'
                  : 'bg-amber-500/25 text-amber-100 hover:bg-amber-500/40'
              }`}
            >
              ✨
            </button>

            <AccessToggle game={game} disabled={disabled} onToggle={onToggleAccess} />
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
      className="flex w-[min(380px,calc(100vw-1.5rem))] items-center gap-3 rounded-2xl border border-white/25 aura-card px-3 py-3 shadow-[0_20px_50px_rgba(11,8,40,0.55)]"
    >
      <GameIcon game={game} />
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-200">
          Moving game
        </p>
        <p className="truncate text-sm font-extrabold aura-text">{game.label}</p>
      </div>
    </motion.div>
  );
}

// Full game editor for a single classId. Works for a teacher (own class) and an
// admin (any class) because the backend authorises both; the component is keyed
// by classId so switching classes remounts it with fresh fetch guards.
function GameAccessEditor({
  classId,
  teacherCode,
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
  // The game currently open in the schedule dialog (null when closed).
  const [scheduleTarget, setScheduleTarget] = useState(null);

  const initializedRef = useRef(false);
  const moveTimerRef = useRef(null);
  const fetchAttemptedRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (fetchAttemptedRef.current) return;
    fetchAttemptedRef.current = true;
    setLoading(true);

    fetchGameAccessForClass(classId, teacherCode)
      .then((rows) => {
        setGames(mergeRows(rows));
        setLoaded(true);
        setLoading(false);
      })
      .catch((err) => {
        setLocalError(err.message);
        setLoading(false);
      });
  }, [classId, teacherCode]);

  useEffect(() => {
    if (!loaded || initializedRef.current) return;
    const snapshot = copyGames(games);
    setDraftGames(snapshot);
    setOriginalGames(copyGames(snapshot));
    initializedRef.current = true;
  }, [loaded, games]);

  useEffect(() => () => {
    if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
  }, []);

  const visibleGames = initializedRef.current ? draftGames : games;
  const slottedGames = useMemo(() => addSlotLabels(visibleGames), [visibleGames]);

  const activeGame = useMemo(
    () => slottedGames.find((game) => game.key === activeKey),
    [activeKey, slottedGames]
  );

  const unlockedCount = visibleGames.filter((game) => game.unlocked).length;
  const allUnlocked = visibleGames.length > 0 && unlockedCount === visibleGames.length;
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
    const originalByKey = new Map(originalGames.map((game) => [game.key, game]));
    const settingChanges = draftGames.filter((game) => {
      const original = originalByKey.get(game.key);
      return original && (original.unlocked !== game.unlocked || original.shiny !== game.shiny);
    }).length;
    const orderChanged = draftGames.some(
      (game, index) => originalGames[index]?.key !== game.key
    );
    return settingChanges + (orderChanged ? 1 : 0);
  }, [draftGames, isReady, originalGames]);

  const handleToggleAccess = (gameKey, unlocked) => {
    setDraftGames((current) =>
      current.map((game) =>
        game.key === gameKey
          ? // Unlocking now scraps any pending schedule (the server does the
            // same), so drop it from the draft too or the row would keep
            // showing an "unlocks at" badge until the next refetch.
            { ...game, unlocked, unlockAt: unlocked ? null : game.unlockAt }
          : game
      )
    );
  };

  const handleToggleShiny = (gameKey, shiny) => {
    setDraftGames((current) =>
      current.map((game) => (game.key === gameKey ? { ...game, shiny } : game))
    );
  };

  const handleBulk = (unlocked) => {
    setDraftGames((current) =>
      current.map((game) => ({
        ...game,
        unlocked,
        unlockAt: unlocked ? null : game.unlockAt,
      }))
    );
  };

  // Scheduling writes straight through instead of going through Confirm: it
  // carries its own explicit date/time dialog (so the intent is already
  // confirmed), and routing it through Confirm would discard any unsaved
  // reorder/lock drafts the teacher has on screen.
  const handleSchedule = async (gameKey, unlockAtIso) => {
    setLocalError(null);
    onGlobalError(null);
    setLocalSaving(true);
    onGlobalSavingChange(true);
    try {
      await setGameUnlockScheduleForClass(gameKey, unlockAtIso, classId, teacherCode);
      // Patch both the draft and the saved snapshot so the change is not
      // picked up as an unsaved edit and can't be reverted by Reset.
      const patch = (list) =>
        list.map((game) =>
          game.key === gameKey ? { ...game, unlockAt: unlockAtIso } : game
        );
      setDraftGames(patch);
      setOriginalGames(patch);
      setScheduleTarget(null);
    } catch (err) {
      setLocalError(err.message || 'Could not schedule this unlock.');
    } finally {
      setLocalSaving(false);
      onGlobalSavingChange(false);
    }
  };

  // Clears a pending schedule WITHOUT unlocking the game — the two are
  // separate intents, which is why this calls the schedule endpoint with null
  // rather than toggling `unlocked`. The game stays locked and simply has no
  // countdown any more.
  //
  // Confirmed first: the row's cancel button sits directly beside the schedule
  // and unlock buttons, so an accidental tap would silently drop a countdown
  // the teacher deliberately set.
  const handleCancelSchedule = async (game) => {
    if (!game?.unlockAt) return;
    const ok = await confirmDialog({
      title: `Cancel the scheduled unlock for ${game.label}?`,
      message: `It will no longer unlock on its own. The game stays locked until you unlock it yourself.`,
      confirmLabel: 'Cancel schedule',
      cancelLabel: 'Keep it',
      danger: true,
      icon: '⏰',
    });
    if (!ok) return;

    setLocalError(null);
    onGlobalError(null);
    setLocalSaving(true);
    onGlobalSavingChange(true);
    try {
      await setGameUnlockScheduleForClass(game.key, null, classId, teacherCode);
      // unlockAt must be cleared in BOTH lists, or Reset would resurrect the
      // cancelled schedule from the saved snapshot.
      const patch = (list) =>
        list.map((item) =>
          item.key === game.key ? { ...item, unlockAt: null } : item
        );
      setDraftGames(patch);
      setOriginalGames(patch);
      setScheduleTarget(null);
    } catch (err) {
      setLocalError(err.message || 'Could not cancel this schedule.');
    } finally {
      setLocalSaving(false);
      onGlobalSavingChange(false);
    }
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
    const movedGame = addSlotLabels(nextGames).find((game) => game.key === active.id);

    setDraftGames(nextGames);
    setLastMove({ gameKey: active.id, slotLabel: movedGame?.slotLabel || '' });

    if (moveTimerRef.current) clearTimeout(moveTimerRef.current);
    moveTimerRef.current = setTimeout(() => setLastMove(null), 1800);
  };

  const handleConfirm = async () => {
    if (!hasChanges || localSaving || isSaving) return;
    setLocalError(null);
    onGlobalError(null);
    setLocalSaving(true);
    onGlobalSavingChange(true);

    try {
      const originalByKey = new Map(originalGames.map((game) => [game.key, game]));
      const orderChanged = draftGames.some(
        (game, index) => originalGames[index]?.key !== game.key
      );

      if (orderChanged) {
        await setGameOrderForClass(
          draftGames.map((game) => game.key),
          classId,
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
          setGameUnlockedForClass(game.key, game.unlocked, classId, teacherCode)
        ),
        ...shinyChanges.map((game) =>
          setGameShinyForClass(game.key, game.shiny, classId, teacherCode)
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

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="min-w-0 flex-1 rounded-2xl aura-card px-4 py-3 sm:max-w-xs sm:px-5">
          <p className="text-[10px] font-black uppercase tracking-wide text-indigo-200">
            Player access
          </p>
          <p className="mt-0.5 text-lg font-black aura-text sm:text-xl">
            {unlockedCount}
            <span className="text-sm font-bold aura-muted"> / {visibleGames.length} open</span>
          </p>
        </div>

        <button
          type="button"
          disabled={!isReady || localSaving || isSaving}
          onClick={() => handleBulk(!allUnlocked)}
          className="aura-ghost min-h-[3.25rem] shrink-0 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[9rem]"
        >
          {allUnlocked ? 'Lock all' : 'Unlock all'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {localError && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/20 px-3 py-3 text-sm font-bold text-rose-100"
          >
            ⚠️ {localError}
          </motion.p>
        )}
      </AnimatePresence>

      {!isReady && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold aura-soft">
          {loading ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
              Loading games…
            </>
          ) : (
            'Preparing games…'
          )}
        </div>
      )}

      <p className="mb-3 px-1 text-sm font-bold aura-soft">
        Drag a slot to reorder, or hover over one to preview the new placement.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
        onDragStart={({ active }) => {
          setActiveKey(active.id);
          setOverKey(null);
        }}
        onDragOver={({ over }) => {
          const nextOverKey = over?.id || null;
          setOverKey((current) => (current === nextOverKey ? current : nextOverKey));
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
                isHoveredSlot={overKey === game.key && activeKey !== game.key}
                isJustMoved={lastMove?.gameKey === game.key}
                disabled={!isReady || localSaving || isSaving}
                onToggleAccess={handleToggleAccess}
                onToggleShiny={handleToggleShiny}
                onSchedule={setScheduleTarget}
                onCancelSchedule={handleCancelSchedule}
              />
            ))}
          </ul>

          {isReady && slottedGames.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/25 bg-white/10 px-5 py-8 text-center">
              <span className="text-4xl">🎮</span>
              <p className="mt-3 text-base font-black aura-text">No games yet</p>
              <p className="mt-1 text-sm font-semibold aura-soft">Add games from the Catalogue tab.</p>
            </div>
          )}
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          <DragPreview game={activeGame} />
        </DragOverlay>
      </DndContext>

      <div className="mt-6 border-t border-white/20 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasChanges || localSaving || isSaving}
            className="aura-ghost min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-45"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!hasChanges || localSaving || isSaving}
            className="aura-btn aura-btn-violet min-h-11 flex-1 gap-2 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none sm:min-w-[12rem]"
          >
            {localSaving || isSaving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                Saving…
              </>
            ) : (
              <>
                Confirm changes
                {changeCount > 0 && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{changeCount}</span>
                )}
              </>
            )}
          </button>
        </div>

        {hasChanges && !localSaving && !isSaving && (
          <p className="mt-2 text-center text-[11px] font-semibold text-amber-200">
            You have unsaved changes.
          </p>
        )}
      </div>

      {/* Name the time in every "unlocks at" label so a teacher outside the
          device's own timezone isn't misled by a bare clock time. */}
      <p className="mt-3 px-1 text-[11px] font-semibold aura-muted">
        Scheduled unlocks follow your device time ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
      </p>

      <AnimatePresence>
        {scheduleTarget && (
          <ScheduleUnlockDialog
            game={scheduleTarget}
            saving={localSaving || isSaving}
            onCancel={() => setScheduleTarget(null)}
            onConfirm={(iso) => handleSchedule(scheduleTarget.key, iso)}
            onCancelSchedule={() => handleCancelSchedule(scheduleTarget)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Modal for picking the unlock moment. Split out so its draft input state
// resets naturally each time it is opened for a different game.
function ScheduleUnlockDialog({ game, saving, onCancel, onConfirm, onCancelSchedule }) {
  const [value, setValue] = useState(() =>
    game.unlockAt ? toLocalInput(game.unlockAt) : defaultUnlockInput()
  );
  // Date.now() can't be read during render, so the "is this in the future?"
  // hint is measured against the moment the dialog opened.
  const [openedAt] = useState(() => Date.now());
  // Set when the chosen time has slid into the past while the dialog sat open.
  const [stale, setStale] = useState(false);

  // datetime-local yields wall-clock text with no timezone, so `new Date()`
  // reads it in the browser's own zone — the same way it displays it back.
  const when = value ? new Date(value) : null;
  const valid = Boolean(when) && !Number.isNaN(when.getTime());
  const tooSoon = stale || (valid && when.getTime() <= openedAt);

  const submit = (event) => {
    event.preventDefault();
    if (!valid || saving) return;
    // Re-checked here (fine in an event handler) so a time that expired while
    // the dialog was open is caught before the round trip.
    if (when.getTime() <= Date.now()) {
      setStale(true);
      return;
    }
    onConfirm(when.toISOString());
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
      onClick={() => !saving && onCancel()}
    >
      <motion.form
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 18 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="flex w-full max-w-md flex-col gap-4 rounded-[2rem] aura-card p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
            style={{ background: game.tint || '#EFF6FF' }}
          >
            {game.emoji || '🎮'}
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-black aura-text">Schedule unlock</h3>
            <p className="mt-0.5 truncate text-sm font-semibold aura-soft">{game.label}</p>
          </div>
        </div>

        <div>
          <label htmlFor="schedule-at" className="mb-1 block text-[11px] font-black aura-soft">
            Unlock on
          </label>
          <input
            id="schedule-at"
            type="datetime-local"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setStale(false);
            }}
            disabled={saving}
            className="aura-input px-3 py-2.5 text-sm font-bold disabled:opacity-60"
          />
          {tooSoon && (
            <p className="mt-1.5 text-[11px] font-bold text-rose-200">
              Pick a time in the future.
            </p>
          )}
        </div>

        <p className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-semibold aura-soft">
          The game stays locked and unlocks by itself at this time. You can also unlock it early, or
          cancel the schedule below to leave it locked with no set time.
        </p>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!valid || tooSoon || saving}
            className="aura-btn aura-btn-violet min-h-11 flex-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Scheduling…' : 'Schedule unlock'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="aura-ghost min-h-11 px-4 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        {/* Offered here as well as in the row, because the most likely moment
            to realise a schedule is wrong is while editing it. Changing a
            schedule is a re-save; REMOVING one needs its own action, since
            there is no valid time that means "none". */}
        {game.unlockAt && (
          <button
            type="button"
            onClick={onCancelSchedule}
            disabled={saving}
            className="aura-ghost-danger min-h-11 text-sm disabled:opacity-50"
          >
            {saving ? 'Working…' : 'Cancel scheduled unlock'}
          </button>
        )}
      </motion.form>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Catalogue tab — the game catalogue as a searchable add/remove storefront.
// Split out of the game editor so a teacher browses (and opts into) the full
// catalog on its own tab instead of scrolling past it every time they reorder.
// ---------------------------------------------------------------------------
function GameCatalogue({ classId, teacherCode, isAdmin = false }) {
  const [classes, setClasses] = useState(null);
  const [pickedClassId, setPickedClassId] = useState('');
  const [addedKeys, setAddedKeys] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [savingKey, setSavingKey] = useState(null);
  // Term ids currently collapsed in the grouped catalogue. Stored as a Set of
  // ids (not booleans per term). Starts with every term folded so the catalogue
  // opens as a compact set of folders; a teacher expands the term they want.
  const [collapsedTerms, setCollapsedTerms] = useState(
    () => new Set(GAME_TERMS.map((term) => term.id))
  );

  // An admin has NO class of their own — playerStore.classId is null for them —
  // so this tab has to ask which class it is editing. Without a class the fetch
  // went out as `classId=null`, the server answered "Class not found", and the
  // Catalogue was dead for every admin: the exact place a newly shipped game is
  // meant to be added from.
  const effectiveClassId = isAdmin ? pickedClassId : classId;

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    fetchClasses(teacherCode)
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setClasses(list);
        // Default to the first class so the tab is immediately usable, but let
        // the admin switch. `classId` is the stable identifier; className is
        // only the label.
        setPickedClassId((current) => current || (list[0]?.classId ?? ''));
      })
      .catch(() => {
        if (!cancelled) setClasses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, teacherCode]);

  const load = useCallback(async () => {
    // No class chosen yet (admin still loading, or there are no classes).
    if (!effectiveClassId) return;
    setStatus('loading');
    setError(null);
    // Drop the previous class's added-set, or its ticks would briefly show
    // against a different class's catalogue.
    setAddedKeys(null);
    try {
      const rows = await fetchGameAccessForClass(effectiveClassId, teacherCode);
      setAddedKeys(new Set(mergeRows(rows).map((game) => game.key)));
      setStatus('ready');
    } catch (err) {
      setError(err.message || 'Could not load the game catalogue.');
      setStatus('error');
    }
  }, [effectiveClassId, teacherCode]);

  useEffect(() => {
    load();
  }, [load]);

  const addedCount = addedKeys ? addedKeys.size : 0;

  // Match against the title and the description so a teacher can search either
  // by game name or by what the game teaches (e.g. "number bonds", "counting").
  // The catalogue is grouped by academic term. Matching is still run across the
  // whole catalogue first, then grouped, so a term with no matches collapses
  // cleanly rather than leaving an empty heading behind.
  const filteredGroups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = !term
      ? GAME_CATALOG
      : GAME_CATALOG.filter((game) => {
          const haystack = `${game.title} ${game.label} ${game.subtitle} ${game.description || ''}`
            .toLowerCase();
          return haystack.includes(term);
        });
    return groupGamesByTerm(matches);
  }, [query]);

  const filteredCount = useMemo(
    () => filteredGroups.reduce((sum, group) => sum + group.games.length, 0),
    [filteredGroups]
  );

  const toggleTerm = (id) => {
    setCollapsedTerms((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggle = async (game) => {
    if (!addedKeys || savingKey || !effectiveClassId) return;
    const isAdded = addedKeys.has(game.key);
    setSavingKey(game.key);
    setError(null);
    try {
      if (isAdded) {
        await removeGameForClass(game.key, effectiveClassId, teacherCode);
      } else {
        await addGameForClass(game.key, effectiveClassId, teacherCode);
      }
      // Trust the server round-trip over optimistic state so two tabs can't
      // drift the "added" set.
      const rows = await fetchGameAccessForClass(effectiveClassId, teacherCode);
      setAddedKeys(new Set(mergeRows(rows).map((item) => item.key)));
    } catch (err) {
      setError(err.message || 'Could not update the catalogue. Please try again.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div>
      <div className="mb-4 rounded-2xl aura-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-black aura-text">Game catalogue</p>
          <p className="text-[11px] font-black uppercase tracking-wide aura-muted">
            {addedCount} of {GAME_CATALOG.length} added
          </p>
        </div>

        {/* Admins own no class, so they must pick the target here. A class is
            the only thing these add/remove calls can act on. */}
        {isAdmin && (
          <div className="mt-3">
            <label htmlFor="catalogue-class" className="mb-1 block text-[11px] font-black aura-soft">
              Adding to
            </label>
            <select
              id="catalogue-class"
              value={pickedClassId}
              onChange={(e) => setPickedClassId(e.target.value)}
              disabled={!classes || classes.length === 0}
              className="aura-input px-3 py-2.5 text-sm font-bold disabled:opacity-60"
            >
              {(classes || []).map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.className || c.classId}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="mt-2 text-xs font-semibold aura-soft">
          {isAdmin
            ? 'Pick a class above, then add a game to make it available there.'
            : 'Add a game to make it available to your class, or remove one to take it back out.'}
        </p>
        <div className="relative mt-3">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm aura-muted">
            🔍
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search games by title or description…"
            className="w-full rounded-2xl border border-white/20 bg-white/10 py-2.5 pl-10 pr-4 text-sm font-semibold text-white placeholder:text-white/45 focus:border-violet-300/60 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/20 px-3 py-3 text-sm font-bold text-rose-100"
          >
            ⚠️ {error}
          </motion.p>
        )}
      </AnimatePresence>

      {status === 'loading' && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold aura-soft">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
          Loading the catalogue…
        </div>
      )}

      {status === 'ready' && (
        <div className="flex flex-col gap-3">
          {filteredGroups.map((group) => {
            const isCollapsed = collapsedTerms.has(group.id);
            return (
              <section
                key={group.id}
                aria-label={group.label}
                className="overflow-hidden rounded-2xl border border-white/15 bg-white/5"
              >
                <button
                  type="button"
                  onClick={() => toggleTerm(group.id)}
                  aria-expanded={!isCollapsed}
                  aria-controls={`catalogue-term-${group.id}`}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-white/5"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-black text-white/70 transition-transform duration-200 ${
                      isCollapsed ? '' : 'rotate-90'
                    }`}
                    aria-hidden="true"
                  >
                    ▸
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-lg leading-none" aria-hidden="true">
                      📁
                    </span>
                    <h3 className="text-sm font-black uppercase tracking-wide text-indigo-100">
                      {group.label}
                    </h3>
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white/60">
                    {group.games.length}
                  </span>
                </button>

                <div
                  id={`catalogue-term-${group.id}`}
                  className={isCollapsed ? 'hidden' : ''}
                >
                  <ul className="grid grid-cols-1 gap-2.5 p-3 pt-0 sm:grid-cols-2">
                {group.games.map((game) => {
                  const isAdded = addedKeys.has(game.key);
                  const isSavingThis = savingKey === game.key;
                  const isBusy = Boolean(savingKey);
                  return (
                    <li
                      key={game.key}
                      className="flex flex-col gap-3 rounded-2xl aura-card p-3.5 sm:p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl leading-none"
                          style={{ background: game.tint }}
                        >
                          {game.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 flex-1 text-sm font-black leading-snug aura-text">
                              {game.label}
                            </p>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                                isAdded
                                  ? 'bg-emerald-500/25 text-emerald-100'
                                  : 'bg-white/10 text-white/60'
                              }`}
                            >
                              {isAdded ? 'Added' : 'Not added'}
                            </span>
                          </div>
                          <p className="mt-0.5 whitespace-pre-line text-[11px] font-semibold leading-snug aura-muted">
                            {game.subtitle}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs font-semibold leading-snug aura-soft">{game.description}</p>

                      <button
                        type="button"
                        onClick={() => toggle(game)}
                        disabled={isBusy}
                        className={`min-h-10 w-full rounded-xl px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-55 ${
                          isAdded
                            ? 'bg-rose-500/25 text-rose-100 hover:bg-rose-500/40'
                            : 'bg-indigo-600 text-white hover:bg-indigo-500'
                        }`}
                      >
                        {isSavingThis ? 'Saving…' : isAdded ? 'Remove' : '+ Add'}
                      </button>
                    </li>
                  );
                    })}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {status === 'ready' && filteredCount === 0 && (
        <div className="rounded-2xl border border-dashed border-white/25 bg-white/10 px-5 py-8 text-center">
          <span className="text-4xl">🔍</span>
          <p className="mt-3 text-base font-black aura-text">No games found</p>
          <p className="mt-1 text-sm font-semibold aura-soft">
            Nothing matches “{query.trim()}”. Try another word like “counting” or “bonds”.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Students tab — roster CRUD (classId-scoped) plus the name-identity merge UI.
// The identity list is roster students ∪ distinct play-session names, so a
// teacher can merge "light" public-class kids who never had a code.
// ---------------------------------------------------------------------------
function AddStudentForm({ classId, teacherCode, onAdded }) {
  const [nickname, setNickname] = useState('');
  const [group, setGroup] = useState('');
  const [code, setCode] = useState(() => generateStudentCode());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const check = useCodeCheck(code, undefined);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await addStudentToClass(
        classId,
        {
          nickname: trimmed,
          fullName: trimmed,
          group: group.trim(),
          code: code.trim().toUpperCase(),
        },
        teacherCode
      );
      setNickname('');
      setGroup('');
      setCode(generateStudentCode());
      onAdded?.();
    } catch (err) {
      setError(err.message || 'Could not add this student.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 rounded-2xl aura-card p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex-1">
          <label htmlFor="add-student-name" className="mb-1 block text-[11px] font-black aura-soft">
            Name
          </label>
          <input
            id="add-student-name"
            type="text"
            value={nickname}
            maxLength={40}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Aisyah"
            disabled={saving}
            className={textInputCls}
          />
        </div>

        <div className="flex-1">
          <label htmlFor="add-student-group" className="mb-1 block text-[11px] font-black aura-soft">
            Group (optional)
          </label>
          <input
            id="add-student-group"
            type="text"
            value={group}
            maxLength={40}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="e.g. Red group"
            disabled={saving}
            className={textInputCls}
          />
        </div>

        <div className="flex-1">
          <CodeField
            id="add-student-code"
            label="Student code"
            value={code}
            onChange={setCode}
            placeholder="6-character code"
            check={check}
            disabled={saving}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCode(generateStudentCode())}
          disabled={saving}
          className="aura-ghost rounded-xl px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          ↻ New code
        </button>
        <button
          type="submit"
          disabled={saving || !nickname.trim() || check.status === 'taken'}
          className="aura-btn aura-btn-violet min-h-[2.75rem] shrink-0 gap-2 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
              Adding…
            </>
          ) : (
            '+ Add student'
          )}
        </button>
      </div>

      {error && (
        <p className="mt-2 rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-100" role="alert">
          ⚠️ {error}
        </p>
      )}
    </form>
  );
}

// One roster/identity row. Rostered students are fully editable; "light" names
// (no Student record) are selectable for merging but not editable — there is no
// record to rename, only play history to remove.
//
// Deleting, by contrast, applies to BOTH kinds. Each row is the only thing
// keeping that entry alive (a Student document, or a set of play sessions), so
// the delete control is deliberately not gated on `rostered`.
function IdentityRow({
  identity,
  classId,
  teacherCode,
  selectable,
  selected,
  onToggleSelected,
  onChanged,
  onBadge,
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(identity.name || '');
  const [code, setCode] = useState(identity.code || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const check = useCodeCheck(editing ? code : '', { studentId: identity.studentId });

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateStudentInClass(
        classId,
        identity.studentId,
        { nickname: trimmed, code: code.trim().toUpperCase() },
        teacherCode
      );
      setEditing(false);
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    const ok = await confirmDialog({
      title: `Remove ${identity.name}?`,
      // A light identity exists ONLY as play history, so spell that out — this
      // is a harder delete than removing a roster student, who at least has a
      // code and a badge that stop working.
      message: identity.rostered
        ? 'Their play history for this class will be removed too.'
        : 'This player has no code — only their play history exists, and it will all be removed.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
      danger: true,
      icon: '🗑️',
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      if (identity.rostered) {
        await deleteStudentInClass(classId, identity.studentId, teacherCode);
      } else {
        await deleteIdentityInClass(classId, identity.name, teacherCode);
      }
      // Leave `deleting` true — the parent reload drops this row from the list,
      // so the spinner stays until the row actually disappears.
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not delete this player.');
      setDeleting(false);
    }
  };

  return (
    <li className="rounded-2xl aura-card p-3 transition sm:p-4">
      {error && (
        <p className="mb-2.5 rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-100" role="alert">
          ⚠️ {error}
        </p>
      )}

      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            disabled={saving}
            className={textInputCls}
          />
          <CodeField
            id={`code-${identity.studentId}`}
            label="Code"
            value={code}
            onChange={setCode}
            placeholder="6-character code"
            check={check}
            disabled={saving}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim() || check.status === 'taken'}
              className="aura-btn aura-btn-violet flex-1 px-3 py-2 text-xs disabled:opacity-50 sm:flex-none sm:px-5"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setName(identity.name || '');
                setCode(identity.code || '');
                setError(null);
              }}
              disabled={saving}
              className="aura-ghost flex-1 px-3 py-2 text-xs disabled:opacity-50 sm:flex-none sm:px-5"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelected(identity.name)}
              aria-label={`Select ${identity.name} for merging`}
              className="h-5 w-5 shrink-0 accent-violet-500"
            />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black aura-text sm:text-base">{identity.name}</p>
            <p className="mt-1 font-mono text-[11px] font-bold tracking-wider aura-muted">
              {identity.rostered
                ? `Code: ${identity.code || '—'}`
                : 'No code — joined with a name'}
            </p>
          </div>

          {/* Badge and edit both act on a Student record, so they are
              rostered-only. Delete is NOT part of that gate — it is rendered
              for every identity, because a rostered student and a light name
              are each removable. */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {identity.rostered && (
              <>
                <button
                  type="button"
                  onClick={() => onBadge(identity)}
                  title="Generate badge with QR code"
                  aria-label={`Generate badge for ${identity.name}`}
                  className="aura-btn-gold aura-btn h-9 w-9 active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM18 13h-2v2h2v-2zM13 13h2v2h-2v-2zM18 18h2v2h-2v-2zM13 18h2v2h-2v-2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setName(identity.name || '');
                    setCode(identity.code || '');
                    setError(null);
                    setEditing(true);
                  }}
                  title="Edit student"
                  aria-label={`Edit ${identity.name}`}
                  className="aura-icon-btn h-9 w-9 active:scale-95"
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete player"
              aria-label={`Delete ${identity.name}`}
              className="aura-icon-btn aura-ghost-danger h-9 w-9 active:scale-95 disabled:opacity-60"
            >
              {deleting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function StudentsTab({ classId, teacherCode, className }) {
  const [identities, setIdentities] = useState([]);
  const [merges, setMerges] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [showMerged, setShowMerged] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [primaryName, setPrimaryName] = useState('');
  const [busy, setBusy] = useState(false);
  const [badgeIdentity, setBadgeIdentity] = useState(null);

  const load = useCallback(async () => {
    if (!classId || !teacherCode) return;
    setError(null);
    try {
      const data = await fetchClassIdentities(classId, teacherCode);
      setIdentities(Array.isArray(data.identities) ? data.identities : []);
      setMerges(Array.isArray(data.merges) ? data.merges : []);
      setStatus('ready');
    } catch (err) {
      setError(err.message || 'Could not load students.');
      setStatus('error');
    }
  }, [classId, teacherCode]);

  useEffect(() => {
    setStatus('loading');
    setSelected(new Set());
    load();
  }, [load]);

  const mergedMembers = useMemo(
    () =>
      merges.flatMap((m) =>
        (m.members || []).map((name) => ({ name, primaryName: m.primaryName }))
      ),
    [merges]
  );

  const rosterForBadges = useMemo(
    () =>
      identities
        .filter((i) => i.rostered)
        .map((i) => ({
          studentId: i.studentId,
          code: i.code,
          nickname: i.name,
          fullName: i.name,
        })),
    [identities]
  );

  const toggleSelected = (name) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectedNames = [...selected];

  const openMerge = () => {
    if (selectedNames.length < 2) return;
    setPrimaryName(selectedNames[0]);
    setMergeOpen(true);
  };

  const confirmMerge = async () => {
    const memberNames = selectedNames.filter((n) => n !== primaryName);
    if (!primaryName || memberNames.length < 1 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await mergeIdentities(classId, { primaryName, memberNames }, teacherCode);
      setMergeOpen(false);
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err.message || 'Could not merge these students.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnmerge = async (memberName) => {
    const ok = await confirmDialog({
      title: `Unmerge "${memberName}"?`,
      message: 'They will become their own identity again and their stats will split out.',
      confirmLabel: 'Unmerge',
      icon: '↩️',
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await unmergeIdentity(classId, { memberName }, teacherCode);
      await load();
    } catch (err) {
      setError(err.message || 'Could not unmerge this identity.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <AddStudentForm classId={classId} teacherCode={teacherCode} onAdded={load} />

      {error && (
        <p className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/20 px-3 py-3 text-sm font-bold text-rose-100">
          ⚠️ {error}
        </p>
      )}

      {status === 'loading' && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold aura-soft">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
          Loading students…
        </div>
      )}

      {status === 'ready' && identities.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/25 bg-white/10 px-5 py-10 text-center">
          <span className="text-4xl">🧑‍🎓</span>
          <p className="mt-3 text-base font-black aura-text">No students yet</p>
          <p className="mt-1 text-sm font-semibold aura-soft">
            Add your first student using the form above.
          </p>
        </div>
      )}

      {status === 'ready' && identities.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-black aura-soft">
              {identities.length} student{identities.length === 1 ? '' : 's'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={load}
                className="aura-ghost gap-1.5 px-3 py-2 text-xs"
              >
                ↻ Refresh
              </button>
              <button
                type="button"
                onClick={openMerge}
                disabled={selectedNames.length < 2 || busy}
                className="aura-btn aura-btn-violet min-h-10 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                Merge selected ({selectedNames.length})
              </button>
            </div>
          </div>

          <div className="mb-3">
            <Suspense fallback={null}>
              <PrintAllBadgesButton students={rosterForBadges} classInfo={{ className }} />
            </Suspense>
          </div>

          <ul className="flex flex-col gap-2">
            {identities.map((identity) => (
              <IdentityRow
                key={identity.studentId || `name:${identity.name}`}
                identity={identity}
                classId={classId}
                teacherCode={teacherCode}
                selectable
                selected={selected.has(identity.name)}
                onToggleSelected={toggleSelected}
                onChanged={load}
                onBadge={setBadgeIdentity}
              />
            ))}
          </ul>
        </>
      )}

      {status === 'ready' && mergedMembers.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowMerged((v) => !v)}
            className="aura-ghost w-full justify-between px-4 py-2.5 text-xs"
          >
            <span>
              {mergedMembers.length} merged identit{mergedMembers.length === 1 ? 'y' : 'ies'} hidden
            </span>
            <span>{showMerged ? 'Hide' : 'Show'}</span>
          </button>

          {showMerged && (
            <ul className="mt-3 flex flex-col gap-2">
              {mergedMembers.map((m) => (
                <li
                  key={`${m.primaryName}::${m.name}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-3 sm:p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black aura-text">{m.name}</p>
                    <p className="mt-1 text-[11px] font-bold text-amber-200">
                      Merged into {m.primaryName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnmerge(m.name)}
                    disabled={busy}
                    className="aura-ghost shrink-0 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
                  >
                    Unmerge
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {badgeIdentity && (
        <Suspense fallback={null}>
          <StudentBadge
            student={{
              studentId: badgeIdentity.studentId,
              code: badgeIdentity.code,
              nickname: badgeIdentity.name,
              fullName: badgeIdentity.name,
            }}
            classInfo={{ className: className || 'EZ Wonders' }}
            onClose={() => setBadgeIdentity(null)}
          />
        </Suspense>
      )}

      <AnimatePresence>
        {mergeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm"
            onClick={() => !busy && setMergeOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-md flex-col gap-4 rounded-[2rem] aura-card p-5 sm:p-6"
            >
              <div>
                <h3 className="text-lg font-black aura-text">Merge identities</h3>
                <p className="mt-1 text-sm font-semibold aura-soft">
                  Pick the name that should be kept. The others become "merged into" it, and all
                  past plays and stats combine.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {selectedNames.map((name) => (
                  <label
                    key={name}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                      primaryName === name
                        ? 'border-violet-400 bg-violet-500/20'
                        : 'border-white/15 bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="merge-primary"
                      checked={primaryName === name}
                      onChange={() => setPrimaryName(name)}
                      className="h-4 w-4 accent-violet-500"
                    />
                    <span className="text-sm font-black aura-text">{name}</span>
                    {primaryName === name && (
                      <span className="ml-auto rounded-full bg-violet-500/30 px-2 py-0.5 text-[10px] font-black text-violet-100">
                        Keep
                      </span>
                    )}
                  </label>
                ))}
              </div>

              <p className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-semibold aura-soft">
                After merge, all play time and stats will be combined into{' '}
                <strong className="aura-text">{primaryName}</strong>.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmMerge}
                  disabled={busy || !primaryName}
                  className="aura-btn aura-btn-violet flex-1 min-h-11 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Merging…' : 'Merge'}
                </button>
                <button
                  type="button"
                  onClick={() => setMergeOpen(false)}
                  disabled={busy}
                  className="aura-ghost min-h-11 px-4 text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Teacher settings — read-only class info, public/private toggle, and an
// editable class code (allowed by Q5, validated against the global namespace).
// ---------------------------------------------------------------------------
function TeacherSettings({ classId, teacherCode, teacherName, onClose, resetPlayer }) {
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [savingPublic, setSavingPublic] = useState(false);
  const [codeDraft, setCodeDraft] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [codeError, setCodeError] = useState(null);
  const [codeSaved, setCodeSaved] = useState(false);

  // Editable class details (name / alias / year).
  const [nameDraft, setNameDraft] = useState('');
  const [aliasDraft, setAliasDraft] = useState('');
  const [yearDraft, setYearDraft] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [detailsSaved, setDetailsSaved] = useState(false);

  // Own profile: display name, plus a credential change that needs the current
  // code and a twice-typed new one.
  const [ownNameDraft, setOwnNameDraft] = useState(teacherName || '');
  const [savingOwnName, setSavingOwnName] = useState(false);
  const [ownNameError, setOwnNameError] = useState(null);
  const [ownNameSaved, setOwnNameSaved] = useState(false);

  const [currentCodeDraft, setCurrentCodeDraft] = useState('');
  const [newCodeDraft, setNewCodeDraft] = useState('');
  const [confirmCodeDraft, setConfirmCodeDraft] = useState('');
  const [savingTeacherCode, setSavingTeacherCode] = useState(false);
  const [teacherCodeError, setTeacherCodeError] = useState(null);
  const [teacherCodeSaved, setTeacherCodeSaved] = useState(false);

  const adoptCredential = usePlayerStore((s) => s.adoptCredential);

  const load = useCallback(async () => {
    if (!classId) return;
    setStatus('loading');
    setError(null);
    try {
      const data = await fetchClassInfo(classId, teacherCode);
      setInfo(data);
      setCodeDraft(data.classCode || '');
      setNameDraft(data.className || '');
      setAliasDraft(data.classAlias || '');
      setYearDraft(data.classYear || '');
      setStatus('ready');
    } catch (err) {
      setError(err.message || 'Could not load class information.');
      setStatus('error');
    }
  }, [classId, teacherCode]);

  // Fetch ONCE per class, not on every teacherCode change. After a teacher
  // changes their own code the parent hands down the new teacherCode, which
  // would re-run load(), flip the panel back to 'loading' and unmount this
  // whole form — destroying the "✓ Code changed" confirmation mid-flight. The
  // class data doesn't depend on the code, so a ref guard is the right scope.
  const loadedForClassRef = useRef(null);
  useEffect(() => {
    if (!classId || loadedForClassRef.current === classId) return;
    loadedForClassRef.current = classId;
    load();
  }, [classId, load]);

  const codeChanged =
    info && (codeDraft.trim().toUpperCase() !== (info.classCode || '').toUpperCase());
  const codeCheck = useCodeCheck(codeChanged ? codeDraft : '', { classId });

  const detailsChanged =
    Boolean(info) &&
    (nameDraft.trim() !== (info.className || '') ||
      aliasDraft.trim() !== (info.classAlias || '') ||
      yearDraft.trim() !== (info.classYear || ''));

  // Compare against the LIVE store name, not the `teacherName` prop. After a
  // code change the prop is refreshed from the server identity, but so is the
  // store — reading the store here keeps the two in step and means the button
  // reads correctly instead of staying enabled against a stale baseline.
  const liveTeacherName = usePlayerStore((s) => s.playerName);
  const ownNameChanged =
    ownNameDraft.trim() !== (liveTeacherName ?? teacherName ?? '').trim();

  // Availability check for the NEW teacher code, excluding nothing: a change
  // here frees the old code and must not collide with anything else. Skipped
  // until the field holds something, so an empty box reads as idle, not taken.
  const newCodeCheck = useCodeCheck(newCodeDraft, undefined);

  const newCodeTooShort =
    newCodeDraft.length > 0 && newCodeDraft.trim().length < 4;
  const newCodeSameAsOld =
    newCodeDraft.trim().length > 0 && newCodeDraft.trim() === currentCodeDraft.trim();
  const newCodeMismatch =
    confirmCodeDraft.length > 0 && confirmCodeDraft.trim() !== newCodeDraft.trim();
  const canSubmitTeacherCode =
    !savingTeacherCode &&
    currentCodeDraft.trim().length > 0 &&
    newCodeDraft.trim().length >= 4 &&
    confirmCodeDraft.trim() === newCodeDraft.trim() &&
    !newCodeTooShort &&
    !newCodeSameAsOld &&
    !newCodeMismatch &&
    newCodeCheck.status !== 'taken';

  const saveDetails = async () => {
    if (!detailsChanged || savingDetails) return;
    setSavingDetails(true);
    setDetailsError(null);
    setDetailsSaved(false);
    try {
      const updated = await setClassDetails(
        classId,
        {
          className: nameDraft.trim(),
          classAlias: aliasDraft.trim(),
          classYear: yearDraft.trim(),
        },
        teacherCode
      );
      const next = updated?.classInfo;
      if (next) {
        const name = next.className || nameDraft.trim();
        // The server falls back to the class name when the alias is cleared, so
        // mirror that rather than leaving a stale alias in the form.
        const alias = next.classAlias || name;
        // `classYear` is only trusted when the key is actually present; an older
        // server omits it, and reading that as null would silently wipe the year
        // the teacher just typed.
        const year = 'classYear' in next ? next.classYear || '' : yearDraft.trim();
        setInfo((cur) => ({
          ...cur,
          className: name,
          classAlias: alias,
          classYear: year || null,
        }));
        setNameDraft(name);
        setAliasDraft(alias);
        setYearDraft(year);
      }
      setDetailsSaved(true);
    } catch (err) {
      setDetailsError(err.message || 'Could not update class information.');
    } finally {
      setSavingDetails(false);
    }
  };

  const saveOwnName = async () => {
    if (!ownNameChanged || savingOwnName) return;
    setSavingOwnName(true);
    setOwnNameError(null);
    setOwnNameSaved(false);
    try {
      const res = await updateOwnTeacher(
        { name: ownNameDraft.trim() },
        teacherCode
      );
      const identity = res?.teacher;
      // Keep the stored identity in step without touching the credential.
      if (identity) {
        adoptCredential(teacherCode, identity);
        // Adopt the server's (possibly length-trimmed) name so the field's
        // baseline matches what was actually saved — otherwise a >80-char input
        // would leave the Save button permanently enabled.
        setOwnNameDraft(identity.name ?? ownNameDraft.trim());
      }
      setOwnNameSaved(true);
    } catch (err) {
      setOwnNameError(err.message || 'Could not update your name.');
    } finally {
      setSavingOwnName(false);
    }
  };

  const saveTeacherCode = async () => {
    if (!canSubmitTeacherCode) return;

    const ok = await confirmDialog({
      title: 'Change your code?',
      message:
        'This becomes your new sign-in code. Any device or bookmark still using the old code will stop working.',
      confirmLabel: 'Change code',
      cancelLabel: 'Cancel',
      danger: true,
      icon: '🔑',
    });
    if (!ok) return;

    setSavingTeacherCode(true);
    setTeacherCodeError(null);
    setTeacherCodeSaved(false);
    try {
      const res = await updateOwnTeacher(
        {
          currentCode: currentCodeDraft.trim(),
          newCode: newCodeDraft.trim(),
        },
        teacherCode
      );
      const nextCode = newCodeDraft.trim();
      // Adopt the new credential so this device stays signed in; the response's
      // identity is authoritative, so re-apply it rather than guessing.
      adoptCredential(nextCode, res?.teacher);
      setCurrentCodeDraft('');
      setNewCodeDraft('');
      setConfirmCodeDraft('');
      setTeacherCodeSaved(true);
    } catch (err) {
      setTeacherCodeError(err.message || 'Could not change your code.');
    } finally {
      setSavingTeacherCode(false);
    }
  };

  const togglePublic = async (value) => {
    if (!info || savingPublic || info.isPublic === value) return;
    // Privacy changes are hard to explain after the fact (they alter how every
    // student signs in), so confirm before applying — same dialog as sign-out.
    const ok = await confirmDialog({
      title: value ? 'Make class public?' : 'Make class private?',
      message: value
        ? 'Anyone with the class code can join using just their name.'
        : 'Each student will need their own individual code to join.',
      confirmLabel: value ? 'Make public' : 'Make private',
      cancelLabel: 'Cancel',
      danger: !value,
      icon: value ? '🌐' : '🔒',
    });
    if (!ok) return;
    setSavingPublic(true);
    setError(null);
    try {
      const updated = await setClassPublic(classId, value, teacherCode);
      setInfo((cur) => ({ ...cur, isPublic: updated?.isPublic ?? value }));
    } catch (err) {
      setError(err.message || 'Could not update class privacy.');
    } finally {
      setSavingPublic(false);
    }
  };

  const saveCode = async () => {
    const next = codeDraft.trim().toUpperCase();
    if (!next || !codeChanged || savingCode) return;
    setSavingCode(true);
    setCodeError(null);
    setCodeSaved(false);
    try {
      const updated = await setClassCode(classId, next, teacherCode);
      setInfo((cur) => ({ ...cur, classCode: updated?.classCode || next }));
      setCodeDraft(updated?.classCode || next);
      setCodeSaved(true);
    } catch (err) {
      setCodeError(err.message || 'Could not update the class code.');
    } finally {
      setSavingCode(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl aura-card px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide aura-muted">Signed in as</p>
          <p className="truncate text-base font-black aura-text sm:text-lg">{teacherName}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            const ok = await confirmDialog({
              title: 'Sign out?',
              message: 'You will need your code to sign back in.',
              confirmLabel: 'Sign out',
              cancelLabel: 'Stay',
              danger: true,
              icon: '👋',
            });
            if (ok) {
              resetPlayer();
              onClose?.();
            }
          }}
          className="aura-ghost shrink-0 rounded-full px-4 py-2 text-xs font-black"
        >
          Not you?
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold aura-soft">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
          Loading class information…
        </div>
      )}

      {status === 'error' && (
        <p className="rounded-2xl border border-rose-500/30 bg-rose-500/20 px-3 py-3 text-sm font-bold text-rose-100">
          ⚠️ {error || 'Could not load class information.'}
        </p>
      )}

      {status === 'ready' && info && (
        <>
          <div className="rounded-2xl aura-card p-4 sm:p-5">
            <p className="text-sm font-black aura-text">Class information</p>
            <p className="mt-1 text-xs font-semibold aura-soft">
              Rename your class and set how it is labelled. The class ID is fixed and cannot be
              changed.
            </p>

            <div className="mt-3 flex flex-col gap-3">
              <div>
                <label htmlFor="cls-name" className="mb-1 block text-[11px] font-black aura-soft">
                  Class name
                </label>
                <input
                  id="cls-name"
                  type="text"
                  value={nameDraft}
                  maxLength={80}
                  onChange={(e) => {
                    setNameDraft(e.target.value);
                    setDetailsSaved(false);
                    setDetailsError(null);
                  }}
                  disabled={savingDetails}
                  className={textInputCls}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="cls-alias" className="mb-1 block text-[11px] font-black aura-soft">
                    Short label (alias)
                  </label>
                  <input
                    id="cls-alias"
                    type="text"
                    value={aliasDraft}
                    maxLength={80}
                    placeholder={nameDraft || 'e.g. Sunflower'}
                    onChange={(e) => {
                      setAliasDraft(e.target.value);
                      setDetailsSaved(false);
                      setDetailsError(null);
                    }}
                    disabled={savingDetails}
                    className={textInputCls}
                  />
                </div>
                <div>
                  <label htmlFor="cls-year" className="mb-1 block text-[11px] font-black aura-soft">
                    Year
                  </label>
                  <input
                    id="cls-year"
                    type="text"
                    value={yearDraft}
                    maxLength={20}
                    placeholder="e.g. 2026"
                    onChange={(e) => {
                      setYearDraft(e.target.value);
                      setDetailsSaved(false);
                      setDetailsError(null);
                    }}
                    disabled={savingDetails}
                    className={textInputCls}
                  />
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <dt className="font-bold aura-muted">Class ID</dt>
                  <dd className="font-mono text-xs font-bold aura-soft">{info.classId}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="font-bold aura-muted">Class code</dt>
                  <dd className="font-mono text-xs font-black aura-text">{info.classCode || '—'}</dd>
                </div>
              </dl>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={saveDetails}
                  disabled={!detailsChanged || savingDetails}
                  className="aura-btn aura-btn-violet min-h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingDetails ? 'Saving…' : 'Save class information'}
                </button>
                {detailsSaved && (
                  <span className="text-[11px] font-black text-emerald-200">✓ Saved</span>
                )}
              </div>
              {detailsError && (
                <p className="rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-100">
                  ⚠️ {detailsError}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl aura-card p-4 sm:p-5">
            <p className="text-sm font-black aura-text">Your name</p>
            <p className="mt-1 text-xs font-semibold aura-soft">
              This is what students, other teachers and admin see next to your activity.
            </p>
            <div className="mt-3">
              <input
                type="text"
                value={ownNameDraft}
                maxLength={80}
                onChange={(e) => {
                  setOwnNameDraft(e.target.value);
                  setOwnNameSaved(false);
                  setOwnNameError(null);
                }}
                disabled={savingOwnName}
                className={textInputCls}
              />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={saveOwnName}
                disabled={!ownNameChanged || savingOwnName}
                className="aura-btn aura-btn-violet min-h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingOwnName ? 'Saving…' : 'Save name'}
              </button>
              {ownNameSaved && (
                <span className="text-[11px] font-black text-emerald-200">✓ Saved</span>
              )}
            </div>
            {ownNameError && (
              <p className="mt-2 rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-100">
                ⚠️ {ownNameError}
              </p>
            )}
          </div>

          <div className="rounded-2xl aura-card p-4 sm:p-5">
            <p className="text-sm font-black aura-text">Your access code</p>
            <p className="mt-1 text-xs font-semibold aura-soft">
              This is your own sign-in code. Changing it signs out every other device still using
              the old one, including printed badges or shared links that contain it.
            </p>

            <div className="mt-3 flex flex-col gap-3">
              <div>
                <label htmlFor="tc-current" className="mb-1 block text-[11px] font-black aura-soft">
                  Your current code
                </label>
                <input
                  id="tc-current"
                  type="password"
                  value={currentCodeDraft}
                  autoComplete="off"
                  onChange={(e) => {
                    setCurrentCodeDraft(e.target.value);
                    setTeacherCodeSaved(false);
                    setTeacherCodeError(null);
                  }}
                  disabled={savingTeacherCode}
                  className={textInputCls}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="tc-new" className="mb-1 block text-[11px] font-black aura-soft">
                    New code
                  </label>
                  <input
                    id="tc-new"
                    type="password"
                    value={newCodeDraft}
                    autoComplete="off"
                    onChange={(e) => {
                      setNewCodeDraft(e.target.value);
                      setTeacherCodeSaved(false);
                      setTeacherCodeError(null);
                    }}
                    disabled={savingTeacherCode}
                    className={textInputCls}
                  />
                  <div className="mt-1 min-h-[1rem]">
                    {newCodeTooShort ? (
                      <span className="text-[11px] font-black text-amber-200">
                        ✕ At least 4 characters
                      </span>
                    ) : newCodeSameAsOld ? (
                      <span className="text-[11px] font-black text-amber-200">
                        ✕ That is already your code
                      </span>
                    ) : (
                      <CodeCheckBadge state={newCodeCheck} />
                    )}
                  </div>
                </div>
                <div>
                  <label htmlFor="tc-confirm" className="mb-1 block text-[11px] font-black aura-soft">
                    Repeat new code
                  </label>
                  <input
                    id="tc-confirm"
                    type="password"
                    value={confirmCodeDraft}
                    autoComplete="off"
                    onChange={(e) => {
                      setConfirmCodeDraft(e.target.value);
                      setTeacherCodeSaved(false);
                      setTeacherCodeError(null);
                    }}
                    disabled={savingTeacherCode}
                    className={textInputCls}
                  />
                  <div className="mt-1 min-h-[1rem]">
                    {newCodeMismatch ? (
                      <span className="text-[11px] font-black text-amber-200">
                        ✕ The two codes do not match
                      </span>
                    ) : confirmCodeDraft.length > 0 ? (
                      <span className="text-[11px] font-black text-emerald-200">✓ Match</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={saveTeacherCode}
                  disabled={!canSubmitTeacherCode}
                  className="aura-btn aura-btn-violet min-h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingTeacherCode ? 'Changing…' : 'Change code'}
                </button>
                {teacherCodeSaved && (
                  <span className="text-[11px] font-black text-emerald-200">✓ Code changed</span>
                )}
              </div>
              {teacherCodeError && (
                <p className="rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-100">
                  ⚠️ {teacherCodeError}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl aura-card p-4 sm:p-5">
            <p className="text-sm font-black aura-text">Class privacy</p>
            <p className="mt-1 text-xs font-semibold aura-soft">
              Public lets anyone join with the class code and their name. Private requires each
              student to have their own code.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => togglePublic(false)}
                disabled={savingPublic || !info.isPublic}
                className={`rounded-2xl border px-4 py-3 text-left transition disabled:opacity-60 ${
                  !info.isPublic
                    ? 'border-rose-400 bg-rose-500/20'
                    : 'border-white/15 bg-white/5 hover:bg-white/10'
                }`}
              >
                <p className="text-sm font-black aura-text">🔒 Private</p>
                <p className="mt-0.5 text-[11px] font-semibold aura-soft">
                  Students need an individual code.
                </p>
              </button>
              <button
                type="button"
                onClick={() => togglePublic(true)}
                disabled={savingPublic || info.isPublic}
                className={`rounded-2xl border px-4 py-3 text-left transition disabled:opacity-60 ${
                  info.isPublic
                    ? 'border-emerald-400 bg-emerald-500/20'
                    : 'border-white/15 bg-white/5 hover:bg-white/10'
                }`}
              >
                <p className="text-sm font-black aura-text">🌐 Public</p>
                <p className="mt-0.5 text-[11px] font-semibold aura-soft">
                  Join with the class code + name.
                </p>
              </button>
            </div>
            {savingPublic && (
              <p className="mt-2 text-[11px] font-bold aura-muted">Saving privacy…</p>
            )}
          </div>

          <div className="rounded-2xl aura-card p-4 sm:p-5">
            <p className="text-sm font-black aura-text">Class code</p>
            <p className="mt-1 text-xs font-semibold aura-soft">
              You can rename your own class code. Changing it breaks any printed badges or shared
              links that contain the old code.
            </p>
            <div className="mt-3">
              <CodeField
                id="class-code"
                label="Class code"
                value={codeDraft}
                onChange={(v) => {
                  setCodeDraft(v);
                  setCodeSaved(false);
                  setCodeError(null);
                }}
                placeholder="e.g. C4KD2M"
                check={codeChanged ? codeCheck : { status: 'idle' }}
                disabled={savingCode}
              />
            </div>
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={saveCode}
                disabled={!codeChanged || savingCode || codeCheck.status === 'taken'}
                className="aura-btn aura-btn-violet min-h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingCode ? 'Saving…' : 'Save class code'}
              </button>
              {codeSaved && <span className="text-[11px] font-black text-emerald-200">✓ Saved</span>}
            </div>
            {codeError && (
              <p className="mt-2 rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-100">
                ⚠️ {codeError}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin — class list + create form + detail editor (with a games sub-panel).
// ---------------------------------------------------------------------------
function TeacherRowsEditor({ teachers, setTeachers, disabled, originalCodes }) {
  const update = (index, patch) =>
    setTeachers((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const add = () => setTeachers((rows) => [...rows, { name: '', teacherCode: '' }]);
  const remove = (index) => setTeachers((rows) => rows.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-3">
      {teachers.length === 0 && (
        <p className="text-xs font-semibold aura-muted">No teachers yet.</p>
      )}
      {teachers.map((teacher, index) => (
        <TeacherRow
          key={index}
          teacher={teacher}
          index={index}
          disabled={disabled}
          onChange={update}
          onRemove={remove}
          originalCode={originalCodes?.[index]}
        />
      ))}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="aura-ghost self-start rounded-xl px-3 py-2 text-xs disabled:opacity-50"
      >
        + Add teacher
      </button>
    </div>
  );
}

// A single teacher row. Split out so each row can own its own availability hook
// (hooks can't be called inside a loop). Availability is only checked when the
// code actually differs from what was loaded, otherwise an unchanged code would
// falsely report as "taken".
function TeacherRow({ teacher, index, disabled, onChange, onRemove, originalCode }) {
  const changed = (teacher.teacherCode || '').trim() !== (originalCode || '').trim();
  const check = useCodeCheck(changed ? teacher.teacherCode : '', undefined);
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <input
            type="text"
            value={teacher.name}
            onChange={(e) => onChange(index, { name: e.target.value })}
            placeholder="Teacher name"
            disabled={disabled}
            className={textInputCls}
          />
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={teacher.teacherCode}
            onChange={(e) => onChange(index, { teacherCode: e.target.value })}
            placeholder="Teacher code"
            disabled={disabled}
            autoComplete="off"
            className={textInputCls}
          />
          <div className="mt-1 min-h-[1rem]">
            <CodeCheckBadge state={check} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={disabled}
          className="aura-ghost aura-ghost-danger h-11 shrink-0 rounded-xl px-3 text-xs disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function NewClassForm({ teacherCode, onCreated, onCancel }) {
  const [className, setClassName] = useState('');
  const [classYear, setClassYear] = useState('');
  const [classAlias, setClassAlias] = useState('');
  const [classCode, setClassCode] = useState('');
  // Q3: new classes default to Private; the admin can flip to Public here.
  const [isPublic, setIsPublic] = useState(false);
  const [teachers, setTeachers] = useState([{ name: '', teacherCode: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const codeCheck = useCodeCheck(classCode, undefined);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await createClass(
        {
          className: className.trim(),
          classYear: classYear.trim(),
          classAlias: classAlias.trim(),
          classCode: classCode.trim(),
          isPublic,
          teachers: teachers
            .map((t) => ({ name: t.name.trim(), teacherCode: t.teacherCode.trim() }))
            .filter((t) => t.name && t.teacherCode),
        },
        teacherCode
      );
      onCreated?.();
    } catch (err) {
      setError(err.message || 'Could not create this class.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl aura-card p-4 sm:p-5">
      <h3 className="text-base font-black aura-text">New class</h3>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-black aura-soft">Class name</label>
          <input
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="e.g. Kindergarten 1"
            disabled={saving}
            className={textInputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-black aura-soft">Year (optional)</label>
          <input
            type="text"
            value={classYear}
            onChange={(e) => setClassYear(e.target.value)}
            placeholder="e.g. 2026"
            disabled={saving}
            className={textInputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-black aura-soft">Alias (optional)</label>
          <input
            type="text"
            value={classAlias}
            onChange={(e) => setClassAlias(e.target.value)}
            placeholder="Short display name"
            disabled={saving}
            className={textInputCls}
          />
        </div>
        <CodeField
          id="new-class-code"
          label="Class code"
          value={classCode}
          onChange={setClassCode}
          placeholder="e.g. C4KD2M"
          check={codeCheck}
          disabled={saving}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs font-black aura-soft">Privacy</span>
        <div className="flex overflow-hidden rounded-full border border-white/20">
          <button
            type="button"
            onClick={() => setIsPublic(false)}
            disabled={saving}
            className={`px-3 py-1.5 text-xs font-black transition ${
              !isPublic ? 'bg-rose-500/40 text-white' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            Private
          </button>
          <button
            type="button"
            onClick={() => setIsPublic(true)}
            disabled={saving}
            className={`px-3 py-1.5 text-xs font-black transition ${
              isPublic ? 'bg-emerald-500/40 text-white' : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            Public
          </button>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-black aura-soft">Teachers</p>
        <TeacherRowsEditor teachers={teachers} setTeachers={setTeachers} disabled={saving} />
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-100">
          ⚠️ {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving || !className.trim() || !classCode.trim()}
          className="aura-btn aura-btn-violet min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create class'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="aura-ghost min-h-11 px-4 text-sm disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function AdminClassDetail({ classId, teacherCode, onBack, onSaved }) {
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    className: '',
    classYear: '',
    classAlias: '',
    classCode: '',
    isPublic: false,
    active: true,
  });
  const [teachers, setTeachers] = useState([]);
  const [showGames, setShowGames] = useState(false);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const data = await fetchClassInfo(classId, teacherCode);
      setInfo(data);
      setForm({
        className: data.className || '',
        classYear: data.classYear || '',
        classAlias: data.classAlias || '',
        classCode: data.classCode || '',
        isPublic: Boolean(data.isPublic),
        active: data.active !== false,
      });
      setTeachers(
        (data.teacherList || []).map((t) => ({ name: t.name, teacherCode: t.code }))
      );
      setStatus('ready');
    } catch (err) {
      setError(err.message || 'Could not load this class.');
      setStatus('error');
    }
  }, [classId, teacherCode]);

  useEffect(() => {
    load();
  }, [load]);

  const codeChanged = info && form.classCode.trim() !== (info.classCode || '');
  const codeCheck = useCodeCheck(codeChanged ? form.classCode : '', { classId });

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateClass(
        classId,
        {
          className: form.className.trim(),
          classYear: form.classYear.trim(),
          classAlias: form.classAlias.trim(),
          classCode: form.classCode.trim(),
          isPublic: form.isPublic,
          active: form.active,
          teachers: teachers
            .map((t) => ({ name: t.name.trim(), teacherCode: t.teacherCode.trim() }))
            .filter((t) => t.name && t.teacherCode),
        },
        teacherCode
      );
      await load();
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="aura-ghost mb-4 rounded-xl px-3 py-2 text-xs font-black"
      >
        ← All classes
      </button>

      {status === 'loading' && (
        <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold aura-soft">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
          Loading class…
        </div>
      )}

      {status === 'error' && (
        <p className="rounded-2xl border border-rose-500/30 bg-rose-500/20 px-3 py-3 text-sm font-bold text-rose-100">
          ⚠️ {error || 'Could not load this class.'}
        </p>
      )}

      {status === 'ready' && info && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl aura-card p-4 sm:p-5">
            <p className="font-mono text-[11px] font-bold aura-muted">{info.classId}</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-black aura-soft">Class name</label>
                <input
                  type="text"
                  value={form.className}
                  onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))}
                  disabled={saving}
                  className={textInputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-black aura-soft">Year</label>
                <input
                  type="text"
                  value={form.classYear}
                  onChange={(e) => setForm((f) => ({ ...f, classYear: e.target.value }))}
                  disabled={saving}
                  className={textInputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-black aura-soft">Alias</label>
                <input
                  type="text"
                  value={form.classAlias}
                  onChange={(e) => setForm((f) => ({ ...f, classAlias: e.target.value }))}
                  disabled={saving}
                  className={textInputCls}
                />
              </div>
              <CodeField
                id="detail-class-code"
                label="Class code"
                value={form.classCode}
                onChange={(v) => setForm((f) => ({ ...f, classCode: v }))}
                check={codeChanged ? codeCheck : { status: 'idle' }}
                disabled={saving}
                hint="Changing this breaks printed badges / links."
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-black aura-soft">
                <input
                  type="checkbox"
                  checked={form.isPublic}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    if (next === form.isPublic) return;
                    const ok = await confirmDialog({
                      title: next ? 'Make class public?' : 'Make class private?',
                      message: next
                        ? 'Anyone with the class code can join using just their name.'
                        : 'Each student will need their own individual code to join.',
                      confirmLabel: next ? 'Make public' : 'Make private',
                      cancelLabel: 'Cancel',
                      danger: !next,
                      icon: next ? '🌐' : '🔒',
                    });
                    if (ok) setForm((f) => ({ ...f, isPublic: next }));
                  }}
                  disabled={saving}
                  className="h-4 w-4 accent-emerald-500"
                />
                Public class
              </label>
              <label className="flex items-center gap-2 text-xs font-black aura-soft">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  disabled={saving}
                  className="h-4 w-4 accent-indigo-500"
                />
                Active
              </label>
            </div>
          </div>

          <div className="rounded-2xl aura-card p-4 sm:p-5">
            <p className="mb-3 text-sm font-black aura-text">Teachers</p>
            <TeacherRowsEditor
              teachers={teachers}
              setTeachers={setTeachers}
              disabled={saving}
              originalCodes={(info.teacherList || []).map((t) => t.code)}
            />
          </div>

          {error && (
            <p className="rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-100">
              ⚠️ {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !form.className.trim() || !form.classCode.trim()}
              className="aura-btn aura-btn-violet min-h-11 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>

          <div className="rounded-2xl aura-card p-4 sm:p-5">
            <button
              type="button"
              onClick={() => setShowGames((v) => !v)}
              className="aura-ghost w-full justify-between px-4 py-2.5 text-sm"
            >
              <span>🎮 Games for this class</span>
              <span>{showGames ? 'Hide' : 'Manage'}</span>
            </button>
            {showGames && (
              <div className="mt-4">
                {globalError && (
                  <p className="mb-3 rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-100">
                    ⚠️ {globalError}
                  </p>
                )}
                <GameAccessEditor
                  key={`games-${classId}`}
                  classId={classId}
                  teacherCode={teacherCode}
                  isSaving={globalSaving}
                  onGlobalError={setGlobalError}
                  onGlobalSavingChange={setGlobalSaving}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminClasses({ teacherCode }) {
  const [classes, setClasses] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const rows = await fetchClasses(teacherCode);
      setClasses(Array.isArray(rows) ? rows : []);
      setStatus('ready');
    } catch (err) {
      setError(err.message || 'Could not load classes.');
      setStatus('error');
    }
  }, [teacherCode]);

  useEffect(() => {
    load();
  }, [load]);

  if (selectedId) {
    return (
      <AdminClassDetail
        classId={selectedId}
        teacherCode={teacherCode}
        onBack={() => {
          setSelectedId(null);
          load();
        }}
        onSaved={load}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-black aura-soft">
          {status === 'ready' ? `${classes.length} class${classes.length === 1 ? '' : 'es'}` : ''}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className="aura-ghost px-3 py-2 text-xs">
            ↻ Refresh
          </button>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="aura-btn aura-btn-violet min-h-10 px-3 text-xs"
          >
            {creating ? 'Close' : '+ New class'}
          </button>
        </div>
      </div>

      {creating && (
        <NewClassForm
          teacherCode={teacherCode}
          onCreated={() => {
            setCreating(false);
            load();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {status === 'loading' && (
        <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold aura-soft">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
          Loading classes…
        </div>
      )}

      {status === 'error' && (
        <p className="rounded-2xl border border-rose-500/30 bg-rose-500/20 px-3 py-3 text-sm font-bold text-rose-100">
          ⚠️ {error}
        </p>
      )}

      {status === 'ready' && classes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/25 bg-white/10 px-5 py-10 text-center">
          <span className="text-4xl">🏫</span>
          <p className="mt-3 text-base font-black aura-text">No classes yet</p>
          <p className="mt-1 text-sm font-semibold aura-soft">Create your first class above.</p>
        </div>
      )}

      {status === 'ready' && classes.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {classes.map((c) => (
            <li key={c.classId}>
              <button
                type="button"
                onClick={() => setSelectedId(c.classId)}
                className="aura-card flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-white/10 active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/40 to-violet-500/40 text-lg">
                  🏫
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-black aura-text sm:text-base">
                      {c.className}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        c.isPublic
                          ? 'bg-emerald-500/25 text-emerald-100'
                          : 'bg-white/10 text-slate-200'
                      }`}
                    >
                      {c.isPublic ? '🌐 Public' : '🔒 Private'}
                    </span>
                    {!c.active && (
                      <span className="rounded-full bg-rose-500/25 px-2 py-0.5 text-[10px] font-black text-rose-100">
                        Inactive
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block font-mono text-[11px] font-bold aura-muted">
                    {c.classCode || c.classId}
                    {c.classAlias && c.classAlias !== c.className ? ` · ${c.classAlias}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="rounded-full bg-indigo-500/25 px-2.5 py-1 text-[11px] font-black text-indigo-100">
                    {c.teacherCount ?? 0} teachers
                  </span>
                  <span className="rounded-full bg-violet-500/25 px-2.5 py-1 text-[11px] font-black text-violet-100">
                    {c.studentCount ?? 0} students
                  </span>
                </span>
                <span className="shrink-0 text-lg aura-muted">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin settings — identity + the global maintenance control.
// ---------------------------------------------------------------------------
function AdminSettings({ teacherName, onClose, resetPlayer }) {
  const teacherCode = usePlayerStore((s) => s.teacherCode);
  const maintenanceMode = useSystemConfigStore((s) => s.maintenanceMode);
  const maintenanceMessage = useSystemConfigStore((s) => s.maintenanceMessage);
  const maintenanceEndsAt = useSystemConfigStore((s) => s.maintenanceEndsAt);
  const fetchConfig = useSystemConfigStore((s) => s.fetchConfig);
  const patchConfig = useSystemConfigStore((s) => s.patchConfig);

  const [messageDraft, setMessageDraft] = useState(maintenanceMessage || '');
  const [endsAtDraft, setEndsAtDraft] = useState(() => toLocalInput(maintenanceEndsAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    setMessageDraft(maintenanceMessage || '');
  }, [maintenanceMessage]);

  useEffect(() => {
    setEndsAtDraft(toLocalInput(maintenanceEndsAt));
  }, [maintenanceEndsAt]);

  const toggleMaintenance = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await patchConfig({ maintenanceMode: !maintenanceMode }, teacherCode);
    } catch (err) {
      setError(err.message || 'Could not update maintenance mode.');
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await patchConfig(
        {
          maintenanceMessage: messageDraft,
          maintenanceEndsAt: endsAtDraft ? new Date(endsAtDraft).toISOString() : null,
        },
        teacherCode
      );
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Could not save maintenance details.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl aura-card px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide aura-muted">Signed in as</p>
          <p className="truncate text-base font-black aura-text sm:text-lg">{teacherName}</p>
          <p className="mt-0.5 text-[11px] font-bold text-amber-200">Administrator</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            const ok = await confirmDialog({
              title: 'Sign out of admin?',
              message: 'You will need the admin code to sign back in.',
              confirmLabel: 'Sign out',
              cancelLabel: 'Stay',
              danger: true,
              icon: '👋',
            });
            if (ok) {
              resetPlayer();
              onClose?.();
            }
          }}
          className="aura-ghost shrink-0 rounded-full px-4 py-2 text-xs font-black"
        >
          Sign out
        </button>
      </div>

      <div
        className={`rounded-2xl border p-4 sm:p-5 ${
          maintenanceMode ? 'border-amber-400/60 bg-amber-500/15' : 'aura-card'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-black aura-text">
              Maintenance mode: {maintenanceMode ? 'ON' : 'OFF'}
            </p>
            <p className="mt-1 text-xs font-semibold aura-soft">
              When ON, students see a maintenance screen on every page. Teachers and admins keep
              working normally.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={maintenanceMode}
            onClick={toggleMaintenance}
            disabled={busy}
            className={`relative h-8 w-[3.5rem] shrink-0 rounded-full border-2 transition-colors disabled:opacity-50 sm:h-10 sm:w-[4.25rem] ${
              maintenanceMode ? 'border-amber-500 bg-amber-500' : 'border-white/40 bg-white/15'
            }`}
          >
            <motion.span
              animate={{ x: maintenanceMode ? (window.innerWidth >= 640 ? 40 : 32) : 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 34 }}
              className="absolute left-[3px] top-[3px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-[10px] font-black text-slate-700 shadow-sm sm:h-7 sm:w-7 sm:text-xs"
            >
              {maintenanceMode ? '✓' : '—'}
            </motion.span>
          </button>
        </div>

        {maintenanceMode && (
          <p className="mt-3 rounded-xl bg-amber-400/20 px-3 py-2 text-[11px] font-black text-amber-100">
            ⚠ Students currently see a maintenance screen.
          </p>
        )}
      </div>

      <div className="rounded-2xl aura-card p-4 sm:p-5">
        <p className="text-sm font-black aura-text">Maintenance message & schedule</p>
        <p className="mt-1 text-xs font-semibold aura-soft">
          Optional. Leave the message empty to use the default text, and the end time empty for no
          countdown.
        </p>

        <div className="mt-3 flex flex-col gap-3">
          <div>
            <label htmlFor="maint-message" className="mb-1 block text-[11px] font-black aura-soft">
              Custom message (optional)
            </label>
            <textarea
              id="maint-message"
              value={messageDraft}
              onChange={(e) => {
                setMessageDraft(e.target.value);
                setSaved(false);
              }}
              rows={2}
              maxLength={300}
              placeholder="EZ Wonders is under maintenance currently. Come back later."
              disabled={busy}
              className="aura-input px-3 py-2.5 text-sm font-bold disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="maint-ends" className="mb-1 block text-[11px] font-black aura-soft">
              Countdown ends at (optional)
            </label>
            <input
              id="maint-ends"
              type="datetime-local"
              value={endsAtDraft}
              onChange={(e) => {
                setEndsAtDraft(e.target.value);
                setSaved(false);
              }}
              disabled={busy}
              className="aura-input px-3 py-2.5 text-sm font-bold disabled:opacity-60"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveDetails}
              disabled={busy}
              className="aura-btn aura-btn-violet min-h-10 px-4 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            {saved && <span className="text-[11px] font-black text-emerald-200">✓ Saved</span>}
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-100">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel shell
// ---------------------------------------------------------------------------
export default function GameAccessPanel({ onClose, initialTab }) {
  const teacherCode = usePlayerStore((state) => state.teacherCode);
  const classId = usePlayerStore((state) => state.classId);
  const className = usePlayerStore((state) => state.className);
  const isAdmin = usePlayerStore((state) => state.isAdmin);
  const teacherName = usePlayerStore((state) => state.playerName);
  const resetPlayer = usePlayerStore((state) => state.resetPlayer);

  const tabs = isAdmin ? ADMIN_TABS : TEACHER_TABS;
  const [activeTab, setActiveTab] = useState(null);
  const [globalError, setGlobalError] = useState(null);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [statsView, setStatsView] = useState('stats');

  // First tab: role default, unless a ?tab= deep-link asked for stats.
  useEffect(() => {
    if (activeTab) return;
    if (initialTab === 'stats') setActiveTab('stats');
    else setActiveTab(isAdmin ? 'classes' : 'games');
  }, [activeTab, initialTab, isAdmin]);

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setGlobalError(null);
    setActiveTab(tab);
  };

  const activeConfig = tabs.find((t) => t.key === activeTab);

  return (
    <div className="aura-page min-h-[100dvh] w-full">
      <header className="sticky top-[var(--maint-banner-h,0px)] z-30 border-b border-white/15 bg-gradient-to-br from-[#315ed8]/95 via-[#5a3fc4]/95 to-[#972aa8]/95 px-4 pt-[max(0.875rem,env(safe-area-inset-top))] shadow-[0_14px_40px_-28px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:px-6 sm:pt-5 lg:px-10">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2.5 pb-3 sm:gap-4 sm:pb-4">
          <button
            type="button"
            onClick={onClose}
            disabled={globalSaving}
            aria-label="Back home"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 text-lg leading-none text-white shadow-sm transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:w-11 sm:text-xl"
          >
            ←
          </button>

          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl leading-none shadow-sm ring-1 ring-white/25 sm:flex">
            🏫
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase leading-none tracking-[0.16em] text-white/70 sm:text-[11px]">
              {isAdmin ? 'Admin controls' : 'Teacher controls'}
            </p>
            <h1 className="mt-1.5 truncate text-lg font-black leading-tight tracking-tight text-white sm:text-2xl">
              {isAdmin ? 'Class management' : 'Class controls'}
            </h1>
            <p className="mt-1 hidden truncate text-xs font-semibold leading-snug text-white/80 sm:block">
              {activeConfig?.description || ''}
            </p>
          </div>

          <Link
            to="/teacher-onboarding"
            aria-label="Open the teacher guide"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3 text-xs font-black text-white shadow-sm transition hover:bg-white/25 sm:h-11 sm:px-4 sm:text-sm"
          >
            <span aria-hidden="true" className="text-base leading-none">
              📘
            </span>
            <span className="hidden sm:inline">Teacher guide</span>
          </Link>
        </div>

        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onChange={handleTabChange}
          disabled={globalSaving}
        />
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-32 sm:px-6 sm:py-8 lg:max-w-4xl lg:px-8 lg:pb-8">
        <AnimatePresence mode="wait">
          {globalError && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/20 px-3 py-3 text-sm font-bold text-rose-100"
            >
              ⚠️ {globalError}
            </motion.p>
          )}
        </AnimatePresence>

        {activeTab === 'games' && !isAdmin && (
          <GameAccessEditor
            key={`games-${classId}`}
            classId={classId}
            teacherCode={teacherCode}
            isSaving={globalSaving}
            onGlobalError={setGlobalError}
            onGlobalSavingChange={setGlobalSaving}
          />
        )}

        {activeTab === 'catalogue' && (
          <GameCatalogue
            key={`catalogue-${classId}`}
            classId={classId}
            teacherCode={teacherCode}
          />
        )}

        {activeTab === 'students' && (
          <StudentsTab classId={classId} teacherCode={teacherCode} className={className} />
        )}

        {activeTab === 'stats' && (
          <div>
            {!isAdmin && (
              <div className="mb-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setStatsView('stats')}
                  className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-black transition-all active:scale-95 sm:h-11 sm:px-5 ${
                    statsView === 'stats'
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  📊 Stats
                </button>
                <button
                  type="button"
                  onClick={() => setStatsView('mission')}
                  className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-black transition-all active:scale-95 sm:h-11 sm:px-5 ${
                    statsView === 'mission'
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  🏆 Mission heroes
                </button>
              </div>
            )}

            <Suspense fallback={null}>
              {isAdmin ? (
                <StatsPanel embedded adminMode />
              ) : statsView === 'mission' ? (
                <MissionHeroes teacherCode={teacherCode} />
              ) : (
                <StatsPanel embedded />
              )}
            </Suspense>
          </div>
        )}

        {activeTab === 'settings' && !isAdmin && (
          <TeacherSettings
            classId={classId}
            teacherCode={teacherCode}
            teacherName={teacherName}
            onClose={onClose}
            resetPlayer={resetPlayer}
          />
        )}

        {activeTab === 'settings' && isAdmin && (
          <AdminSettings teacherName={teacherName} onClose={onClose} resetPlayer={resetPlayer} />
        )}

        {activeTab === 'classes' && isAdmin && (
          <AdminClasses teacherCode={teacherCode} />
        )}
      </main>
    </div>
  );
}
