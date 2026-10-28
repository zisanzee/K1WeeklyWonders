// TeacherClassGate.jsx
// Route guard for staff-only, class-scoped pages (the per-student data page).
//
// WHAT THIS IS AND IS NOT
// ---------------------------------------------------------------------------
// This is a UX guard, NOT the security boundary. `isTeacher` / `isAdmin` are
// zustand UI state derived on the client, and a determined visitor can edit
// them. The real boundary is the server's `requireClassAccess` on the endpoint
// the page calls — a wrong class gets a 403 there no matter what this component
// decides.
//
// Its job is narrower and still worth doing: stop a signed-out visitor, or a
// teacher who typed another class's URL, from ever reaching a page that would
// otherwise render an error box (or, worse, spin forever waiting on a request
// that will be refused).
//
// WHY THE CLASS COMPARISON MATTERS
// ---------------------------------------------------------------------------
// Two classes can both contain a child called "Aarav". The route carries
// `:classId` precisely so they are different pages, and this guard refuses to
// render one class's page under another class's session. An admin has no class
// of their own (`classId` is null) and is allowed through every class, matching
// requireClassAccess on the server.
import { Navigate } from 'react-router-dom';
import { usePlayerStore } from '@/auth/playerStore';

export default function TeacherClassGate({ classId, children }) {
  const status = usePlayerStore((s) => s.status);
  const isTeacher = usePlayerStore((s) => s.isTeacher);
  const isAdmin = usePlayerStore((s) => s.isAdmin);
  const ownClassId = usePlayerStore((s) => s.classId);

  // Auth is still resolving (AuthBootstrap awaits hydrate before render, so this
  // is normally instant). Rendering nothing is right: redirecting here would
  // bounce a signed-in teacher out on a slow first paint.
  if (status === 'loading' || status === 'idle') return null;

  // Signed out, or a child signed in on this device — this is staff-only data.
  if (!isTeacher) return <Navigate to="/" replace />;

  // Admin: any class. Teacher: only their own.
  if (!isAdmin && ownClassId !== classId) return <Navigate to="/" replace />;

  return children;
}
