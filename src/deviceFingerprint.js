// deviceFingerprint.js
// Coarse, dependency-free device fingerprint — good enough to spot "this
// game lags on Android tablets" patterns, not meant to be precise.
//
// Takes the navigator object as an argument rather than reaching for the
// global directly, so it can be unit tested against real user-agent strings
// without a DOM. Callers pass nothing and get the browser's navigator.
export function detectDevice(
  nav = typeof navigator !== 'undefined' ? navigator : null
) {
  if (!nav) return null;

  const ua = nav.userAgent || '';

  let os = 'Unknown OS';
  // Modern iPadOS Safari reports itself as "Macintosh" — the touch-points
  // check is the standard way to tell it apart from an actual Mac.
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)) os = 'iPadOS';
  else if (/iPhone|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Macintosh/.test(ua)) os = 'macOS';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  let browser = 'Unknown browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/CriOS\//.test(ua)) browser = 'Chrome (iOS)';
  else if (/FxiOS\//.test(ua)) browser = 'Firefox (iOS)';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';

  let kind = 'desktop';
  if (os === 'iPadOS' || /Tablet/.test(ua) || (os === 'Android' && !/Mobile/.test(ua))) {
    kind = 'tablet';
  } else if (os === 'iOS' || /Mobile/.test(ua)) {
    kind = 'mobile';
  }

  // Truncated because this is written to the DB on every completed round.
  return { kind, os, browser, userAgent: ua.slice(0, 300) };
}
