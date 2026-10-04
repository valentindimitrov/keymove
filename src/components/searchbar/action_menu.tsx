import React from 'react';
import type { ResultAction } from '../../lib/result_actions.js';
import type { Suggestion } from '../../hooks/use_suggestions.js';
import SuggestionContent from './suggestion_content.js';
import Utils from '../../lib/utils.js';
import ShortcutBadge from './shortcut_badge.js';

type ActionMenuProps = {
  actions: ResultAction[];
  tooltipsMode?: boolean;
  suggestion: Suggestion;
  above: boolean;
  maxHeight: number;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onEscape?: (() => void) | undefined;
  onNavigate: (event: KeyboardEvent, forward: boolean) => void;
  onAction: (id: string) => Promise<void> | void;
};

const ActionMenu = ({
  actions,
  tooltipsMode = true,
  suggestion,
  above,
  maxHeight,
  searchInputRef,
  onClose,
  onEscape,
  onNavigate,
  onAction,
}: ActionMenuProps) => {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [selected, setSelected] = React.useState(0);
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const running = React.useRef(false);
  const mounted = React.useRef(false);

  React.useLayoutEffect(() => {
    mounted.current = true;
    const menu = menuRef.current;
    const searchInput = searchInputRef.current;
    menu?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    return () => {
      mounted.current = false;
      const tree = menu?.getRootNode();
      const active = tree instanceof ShadowRoot ? tree.activeElement : document.activeElement;
      // Never steal focus after a deliberate handoff or an outside click.
      if (active && menu?.contains(active)) searchInput?.focus({ preventScroll: true });
    };
  }, [searchInputRef]);

  const choose = (index: number) => {
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    items?.[index]?.focus({ preventScroll: true });
    items?.[index]?.scrollIntoView({ block: 'nearest' });
  };
  const execute = async (id: string) => {
    if (running.current || actions.find(action => action.id === id)?.disabled) return;
    running.current = true;
    setBusy(true);
    setMessage('');
    try {
      await onAction(id);
    } catch (error) {
      if (mounted.current)
        setMessage(
          error instanceof Error && error.message.startsWith('Could not copy image.')
            ? error.message
            : 'Could not complete this action. Please try again.',
        );
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <>
      <div
        id="keymove-action-menu-container"
        className={`keymove-action-menu${above ? ' keymove-action-menu-above' : ''}`}
        ref={menuRef}
        style={{ maxHeight }}
        onMouseDown={event => event.stopPropagation()}
        onBlur={event => {
          if (
            event.relatedTarget instanceof Node &&
            !event.currentTarget.contains(event.relatedTarget)
          )
            onClose();
        }}
        onKeyDown={event => {
          event.stopPropagation();
          if (event.nativeEvent.isComposing) return;
          if (
            event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            /^Digit[1-9]$/.test(event.code)
          ) {
            event.preventDefault();
            const index = Number(event.code.slice(-1)) - 1;
            const action = actions[index];
            if (action && !event.repeat) {
              choose(index);
              void execute(action.id);
            }
            return;
          }
          if (
            event.ctrlKey ||
            event.altKey ||
            event.metaKey ||
            (event.shiftKey && event.key !== 'Tab')
          ) {
            if (event.key === 'Enter' || event.key === ' ') event.preventDefault();
            return;
          }
          if (event.key === 'Escape' || event.key === 'ArrowLeft') {
            event.preventDefault();
            if (event.key === 'Escape' && onEscape) onEscape();
            else onClose();
          } else if (event.key === 'Tab') {
            event.preventDefault();
            onNavigate(event.nativeEvent, !event.shiftKey);
          } else if (!event.shiftKey) {
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              choose(
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? actions.length - 1
                    : (selected + (event.key === 'ArrowDown' ? 1 : actions.length - 1)) %
                      actions.length,
              );
            } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight') {
              event.preventDefault();
              const action = actions[selected];
              if (action) void execute(action.id);
            }
          }
        }}
        onKeyUp={event => event.stopPropagation()}
      >
        <div
          id="keymove-action-menu"
          role="menu"
          aria-label={`Actions for ${suggestion.label}`}
          aria-busy={busy}
        >
          {actions.map((action, index) => (
            <button
              type="button"
              role="menuitem"
              key={action.id}
              tabIndex={selected === index ? 0 : -1}
              aria-disabled={action.disabled || busy || undefined}
              aria-keyshortcuts={`Alt+${index + 1}`}
              onFocus={() => setSelected(index)}
              onClick={() => void execute(action.id)}
            >
              <ShortcutBadge position={index + 1} tooltipsMode={tooltipsMode} />
              <span className="keymove-action-label">{action.label}</span>
            </button>
          ))}
        </div>
        {tooltipsMode && (
          <div className="keymove-action-menu-footer">
            {onEscape
              ? '↑ ↓ choose · → / Enter run · ← back · Esc return to text'
              : '↑ ↓ choose · → / Enter run · ← / Esc back'}
          </div>
        )}
        {tooltipsMode && (
          <div className="keymove-action-menu-footer">
            {Utils.isMacOS() ? 'Option' : 'Alt'}+
            {actions.length === 1 ? '1' : `1–${actions.length}`} run action
          </div>
        )}
        <div role="status" aria-live="polite">
          {message}
        </div>
      </div>
      <div
        className="keymove-action-menu-result-container"
        onMouseDown={event => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <div
          className="keymove-suggestion keymove-suggestion-selected keymove-action-menu-result"
          role="group"
          aria-label="Selected result"
        >
          <SuggestionContent suggestion={suggestion} />
        </div>
      </div>
    </>
  );
};

export default ActionMenu;
