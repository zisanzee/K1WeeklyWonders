import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  setGameOrderForType,
  setGameShinyForType,
  setGameUnlockedForType,
  addGameToType,
  removeGameFromType,
  fetchGameAccessForType,
  mergeRows,
  GAME_CATALOG,
  useGameAccessStore,
} from './gameAccess';
import { useStudentStore, addStudent, updateStudent, deleteStudent } from './students';
import { fetchClassInfo } from './classInfo';
import StudentBadge, { PrintAllBadgesButton } from './StudentBadge';
import StatsPanel from './StatsPanel';

const CLASS_TYPE_LABELS = {
  k1: { label: 'K1 Games', icon: '🎮', description: 'Manage K1 (Kindergarten 1) game arrangement — reorder, lock/unlock, and feature games.' },
  k2: { label: 'K2 Games', icon: '🎯', description: 'Manage K2 (Kindergarten 2) game arrangement — reorder, lock/unlock, and feature games.' },
};

function AdminTabBar({ activeTab, onChange, disabled, adminClassType }) {
  const tabs = [
    { key: 'k1-games', label: 'K1 Games', icon: '🎮', description: CLASS_TYPE_LABELS.k1.description },
    { key: 'k2-games', label: 'K2 Games', icon: '🎯', description: CLASS_TYPE_LABELS.k2.description },
    { key: 'stats', label: 'Stats', icon: '📊', description: 'See who has been playing and how they are doing.' },
    { key: 'students', label: 'Students', icon: '🧑‍🎓', description: 'Manage the students enrolled in this class.' },
    { key: 'settings', label: 'Settings', icon: '⚙️', description: 'Configure settings for this class.' },
  ];

  return (
    <div className="mx-auto max-w-5xl overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div role="tablist" aria-label="Admin panel sections" className="flex min-w-max gap-1 border-b border-white/25 sm:min-w-0 sm:gap-2">
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
                isActive ? 'text-white' : 'text-slate-300/70 hover:text-white'
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
    { key: 'stats', label: 'Stats', icon: '📊', description: 'See who has been playing and how they are doing.' },
    { key: 'students', label: 'Students', icon: '🧑‍🎓', description: 'Manage the students enrolled in this class.' },
    { key: 'settings', label: 'Settings', icon: '⚙️', description: 'Configure settings for this class.' },
  ];

  return (
    <div className="mx-auto max-w-5xl overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div role="tablist" aria-label="Teacher panel sections" className="flex min-w-max gap-1 border-b border-white/25 sm:min-w-0 sm:gap-2">
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
                isActive ? 'text-white' : 'text-slate-300/70 hover:text-white'
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

function AddStudentForm({ onAdd, isSaving, error }) {
  const [nickname, setNickname] = useState('');
  const [group, setGroup] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) return;
    onAdd({ fullName: trimmedNickname, nickname: trimmedNickname, group: group.trim() }, () => {
      setNickname('');
      setGroup('');
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 flex flex-col gap-2 rounded-2xl aura-card p-3 sm:flex-row sm:items-end sm:gap-3 sm:p-4"
    >
      <div className="flex-1">
        <label htmlFor="student-nickname" className="mb-1 block text-[11px] font-black aura-soft">
          Nickname
        </label>
        <input
          id="student-nickname"
          type="text"
          value={nickname}
          maxLength={40}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="e.g. Aisyah"
          disabled={isSaving}
          className="aura-input px-3 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="flex-1">
        <label htmlFor="student-group" className="mb-1 block text-[11px] font-black aura-soft">
          Group (optional)
        </label>
        <input
          id="student-group"
          type="text"
          value={group}
          maxLength={40}
          onChange={(event) => setGroup(event.target.value)}
          placeholder="e.g. Red group"
          disabled={isSaving}
          className="aura-input px-3 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <button
        type="submit"
        disabled={isSaving || !nickname.trim()}
        className="aura-btn aura-btn-violet min-h-[2.75rem] shrink-0 gap-2 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
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
        <p className="w-full rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-100 sm:basis-full" role="alert">
          ⚠️ {error}
        </p>
      )}
    </form>
  );
}

// Inline-editable student row. Nickname and group can be edited in-place;
// the code is read-only. Each row has a badge button to open the QR modal.
function StudentRow({ student, teacherCode }) {
  const teacherName = usePlayerStore((state) => state.playerName);
  const className = usePlayerStore((state) => state.className);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(student.nickname || '');
  const [group, setGroup] = useState(student.group || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showBadge, setShowBadge] = useState(false);

  const handleSave = async () => {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) return;
    setSaving(true);
    setError(null);
    try {
      await updateStudent({
        studentId: student.studentId,
        nickname: trimmedNickname,
        group: group.trim(),
        teacherCode,
      });
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setNickname(student.nickname || '');
    setGroup(student.group || '');
    setEditing(false);
    setError(null);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove ${student.nickname || 'this student'} from the roster?`)) return;
    setError(null);
    try {
      await deleteStudent({ studentId: student.studentId, teacherCode });
    } catch (err) {
      setError(err.message || 'Could not delete student.');
    }
  };

  return (
    <>
      <li className="rounded-2xl aura-card p-3 transition sm:p-4">
        {error && (
          <p className="mb-2.5 rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-bold text-rose-100" role="alert">
            ⚠️ {error}
          </p>
        )}

        {/* Inline edit keeps the full width so the inputs never get cramped on
            narrow screens; the code/actions row is hidden while editing. */}
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={nickname}
              maxLength={40}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Nickname"
              disabled={saving}
              className="aura-input px-3 py-2 text-sm font-bold disabled:opacity-60"
            />
            <input
              type="text"
              value={group}
              maxLength={40}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="Group (optional)"
              disabled={saving}
              className="aura-input px-3 py-2 text-sm font-bold disabled:opacity-60"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !nickname.trim()}
                className="aura-btn aura-btn-violet flex-1 px-3 py-2 text-xs disabled:opacity-50 sm:flex-none sm:px-5"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="aura-ghost flex-1 px-3 py-2 text-xs disabled:opacity-50 sm:flex-none sm:px-5"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {/* Name, group and code — truncate so nothing overflows on mobile */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate text-sm font-black aura-text sm:text-base">
                  {student.nickname || student.fullName || 'Student'}
                </p>
                {student.group && (
                  <span className="rounded-full bg-indigo-500/30 px-2 py-0.5 text-[10px] font-black text-indigo-100">
                    {student.group}
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-[11px] font-bold tracking-wider aura-muted">
                Code: {student.code || student.studentId?.slice(0, 8)}
              </p>
            </div>

            {/* Row actions — fixed tap targets so they stay usable on touch screens */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowBadge(true)}
                title="Generate badge with QR code"
                aria-label={`Generate badge for ${student.nickname || student.fullName}`}
                className="aura-btn-gold aura-btn h-9 w-9 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM18 13h-2v2h2v-2zM13 13h2v2h-2v-2zM18 18h2v2h-2v-2zM13 18h2v2h-2v-2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNickname(student.nickname || '');
                  setGroup(student.group || '');
                  setEditing(true);
                  setError(null);
                }}
                title="Edit student"
                aria-label={`Edit ${student.nickname || student.fullName}`}
                className="aura-icon-btn h-9 w-9 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleDelete}
                title="Delete student"
                aria-label={`Delete ${student.nickname || student.fullName}`}
                className="aura-icon-btn aura-ghost-danger h-9 w-9 active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </li>

      {showBadge && (
        <StudentBadge
          student={student}
          classInfo={{ className: className || 'K1 Weekly Wonders', teacherName }}
          onClose={() => setShowBadge(false)}
        />
      )}
    </>
  );
}

function StudentsTab({ isReady, students, onAdd, isSaving, error, teacherCode }) {
  const loading = useStudentStore((state) => state.loading);
  const fetchStudents = useStudentStore((state) => state.fetchStudents);

  return (
    <div>
      <AddStudentForm onAdd={onAdd} isSaving={isSaving} error={error} />

      {!isReady && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold aura-soft">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
          Loading students…
        </div>
      )}

      {isReady && students.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/25 bg-white/10 px-5 py-10 text-center">
          <span className="text-4xl">🧑‍🎓</span>
          <p className="mt-3 text-base font-black aura-text">No students yet</p>
          <p className="mt-1 text-sm font-semibold aura-soft">
            Add your first student using the form above.
          </p>
        </div>
      )}

      {isReady && students.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-black aura-soft">
            {students.length} student{students.length === 1 ? '' : 's'}
          </p>
          <button
            type="button"
            onClick={() => fetchStudents(teacherCode)}
            disabled={loading}
            title="Refresh the student list"
            className="aura-ghost gap-1.5 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="currentColor" aria-hidden="true">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
            Refresh
          </button>
        </div>
      )}

      {isReady && students.length > 0 && (
        <div className="mb-3">
          <PrintAllBadgesButton />
        </div>
      )}

      {isReady && students.length > 0 && (
        <ul className="flex flex-col gap-2">
          {students.map((student) => (
            <StudentRow
              key={student.studentId}
              student={student}
              teacherCode={teacherCode}
            />
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
    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/35 to-violet-500/35 text-3xl shadow-sm sm:h-24 sm:w-24">
      🏫
    </span>
  );
}

function ClassInfoTab({ status, classInfo, error }) {
  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold aura-soft">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
        Loading class information…
      </div>
    );
  }

  if (status === 'error' || !classInfo) {
    return (
      <p className="rounded-2xl border border-rose-500/30 bg-rose-500/20 px-3 py-3 text-sm font-bold text-rose-100">
        ⚠️ {error || 'Could not load class information.'}
      </p>
    );
  }

  return (
    <div className="rounded-2xl aura-card p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <ClassImage image={classInfo.image} className={classInfo.className} />
        <div className="min-w-0">
          <p className="truncate text-lg font-black aura-text">{classInfo.className}</p>
          <p className="mt-0.5 font-mono text-xs font-bold aura-muted">{classInfo.classId}</p>
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-black uppercase tracking-wide aura-muted">
          Teachers
        </p>
        {classInfo.teachers.length === 0 ? (
          <p className="text-sm font-semibold aura-muted">No teachers assigned to this class yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {classInfo.teachers.map((name) => (
              <li
                key={name}
                className="rounded-full bg-indigo-500/30 px-3 py-1.5 text-xs font-black text-indigo-100"
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
          game.unlocked
            ? 'border-indigo-400/40 aura-card'
            : 'border-white/20 bg-white/10'
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
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm'
                  : 'bg-amber-500/25 text-amber-100 hover:bg-amber-500/40'
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
      className="flex w-[min(380px,calc(100vw-1.5rem))] items-center gap-3 rounded-2xl border border-white/25 aura-card px-3 py-3 shadow-[0_20px_50px_rgba(11,8,40,0.55)]"
    >
      <GameIcon game={game} />

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-200">
          Moving game
        </p>
        <p className="truncate text-sm font-extrabold aura-text">
          {game.label}
        </p>
      </div>
    </motion.div>
  );
}

// Admin-only: full edit controls for a specific class type (k1 or k2).
// All reads and writes are keyed by classType directly — the server handles
// classType-scoped GameAccess with admin-only gating.
function GameAccessTypeEditor({
  classType,
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

  // Fetch games by classType via the admin-only endpoint.
  useEffect(() => {
    if (fetchAttemptedRef.current) return;
    fetchAttemptedRef.current = true;
    setLoading(true);

    fetchGameAccessForType(classType, teacherCode)
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
  }, [classType, teacherCode]);

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

      if (orderChanged) {
        await setGameOrderForType(
          draftGames.map((game) => game.key),
          classType,
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
          setGameUnlockedForType(game.key, game.unlocked, classType, teacherCode)
        ),
        ...shinyChanges.map((game) =>
          setGameShinyForType(game.key, game.shiny, classType, teacherCode)
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
        await removeGameFromType(game.key, classType, teacherCode);
      } else {
        await addGameToType(game.key, classType, teacherCode);
      }
      // Refresh games after shop change
      const rows = await fetchGameAccessForType(classType, teacherCode);
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
        <div className="min-w-0 flex-1 rounded-2xl aura-card px-4 py-3 sm:max-w-xs sm:px-5">
          <p className="text-[10px] font-black uppercase tracking-wide text-indigo-200">
            Player access
          </p>
          <p className="mt-0.5 text-lg font-black aura-text sm:text-xl">
            {unlockedCount}
            <span className="text-sm font-bold aura-muted">
              {' '}
              / {visibleGames.length} open
            </span>
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
        {displayError && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/20 px-3 py-3 text-sm font-bold text-rose-100"
          >
            ⚠️ {displayError}
          </motion.p>
        )}
      </AnimatePresence>

      {!isReady && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold aura-soft">
          {loading ? (
            <>
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
              Loading {CLASS_TYPE_LABELS[classType]?.label || classType} games…
            </>
          ) : (
            'Preparing games…'
          )}
        </div>
      )}

      <p className="mb-3 px-1 text-sm font-bold aura-soft">
        Drag a slot to reorder, or hover over one to preview the new placement.
      </p>

      {/* Shop section */}
      <div className="mb-6 rounded-2xl border border-white/20 bg-white/10 px-4 py-3">
        <p className="mb-3 text-sm font-semibold text-white">
          Game shop — <strong>+</strong> adds this game to {CLASS_TYPE_LABELS[classType]?.label || classType}, <strong>Remove</strong> takes it out.
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {GAME_CATALOG.map((game) => {
            const isAdded = visibleGames.some((item) => item.key === game.key);
            const isSavingThis = shopSavingKey === game.key;
            return (
              <li key={game.key} className="flex items-center gap-3 rounded-2xl aura-card p-3 sm:p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: game.tint }}>{game.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black aura-text">{game.label}</p>
                  <p className="mt-0.5 whitespace-pre-line text-[11px] font-semibold leading-snug aura-muted">{game.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleShopToggle(game)}
                  disabled={Boolean(shopSavingKey) || !isReady || localSaving || isSaving}
                  className={`min-h-10 shrink-0 rounded-xl px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-55 ${
                    isAdded ? 'bg-rose-500/25 text-rose-100 hover:bg-rose-500/40' : 'bg-indigo-600 text-white hover:bg-indigo-500'
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
            <div className="rounded-2xl border border-dashed border-white/25 bg-white/10 px-5 py-8 text-center">
              <span className="text-4xl">&#127918;</span>
              <p className="mt-3 text-base font-black aura-text">
                {CLASS_TYPE_LABELS[classType]?.label || classType} has no games yet
              </p>
              <p className="mt-1 text-sm font-semibold aura-soft">
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
          <p className="mt-2 text-center text-[11px] font-semibold text-amber-200">
            You have unsaved changes.
          </p>
        )}
      </div>
    </>
  );
}

// Non-admin teacher: read-only game list for their own class type.
// Uses the main gameAccess store — the server resolves classId→classType
// automatically, so every class of the same type sees identical data.
function ReadOnlyGameList({ classId }) {
  const games = useGameAccessStore((s) => s.games);
  const loaded = useGameAccessStore((s) => s.loaded);
  const loadedClassId = useGameAccessStore((s) => s.loadedClassId);
  const error = useGameAccessStore((s) => s.error);
  const loading = useGameAccessStore((s) => s.loading);
  const fetchGameAccess = useGameAccessStore((s) => s.fetchGameAccess);

  useEffect(() => {
    if (!classId) return;
    if (loaded && loadedClassId === classId) return;
    fetchGameAccess(classId);
  }, [classId, loaded, loadedClassId, fetchGameAccess]);

  const isReady = loaded && loadedClassId === classId;

  if (!isReady) {
    if (error) {
      return (
        <p className="rounded-2xl border border-rose-500/30 bg-rose-500/20 px-3 py-3 text-sm font-bold text-rose-100">
          ⚠️ {error}
        </p>
      );
    }

    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold aura-soft">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
        Loading games…
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/25 bg-white/10 px-5 py-10 text-center">
        <span className="text-4xl">🎮</span>
        <p className="mt-3 text-base font-black aura-text">No games configured yet</p>
        <p className="mt-1 text-sm font-semibold aura-soft">
          Ask an admin to add games for this class type.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm font-bold aura-soft">
        Current game arrangement for your class (read-only).
      </p>
      <ul className="flex flex-col gap-2.5">
        {games.map((game, index) => (
          <li
            key={game.gameKey || index}
            className="flex items-center gap-3 rounded-2xl aura-card p-3 sm:p-4"
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
              <p className="text-sm font-extrabold leading-tight aura-text sm:text-base">
                {game.label || game.gameKey}
              </p>
              <p className="mt-1 whitespace-pre-line text-[10px] font-semibold leading-snug aura-soft sm:text-xs">
                {game.subtitle || ''}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                  game.unlocked
                    ? 'bg-emerald-500/25 text-emerald-100'
                    : 'bg-white/10 text-slate-200'
                }`}
              >
                {game.unlocked ? '🔓 Unlocked' : '🔒 Locked'}
              </span>
              {game.shiny && (
                <span className="rounded-full bg-amber-500/25 px-2.5 py-1 text-[10px] font-black text-amber-100">
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

export default function GameAccessPanel({ onClose, initialTab }) {
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

  // Determine initial tab based on role, classType, and any ?tab= override
  // passed in from the route (e.g. Home's "View Stats" deep-link).
  useEffect(() => {
    if (activeTab) return;
    if (initialTab === 'stats') {
      setActiveTab('stats');
    } else if (isAdmin) {
      setActiveTab(userClassType === 'k2' ? 'k2-games' : 'k1-games');
    } else {
      setActiveTab('games');
    }
  }, [isAdmin, userClassType, activeTab, initialTab]);

  // The roster is class-scoped. When the logged-in teacher's class changes
  // (logout → login as a different teacher), drop the previous class's cached
  // students so they never leak into the new session.
  const prevClassIdRef = useRef(classId);
  useEffect(() => {
    if (prevClassIdRef.current !== classId) {
      useStudentStore.getState().reset();
      prevClassIdRef.current = classId;
    }
  }, [classId]);

  // Fetch each tab's data when it's first opened, or when the cached roster
  // belongs to a different class than the current one.
  useEffect(() => {
    if (activeTab !== 'students') return;
    const store = useStudentStore.getState();
    if (!store.loaded || store.loadedClassId !== classId) {
      fetchStudents(teacherCode);
    }
  }, [activeTab, studentsLoaded, fetchStudents, teacherCode, classId]);

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

  const handleAddStudent = async ({ fullName, nickname, group }, onSuccess) => {
    if (isAddingStudent) return;
    setStudentError(null);
    setIsAddingStudent(true);

    try {
      await addStudent({ fullName, nickname, group, teacherCode });
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
    if (activeTab === 'stats') return { description: 'See who has been playing and how they are doing.' };
    if (activeTab === 'k1-games') return { description: CLASS_TYPE_LABELS.k1.description };
    if (activeTab === 'k2-games') return { description: CLASS_TYPE_LABELS.k2.description };
    if (activeTab === 'games') return { description: "View your class's current game arrangement." };
    return { description: '' };
  })();

  return (
    <div className="aura-page min-h-[100dvh] w-full">
      <header className="sticky top-0 z-30 border-b border-white/15 bg-gradient-to-br from-[#315ed8]/95 via-[#5a3fc4]/95 to-[#972aa8]/95 px-4 pb-0 pt-[max(1rem,env(safe-area-inset-top))] shadow-[0_14px_40px_-28px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:px-6 sm:pt-6 lg:px-10">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-3 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={globalSaving}
              aria-label="Back home"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 text-xl text-white shadow-sm transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ←
            </button>

            <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl shadow-sm ring-1 ring-white/25 sm:flex sm:h-12 sm:w-12">
              🏫
            </span>

            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/70">
                {isAdmin ? 'Admin controls' : 'Teacher controls'}
              </p>
              <h1 className="truncate text-xl font-black tracking-tight text-white sm:text-2xl lg:text-3xl">
                {isAdmin ? 'Class management' : 'Class controls'}
              </h1>
            </div>
          </div>

          <Link
            to="/beta-ezwonders"
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-4 text-sm font-black text-white shadow-sm transition hover:bg-white/25"
          >
            ✨ Beta Homepage
          </Link>
        </div>

        <p className="mx-auto max-w-5xl pb-4 text-xs font-semibold leading-relaxed text-white/85 sm:text-sm">
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
              className="mb-3 rounded-2xl border border-rose-500/30 bg-rose-500/20 px-3 py-3 text-sm font-bold text-rose-100"
            >
              ⚠️ {globalError}
            </motion.p>
          )}
        </AnimatePresence>

        {activeTab === 'stats' && <StatsPanel embedded />}

        {activeTab === 'students' && (
          <StudentsTab
            isReady={studentsLoaded}
            students={students}
            onAdd={handleAddStudent}
            isSaving={isAddingStudent}
            error={studentError}
            teacherCode={teacherCode}
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
