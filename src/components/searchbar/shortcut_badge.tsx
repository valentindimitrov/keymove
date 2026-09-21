import Utils from '../../lib/utils.js';

const ShortcutBadge = ({ position, tooltipsMode }: { position: number; tooltipsMode: boolean }) => (
  <span
    className={`keymove-suggestion-position${tooltipsMode ? ' keymove-shortcut-hint' : ''}`}
    aria-hidden="true"
  >
    {tooltipsMode ? `${Utils.isMacOS() ? 'Option' : 'Alt'} + ${position}` : position}
  </span>
);

export default ShortcutBadge;
