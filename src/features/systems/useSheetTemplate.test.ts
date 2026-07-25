import { describe, it, expect } from 'vitest';
import { resolveSheetTemplate } from './useSheetTemplate';

const validV1 = {
  version: 1,
  sheet: { layout: 'default', regions: [['SomeCard']] },
};

const validV2 = {
  version: 2,
  sheet: { layout: 'default', regions: [['SomeCard'], ['OtherCard']] },
};

describe('resolveSheetTemplate', () => {
  it('serves the cached template when there is no bundled template', () => {
    const result = resolveSheetTemplate(undefined, validV1);
    expect(result.template).toEqual(validV1);
    expect(result.error).toBeNull();
    expect(result.cacheWrite).toBeNull();
  });

  it('serves the bundled template and caches it when there is no cached copy', () => {
    const result = resolveSheetTemplate(validV1, undefined);
    expect(result.template).toEqual(validV1);
    expect(result.error).toBeNull();
    expect(result.cacheWrite).toEqual(validV1);
  });

  it('refreshes the cache when the bundled version is newer', () => {
    const result = resolveSheetTemplate(validV2, validV1);
    expect(result.template).toEqual(validV2);
    expect(result.cacheWrite).toEqual(validV2);
  });

  it('keeps the cached copy when the bundled version is not newer', () => {
    const result = resolveSheetTemplate(validV1, validV2);
    expect(result.template).toEqual(validV2);
    expect(result.cacheWrite).toBeNull();
  });

  it('keeps the cache and writes nothing when versions are equal (no IndexedDB thrash)', () => {
    // Same version, different content: the tie must keep the cached copy and NOT
    // rewrite it, so a load doesn't churn IndexedDB every time.
    const bundledSameVersion = { version: 1, sheet: { layout: 'default', regions: [['DifferentCard']] } };
    const result = resolveSheetTemplate(bundledSameVersion, validV1);
    expect(result.template).toEqual(validV1);
    expect(result.cacheWrite).toBeNull();
  });

  it('surfaces an error and returns a null template for an invalid bundled template', () => {
    const result = resolveSheetTemplate({ version: 'not-a-number' }, undefined);
    expect(result.template).toBeNull();
    expect(result.error).toContain('Invalid bundled sheet template');
    expect(result.cacheWrite).toBeNull();
  });

  it('surfaces an error for an invalid cached template when there is no bundled template', () => {
    const result = resolveSheetTemplate(undefined, { version: 'not-a-number' });
    expect(result.template).toBeNull();
    expect(result.error).toContain('Invalid cached sheet template');
    expect(result.cacheWrite).toBeNull();
  });

  it('falls back to a valid bundled template when the cached template is invalid', () => {
    const result = resolveSheetTemplate(validV1, { version: 'not-a-number' });
    expect(result.template).toEqual(validV1);
    expect(result.error).toBeNull();
    expect(result.cacheWrite).toEqual(validV1);
  });

  it('returns a null template with no error when neither bundled nor cached exist', () => {
    const result = resolveSheetTemplate(undefined, undefined);
    expect(result.template).toBeNull();
    expect(result.error).toBeNull();
    expect(result.cacheWrite).toBeNull();
  });
});
