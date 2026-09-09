import { useLocation, useRoutes } from 'react-router-dom';
import { routes } from '../routes';
import { useAppState } from '../context/AppStateContext';
import { UpdatePrompt } from '../pwa/UpdatePrompt';
import { ErrorBoundary } from './ErrorBoundary';
import { StorageUnavailable } from './StorageUnavailable';

export function App() {
  const { isLoading, storageError } = useAppState();
  const element = useRoutes(routes);
  const { pathname } = useLocation();

  if (storageError) {
    return <StorageUnavailable error={storageError} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-bg text-text text-lg">
        Loading...
      </div>
    );
  }

  return (
    <ErrorBoundary resetKey={pathname}>
      {element}
      <UpdatePrompt />
    </ErrorBoundary>
  );
}
