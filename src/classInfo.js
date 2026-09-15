import { requestJson } from './apiClient';

// Thin fetch helper shared by every class/system endpoint. Always throws
// Error(body.error) so callers can show the server's message verbatim.
async function request(path, { method = 'GET', body, teacherCode } = {}) {
  const payload = body ? { ...body } : undefined;
  // Teacher/admin code rides in the body for writes; reads put it in the query.
  if (payload && teacherCode) payload.teacherCode = teacherCode;

  return requestJson(path, {
    method,
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

// Returns class detail: { classId, className, classAlias, classYear, classCode,
// classType, isPublic, active, image, teachers[], teacherList[] }.
// `image` is null until a teacher uploads one — render a placeholder then.
export async function fetchClassInfo(classId, teacherCode) {
  const params = teacherCode
    ? `?teacherCode=${encodeURIComponent(teacherCode)}`
    : '';
  return request(`/api/classes/${encodeURIComponent(classId)}${params}`);
}

// Live "is this code free?" check for admin/teacher forms.
export async function checkCodeAvailable(code, exclude = {}) {
  const body = { code, ...exclude };
  return request('/api/codes/check', { method: 'POST', body });
}

// Admin-only: every class with summary info (isPublic, active, counts).
export async function fetchClasses(teacherCode) {
  return request(`/api/classes?teacherCode=${encodeURIComponent(teacherCode)}`);
}

// Admin-only: create a class plus its teachers list.
export async function createClass(payload, teacherCode) {
  return request('/api/classes', { method: 'POST', body: payload, teacherCode });
}

// Admin-only: update any class field, including the full teacher list.
export async function updateClass(classId, payload, teacherCode) {
  return request(`/api/classes/${encodeURIComponent(classId)}`, {
    method: 'PUT',
    body: payload,
    teacherCode,
  });
}

// Teacher (own) OR admin: toggle the class public/private flag.
export async function setClassPublic(classId, isPublic, teacherCode) {
  return request(`/api/classes/${encodeURIComponent(classId)}/public`, {
    method: 'PATCH',
    body: { isPublic },
    teacherCode,
  });
}

// Teacher (own) OR admin: rename the class and its descriptive fields. A
// separate endpoint from the admin-only PUT (which also rewrites the teacher
// list); only the fields a teacher is trusted with are accepted here.
export async function setClassDetails(classId, fields, teacherCode) {
  return request(`/api/classes/${encodeURIComponent(classId)}/details`, {
    method: 'PATCH',
    body: fields,
    teacherCode,
  });
}

// A teacher editing their own name and/or access code. `currentCode` is the
// credential proof and is required by the server whenever `newCode` is set.
// The response carries the refreshed identity so the caller can swap its stored
// credential and stay signed in after a code change.
export async function updateOwnTeacher(
  { name, currentCode, newCode },
  teacherCode
) {
  const body = {};
  if (name != null) body.name = name;
  if (currentCode != null) body.currentCode = currentCode;
  if (newCode != null) body.newCode = newCode;
  return request('/api/teachers/me', { method: 'PATCH', body, teacherCode });
}

// Teacher (own) OR admin: rename the class code, subject to global uniqueness.
export async function setClassCode(classId, classCode, teacherCode) {
  return request(`/api/classes/${encodeURIComponent(classId)}/code`, {
    method: 'PATCH',
    body: { classCode },
    teacherCode,
  });
}
