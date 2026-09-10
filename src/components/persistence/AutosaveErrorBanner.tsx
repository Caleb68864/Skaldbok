/**
 * The persistent half of an autosave failure.
 *
 * @remarks
 * `useAutosave` shows one 8-second toast per failure *streak* — `erroredRef`
 * suppresses the rest deliberately, so a save that keeps failing on every
 * debounce tick does not spam the user. The consequence is that after those
 * eight seconds nothing on screen says anything is wrong, while the interface
 * goes on showing every edit as applied. This is local-first: an edit that was
 * not written is gone, and there is no server to reconcile against later.
 *
 * So the hook also returns `error`, and this is what renders it. Two screens
 * hand-rolled their own `<div>` for it and five discarded the value entirely;
 * one component means the message cannot be styled five ways, and cannot be
 * announced by four of them and not the fifth.
 *
 * `role="alert"` because it is an assertive interruption by definition: the
 * user is typing into fields whose contents are not being saved.
 *
 * `autosaveErrorReaders.test.ts` fails if a screen calls `useAutosave` without
 * rendering this.
 */
export function AutosaveErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="mb-[var(--space-sm)] rounded-[var(--radius-md)] border border-[var(--color-danger)] px-[var(--space-md)] py-[var(--space-sm)] text-[length:var(--font-size-sm)] text-[var(--color-danger)]"
    >
      {error}
    </div>
  );
}
