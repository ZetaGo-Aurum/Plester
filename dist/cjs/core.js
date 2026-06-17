"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compare = compare;
exports.installExceptionHook = installExceptionHook;
exports.removeExceptionHook = removeExceptionHook;
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
function compare(a, b) {
    if (a === b)
        return { distance: 0, similarity: 1, accepted: true };
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0)
        return { distance: 0, similarity: 1, accepted: true };
    const dist = damerauLevenshtein(a, b);
    const sim = 1 - dist / maxLen;
    return { distance: dist, similarity: sim, accepted: dist <= 1 || sim >= 0.7 };
}
let hooked = false;
function installExceptionHook() {
    if (hooked)
        return;
    hooked = true;
    if (typeof process !== 'undefined' && typeof process.on === 'function') {
        process.removeAllListeners('uncaughtException');
        process.removeAllListeners('unhandledRejection');
        process.on('uncaughtException', (error) => {
            console.error('[Plester:Exception] Uncaught exception intercepted and suppressed');
            console.error(`  ${error.name}: ${error.message}`);
            if (error.stack) {
                const topFrame = extractTopFrame(error.stack);
                if (topFrame)
                    console.error(`  at ${topFrame}`);
            }
        });
        process.on('unhandledRejection', (reason) => {
            console.error('[Plester:Exception] Unhandled promise rejection intercepted');
            if (reason instanceof Error) {
                console.error(`  ${reason.name}: ${reason.message}`);
                if (reason.stack) {
                    const topFrame = extractTopFrame(reason.stack);
                    if (topFrame)
                        console.error(`  at ${topFrame}`);
                }
            }
            else {
                console.error(`  Reason: ${String(reason)}`);
            }
        });
    }
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
function removeExceptionHook() {
    if (typeof process !== 'undefined' && typeof process.removeListener === 'function') {
        hooked = false;
    }
}
//# sourceMappingURL=core.js.map