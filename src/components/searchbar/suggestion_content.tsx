import type { Suggestion } from '../../hooks/use_suggestions.js';
import { matchingTextSpans } from '../../lib/search_text.js';
import { KEYMOVE_SHADOW_ROOT_MODE } from '../../lib/dom_tree.js';

// Result text can come from cross-origin frames. A closed root keeps page script from
// reading it, but Chromium's window.find still matches text inside closed roots, not
// generated content, so builds with closed roots draw it from an attribute. Screen
// readers include generated content in each row's name. See SECURITY.md.
const GENERATED_TEXT = KEYMOVE_SHADOW_ROOT_MODE === 'closed';

const ResultText = ({ text }: { text: string }) =>
  GENERATED_TEXT ? <span className="keymove-generated-text" data-text={text} /> : <>{text}</>;

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
              <ResultText text={suggestion.label.slice(0, span.start)} />
              <mark className="keymove-suggestion-match">
                <ResultText text={suggestion.label.slice(span.start, span.end)} />
              </mark>
              <ResultText text={suggestion.label.slice(span.end)} />
            </>
          ) : (
            <ResultText text={suggestion.label} />
          )}
        </span>
        <span className="keymove-suggestion-context">
          <ResultText text={suggestion.context} />
        </span>
      </span>
    </>
  );
};

export default SuggestionContent;
