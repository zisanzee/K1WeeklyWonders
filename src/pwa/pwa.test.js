import { describe, it, expect } from 'vitest';
import {
  shouldOfferInstall,
  isInstallRoute,
  classifyLowPower,
  shouldShowUpdatePrompt,
  manualInstallInstructions,
  isIosPlatform,
  computeInstallSupported,
  resolveInstallTarget,
  installGuideFor,
} from '@/pwa/pwa';

const base = {
  standalone: false,
  installedHint: false,
  installSupported: false,
};

describe('shouldOfferInstall', () => {
  it('offers install when install is supported', () => {
    expect(shouldOfferInstall({ ...base, installSupported: true })).toBe(true);
  });

  it('does not offer install when nothing can install here', () => {
    expect(shouldOfferInstall({ ...base, installSupported: false })).toBe(
      false
    );
  });

  it('does not offer install when already running as an installed app', () => {
    expect(
      shouldOfferInstall({ ...base, standalone: true, installSupported: true })
    ).toBe(false);
  });

  it('does not offer install when a previous install was recorded', () => {
    expect(
      shouldOfferInstall({
        ...base,
        installedHint: true,
        installSupported: true,
      })
    ).toBe(false);
  });
});

describe('isIosPlatform', () => {
  it('detects the explicit iOS/iPadOS platforms', () => {
    expect(isIosPlatform({ platform: 'iPhone' })).toBe(true);
    expect(isIosPlatform({ platform: 'iPad' })).toBe(true);
    expect(isIosPlatform({ platform: 'iPod' })).toBe(true);
  });

  it('detects iOS from the user agent when platform is masked', () => {
    expect(
      isIosPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' })
    ).toBe(true);
  });

  // iPadOS 13+ reports platform "MacIntel" — the touch-point count is the only
  // reliable tell, because a real Mac has none.
  it('treats an iPadOS "MacIntel" with touch points as iOS', () => {
    expect(isIosPlatform({ platform: 'MacIntel', maxTouchPoints: 5 })).toBe(
      true
    );
    expect(isIosPlatform({ platform: 'MacIntel', maxTouchPoints: 0 })).toBe(
      false
    );
  });

  it('is false for non-Apple platforms', () => {
    expect(isIosPlatform({ platform: 'Win32', userAgent: 'Windows NT' })).toBe(
      false
    );
  });
});

describe('computeInstallSupported', () => {
  it('is true for iOS even without a native prompt', () => {
    expect(
      computeInstallSupported({ ios: true, nativePromptSupported: false })
    ).toBe(true);
  });

  it('is true for a Chromium prompt', () => {
    expect(
      computeInstallSupported({ ios: false, nativePromptSupported: true })
    ).toBe(true);
  });

  it('is false when neither route exists', () => {
    expect(computeInstallSupported({})).toBe(false);
  });
});

describe('resolveInstallTarget', () => {
  it('prefers the native prompt whenever it is ready', () => {
    expect(
      resolveInstallTarget({ nativePromptReady: true, platform: 'ios' })
    ).toBe('native');
  });

  it('routes iOS to the Share-sheet guide', () => {
    expect(resolveInstallTarget({ platform: 'ios' })).toBe('ios');
  });

  it('routes Firefox to its own menu guide', () => {
    expect(resolveInstallTarget({ platform: 'firefox' })).toBe('firefox');
  });

  it('falls back to the Chromium menu guide', () => {
    expect(resolveInstallTarget({ platform: 'chromium' })).toBe('chromium');
    expect(resolveInstallTarget({})).toBe('chromium');
  });
});

describe('install guides', () => {
  it('manualInstallInstructions returns the Chromium steps', () => {
    const steps = manualInstallInstructions();
    expect(Array.isArray(steps)).toBe(true);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.join(' ')).toMatch(/Edge/);
    expect(steps.join(' ')).toMatch(/Chrome/);
  });

  it('gives iOS-specific steps mentioning the Share sheet', () => {
    const guide = installGuideFor('ios');
    expect(guide.steps.join(' ')).toMatch(/Share/);
    expect(guide.steps.join(' ')).toMatch(/Add to Home Screen/);
  });

  it('gives Firefox its own menu steps', () => {
    const guide = installGuideFor('firefox');
    expect(guide.steps.join(' ')).toMatch(/Firefox/);
  });

  it('always resolves to a usable guide even for an unknown target', () => {
    const guide = installGuideFor('nonsense');
    expect(guide.title).toBeTruthy();
    expect(guide.steps.length).toBeGreaterThanOrEqual(2);
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
