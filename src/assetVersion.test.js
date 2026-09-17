import { describe, it, expect } from 'vitest';
import { withAssetVersion, BUILD_ID } from './assetVersion';

describe('withAssetVersion', () => {
  it('appends the build id to a same-origin path', () => {
    // The whole point: the URL changes per deploy so a CacheFirst entry or an
    // HTTP cache can never serve the previous build's file.
    expect(withAssetVersion('/PhaserAssets/wrong.wav')).toBe(
      `/PhaserAssets/wrong.wav?v=${BUILD_ID}`
    );
  });

  it('uses & when the path already has a query string', () => {
    expect(withAssetVersion('/thing.png?a=1')).toBe(
      `/thing.png?a=1&v=${BUILD_ID}`
    );
  });

  it('leaves absolute URLs alone', () => {
    // Cloudinary already versions its own media in the path — adding a query
    // string there would only create duplicate cache entries for one file.
    const cloudinary =
      'https://res.cloudinary.com/hijmipga/image/upload/v1789297282/cookie_hjnlx5.png';
    expect(withAssetVersion(cloudinary)).toBe(cloudinary);
  });

  it('leaves protocol-relative and data URIs alone', () => {
    expect(withAssetVersion('//cdn.example.com/a.png')).toBe(
      '//cdn.example.com/a.png'
    );
    expect(withAssetVersion('data:image/png;base64,AAAA')).toBe(
      'data:image/png;base64,AAAA'
    );
  });

  it('passes through empty and non-string input untouched', () => {
    expect(withAssetVersion('')).toBe('');
    expect(withAssetVersion(undefined)).toBe(undefined);
    expect(withAssetVersion(null)).toBe(null);
  });
});
