import { fireEvent, render, screen } from '@testing-library/react';
import { EXTENSION_NAME } from '../extension_identity.js';
import ExtensionErrorBoundary from './extension_error_boundary.js';

test('offers a retry when the search interface throws during render', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  let shouldThrow = true;

  const Child = () => {
    if (shouldThrow) {
      throw new Error('render failed');
    }
    return <div>Search restored</div>;
  };

  render(
    <ExtensionErrorBoundary>
      <Child />
    </ExtensionErrorBoundary>,
  );

  expect(screen.getByRole('alert')).toHaveTextContent('The page search interface stopped.');
  expect(consoleError).toHaveBeenCalledWith(
    `${EXTENSION_NAME} search interface failed: render failed`,
  );

  shouldThrow = false;
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(screen.getByText('Search restored')).toBeInTheDocument();

  consoleError.mockRestore();
});
