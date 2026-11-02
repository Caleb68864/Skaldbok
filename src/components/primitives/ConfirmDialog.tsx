import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

/** Themed replacements for `window.confirm` and `window.prompt`. */
export interface ConfirmApi {
  /** Resolves `true` if the user confirms, `false` for anything else. */
  confirm: (message: string) => Promise<boolean>;
  /** Resolves the entered text, or `null` if the user cancels. */
  promptText: (label: string) => Promise<string | null>;
}

type Request =
  | { kind: 'confirm'; message: string; settle: (value: boolean) => void }
  | { kind: 'prompt'; message: string; settle: (value: string | null) => void };

const ConfirmContext = createContext<ConfirmApi | null>(null);

/**
 * Hosts the one dialog `useConfirm` opens.
 *
 * @remarks
 * Roadmap H5. The native dialogs are unthemed, block the main thread and render as
 * bare sheets in an installed iOS PWA.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const [text, setText] = useState('');
  const current = useRef<Request | null>(null);

  const open = useCallback((next: Request | null) => {
    // A caller is awaiting the one being replaced; leaving it pending would hang it.
    const replaced = current.current;
    if (replaced?.kind === 'confirm') replaced.settle(false);
    if (replaced?.kind === 'prompt') replaced.settle(null);
    current.current = next;
    setText('');
    setRequest(next);
  }, []);

  const confirm = useCallback<ConfirmApi['confirm']>(
    message => new Promise(resolve => open({ kind: 'confirm', message, settle: resolve })),
    [open],
  );
  const promptText = useCallback<ConfirmApi['promptText']>(
    message => new Promise(resolve => open({ kind: 'prompt', message, settle: resolve })),
    [open],
  );
  const api = useMemo<ConfirmApi>(() => ({ confirm, promptText }), [confirm, promptText]);

  const cancel = useCallback(() => open(null), [open]);
  const accept = useCallback(() => {
    const active = current.current;
    current.current = null;
    if (active?.kind === 'confirm') active.settle(true);
    if (active?.kind === 'prompt') active.settle(text.trim() === '' ? null : text.trim());
    setRequest(null);
  }, [text]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Modal
        open={request !== null}
        onClose={cancel}
        title={request?.kind === 'prompt' ? request.message : 'Please confirm'}
        actions={
          <>
            <Button variant="secondary" onClick={cancel}>Cancel</Button>
            <Button variant="primary" onClick={accept}>{request?.kind === 'prompt' ? 'OK' : 'Confirm'}</Button>
          </>
        }
      >
        {request?.kind === 'prompt' ? (
          <input
            autoFocus
            aria-label={request.message}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') accept(); }}
            className="w-full min-h-11 px-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
          />
        ) : (
          <p className="text-[var(--color-text)]">{request?.message}</p>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

/** The confirm and prompt dialogs. Must be used inside {@link ConfirmProvider}. */
export function useConfirm(): ConfirmApi {
  const api = useContext(ConfirmContext);
  if (!api) throw new Error('useConfirm must be used within ConfirmProvider');
  return api;
}
