import { useRoutes } from 'react-router-dom';
import { routes } from '../routes';
import { useAppState } from '../context/AppStateContext';

export function App() {
  const { isLoading } = useAppState();
  const element = useRoutes(routes);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-bg text-text text-lg">
        Loading...
      </div>
    );
  }

  return element;
}
