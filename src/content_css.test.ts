import { readFileSync } from 'node:fs';
import path from 'node:path';

const contentStyles = readFileSync(path.resolve(process.cwd(), 'src/content.css'), 'utf8');

test('keeps Shadow DOM styles free of obsolete override and vendor compatibility rules', () => {
  expect(contentStyles).toContain('all: initial');
  expect(contentStyles).not.toContain('!important');
  expect(contentStyles).not.toMatch(/-(?:webkit|moz|ms)-/);
  expect(contentStyles).not.toContain(':-ms-input-placeholder');
});
