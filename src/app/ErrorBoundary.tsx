import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../components/primitives/Button';

export interface ErrorBoundaryProps {
  children: ReactNode;
}

export interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
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
            <Button variant="primary" onClick={() => this.setState({ error: null })}>Try Again</Button>
            <Button variant="secondary" onClick={() => window.location.assign('/library')}>Character Library</Button>
          </div>
        </div>
      </div>
    );
  }
}
