import React from 'react';
import type { SiteBehavior } from '../../lib/interaction_settings_schema.js';
import { parseSiteBehavior } from '../../lib/interaction_settings_schema.js';
const labels: Record<SiteBehavior, string> = {
  type: 'Type to search',
  shortcut: 'Shortcut only',
  paused: 'Paused',
};
export default function SiteSettings({
  hostname,
  sites,
  ready,
  alwaysOn,
  openingLabel,
  onChange,
}: {
  hostname: string | null;
  sites: Record<string, SiteBehavior>;
  ready: boolean;
  alwaysOn: boolean;
  openingLabel: string;
  onChange: (hostname: string, value: SiteBehavior | undefined) => void;
}) {
  const id = React.useId();
  const site = hostname && Object.hasOwn(sites, hostname) ? sites[hostname] : undefined;
  const effective = site ?? (alwaysOn ? 'type' : 'shortcut');
  const current = React.useRef<HTMLSelectElement>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const entries = Object.entries(sites).sort(([a], [b]) => a.localeCompare(b));
  return (
    <>
      <div className="keymove-current-site">
        <span>Current site</span>
        <strong>{hostname ?? 'Unavailable'}</strong>
      </div>
      {hostname ? (
        <>
          <label className="keymove-settings-field" htmlFor={id}>
            <span>Site behavior</span>
            <select
              ref={current}
              id={id}
              disabled={!ready}
              value={site ?? 'default'}
              aria-describedby={`${id}-hint`}
              onChange={event => onChange(hostname, parseSiteBehavior(event.target.value))}
            >
              <option value="default">Use default</option>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="keymove-popup-hint" id={`${id}-hint`} aria-live="polite">
            {!site && 'Using your default. '}
            {effective === 'paused'
              ? 'KeyMove is paused here. Resume from this menu.'
              : effective === 'type'
                ? 'Typing outside a field opens KeyMove.'
                : `Website shortcuts stay available. Open KeyMove with ${openingLabel}.`}
          </p>
        </>
      ) : (
        <p className="keymove-popup-hint">
          Open settings from an HTTP or HTTPS page to set its behavior.
        </p>
      )}
      <h2 ref={heading} tabIndex={-1} className="keymove-settings-heading">
        Saved site overrides ({entries.length})
      </h2>
      <p className="keymove-popup-hint">
        These take priority over General → Default activation. Remove an override to use the default
        again.
      </p>
      <ul className="keymove-site-overrides">
        {entries.map(([host, behavior]) => (
          <li key={host}>
            <span>
              {host}
              <span className="keymove-info-panel-setting-description">{labels[behavior]}</span>
            </span>
            <button
              type="button"
              className="keymove-settings-button"
              disabled={!ready}
              aria-label={`Remove override for ${host}`}
              onClick={event => {
                const next = event.currentTarget
                  .closest('li')
                  ?.nextElementSibling?.querySelector('button');
                if (next instanceof HTMLElement) next.focus();
                else (current.current ?? heading.current)?.focus();
                onChange(host, undefined);
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {!entries.length && (
        <p className="keymove-popup-hint">No site overrides. All sites use the default.</p>
      )}
    </>
  );
}
