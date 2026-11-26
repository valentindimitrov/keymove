// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';

const contentStyles = readFileSync(path.resolve(process.cwd(), 'src/content.css'), 'utf8');

test('resets host-page styling at the shadow boundary, ahead of important page rules', () => {
  // Strip comments first: one that mentions the reset must not stand in for the rule.
  const rules = contentStyles.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g);
  // Rules for the host element itself, not for its descendants or its ::backdrop.
  const hostRules = [...rules].filter(([, selectors]) =>
    selectors!.split(',').some(selector => /^:host(?:\([^)]*\))?$/.test(selector.trim())),
  );
  const declarations = hostRules.flatMap(([, , body]) =>
    body!
      .split(';')
      .map(declaration => declaration.trim())
      .filter(Boolean),
  );

  // Page rules reach the host itself and beat normal :host declarations; only important
  // ones win, even over the page's important rules (Dawn's `div:empty { display: none }`).
  // That includes the theme's custom properties, which a page rule could otherwise set.
  expect(declarations).toContain('all: initial !important');
  expect(declarations).toContain('display: block !important');
  expect(declarations.filter(declaration => !declaration.endsWith('!important'))).toEqual([]);
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
