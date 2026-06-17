import { wrap } from './proxy.js';
import { patchJSON } from './json.js';
import { installExceptionHook } from './core.js';
export { wrap } from './proxy.js';
export { patchJSON, unpatchJSON } from './json.js';
export { installExceptionHook, removeExceptionHook, compare, getErrorStats } from './core.js';
let initialized = false;
export function init(options) {
    if (initialized)
        return;
    initialized = true;
    installExceptionHook();
    patchJSON();
    if (!options?.silent) {
        console.log('[Plester] Self-healing runtime engine activated');
        console.log('[Plester]  + Global exception handler installed');
        console.log('[Plester]  + JSON.parse patched with auto-healer');
        console.log('[Plester]  + Dual-algorithm matcher (Damerau–Levenshtein + Jaro-Winkler)');
    }
}
const plester = { init, wrap };
export default plester;
//# sourceMappingURL=index.js.map