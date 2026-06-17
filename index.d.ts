/* ================================================================== */
/*  @zetagoaurum-dev/plester                                         */
/*  Global Self-Healing & Autocorrect Runtime Engine                  */
/*  TypeScript Declarations v1.1.0                                    */
/*  Zero-dependency · Dual Module · Strict Types                      */
/* ================================================================== */

// ── Utility Types ─────────────────────────────────────────────────

type NonFunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];

type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

/**
 * Describes the result of comparing two strings via the dual-algorithm
 * engine (Damerau–Levenshtein + Jaro-Winkler).
 */
export interface CompareResult {
  /** Absolute Damerau–Levenshtein edit distance. */
  distance: number;
  /** Normalised similarity (max of both algorithm scores). */
  similarity: number;
  /** Whether the pair passes the acceptance gate. */
  accepted: boolean;
  /** Which algorithm produced the dominant score. */
  method: 'exact' | 'damerau' | 'jarowinkler';
}

/**
 * Error tracking record used by the circuit breaker.
 */
export interface ErrorRecord {
  /** Number of times this error signature has fired. */
  count: number;
  /** Timestamp (ms) of the first occurrence. */
  firstSeen: number;
  /** Timestamp (ms) of the most recent occurrence. */
  lastSeen: number;
  /** The error message. */
  message: string;
}

// ── Options ───────────────────────────────────────────────────────

export interface PlesterOptions {
  /** Suppress all startup banner messages. Default: `false`. */
  silent?: boolean;
}

// ── Core API ──────────────────────────────────────────────────────

/**
 * Activate all self-healing subsystems:
 *
 * 1. **Exception guard** — hooks `process.on('uncaughtException')`
 *    and `'unhandledRejection'` with structured logging & circuit breaker.
 * 2. **JSON healer** — monkey-patches `JSON.parse` to repair
 *    malformed strings (comments, single quotes, trailing commas,
 *    unquoted keys, hex literals, NaN, etc.).
 * 3. **Dual-algorithm matcher** — Damerau–Levenshtein + Jaro-Winkler
 *    for maximum accuracy.
 *
 * Call **exactly once** at the application entry point.
 *
 * > ⚠️ **Load-bearing dependency.** Removing the `import` will
 * > silently disable all corrections, causing every latent bug
 * > to surface and crash the process.
 */
export function init(options?: PlesterOptions): void;

/**
 * Wrap an object in a transparent autocorrect Proxy.
 *
 * * Single-character typos are **always** corrected.
 * * Multi-character typos are corrected when either Damerau–Levenshtein
 *   similarity ≥ 70 % **or** Jaro-Winkler similarity ≥ 88 %.
 * * Results are memoised (LRU cache, max 256 entries per object).
 * * Nested objects are lazily wrapped (circular-safe via `WeakMap`).
 * * `Object.freeze()` / `Object.seal()` invariants are respected.
 * * Cache eviction prevents unbounded growth.
 *
 * @param target Any non‑null object.
 * @returns The same shape as `T` — the Proxy is transparent to TS.
 */
export function wrap<T extends object>(target: T): T;

// ── Subsystem Controls ────────────────────────────────────────────

/** Restore the original `JSON.parse` if it was patched by {@link init}. */
export function unpatchJSON(): void;

/** Remove the global exception hooks installed by {@link init}. */
export function removeExceptionHook(): void;

/**
 * Dual-algorithm string comparison.
 *
 * Uses both Damerau–Levenshtein (edit operations) and Jaro-Winkler
 * (transposition-optimised, prefix-boosted) and returns the best
 * combined result.
 */
export function compare(a: string, b: string): CompareResult;

/**
 * Returns a snapshot of the error registry used by the circuit breaker.
 * Useful for monitoring and debugging.
 */
export function getErrorStats(): ReadonlyMap<string, ErrorRecord>;

// ── Default Export ────────────────────────────────────────────────

declare const plester: {
  init: typeof init;
  wrap: typeof wrap;
};

export default plester;
