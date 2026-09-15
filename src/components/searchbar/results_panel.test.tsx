import { fireEvent, render, screen, within } from '@testing-library/react';
import ResultsPanel from './results_panel.js';
import type { Suggestion } from '../../hooks/use_suggestions.js';

function suggestion(label: string, overrides: Partial<Suggestion> = {}): Suggestion {
  const node = document.createElement('a');
  node.textContent = label;
  return { kind: 'action', node, term: null, label, context: 'link', ...overrides };
}

test('numbers each row and names what activating it would do', () => {
  const rows = [
    suggestion('Contributing guidelines', { term: 'contribu', context: 'link · in navigation' }),
    suggestion('We welcome contributions', { kind: 'text', context: 'paragraph' }),
  ];
  render(<ResultsPanel onSelect={vi.fn()} suggestions={rows} selectedNode={null} above={false} />);

  const options = screen.getAllByRole('option');
  expect(options).toHaveLength(2);
  expect(options[0]).toHaveTextContent('1');
  expect(options[0]).toHaveTextContent('Contributing guidelines');
  expect(options[0]).toHaveTextContent('link · in navigation');
  expect(options[1]).toHaveTextContent('2');
  expect(options[1]).toHaveTextContent('paragraph');
});

test('marks the part of the row that matched', () => {
  const row = suggestion('Contributing guidelines', { term: 'contribu' });
  render(<ResultsPanel onSelect={vi.fn()} suggestions={[row]} selectedNode={null} above={false} />);

  const marked = within(screen.getByRole('option')).getByText('Contribu');
  expect(marked.tagName).toBe('MARK');
});

test.each([
  ['İstanbul', 'stanbul', 'stanbul'],
  ['Cafe\u0301', 'café', 'Cafe\u0301'],
  ['БЪЛГАРИЯ', 'българия', 'БЪЛГАРИЯ'],
  ['ΕΛΛΑΔΑ', 'ελλαδα', 'ΕΛΛΑΔΑ'],
  ['日本語', '日本', '日本'],
  ['العربية', 'عرب', 'عرب'],
])('marks original Unicode text in %s', (label, term, expected) => {
  const { container } = render(
    <ResultsPanel
      onSelect={vi.fn()}
      suggestions={[suggestion(label, { term })]}
      selectedNode={null}
      above={false}
    />,
  );
  expect(container.querySelector('mark')?.textContent).toBe(expected);
});

test('selects the row the cursor is on, and none when it has moved past the slate', () => {
  const rows = [suggestion('First'), suggestion('Second')];
  const { rerender } = render(
    <ResultsPanel
      onSelect={vi.fn()}
      suggestions={rows}
      selectedNode={rows[1]!.node}
      above={false}
    />,
  );

  expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
  expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'false');

  rerender(
    <ResultsPanel
      onSelect={vi.fn()}
      suggestions={rows}
      selectedNode={document.createElement('p')}
      above={false}
    />,
  );

  expect(screen.queryByRole('option', { selected: true })).not.toBeInTheDocument();
});

test('renders nothing at all when there is no slate', () => {
  const { container } = render(
    <ResultsPanel onSelect={vi.fn()} suggestions={[]} selectedNode={null} above={false} />,
  );

  expect(container).toBeEmptyDOMElement();
});

test('keeps selection styling while busy but prevents selecting outdated rows', () => {
  const row = suggestion('Contributing guidelines');
  const onSelect = vi.fn();
  const props = { suggestions: [row], selectedNode: row.node, above: false, onSelect };
  const { rerender } = render(<ResultsPanel {...props} />);
  const panel = screen.getByRole('listbox');
  const option = screen.getByRole('option');
  rerender(<ResultsPanel {...props} selectedNode={null} pending />);
  expect(screen.getByRole('listbox')).toBe(panel);
  expect(option).toHaveClass('keymove-suggestion-selected');
  expect(option).toHaveAttribute('aria-selected', 'false');
  expect(option).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(option);
  expect(onSelect).not.toHaveBeenCalled();
  rerender(<ResultsPanel {...props} />);
  fireEvent.click(option);
  expect(onSelect).toHaveBeenCalledWith(0);
});

test('flips above the bar when asked, so it does not run off the bottom', () => {
  const { container, rerender } = render(
    <ResultsPanel onSelect={vi.fn()} suggestions={[suggestion('One')]} selectedNode={null} above />,
  );
  expect(container.querySelector('.keymove-suggestions')).toHaveClass('keymove-suggestions-above');

  rerender(
    <ResultsPanel
      onSelect={vi.fn()}
      suggestions={[suggestion('One')]}
      selectedNode={null}
      above={false}
    />,
  );
  expect(container.querySelector('.keymove-suggestions')).toHaveClass('keymove-suggestions-below');
});

test('says how far off an approximate result is, and where it sits', () => {
  const row = suggestion('Contributing guidelines', {
    term: 'contribu',
    context: 'link · 1 edit away · in Navigation',
  });
  render(<ResultsPanel onSelect={vi.fn()} suggestions={[row]} selectedNode={null} above={false} />);

  expect(screen.getByRole('option')).toHaveTextContent('link · 1 edit away · in Navigation');
});
