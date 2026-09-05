type JsonObject = Record<string, unknown>;
type StringArrayOptions = {
  minimumLength?: number;
  expectation?: string;
};

function fail(path: string, expectation: string): never {
  throw new TypeError(`${path} ${expectation}`);
}

function assertObject(value: unknown, path: string): asserts value is JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
}

function assertKnownKeys(value: JsonObject, allowedKeys: ReadonlySet<string>, path: string) {
  Object.keys(value).forEach(key => {
    if (!allowedKeys.has(key)) {
      fail(`${path}.${key}`, 'is not a supported property');
    }
  });
}

function assertNonemptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(path, 'must be a non-empty string');
  }
}

function assertStringArray(
  value: unknown,
  path: string,
  { minimumLength = 0, expectation }: StringArrayOptions = {},
): asserts value is string[] {
  if (!Array.isArray(value) || value.length < minimumLength) {
    fail(path, expectation ?? `must be an array containing at least ${minimumLength} string(s)`);
  }
  value.forEach((entry, index) => assertNonemptyString(entry, `${path}[${index}]`));
}

export type { JsonObject, StringArrayOptions };
export { assertKnownKeys, assertNonemptyString, assertObject, assertStringArray, fail };
