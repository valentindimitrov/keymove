const DEFAULT_POPUP_POSITION = Object.freeze({ x: 0.5, y: 0.75 });

type PopupPosition = { x: number; y: number };
type PopupPositionValidation = { position: PopupPosition; issues: string[] };

function isNormalizedCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validatePopupPosition(value: unknown): PopupPositionValidation {
  if (value === undefined) {
    return { position: { ...DEFAULT_POPUP_POSITION }, issues: [] };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      position: { ...DEFAULT_POPUP_POSITION },
      issues: ['Popup position must be an object.'],
    };
  }

  const data = value as Record<string, unknown>;
  const issues: string[] = [];
  if (!isNormalizedCoordinate(data['x'])) {
    issues.push('Popup position x must be a finite number from 0 to 1.');
  }
  if (!isNormalizedCoordinate(data['y'])) {
    issues.push('Popup position y must be a finite number from 0 to 1.');
  }

  return issues.length === 0
    ? { position: { x: data['x'] as number, y: data['y'] as number }, issues }
    : { position: { ...DEFAULT_POPUP_POSITION }, issues };
}

export type { PopupPosition };
export { DEFAULT_POPUP_POSITION, validatePopupPosition };
