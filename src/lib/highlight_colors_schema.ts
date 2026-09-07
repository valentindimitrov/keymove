import { SEARCH_MODES } from '../hooks/use_search_navigation.js';
import type { SearchMode } from '../hooks/use_search_navigation.js';

const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

const DEFAULT_HIGHLIGHT_COLORS = Object.freeze({
  [SEARCH_MODES.TEXT]: '#f59e0b',
  [SEARCH_MODES.ACTIONS]: '#a78bfa',
});

type HighlightColors = Record<SearchMode, string>;
type HighlightColorsValidation = { colors: HighlightColors; issues: string[] };

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_REGEX.test(value);
}

function validateHighlightColors(data: unknown): HighlightColorsValidation {
  const colors: HighlightColors = { ...DEFAULT_HIGHLIGHT_COLORS };
  if (data === undefined) {
    return { colors, issues: [] };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { colors, issues: ['Stored highlight colours must be an object.'] };
  }

  const issues: string[] = [];
  (Object.keys(DEFAULT_HIGHLIGHT_COLORS) as SearchMode[]).forEach(mode => {
    if (!Object.hasOwn(data, mode)) {
      return;
    }
    const value = (data as Record<string, unknown>)[mode];
    if (isHexColor(value)) {
      colors[mode] = value.toLowerCase();
    } else {
      issues.push(`Highlight colour "${mode}" must be a "#rrggbb" string.`);
    }
  });

  return { colors, issues };
}

function validateHighlightColorsChange(change: unknown): HighlightColorsValidation {
  if (!change || typeof change !== 'object' || Array.isArray(change)) {
    return {
      colors: { ...DEFAULT_HIGHLIGHT_COLORS },
      issues: ['Storage change for highlight colours must be an object.'],
    };
  }
  return validateHighlightColors((change as Record<string, unknown>).newValue);
}

// Colours reach the page as concrete rgba() strings rather than through a custom property.
// A var() that fails to resolve invalidates the whole declaration it sits in, which once
// erased the selection outline entirely instead of falling back to a visible colour.
function rgbaForHexColor(hexColor: string, alpha: number) {
  const red = Number.parseInt(hexColor.slice(1, 3), 16);
  const green = Number.parseInt(hexColor.slice(3, 5), 16);
  const blue = Number.parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

// Relative luminance decides whether text sitting on the solid colour reads darker or
// lighter, so a bright pick and a dark pick both stay legible.
function inkForHexColor(hexColor: string) {
  const channels = [1, 3, 5].map(offset => {
    const channel = Number.parseInt(hexColor.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  return luminance > 0.4 ? '#1a1a1a' : '#ffffff';
}

export type { HighlightColors, HighlightColorsValidation };
export {
  DEFAULT_HIGHLIGHT_COLORS,
  inkForHexColor,
  isHexColor,
  rgbaForHexColor,
  validateHighlightColors,
  validateHighlightColorsChange,
};
