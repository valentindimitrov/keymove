import React from 'react';
export type SettingsTab = 'General' | 'Appearance' | 'Shortcuts' | 'Sites';
const tabs: SettingsTab[] = ['General', 'Appearance', 'Shortcuts', 'Sites'];
export default function SettingsTabs({
  children,
}: {
  children: (tab: SettingsTab) => React.ReactNode;
}) {
  const [tab, setTab] = React.useState<SettingsTab>('General');
  const id = React.useId();
  const buttons = React.useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <>
      <div className="keymove-settings-tabs" role="tablist" aria-label="Settings categories">
        {tabs.map((name, index) => (
          <button
            key={name}
            ref={node => {
              buttons.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`${id}-${name}`}
            aria-controls={`${id}-panel`}
            aria-selected={tab === name}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => setTab(name)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? tabs.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
              setTab(tabs[next]!);
              buttons.current[next]?.focus();
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${tab}`}
        className="keymove-settings-panel"
      >
        {children(tab)}
      </div>
    </>
  );
}
