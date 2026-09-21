import { describe, it, expect } from 'vitest';
import {
  shouldOfferInstall,
  isInstallRoute,
  classifyLowPower,
  shouldShowUpdatePrompt,
} from './pwa';

const base = {
  standalone: false,
  installedHint: false,
  nativePromptSupported: false,
  nativePromptReady: false,
};

describe('shouldOfferInstall', () => {
  it('offers install only when the browser supports it AND a prompt is ready', () => {
    expect(
      shouldOfferInstall({
        ...base,
        nativePromptSupported: true,
        nativePromptReady: true,
      })
    ).toBe(true);
  });

  // The requirement: no native install support → no button, ever. Safari and
  // Firefox do not implement beforeinstallprompt, so this is their path.
  it('does not offer install for a browser without native prompt support', () => {
    expect(
      shouldOfferInstall({ ...base, nativePromptSupported: false })
    ).toBe(false);
  });

  it('does not offer install when supported but no prompt is ready yet', () => {
    // Chrome withholds beforeinstallprompt until an engagement heuristic is
    // met; a button here would be dead on tap.
    expect(
      shouldOfferInstall({
        ...base,
        nativePromptSupported: true,
        nativePromptReady: false,
      })
    ).toBe(false);
  });

  it('does not offer install when already running as an installed app', () => {
    expect(
      shouldOfferInstall({
        ...base,
        standalone: true,
        nativePromptSupported: true,
        nativePromptReady: true,
      })
    ).toBe(false);
  });

  it('does not offer install when a previous install was recorded', () => {
    expect(
      shouldOfferInstall({
        ...base,
        installedHint: true,
        nativePromptSupported: true,
        nativePromptReady: true,
      })
    ).toBe(false);
  });

  it('prefers nothing over a stale ready flag if support is absent', () => {
    // Defensive: a ready prompt implies support, but if the two ever disagree
    // the button must stay hidden rather than render a control that cannot work.
    expect(
      shouldOfferInstall({
        ...base,
        nativePromptSupported: false,
        nativePromptReady: true,
      })
    ).toBe(false);
  });
});

describe('shouldShowUpdatePrompt', () => {
  it('shows while an update is waiting and not snoozed', () => {
    expect(
      shouldShowUpdatePrompt({ needRefresh: true, refreshSnoozed: false })
    ).toBe(true);
  });

  it('hides while snoozed, but the update is still remembered', () => {
    // The regression this guards: "Later" must hide the toast WITHOUT clearing
    // needRefresh. If it cleared needRefresh, a later update() check would find
    // a byte-identical worker, onNeedRefresh would never fire again, and the
    // update would be stranded until the tab was closed.
    expect(
      shouldShowUpdatePrompt({ needRefresh: true, refreshSnoozed: true })
    ).toBe(false);
    // The fact survives — only the presentation is suppressed.
    expect(
      shouldShowUpdatePrompt({ needRefresh: true, refreshSnoozed: false })
    ).toBe(true);
  });

  it('hides when nothing is waiting', () => {
    expect(
      shouldShowUpdatePrompt({ needRefresh: false, refreshSnoozed: false })
    ).toBe(false);
  });

  it('is false when the flags are missing', () => {
    expect(shouldShowUpdatePrompt({})).toBe(false);
  });
});

describe('classifyLowPower', () => {
  it('keeps full decoration on a capable device', () => {
    expect(classifyLowPower({ cores: 8, memory: 8 })).toBe(false);
  });

  it('drops decoration when the user asked to save data', () => {
    expect(classifyLowPower({ saveData: true, cores: 8, memory: 8 })).toBe(true);
  });

  it('drops decoration when the OS asked for reduced motion', () => {
    expect(classifyLowPower({ reducedMotion: true, cores: 8, memory: 8 })).toBe(true);
  });

  it('drops decoration on a low core count', () => {
    expect(classifyLowPower({ cores: 4, memory: 8 })).toBe(true);
    expect(classifyLowPower({ cores: 2, memory: 8 })).toBe(true);
  });

  it('drops decoration on low device memory', () => {
    expect(classifyLowPower({ cores: 8, memory: 4 })).toBe(true);
    expect(classifyLowPower({ cores: 8, memory: 2 })).toBe(true);
  });

  it('treats a browser that reports neither signal as low power', () => {
    // No hardwareConcurrency and no deviceMemory means the browser is old
    // enough to predate both — the exact devices this mode targets.
    expect(classifyLowPower({})).toBe(true);
    expect(classifyLowPower()).toBe(true);
    expect(classifyLowPower({ cores: 0, memory: 0 })).toBe(true);
  });

  it('accepts a single 5-4 boundary case correctly', () => {
    // 5 cores + 5 GB is still "capable"; the threshold is inclusive at 4.
    expect(classifyLowPower({ cores: 5, memory: 5 })).toBe(false);
    expect(classifyLowPower({ cores: 4, memory: 5 })).toBe(true);
    expect(classifyLowPower({ cores: 5, memory: 4 })).toBe(true);
  });
});

describe('isInstallRoute', () => {
  it('allows the entry surfaces', () => {
    expect(isInstallRoute('/')).toBe(true);
    expect(isInstallRoute('/teacher-onboarding')).toBe(true);
  });

  it('normalises a trailing slash and query/hash', () => {
    expect(isInstallRoute('/teacher-onboarding/')).toBe(true);
    expect(isInstallRoute('/teacher-onboarding?x=1')).toBe(true);
    expect(isInstallRoute('/teacher-onboarding#top')).toBe(true);
    expect(isInstallRoute('')).toBe(true); // empty is treated as "/"
    expect(isInstallRoute(undefined)).toBe(true); // defaults to "/"
  });

  it('refuses game routes and the panel', () => {
    // Game routes paint their own top-right chrome; a floating install button
    // there could sit on top of it.
    expect(isInstallRoute('/47182')).toBe(false);
    expect(isInstallRoute('/game-access')).toBe(false);
    expect(isInstallRoute('/p/ABC123')).toBe(false);
  });
});
