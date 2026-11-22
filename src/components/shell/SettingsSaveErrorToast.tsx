import { useEffect, useRef } from 'react';
import { useAppState } from '../../context/AppStateContext';
import { useToast } from '../../context/ToastContext';

/**
 * Shows a failed settings write as an error toast.
 *
 * @remarks
 * `useAppSettings` recorded the failure as `settingsError` and nothing read it,
 * so a write that did not land (storage full, a closed connection) was silent.
 * The settings provider sits outside the toast provider, so the notice lives
 * here, inside the shell, rather than in the hook. It keys on the failure
 * count rather than the message, because a repeat failure says the same thing.
 * Renders nothing.
 */
export function SettingsSaveErrorToast() {
  const { settingsError, settingsErrorCount } = useAppState();
  const { showToast } = useToast();
  const message = useRef(settingsError);
  message.current = settingsError;
  useEffect(() => {
    if (settingsErrorCount > 0 && message.current) showToast(message.current, 'error');
  }, [settingsErrorCount, showToast]);
  return null;
}
