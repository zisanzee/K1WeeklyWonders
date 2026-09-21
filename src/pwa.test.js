import { describe, it, expect } from 'vitest';
import { shouldOfferInstall, isInstallRoute } from './pwa';

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
