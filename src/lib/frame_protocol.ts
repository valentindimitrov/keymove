import { isRecord } from './runtime_schema.js';
import { isImageCommand } from './image_schema.js';
import type { ImageCommand } from './image_schema.js';

export const FRAME_MESSAGE = 'KEYMOVE_FRAME_V1';
export const FRAME_PROBE = 'KEYMOVE_FRAME_PROBE_V1';
export type FrameCommand =
  | ImageCommand
  | 'activate'
  | 'focus'
  | 'scroll'
  | 'select'
  | 'hover'
  | 'unhover'
  | 'text'
  | 'validate';
export type FrameRequest =
  | { op: 'search'; query: string; generation: string; depth: number }
  | { op: 'stop' }
  | { op: 'restore' }
  | { op: 'cancel'; generation: string }
  | { op: 'command'; generation: string; id: number; command: FrameCommand }
  | {
      op: 'paint';
      generation: string;
      selected: number | null;
      ids: number[];
      color: string;
      highlight: boolean;
    };
export type FrameRow = {
  id: number;
  kind: 'text' | 'action';
  action: number | null;
  label: string;
  text: string;
  context: string;
  href: string | null;
  disabled: boolean;
  focusable: boolean;
  score: number;
  term: string | null;
  distance: number | null;
};
export type FrameReply = { generation: string; rows: FrameRow[]; isFuzzy: boolean };
const token = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 100;
const id = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const str = (value: unknown): value is string => typeof value === 'string';
export function isFrameRequest(value: unknown): value is FrameRequest {
  if (!isRecord(value)) return false;
  if (value.op === 'stop' || value.op === 'restore') return true;
  if (!token(value.generation)) return false;
  if (value.op === 'cancel') return true;
  if (value.op === 'search')
    return str(value.query) && value.query.length <= 10000 && id(value.depth) && value.depth <= 8;
  if (value.op === 'command')
    return (
      id(value.id) &&
      (isImageCommand(value.command) ||
        ['activate', 'focus', 'scroll', 'select', 'hover', 'unhover', 'text', 'validate'].includes(
          String(value.command),
        ))
    );
  return (
    value.op === 'paint' &&
    typeof value.highlight === 'boolean' &&
    (value.selected === null || id(value.selected)) &&
    Array.isArray(value.ids) &&
    value.ids.every(id) &&
    str(value.color) &&
    /^#[\da-f]{6}$/i.test(value.color)
  );
}
export function isFrameReply(value: unknown): value is FrameReply {
  return (
    isRecord(value) &&
    token(value.generation) &&
    typeof value.isFuzzy === 'boolean' &&
    Array.isArray(value.rows) &&
    value.rows.every(
      row =>
        isRecord(row) &&
        id(row.id) &&
        ['text', 'action'].includes(String(row.kind)) &&
        (row.action === null || id(row.action)) &&
        str(row.label) &&
        str(row.text) &&
        str(row.context) &&
        (row.href === null || str(row.href)) &&
        typeof row.disabled === 'boolean' &&
        typeof row.focusable === 'boolean' &&
        typeof row.score === 'number' &&
        Number.isFinite(row.score) &&
        (row.term === null || str(row.term)) &&
        (row.distance === null || id(row.distance)),
    )
  );
}
export function isFrameEnvelope(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && value.type === FRAME_MESSAGE;
}
export { token as isFrameToken, id as isFrameId };
