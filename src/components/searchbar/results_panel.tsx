import React from 'react';
import { KEYMOVE_SUGGESTIONS_ID } from '../../constants.js';
import type { Suggestion } from '../../hooks/use_suggestions.js';
import SuggestionContent from './suggestion_content.js';

type ResultsPanelProps = {
  suggestions: Suggestion[];
  selectedNode: Element | null;
  above: boolean;
  pending?: boolean;
  open?: boolean;
  onHeightChange?: (height: number) => void;
  maxHeight?: number;
  onSelect: (position: number) => void;
};

const ResultsPanel = (props: ResultsPanelProps) => {
  const {
    suggestions,
    selectedNode,
    above,
    pending = false,
    open = suggestions.length > 0,
    onHeightChange,
    onSelect,
    maxHeight,
  } = props;
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [minimumHeight, setMinimumHeight] = React.useState(0);
  // Hold the largest height in this query session. Fewer rows or shorter labels must not
  // collapse the surface; clearing/shortening the query releases the reserved space.
  React.useLayoutEffect(() => {
    if (!open) {
      setMinimumHeight(0);
      onHeightChange?.(0);
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => {
      const height = Math.ceil(panel.getBoundingClientRect().height);
      if (height > minimumHeight) {
        setMinimumHeight(height);
        onHeightChange?.(height);
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [open, suggestions, minimumHeight, onHeightChange]);
  const displayedSelection = React.useRef(selectedNode);
  React.useLayoutEffect(() => {
    if (!pending) displayedSelection.current = selectedNode;
  }, [pending, selectedNode]);
  // Preserve the row's appearance while the live navigation cursor is cleared for a query.
  const visibleSelection = pending ? displayedSelection.current : selectedNode;
  React.useLayoutEffect(() => {
    if (!open || pending) return;
    const panel = panelRef.current;
    const row = panel?.querySelector('[aria-selected="true"]');
    if (!panel || !row) return;
    const panelBounds = panel.getBoundingClientRect();
    const rowBounds = row.getBoundingClientRect();
    if (rowBounds.top < panelBounds.top) panel.scrollTop += rowBounds.top - panelBounds.top;
    else if (rowBounds.bottom > panelBounds.bottom)
      panel.scrollTop += rowBounds.bottom - panelBounds.bottom;
  }, [open, pending, selectedNode, suggestions]);

  if (!open) {
    return null;
  }

  return (
    <div
      id={KEYMOVE_SUGGESTIONS_ID}
      ref={panelRef}
      style={{ minHeight: Math.min(minimumHeight, maxHeight ?? Infinity), maxHeight }}
      className={`keymove-suggestions keymove-suggestions-${above ? 'above' : 'below'}`}
      role="listbox"
      aria-busy={pending}
    >
      {suggestions.length === 0 && (
        <div className="keymove-suggestions-empty">{pending ? 'Searching…' : 'No matches'}</div>
      )}
      {suggestions.map((suggestion, index) => {
        const selected = suggestion.node === visibleSelection;
        return (
          <div
            key={index}
            id={`keymove-suggestion-${index}`}
            role="option"
            aria-selected={!pending && selected}
            aria-disabled={pending}
            onMouseDown={event => {
              // Keep the search input focused and prevent the parent from dragging the bar.
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={event => {
              event.stopPropagation();
              if (!pending) onSelect(index);
            }}
            className={`keymove-suggestion${selected ? ' keymove-suggestion-selected' : ''}`}
          >
            <span className={'keymove-suggestion-position'} aria-hidden="true">
              {index + 1}
            </span>
            <SuggestionContent suggestion={suggestion} />
          </div>
        );
      })}
    </div>
  );
};

export default ResultsPanel;
