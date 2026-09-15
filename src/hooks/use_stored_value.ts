import React from 'react';
import { browser, type Browser } from 'wxt/browser';
import { EXTENSION_NAME } from '../extension_identity.js';
import { isRecord } from '../lib/runtime_schema.js';

type StoredValueSchema<T> = {
  key: string;
  description: string;
  initialValue: T;
  validate: (value: unknown) => { value: T; issues: string[] };
};

// One revision protects both initial hydration and failed optimistic writes. A later
// local edit or storage event always wins over either earlier asynchronous operation.
function useStoredValue<T>(schema: StoredValueSchema<T>) {
  const { key, description, initialValue, validate } = schema;
  const revision = React.useRef(0);
  const current = React.useRef(initialValue);
  const [value, setValue] = React.useState(initialValue);
  const reportIssues = React.useCallback(
    (issues: string[]) => {
      issues.forEach(issue =>
        console.warn(`${EXTENSION_NAME} ignored invalid ${description}: ${issue}`),
      );
    },
    [description],
  );
  const reportError = React.useCallback(
    (operation: string, error: unknown) => {
      console.error(
        `${EXTENSION_NAME} could not ${operation} the ${description}: ${error instanceof Error ? error.message : String(error)}`,
      );
    },
    [description],
  );
  const apply = React.useCallback((next: T) => {
    current.current = next;
    setValue(next);
  }, []);
  const updateValue = React.useCallback(
    (next: React.SetStateAction<T>) => {
      const previous = current.current;
      const result = validate(
        typeof next === 'function' ? (next as (previous: T) => T)(previous) : next,
      );
      reportIssues(result.issues);
      if (result.issues.length) return;
      const writeRevision = ++revision.current;
      apply(result.value);
      void browser.storage.local.set({ [key]: result.value }).catch(error => {
        reportError('save', error);
        if (revision.current === writeRevision) apply(previous);
      });
    },
    [apply, key, reportError, reportIssues, validate],
  );
  const resetValue = React.useCallback(
    () => updateValue(initialValue),
    [initialValue, updateValue],
  );

  React.useEffect(() => {
    let active = true;
    const initialRevision = revision.current;
    const accept = (raw: unknown) => {
      const result = validate(raw);
      reportIssues(result.issues);
      apply(result.value);
    };
    const changed = (changes: unknown, area: Browser.storage.AreaName) => {
      if (!active || area !== 'local') return;
      if (!isRecord(changes)) {
        reportIssues(['Storage changes must be an object.']);
        return;
      }
      if (!Object.hasOwn(changes, key)) return;
      revision.current += 1;
      const change = changes[key];
      accept(
        isRecord(change)
          ? Object.hasOwn(change, 'newValue')
            ? change['newValue']
            : undefined
          : null,
      );
    };
    browser.storage.onChanged.addListener(changed);
    void browser.storage.local
      .get(key)
      .then(data => {
        if (active && revision.current === initialRevision)
          accept(isRecord(data) ? (Object.hasOwn(data, key) ? data[key] : undefined) : null);
      })
      .catch(error => reportError('read', error));
    return () => {
      active = false;
      revision.current += 1;
      browser.storage?.onChanged.removeListener(changed);
    };
  }, [apply, key, reportError, reportIssues, validate]);
  return { value, updateValue, resetValue };
}

export default useStoredValue;
