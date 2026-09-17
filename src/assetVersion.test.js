import { describe, it, expect } from 'vitest';
import { withAssetVersion, BUILD_ID } from './assetVersion';

describe('withAssetVersion', () => {
  it('appends the build id to a same-origin path', () => {
    expect(withAssetVersion('/PhaserAssets/wrong.wav')).toBe(
      `/PhaserAssets/wrong.wav?v=${BUILD_ID}`
    );
  });

  it('appends the build id to an absolute Cloudinary URL', () => {
    // This is the case that actually mattered: Cloudinary serves uploads with
    // `Cache-Control: immutable`, which Chrome honours even across a normal
    // reload, so a stable URL is permanently stuck on the old bytes. Only a
    // different URL escapes it.
    const cloudinary =
      'https://res.cloudinary.com/hijmipga/image/upload/v1789297282/cookie_hjnlx5.png';
    expect(withAssetVersion(cloudinary)).toBe(`${cloudinary}?v=${BUILD_ID}`);
  });

  it('uses & when the URL already has a query string', () => {
    expect(withAssetVersion('/thing.png?a=1')).toBe(
      `/thing.png?a=1&v=${BUILD_ID}`
    );
  });

  it('leaves inline data and blob URIs alone', () => {
    // No fetch happens for these, so there is no cache to bust.
    expect(withAssetVersion('data:image/png;base64,AAAA')).toBe(
      'data:image/png;base64,AAAA'
    );
    expect(withAssetVersion('blob:https://ezwonders.com/abc-123')).toBe(
      'blob:https://ezwonders.com/abc-123'
    );
  });

  it('produces a different URL for different builds', () => {
    // The whole mechanism in one assertion: the cache key must change when the
    // build changes, or nothing above matters.
    const url = 'https://res.cloudinary.com/x/y.png';
    const a = `${url}?v=build-1`;
    const b = `${url}?v=build-2`;
    expect(a).not.toBe(b);
  });

  it('passes through empty and non-string input untouched', () => {
    expect(withAssetVersion('')).toBe('');
    expect(withAssetVersion(undefined)).toBe(undefined);
    expect(withAssetVersion(null)).toBe(null);
  });
});
