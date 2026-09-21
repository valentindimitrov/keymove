// @vitest-environment node
import {
  DEFAULT_HIGHLIGHT_COLORS,
  inkForHexColor,
  rgbaForHexColor,
  validateHighlightColors,
} from './highlight_colors_schema.js';

test('accepts stored hex colours and normalises their case', () => {
  const result = validateHighlightColors({ text: '#FF0000', actions: '#00ff00' });

  expect(result).toEqual({ colors: { text: '#ff0000', actions: '#00ff00' }, issues: [] });
});

test('falls back to defaults for malformed colours without dropping valid ones', () => {
  const result = validateHighlightColors({ text: 'red', actions: '#0000ff' });

  expect(result.colors).toEqual({ text: DEFAULT_HIGHLIGHT_COLORS.text, actions: '#0000ff' });
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]).toContain('#rrggbb');
});

test('uses defaults when storage returns nothing or the wrong shape', () => {
  expect(validateHighlightColors(undefined).colors).toEqual({ ...DEFAULT_HIGHLIGHT_COLORS });
  expect(validateHighlightColors([]).issues).toHaveLength(1);
  expect(validateHighlightColors('nope').colors).toEqual({ ...DEFAULT_HIGHLIGHT_COLORS });
  expect(validateHighlightColors({ text: '#123456' }).colors.text).toBe('#123456');
});

test('builds concrete rgba strings rather than relying on custom properties', () => {
  expect(rgbaForHexColor('#a78bfa', 0.26)).toBe('rgba(167, 139, 250, 0.26)');
});

test('picks readable ink for both light and dark colours', () => {
  expect(inkForHexColor('#f59e0b')).toBe('#1a1a1a');
  expect(inkForHexColor('#1d4ed8')).toBe('#ffffff');
});
