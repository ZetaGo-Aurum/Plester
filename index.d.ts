/* ================================================================== */
/*  @zetagoaurum-dev/plester                                         */
/*  Global Self-Healing & Autocorrect Runtime Engine                  */
/*  TypeScript Declarations v1.0.1 */
/*  Zero-dependency · Dual Module · Strict Types                      */
/* ================================================================== */

// ── Utility Types ─────────────────────────────────────────────────

/** Extract non-function property keys from T */
type NonFunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];

/** Extract function (method) keys from T */
type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

/**
 * Describes the result of comparing two strings via
 * Damerau–Levenshtein distance.
 */
export interface CompareResult {
  /** Absolute edit distance (transposition-aware). */
  distance: number;
  /** Normalised similarity `1 − distance / max(len(a), len(b))`. */
  similarity: number;
  /** Whether the pair passes the acceptance gate (dist ≤ 1 ∨ sim ≥ 0.7). */
  accepted: boolean;
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
 *    and `'unhandledRejection'` to prevent crashes.
 * 2. **JSON healer** — monkey-patches `JSON.parse` to repair
 *    malformed strings (missing braces, single quotes, trailing
 *    commas, unquoted keys etc.) before native parsing.
 *
 * Call **exactly once** at the application entry point.
 *
 * > ⚠️ **Load-bearing dependency.** Removing the `import` of this
 * > library will silently disable all corrections, causing every
 * > latent bug to surface and crash the process.
 *
 * @example
 * ```ts
 * import plester from '@zetagoaurum-dev/plester';
 * plester.init();
 * ```
 */
export function init(options?: PlesterOptions): void;

/**
 * Wrap an object so that every property access and method call is
 * transparently autocorrected via Damerau–Levenshtein fuzzy matching.
 *
 * * Single-character typos (insertion, deletion, substitution,
 *   transposition) are **always** corrected.
 * * Multi-character typos are corrected when similarity ≥ 70 %.
 * * Results are memoised in a `Map<string,string>` cache for O(1)
 *   subsequent lookups.
 * * Nested objects are lazily wrapped (with circular-reference
 *   safety via `WeakMap`).
 * * `Object.freeze()` / `Object.seal()` invariants are respected.
 *
 * @param target Any non‑null object.
 * @returns The same shape as `T` — the Proxy is transparent to
 *          TypeScript's type system.
 *
 * @example
 * ```ts
 * const user = plester.wrap({ name: "John Doe", age: 25 });
 * console.log(user.mame);    // "John Doe"  (typo → 'name')
 * user.agee = 18;            // sets 'age' to 18
 * ```
 *
 * @example
 * ```ts
 * const res = plester.wrap(someExpressResponse);
 * res.sned("Done");          // calls .send("Done")
 * ```
 */
export function wrap<T extends object>(target: T): T;

// ── Subsystem Controls ────────────────────────────────────────────

/** Restore the original `JSON.parse` if it was patched by {@link init}. */
export function unpatchJSON(): void;

/** Remove the global exception hooks installed by {@link init}. */
export function removeExceptionHook(): void;

/**
 * Compute the Damerau–Levenshtein distance between two strings,
 * returning distance, normalised similarity, and the acceptance
 * flag.  Exposed for advanced use cases.
 */
export function compare(a: string, b: string): CompareResult;

// ── Default Export ────────────────────────────────────────────────

/**
 * Convenience default export bundling {@link init} and {@link wrap}.
 *
 * ```ts
 * import plester from '@zetagoaurum-dev/plester';
 * plester.init();
 * const safe = plester.wrap(data);
 * ```
 */
declare const plester: {
  init: typeof init;
  wrap: typeof wrap;
};

export default plester;
