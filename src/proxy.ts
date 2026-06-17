import { compare } from './core.js';

const PROXY_CACHE = new WeakMap<object, object>();

function collectKeys(target: object): Set<string> {
  const keys = new Set<string>();

  let proto: object | null = target;
  do {
    const ownKeys = Object.getOwnPropertyNames(proto);
    for (const k of ownKeys) {
      if (k === 'constructor' || k === '__proto__' || k === '__defineGetter__' || k === '__defineSetter__') continue;
      keys.add(k);
    }
    proto = Object.getPrototypeOf(proto);
  } while (proto && proto !== Object.prototype && proto !== null);

  return keys;
}

function findBestMatch(prop: string, candidates: Set<string>): { key: string; result: import('./core.js').CompareResult } | null {
  let bestKey = '';
  let bestScore = 0;
  let bestResult: import('./core.js').CompareResult | null = null;

  for (const candidate of candidates) {
    const result = compare(prop, candidate);
    if (result.similarity > bestScore) {
      bestScore = result.similarity;
      bestKey = candidate;
      bestResult = result;
    }
  }

  return bestResult && bestResult.accepted ? { key: bestKey, result: bestResult } : null;
}

function createProxy<T extends object>(target: T): T {
  const keys = collectKeys(target);
  const cache = new Map<string, string>();

  return new Proxy(target, {
    get(target: T, prop: string | symbol, receiver: any): unknown {
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop, receiver);
      }

      const propStr = prop as string;
      const isArrayIndex = Array.isArray(target) && /^\d+$/.test(propStr);

      if (isArrayIndex || propStr in target) {
        const val = Reflect.get(target, prop, receiver);
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          return wrap(val);
        }
        if (typeof val === 'function') {
          return val.bind(receiver);
        }
        return val;
      }

      const cached = cache.get(propStr);
      if (cached !== undefined) {
        const val = Reflect.get(target, cached, receiver);
        if (typeof val === 'function') return val.bind(receiver);
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) return wrap(val);
        return val;
      }

      const match = findBestMatch(propStr, keys);
      if (match) {
        cache.set(propStr, match.key);
        const val = Reflect.get(target, match.key, receiver);
        if (typeof val === 'function') return val.bind(receiver);
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) return wrap(val);
        return val;
      }

      return Reflect.get(target, prop, receiver);
    },

    set(target: T, prop: string | symbol, value: unknown, receiver: any): boolean {
      if (typeof prop === 'symbol') {
        return Reflect.set(target, prop, value, receiver);
      }

      const propStr = prop as string;

      if (propStr in target) {
        return Reflect.set(target, propStr, value, receiver);
      }

      const cached = cache.get(propStr);
      if (cached !== undefined) {
        return Reflect.set(target, cached, value, receiver);
      }

      const match = findBestMatch(propStr, keys);
      if (match) {
        cache.set(propStr, match.key);
        return Reflect.set(target, match.key, value, receiver);
      }

      return Reflect.set(target, propStr, value, receiver);
    },

    has(target: T, prop: string | symbol): boolean {
      if (typeof prop === 'symbol') return Reflect.has(target, prop);
      const propStr = prop as string;
      if (Reflect.has(target, prop)) return true;
      const cached = cache.get(propStr);
      if (cached !== undefined) return true;
      return findBestMatch(propStr, keys) !== null;
    },

    ownKeys(target: T): ArrayLike<string | symbol> {
      return Reflect.ownKeys(target);
    }
  });
}

export function wrap<T extends object>(target: T): T {
  if (PROXY_CACHE.has(target)) return PROXY_CACHE.get(target) as T;
  const proxy = createProxy(target);
  PROXY_CACHE.set(target, proxy);
  return proxy as T;
}
