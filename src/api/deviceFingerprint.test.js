import { describe, it, expect } from 'vitest';
import { detectDevice } from '@/api/deviceFingerprint';

const nav = (userAgent, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints });

// Real user-agent strings, because the whole value of this function is the
// ordering of its regex tests — a reordered check silently misclassifies a
// whole platform, which is exactly the kind of drift these assertions catch.
const UA = {
  ipadSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
  chromeos:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
};

describe('detectDevice', () => {
  it('returns null when there is no navigator', () => {
    expect(detectDevice(null)).toBeNull();
  });

  it('classifies desktop Windows + Edge', () => {
    const device = detectDevice(nav(UA.windowsEdge));

    expect(device.os).toBe('Windows');
    expect(device.browser).toBe('Edge');
    expect(device.kind).toBe('desktop');
  });

  it('classifies ChromeOS', () => {
    expect(detectDevice(nav(UA.chromeos)).os).toBe('ChromeOS');
  });

  it('classifies an Android phone as mobile', () => {
    const device = detectDevice(nav(UA.androidPhone));

    expect(device.os).toBe('Android');
    expect(device.kind).toBe('mobile');
  });

  it('classifies an Android tablet (no "Mobile" token) as tablet', () => {
    const device = detectDevice(nav(UA.androidTablet));

    expect(device.os).toBe('Android');
    expect(device.kind).toBe('tablet');
  });

  it('classifies an iPhone as iOS mobile', () => {
    const device = detectDevice(nav(UA.iphone));

    expect(device.os).toBe('iOS');
    expect(device.browser).toBe('Safari');
    expect(device.kind).toBe('mobile');
  });

  // iPadOS Safari reports itself as "Macintosh", so the ONLY thing separating
  // an iPad from a real Mac here is the touch-point count. If that check
  // regresses, every iPad in a classroom is recorded as a desktop Mac.
  it('tells an iPad apart from a Macintosh by touch points', () => {
    expect(detectDevice(nav(UA.ipadSafari, 5)).os).toBe('iPadOS');
    expect(detectDevice(nav(UA.ipadSafari, 5)).kind).toBe('tablet');

    const realMac = detectDevice(nav(UA.macSafari, 0));
    expect(realMac.os).toBe('macOS');
    expect(realMac.kind).toBe('desktop');
  });

  it('truncates the stored user-agent so a round cannot bloat the document', () => {
    const device = detectDevice(nav('x'.repeat(900)));

    expect(device.userAgent).toHaveLength(300);
  });

  it('always reports the four fields the PlaySession schema expects', () => {
    const device = detectDevice(nav(UA.windowsEdge));

    expect(Object.keys(device).sort()).toEqual(
      ['browser', 'kind', 'os', 'userAgent'].sort()
    );
  });

  it('falls back to Unknown for an unrecognised agent', () => {
    const device = detectDevice(nav('SomeBot/1.0'));

    expect(device.os).toBe('Unknown OS');
    expect(device.browser).toBe('Unknown browser');
    expect(device.kind).toBe('desktop');
  });
});
