// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { record, records, tabs } from './capture-data.js';

describe('capture response validation', () => {
  it('rejects malformed saved report rows', () => {
    for (const value of [null, [], 'response']) expect(() => record(value)).toThrow();
    expect(() => records({ images: [] })).toThrow();
    expect(() => records([null])).toThrow();
  });

  it('allows tabs without URL access but rejects invalid activation data', () => {
    expect(tabs([{ id: 1, active: false }])).toEqual([{ id: 1, active: false, url: undefined }]);
    expect(() => tabs([{ id: 1, active: 'false' }])).toThrow();
    expect(() => tabs([{ id: 1, active: false, url: 42 }])).toThrow();
  });
});
