enum Kind {
  Error,
  Value,
  Pending
}

interface ErrorResult {
  kind: Kind.Error;
  error: any;
}

interface OkResult {
  kind: Kind.Value;
  value: any;
}

interface Pending {
  kind: Kind.Pending;
  promise: Promise<void>;
}

type Result = ErrorResult | OkResult | Pending;

const cache = new WeakMap<object, Map<Function, Map<string, Result>>>();

function _readMethodCall<T extends any[], V>(
  target: any,
  f: (...args: T) => Promise<V>,
  args: T,
  shouldThrow: boolean
): V {
  let cachedFns = cache.get(target);
  if (!cachedFns) {
    cachedFns = new Map();
    cache.set(target, cachedFns);
  }
  let cachedCalls = cachedFns.get(f);
  if (!cachedCalls) {
    cachedCalls = new Map();
    cachedFns.set(f, cachedCalls);
  }
  const argsJson = JSON.stringify(args);
  let cachedPromise = cachedCalls.get(argsJson);
  if (!cachedPromise) {
    cachedPromise = {
      kind: Kind.Pending,
      promise: undefined
    };
    cachedCalls.set(argsJson, cachedPromise);
    // apparently there's such a thing as synchronous thenables,
    // so we have to save the value in the WeakMap before calling `then()`
    // in case we overwrite the value it stores there.
    cachedPromise.promise = f
      .apply(target, args)
      .then(value => {
        cachedCalls.set(argsJson, { kind: Kind.Value, value });
      })
      .catch(error => {
        cachedCalls.set(argsJson, { kind: Kind.Error, error });
      });
  }
  switch (cachedPromise.kind) {
    case Kind.Value:
      return cachedPromise.value;
    case Kind.Pending:
      if (!shouldThrow) {
        return undefined;
      }
      throw cachedPromise.promise;
    case Kind.Error:
      if (!shouldThrow) {
        return undefined;
      }
      throw cachedPromise.error;
  }
}

export function readMethodCall<T extends any[], V>(
  target: any,
  f: (...args: T) => Promise<V>,
  ...args: T
): V {
  return _readMethodCall(target, f, args, true);
}

export function attemptMethodCall<T extends any[], V>(
  target: any,
  f: (...args: T) => Promise<V>,
  ...args: T
): V | undefined {
  return _readMethodCall(target, f, args, false);
}

export function invalidateMethodCall<T extends any[], V>(
  target: any,
  f: (...args: T) => Promise<V>,
  ...args: T
) {
  const cachedFns = cache.get(target);
  if (!cachedFns) {
    return;
  }
  const cachedCalls = cachedFns.get(f);
  if (!cachedCalls) {
    return;
  }
  const argsJson = JSON.stringify(args);
  cachedCalls.delete(argsJson);
}

const promiseCache: WeakMap<Promise<any>, any> = new WeakMap();

export function readCachedPromise<K, V>(promise: Promise<V>): V {
  let cachedPromise = promiseCache.get(promise);
  if (!cachedPromise) {
    cachedPromise = {
      kind: Kind.Pending,
      promise: undefined
    };
    promiseCache.set(promise, cachedPromise);
    // apparently there's such a thing as synchronous thenables,
    // so we have to save the value in the WeakMap before calling `then()`
    // in case we overwrite the value it stores there.
    cachedPromise.promise = promise
      .then(value => {
        promiseCache.set(promise, { kind: Kind.Value, value });
      })
      .catch(error => {
        promiseCache.set(promise, { kind: Kind.Error, error });
      });
  }
  switch (cachedPromise.kind) {
    case Kind.Value:
      return cachedPromise.value;
    case Kind.Pending:
      throw cachedPromise.promise;
    case Kind.Error:
      throw cachedPromise.error;
  }
}
