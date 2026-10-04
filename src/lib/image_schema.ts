import { isRecord } from './runtime_schema.js';

export type ImageInfo = {
  token: string;
  url: string;
  label: string;
  link: string | null;
  position: number;
  count: number;
};
export type ImageDirection = 'left' | 'right' | 'up' | 'down';
export function isImageDirection(value: unknown): value is ImageDirection {
  return typeof value === 'string' && ['left', 'right', 'up', 'down'].includes(value);
}
export type ImageOperation = 'next' | 'info' | 'clear' | 'activate' | 'copy' | ImageDirection;
export type ImageCommand = { image: ImageOperation; token: string };
export function isImageCommand(value: unknown): value is ImageCommand {
  return (
    isRecord(value) &&
    (['next', 'info', 'clear', 'activate', 'copy'].includes(String(value.image)) ||
      isImageDirection(value.image)) &&
    typeof value.token === 'string' &&
    value.token.length <= 100
  );
}
export function imageUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'blob:'].includes(url.protocol) ||
      /^data:image\/(png|jpeg|gif|webp|avif);/i.test(value)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function isImageInfo(value: unknown): value is ImageInfo {
  return (
    isRecord(value) &&
    typeof value.token === 'string' &&
    value.token.length > 0 &&
    value.token.length <= 100 &&
    typeof value.url === 'string' &&
    imageUrl(value.url) !== null &&
    typeof value.label === 'string' &&
    (value.link === null || (typeof value.link === 'string' && /^https?:\/\//i.test(value.link))) &&
    Number.isSafeInteger(value.position) &&
    Number.isSafeInteger(value.count) &&
    (value.position as number) >= 1 &&
    (value.count as number) >= (value.position as number) &&
    (value.count as number) <= 12
  );
}
