import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../components/primitives/Button';
import { flushAll } from '../features/persistence/autosaveFlush';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * When this changes the boundary clears its error. The app passes the
   * current pathname, so a screen that crashed does not keep the whole app
   * on the fallback after the user navigates elsewhere.
   */
  resetKey?: unknown;
}

export interface ErrorBoundaryState {
  error: Error | null;
  /** True while the recovery button is waiting for pending writes to land. */
  leaving: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, leaving: false };

  /**
   * Leaves for the Character Library, but not before the data is on disk.
   *
   * @remarks
   * This is a full page navigation, so nothing unmounts and no React cleanup
   * runs — whatever has not been written is gone. Two things were being lost.
   *
   * React unmounts the subtree that threw, which *does* fire `useAutosave`'s
   * unmount flush; but that write is fire-and-forget, and a navigation started
   * while it is in flight takes it with it. `flushAll` now waits for those
   * tracked writes as well as for anything still registered — a note editor or
   * encounter view outside the crashed subtree, which nothing flushed at all
   * on this path before.
   *
   * The edit at risk here is very often the one that caused the crash, which
   * makes losing it the worst possible outcome of a recovery button.
   * `flushAll` uses `allSettled`, so a failed write still lets the user leave
   * rather than stranding them on the error screen.
   */
  private leaveForLibrary = async () => {
    if (this.state.leaving) return;
    this.setState({ leaving: true });
    try {
      await flushAll();
    } finally {
      window.location.assign('/library');
    }
  };

  static getDerivedStateFromError(error: Error): Pick<ErrorBoundaryState, 'error'> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, leaving: false });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-dvh bg-bg text-text flex items-center justify-center p-[var(--space-md)]">
        <div className="max-w-xl border border-border rounded-[var(--radius-md)] bg-surface p-[var(--space-md)]">
          <h1 className="text-[length:var(--font-size-xl)] font-bold mb-2">Something went wrong</h1>
          <p className="text-[var(--color-text-muted)] mb-[var(--space-md)]">
            The app caught an unexpected error before it could break the whole screen.
          </p>
          <pre className="max-h-40 overflow-auto rounded-[var(--radius-sm)] bg-surface-alt p-[var(--space-sm)] text-xs text-danger">
            {this.state.error.message}
          </pre>
          <div className="mt-[var(--space-md)] flex gap-3">
            <Button
              variant="primary"
              disabled={this.state.leaving}
              onClick={() => this.setState({ error: null, leaving: false })}
            >
              Try Again
            </Button>
            <Button
              variant="secondary"
              disabled={this.state.leaving}
              onClick={() => { void this.leaveForLibrary(); }}
            >
              Character Library
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
