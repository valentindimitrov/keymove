import React from 'react';
import { MAX_SUGGESTION_COUNT } from '../../constants.js';

type Props = { value: number; onChange: (value: number) => void };

const SuggestionCountSetting = ({ value, onChange }: Props) => {
  const id = React.useId();
  const [draft, setDraft] = React.useState(String(value));
  React.useEffect(() => setDraft(String(value)), [value]);
  return (
    <div className="keymove-info-panel-row keymove-info-panel-setting-row keymove-suggestion-count-setting">
      <input
        id={id}
        type="number"
        min="1"
        max={MAX_SUGGESTION_COUNT}
        step="1"
        aria-describedby={`${id}-description`}
        value={draft}
        onChange={event => {
          setDraft(event.target.value);
          const number = event.target.valueAsNumber;
          if (Number.isSafeInteger(number) && number > 0 && number <= MAX_SUGGESTION_COUNT) {
            onChange(number);
          }
        }}
        onBlur={() => setDraft(String(value))}
      />
      <div className="keymove-info-panel-setting-text">
        <label className="keymove-info-panel-setting-header" htmlFor={id}>
          Number of suggestions
        </label>
        <div id={`${id}-description`} className="keymove-info-panel-setting-description">
          Show 1–5 results. Alt+1 through Alt+5 select the numbered suggestion.
        </div>
      </div>
    </div>
  );
};

export default SuggestionCountSetting;
