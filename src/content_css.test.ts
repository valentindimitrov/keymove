import { readFileSync } from 'node:fs';
import path from 'node:path';

const contentStyles = readFileSync(path.resolve(process.cwd(), 'src/content.css'), 'utf8');

test('keeps Shadow DOM styles free of obsolete override and vendor compatibility rules', () => {
  expect(contentStyles).toContain('all: initial');
  expect(contentStyles).not.toContain('!important');
  expect(contentStyles).not.toMatch(/-(?:webkit|moz|ms)-/);
  expect(contentStyles).not.toContain(':-ms-input-placeholder');
});

test('never reads a custom property without a fallback', () => {
  // An unresolved var() invalidates its whole declaration at computed-value time. In a
  // shorthand that resets every longhand it controls, so `border: 2px solid rgb(var(--x))`
  // turns into border-style: none and the element vanishes rather than turning an odd
  // colour. A fallback keeps the declaration valid whatever happens to the property.
  const readsWithoutFallback = contentStyles.match(/var\(\s*--[\w-]+\s*\)/g);

  expect(readsWithoutFallback).toBeNull();
});
