"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorStats = exports.compare = exports.removeExceptionHook = exports.installExceptionHook = exports.unpatchJSON = exports.patchJSON = exports.wrap = void 0;
exports.init = init;
const proxy_js_1 = require("./proxy.js");
const json_js_1 = require("./json.js");
const core_js_1 = require("./core.js");
var proxy_js_2 = require("./proxy.js");
Object.defineProperty(exports, "wrap", { enumerable: true, get: function () { return proxy_js_2.wrap; } });
var json_js_2 = require("./json.js");
Object.defineProperty(exports, "patchJSON", { enumerable: true, get: function () { return json_js_2.patchJSON; } });
Object.defineProperty(exports, "unpatchJSON", { enumerable: true, get: function () { return json_js_2.unpatchJSON; } });
var core_js_2 = require("./core.js");
Object.defineProperty(exports, "installExceptionHook", { enumerable: true, get: function () { return core_js_2.installExceptionHook; } });
Object.defineProperty(exports, "removeExceptionHook", { enumerable: true, get: function () { return core_js_2.removeExceptionHook; } });
Object.defineProperty(exports, "compare", { enumerable: true, get: function () { return core_js_2.compare; } });
Object.defineProperty(exports, "getErrorStats", { enumerable: true, get: function () { return core_js_2.getErrorStats; } });
let initialized = false;
function init(options) {
    if (initialized)
        return;
    initialized = true;
    (0, core_js_1.installExceptionHook)();
    (0, json_js_1.patchJSON)();
    if (!options?.silent) {
        console.log('[Plester] Self-healing runtime engine activated');
        console.log('[Plester]  + Global exception handler installed');
        console.log('[Plester]  + JSON.parse patched with auto-healer');
        console.log('[Plester]  + Dual-algorithm matcher (Damerau–Levenshtein + Jaro-Winkler)');
    }
}
const plester = { init, wrap: proxy_js_1.wrap };
exports.default = plester;
//# sourceMappingURL=index.js.map