import { useRoutes } from 'react-router-dom';
import { routes } from '../routes';
import { useAppState } from '../context/AppStateContext';

export function App() {
  const { isLoading } = useAppState();
  const element = useRoutes(routes);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text)',
        fontSize: 'var(--font-size-lg)',
      }}>
        Loading...
      </div>
    );
  }

  return element;
}
