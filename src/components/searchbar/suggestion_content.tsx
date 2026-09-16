import type { Suggestion } from '../../hooks/use_suggestions.js';
import { matchingTextSpans } from '../../lib/search_text.js';

/** Keep the selected menu result and the shortlist's labels visually identical. */
const SuggestionContent = ({ suggestion }: { suggestion: Suggestion }) => {
  const span = suggestion.term ? matchingTextSpans(suggestion.label, suggestion.term, 1)[0] : null;
  return (
    <>
      <span
        className={`keymove-suggestion-kind keymove-suggestion-kind-${suggestion.kind}`}
        aria-hidden="true"
      >
        {suggestion.kind === 'action' ? 'Action' : 'Text'}
      </span>
      <span className="keymove-suggestion-body">
        <span className="keymove-suggestion-label">
          {span ? (
            <>
              {suggestion.label.slice(0, span.start)}
              <mark className="keymove-suggestion-match">
                {suggestion.label.slice(span.start, span.end)}
              </mark>
              {suggestion.label.slice(span.end)}
            </>
          ) : (
            suggestion.label
          )}
        </span>
        <span className="keymove-suggestion-context">{suggestion.context}</span>
      </span>
    </>
  );
};

export default SuggestionContent;
