import { describe, it, expect } from 'vitest';
import { importablePortraitUri } from './portraitUri';

/**
 * A character record carries its portrait inline, and an imported record is
 * untrusted input rendered straight into an `<img src>`.
 */
describe('importablePortraitUri', () => {
  it('keeps an inline raster image', () => {
    for (const type of ['jpeg', 'png', 'webp', 'gif']) {
      const uri = `data:image/${type};base64,AAAA`;
      expect(importablePortraitUri(uri), type).toBe(uri);
    }
  });

  it('drops a remote URL', () => {
    // A tracking pixel in an app that otherwise makes no network requests:
    // it would fire every time the sheet opened, disclosing IP and timing.
    expect(importablePortraitUri('https://tracker.example/pixel.png')).toBeUndefined();
    expect(importablePortraitUri('//tracker.example/pixel.png')).toBeUndefined();
    expect(importablePortraitUri('http://tracker.example/p.gif')).toBeUndefined();
  });

  it('drops an SVG data URL', () => {
    // An SVG is a document that carries its own script and external
    // references. The picker only ever produces JPEG, so nothing is lost.
    expect(importablePortraitUri('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBeUndefined();
  });

  it('drops a non-image data URL', () => {
    expect(importablePortraitUri('data:text/html;base64,PGgxPmhpPC9oMT4=')).toBeUndefined();
    expect(importablePortraitUri('data:application/javascript;base64,YWxlcnQoMSk=')).toBeUndefined();
  });

  it('drops a javascript: URL', () => {
    expect(importablePortraitUri('javascript:alert(1)')).toBeUndefined();
  });

  it('drops a data URL whose payload is not base64 characters', () => {
    expect(importablePortraitUri('data:image/png;base64,<script>')).toBeUndefined();
  });

  it('drops an oversized payload', () => {
    // The portrait is rewritten on every autosave and copied into every export.
    expect(importablePortraitUri(`data:image/png;base64,${'A'.repeat(9 * 1024 * 1024)}`)).toBeUndefined();
  });

  it('drops a non-string', () => {
    for (const value of [undefined, null, 42, {}, []]) {
      expect(importablePortraitUri(value)).toBeUndefined();
    }
  });
});
