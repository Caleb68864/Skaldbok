// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadBlob, shareFile } from './delivery';

/**
 * What "the export succeeded" is allowed to mean.
 *
 * @remarks
 * `useExportActions.ts:444` writes `lastBackupAt` — the value
 * `StorageSafetyCard` turns green on, and the only thing in the app that may
 * claim a campaign is backed up — immediately after `await deliverBundle(...)`
 * resolves. Its comment says "only after delivery succeeded".
 *
 * `deliverBundle` could not fail. `downloadBlob` created an object URL, made an
 * anchor it never attached to the document, called `.click()`, revoked the URL
 * on the next synchronous line and returned `void`. Awaiting it meant "we
 * called `.click()`" and nothing more: a synchronous DOM call with no failure
 * mode, certifying a file that on any browser slower to pick up the transfer
 * than Chromium was never written.
 *
 * And a cancelled Web Share force-downloaded anyway, so dismissing the share
 * sheet still put a file on disk and still turned the safety card green.
 *
 * These tests pin the three properties that make delivery reportable: the URL
 * outlives the click, the anchor is in the document when it is clicked, and a
 * cancellation is a cancellation.
 */

const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;

/** Records the anchors clicked and whether each was in the document at the time. */
function captureClicks(): { attachedAtClick: boolean[]; restore: () => void } {
  const attachedAtClick: boolean[] = [];
  const listener = (event: Event) => {
    const target = event.target as HTMLElement;
    attachedAtClick.push(document.body.contains(target));
    // Deliberately does NOT call `preventDefault` — that is what a *refused*
    // download looks like, and it has its own test below.
    event.stopImmediatePropagation();
  };
  document.body.addEventListener('click', listener, true);
  return {
    attachedAtClick,
    restore: () => document.body.removeEventListener('click', listener, true),
  };
}

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    document.body.innerHTML = '';
  });

  it('does not revoke the object URL before the browser can read it', () => {
    const clicks = captureClicks();
    try {
      downloadBlob(new Blob(['{}'], { type: 'application/json' }), 'backup.json');
    } finally {
      clicks.restore();
    }

    expect(
      URL.revokeObjectURL,
      'the transfer starts asynchronously after the click, so revoking on the next '
      + 'synchronous line is a race the export loses on any browser slower than '
      + 'Chromium — and losing it is silent.',
    ).not.toHaveBeenCalled();

    // It is still released, just later.
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('clicks an anchor that is actually in the document', () => {
    const clicks = captureClicks();
    try {
      downloadBlob(new Blob(['{}'], { type: 'application/json' }), 'backup.json');
    } finally {
      clicks.restore();
    }
    expect(clicks.attachedAtClick).toEqual([true]);
    // And it does not stay there.
    expect(document.body.querySelector('a')).toBeNull();
  });

  it('throws when the browser refuses the download', () => {
    // A cancelled click event is the one refusal a page can observe. Before
    // this, the return value was discarded and the caller was told it worked.
    const listener = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    document.body.addEventListener('click', listener, true);
    try {
      expect(() => downloadBlob(new Blob(['{}']), 'backup.json')).toThrow(/backup\.json/);
    } finally {
      document.body.removeEventListener('click', listener, true);
    }
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('throws rather than resolving when object URLs are unavailable', () => {
    URL.createObjectURL = vi.fn(() => {
      throw new Error('nope');
    });
    expect(() => downloadBlob(new Blob(['{}']), 'backup.json')).toThrow();
  });
});

describe('shareFile', () => {
  const originalNavigator = { canShare: navigator.canShare, share: navigator.share };

  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    Object.assign(navigator, originalNavigator);
    document.body.innerHTML = '';
  });

  it('reports a cancelled share as cancelled instead of writing a file anyway', async () => {
    Object.assign(navigator, {
      canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException('share cancelled', 'AbortError')),
    });
    const clicks = captureClicks();
    let outcome;
    try {
      outcome = await shareFile(new Blob(['{}']), 'backup.json');
    } finally {
      clicks.restore();
    }

    expect(
      outcome,
      'dismissing the share sheet used to fall through to a forced download, so a '
      + 'user who cancelled still got a file and the safety card still went green.',
    ).toBe('cancelled');
    expect(clicks.attachedAtClick).toEqual([]);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('still falls back to a download when the share fails for any other reason', async () => {
    Object.assign(navigator, {
      canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException('needs a gesture', 'NotAllowedError')),
    });
    const clicks = captureClicks();
    let outcome;
    try {
      outcome = await shareFile(new Blob(['{}']), 'backup.json');
    } finally {
      clicks.restore();
    }
    expect(outcome).toBe('downloaded');
    expect(clicks.attachedAtClick).toEqual([true]);
  });

  it('reports a completed share', async () => {
    Object.assign(navigator, { canShare: () => true, share: vi.fn().mockResolvedValue(undefined) });
    await expect(shareFile(new Blob(['{}']), 'backup.json')).resolves.toBe('shared');
  });
});
