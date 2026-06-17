"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compare = compare;
exports.installExceptionHook = installExceptionHook;
exports.removeExceptionHook = removeExceptionHook;
exports.getErrorStats = getErrorStats;
const MIN_LEN_FOR_TRANSPOSITION = 2;
function damerauLevenshtein(a, b) {
    if (a === b)
        return 0;
    if (a.length < b.length)
        [a, b] = [b, a];
    const m = a.length;
    const n = b.length;
    if (n === 0)
        return m;
    const aCodes = new Uint16Array(m);
    const bCodes = new Uint16Array(n);
    for (let i = 0; i < m; i++)
        aCodes[i] = a.charCodeAt(i);
    for (let j = 0; j < n; j++)
        bCodes[j] = b.charCodeAt(j);
    let pp = new Uint32Array(n + 1);
    let p = new Uint32Array(n + 1);
    let c = new Uint32Array(n + 1);
    for (let j = 0; j <= n; j++)
        p[j] = j;
    for (let i = 1; i <= m; i++) {
        c[0] = i;
        const aCode = aCodes[i - 1];
        for (let j = 1; j <= n; j++) {
            const cost = aCode === bCodes[j - 1] ? 0 : 1;
            c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + cost);
            if (i >= MIN_LEN_FOR_TRANSPOSITION && j >= MIN_LEN_FOR_TRANSPOSITION) {
                if (aCode === bCodes[j - 2] && aCodes[i - 2] === bCodes[j - 1]) {
                    c[j] = Math.min(c[j], pp[j - 2] + cost);
                }
            }
        }
        const t = pp;
        pp = p;
        p = c;
        c = t;
    }
    return p[n];
}
function jaroWinkler(a, b) {
    if (a === b)
        return 1;
    const m = a.length;
    const n = b.length;
    if (m === 0 || n === 0)
        return 0;
    const matchDist = Math.floor(Math.max(m, n) / 2) - 1;
    if (matchDist < 0)
        return a[0] === b[0] ? 1 : 0;
    const matchedA = new Uint8Array(m);
    const matchedB = new Uint8Array(n);
    let matches = 0;
    for (let i = 0; i < m; i++) {
        const start = Math.max(0, i - matchDist);
        const end = Math.min(n, i + matchDist + 1);
        for (let j = start; j < end; j++) {
            if (matchedB[j] || a[i] !== b[j])
                continue;
            matchedA[i] = 1;
            matchedB[j] = 1;
            matches++;
            break;
        }
    }
    if (matches === 0)
        return 0;
    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < m; i++) {
        if (!matchedA[i])
            continue;
        while (k < n && !matchedB[k])
            k++;
        if (k < n && a[i] !== b[k])
            transpositions++;
        k++;
    }
    const jaro = (matches / m +
        matches / n +
        (matches - transpositions / 2) / matches) / 3;
    let prefix = 0;
    const prefixLimit = Math.min(4, m, n);
    for (let i = 0; i < prefixLimit && a[i] === b[i]; i++)
        prefix++;
    return jaro + prefix * 0.1 * (1 - jaro);
}
function compare(a, b) {
    if (a === b)
        return { distance: 0, similarity: 1, accepted: true, method: 'exact' };
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0)
        return { distance: 0, similarity: 1, accepted: true, method: 'exact' };
    const dlDist = damerauLevenshtein(a, b);
    const dlSim = 1 - dlDist / maxLen;
    const jwSim = jaroWinkler(a, b);
    const similarity = Math.max(dlSim, jwSim);
    const distance = dlDist;
    const method = jwSim > dlSim && jwSim >= 0.85 && dlDist > 1 ? 'jarowinkler' : 'damerau';
    const accepted = distance <= 1 || similarity >= 0.7 || jwSim >= 0.88;
    return { distance, similarity, accepted, method };
}
let hooked = false;
const errorRegistry = new Map();
const CIRCUIT_BREAKER_THRESHOLD = 10;
const CIRCUIT_BREAKER_WINDOW = 60000;
function getErrorSignature(error) {
    const stack = error.stack || '';
    const lines = stack.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('at ')) {
            const frame = trimmed.slice(3);
            return `${error.name}:${frame}`;
        }
    }
    return error.name;
}
function extractTopFrame(stack) {
    const lines = stack.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('at '))
            return trimmed.slice(3);
    }
    return null;
}
function logStructured(level, error) {
    const record = {
        timestamp: new Date().toISOString(),
        level,
        engine: 'plester',
        name: error.name,
        message: error.message,
    };
    if (error.stack) {
        const frame = extractTopFrame(error.stack);
        if (frame)
            record.frame = frame;
    }
    process.stderr.write(JSON.stringify(record) + '\n');
}
function installExceptionHook() {
    if (hooked)
        return;
    hooked = true;
    if (typeof process !== 'undefined' && typeof process.on === 'function') {
        process.removeAllListeners('uncaughtException');
        process.removeAllListeners('unhandledRejection');
        process.on('uncaughtException', (error) => {
            const sig = getErrorSignature(error);
            const now = Date.now();
            let rec = errorRegistry.get(sig);
            if (rec) {
                rec.count++;
                rec.lastSeen = now;
                if (now - rec.firstSeen < CIRCUIT_BREAKER_WINDOW && rec.count >= CIRCUIT_BREAKER_THRESHOLD) {
                    logStructured('critical', error);
                    process.stderr.write(`[Plester:CircuitBreaker] Error "${error.message}" fired ${rec.count}x in 60s — suppressing further logs\n`);
                    return;
                }
            }
            else {
                errorRegistry.set(sig, { count: 1, firstSeen: now, lastSeen: now, message: error.message });
            }
            logStructured('error', error);
        });
        process.on('unhandledRejection', (reason) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            const sig = getErrorSignature(error);
            const now = Date.now();
            let rec = errorRegistry.get(sig);
            if (rec) {
                rec.count++;
                rec.lastSeen = now;
                if (now - rec.firstSeen < CIRCUIT_BREAKER_WINDOW && rec.count >= CIRCUIT_BREAKER_THRESHOLD) {
                    logStructured('critical', error);
                    return;
                }
            }
            else {
                errorRegistry.set(sig, { count: 1, firstSeen: now, lastSeen: now, message: error.message });
            }
            logStructured('error', error);
        });
    }
}
function removeExceptionHook() {
    if (typeof process !== 'undefined' && typeof process.removeListener === 'function') {
        hooked = false;
        errorRegistry.clear();
    }
}
function getErrorStats() {
    return errorRegistry;
}
//# sourceMappingURL=core.js.map