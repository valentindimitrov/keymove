import usePopupPosition from '../../hooks/use_popup_position.js';
import type { PopupPosition } from '../../lib/popup_position_schema.js';

// Normalized viewport coordinates, so the searchbar keeps its place across window sizes.
// The middle of the bottom row is the default position the extension ships with.
const POSITION_STEPS = [0.25, 0.5, 0.75] as const;
const ROW_LABELS = ['Top', 'Middle', 'Bottom'] as const;
const COLUMN_LABELS = ['left', 'centre', 'right'] as const;

function isSamePosition(a: PopupPosition, b: PopupPosition) {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001;
}

const PopupPositionGrid = ({ disabled = false }: { disabled?: boolean }) => {
  const { position, updatePosition } = usePopupPosition();

  return (
    <div className={'keymove-position-grid'} role="group" aria-label="Searchbar position">
      {POSITION_STEPS.map((y, rowIndex) =>
        POSITION_STEPS.map((x, columnIndex) => {
          const selected = isSamePosition(position, { x, y });
          return (
            <button
              key={`${x}-${y}`}
              type="button"
              disabled={disabled}
              className={
                selected
                  ? 'keymove-position-cell keymove-position-cell-selected'
                  : 'keymove-position-cell'
              }
              aria-pressed={selected}
              aria-label={`${ROW_LABELS[rowIndex]} ${COLUMN_LABELS[columnIndex]}`}
              onClick={() => updatePosition({ x, y })}
            />
          );
        }),
      )}
    </div>
  );
};

export default PopupPositionGrid;
