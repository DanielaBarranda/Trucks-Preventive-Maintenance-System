import { screen } from '@testing-library/react';
import { renderApp } from './test/render';

it('renders the brand on the landing page', async () => {
  renderApp('/');
  expect(await screen.findAllByText(/FleetPMTS/)).not.toHaveLength(0);
});
