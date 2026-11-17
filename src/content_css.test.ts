// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';

const contentStyles = readFileSync(path.resolve(process.cwd(), 'src/content.css'), 'utf8');

test('resets inherited host-page styling at the shadow boundary', () => {
  // Strip comments first: one that mentions the reset must not stand in for the rule.
  const rules = contentStyles.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g);
  const hostResets = [...rules].filter(
    ([, selectors, body]) =>
      selectors!.split(',').some(selector => selector.trim() === ':host') &&
      /(?:^|;)\s*all\s*:\s*initial\s*(?:;|$)/.test(body!),
  );

  expect(hostResets).toHaveLength(1);
});

test('never reads a custom property without a fallback', () => {
  // An unresolved var() invalidates its whole declaration at computed-value time. In a
  // shorthand that resets every longhand it controls, so `border: 2px solid rgb(var(--x))`
  // turns into border-style: none and the element vanishes rather than turning an odd
  // colour. A fallback keeps the declaration valid whatever happens to the property.
  const popupStyles = readFileSync(path.resolve(process.cwd(), 'src/popup.css'), 'utf8');
  const readsWithoutFallback = (contentStyles + popupStyles).match(/var\(\s*--[\w-]+\s*\)/g);

  expect(readsWithoutFallback).toBeNull();
});
