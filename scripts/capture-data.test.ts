// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { record, records, tabs, targets } from './capture-data.js';

describe('capture response validation', () => {
  it('rejects malformed protocol envelopes and saved report rows', () => {
    for (const value of [null, [], 'response']) expect(() => record(value)).toThrow();
    expect(() => records({ images: [] })).toThrow();
    expect(() => records([null])).toThrow();
    expect(() => targets({ targetInfos: [{ targetId: '1', type: 'page', url: 42 }] })).toThrow();
  });

  it('accepts additional protocol fields without requiring unrelated metadata', () => {
    expect(
      targets({ targetInfos: [{ targetId: '1', type: 'page', url: 'about:blank', title: '' }] }),
    ).toEqual([{ targetId: '1', type: 'page', url: 'about:blank' }]);
  });

  it('allows tabs without URL access but rejects invalid activation data', () => {
    expect(tabs([{ id: 1, active: false }])).toEqual([{ id: 1, active: false, url: undefined }]);
    expect(() => tabs([{ id: 1, active: 'false' }])).toThrow();
    expect(() => tabs([{ id: 1, active: false, url: 42 }])).toThrow();
  });
});
