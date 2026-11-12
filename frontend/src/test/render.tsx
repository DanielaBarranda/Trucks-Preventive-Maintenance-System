import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../routes';

// Renders the whole app (all providers) at a given URL, with a fresh query cache
// state: router location state, e.g. { notice: 'Reading saved' }
export function renderApp(path = '/', state?: unknown) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[state === undefined ? path : { pathname: path, state }]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
