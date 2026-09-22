import { render, screen } from '@testing-library/react';
import App from './App';

test('renders ElectriCity application', () => {
  render(<App />);
  const brandElements = screen.getAllByText(/Electri/i);
  expect(brandElements.length).toBeGreaterThan(0);
});
