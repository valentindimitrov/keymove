// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';

const contentStyles = readFileSync(path.resolve(process.cwd(), 'src/content.css'), 'utf8');

test('resets inherited host-page styling at the shadow boundary', () => {
  expect(contentStyles).toContain('all: initial');
});

test('never reads a custom property without a fallback', () => {
  // An unresolved var() invalidates its whole declaration at computed-value time. In a
  // shorthand that resets every longhand it controls, so `border: 2px solid rgb(var(--x))`
  // turns into border-style: none and the element vanishes rather than turning an odd
  // colour. A fallback keeps the declaration valid whatever happens to the property.
  const readsWithoutFallback = contentStyles.match(/var\(\s*--[\w-]+\s*\)/g);

  expect(readsWithoutFallback).toBeNull();
});
