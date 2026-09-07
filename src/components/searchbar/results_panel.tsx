import { KEYMOVE_SUGGESTIONS_ID } from '../../constants.js';
import type { Suggestion } from '../../hooks/use_suggestions.js';

type ResultsPanelProps = {
  suggestions: Suggestion[];
  selectedNode: Element | null;
  above: boolean;
  alignEnd: boolean;
};

/** Marks the matched slice inside a row so the reason a result is listed is visible. */
function labelParts(label: string, term: string | null) {
  if (!term) return [{ text: label, matched: false }];
  const index = label.toLocaleLowerCase().indexOf(term.toLocaleLowerCase());
  if (index === -1) return [{ text: label, matched: false }];
  return [
    { text: label.slice(0, index), matched: false },
    { text: label.slice(index, index + term.length), matched: true },
    { text: label.slice(index + term.length), matched: false },
  ].filter(part => part.text.length > 0);
}

const ResultsPanel = (props: ResultsPanelProps) => {
  const { suggestions, selectedNode, above, alignEnd } = props;

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      id={KEYMOVE_SUGGESTIONS_ID}
      className={`keymove-suggestions keymove-suggestions-${above ? 'above' : 'below'} keymove-suggestions-${alignEnd ? 'end' : 'start'}`}
      role="listbox"
    >
      {suggestions.map((suggestion, index) => {
        const selected = suggestion.node === selectedNode;
        return (
          <div
            key={index}
            id={`keymove-suggestion-${index}`}
            role="option"
            aria-selected={selected}
            className={`keymove-suggestion${selected ? ' keymove-suggestion-selected' : ''}`}
          >
            <span className={'keymove-suggestion-position'} aria-hidden="true">
              {index + 1}
            </span>
            <span
              className={`keymove-suggestion-kind keymove-suggestion-kind-${suggestion.kind}`}
              aria-hidden="true"
            >
              {suggestion.kind === 'action' ? 'Action' : 'Text'}
            </span>
            <span className={'keymove-suggestion-body'}>
              <span className={'keymove-suggestion-label'}>
                {labelParts(suggestion.label, suggestion.term).map((part, partIndex) =>
                  part.matched ? (
                    <mark key={partIndex} className={'keymove-suggestion-match'}>
                      {part.text}
                    </mark>
                  ) : (
                    <span key={partIndex}>{part.text}</span>
                  ),
                )}
              </span>
              <span className={'keymove-suggestion-context'}>{suggestion.context}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default ResultsPanel;
