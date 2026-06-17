"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrap = wrap;
const core_js_1 = require("./core.js");
const PROXY_CACHE = new WeakMap();
function collectKeys(target) {
    const keys = new Set();
    let proto = target;
    do {
        const ownKeys = Object.getOwnPropertyNames(proto);
        for (const k of ownKeys) {
            if (k === 'constructor' || k === '__proto__' || k === '__defineGetter__' || k === '__defineSetter__')
                continue;
            keys.add(k);
        }
        proto = Object.getPrototypeOf(proto);
    } while (proto && proto !== Object.prototype && proto !== null);
    return keys;
}
function findBestMatch(prop, candidates) {
    let bestKey = '';
    let bestScore = 0;
    let bestResult = null;
    for (const candidate of candidates) {
        const result = (0, core_js_1.compare)(prop, candidate);
        if (result.similarity > bestScore) {
            bestScore = result.similarity;
            bestKey = candidate;
            bestResult = result;
        }
    }
    return bestResult && bestResult.accepted ? { key: bestKey, result: bestResult } : null;
}
function createProxy(target) {
    const keys = collectKeys(target);
    const cache = new Map();
    return new Proxy(target, {
        get(target, prop, receiver) {
            if (typeof prop === 'symbol') {
                return Reflect.get(target, prop, receiver);
            }
            const propStr = prop;
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
                if (typeof val === 'function')
                    return val.bind(receiver);
                if (typeof val === 'object' && val !== null && !Array.isArray(val))
                    return wrap(val);
                return val;
            }
            const match = findBestMatch(propStr, keys);
            if (match) {
                cache.set(propStr, match.key);
                const val = Reflect.get(target, match.key, receiver);
                if (typeof val === 'function')
                    return val.bind(receiver);
                if (typeof val === 'object' && val !== null && !Array.isArray(val))
                    return wrap(val);
                return val;
            }
            return Reflect.get(target, prop, receiver);
        },
        set(target, prop, value, receiver) {
            if (typeof prop === 'symbol') {
                return Reflect.set(target, prop, value, receiver);
            }
            const propStr = prop;
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
        has(target, prop) {
            if (typeof prop === 'symbol')
                return Reflect.has(target, prop);
            const propStr = prop;
            if (Reflect.has(target, prop))
                return true;
            const cached = cache.get(propStr);
            if (cached !== undefined)
                return true;
            return findBestMatch(propStr, keys) !== null;
        },
        ownKeys(target) {
            return Reflect.ownKeys(target);
        }
    });
}
function wrap(target) {
    if (PROXY_CACHE.has(target))
        return PROXY_CACHE.get(target);
    const proxy = createProxy(target);
    PROXY_CACHE.set(target, proxy);
    return proxy;
}
//# sourceMappingURL=proxy.js.map