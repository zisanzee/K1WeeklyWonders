// Copy this file into your React project alongside gameAccess.js, e.g.
// src/classInfo.js
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

// Returns { classId, className, image, teachers } for one class.
// `image` is null until a teacher uploads one — render a placeholder then.
export async function fetchClassInfo(classId) {
  const response = await fetch(
    `${API_BASE}/api/classes/${encodeURIComponent(classId)}`
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Could not load class information');
  }

  return response.json();
}
