import assert from 'node:assert/strict';

// Browser protocol responses and saved reports remain untrusted after type erasure.
export function record(value: unknown): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Expected an object');
  return value as Record<string, unknown>;
}

export function records(value: unknown): Record<string, unknown>[] {
  assert(Array.isArray(value), 'Expected an array');
  return value.map(record);
}

export function targets(value: unknown) {
  return records(record(value).targetInfos).map(target => {
    const { targetId, type, url } = target;
    assert(typeof targetId === 'string' && typeof type === 'string' && typeof url === 'string');
    return { targetId, type, url };
  });
}

export function tabs(value: unknown) {
  return records(value).map(tab => {
    const { id, active, url } = tab;
    assert(typeof id === 'number' && typeof active === 'boolean');
    assert(url === undefined || typeof url === 'string');
    return { id, active, url };
  });
}

export type PendingCommand = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};
