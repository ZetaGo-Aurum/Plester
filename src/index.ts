import { wrap } from './proxy.js';
import { patchJSON, unpatchJSON } from './json.js';
import { installExceptionHook, removeExceptionHook } from './core.js';

export { wrap } from './proxy.js';
export { patchJSON, unpatchJSON } from './json.js';
export { installExceptionHook, removeExceptionHook, compare } from './core.js';

let initialized = false;

export interface PlesterOptions {
  silent?: boolean;
}

export function init(options?: PlesterOptions): void {
  if (initialized) return;
  initialized = true;

  installExceptionHook();
  patchJSON();

  if (!options?.silent) {
    console.log('[Plester] Self-healing runtime engine activated');
    console.log('[Plester]  + Global exception handler installed');
    console.log('[Plester]  + JSON.parse patched with auto-healer');
  }
}

const plester = { init, wrap };

export default plester;
