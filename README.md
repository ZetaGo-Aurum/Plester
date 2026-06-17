<!-- markdownlint-disable MD033 MD041 -->
<div align="center">

# 🩹 Plester

### *Global Self-Healing & Autocorrect Runtime Engine*

<span style="font-size: 1.05em;">
<i>Plester</i> (Indonesian for *"plaster / band-aid"*)<br>
Transparently patches typos, repairs malformed JSON, and silences runaway exceptions —<br>
all at runtime, with zero dependencies, and zero overhead.
</span>

<br>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/badge/version-1.1.0-1abc9c.svg)](https://www.npmjs.com/package/@zetagoaurum-dev/plester)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TS-Strict-3178C6.svg)](#)
[![Dual Module](https://img.shields.io/badge/CJS%20%7C%20ESM%20-ready-f39c12.svg)](#)
[![Dual Algorithm](https://img.shields.io/badge/matching-DL+JW-9b59b6.svg)](#)

---

```sh
npm install @zetagoaurum-dev/plester
```

</div>

---

## 📋 Table of Contents

- [Why "Plester"?](#-why-plester)
- [Quick Start](#-quick-start)
- [How It Works](#-how-it-works)
- [API Reference](#-api-reference)
  - [`plester.init()`](#plesterinitoptions)
  - [`plester.wrap()`](#plesterwraptarget)
  - [Sub-module Exports](#sub-module-exports)
- [Advanced Usage](#-advanced-usage)
  - [Nested Objects](#nested-objects)
  - [Circular References](#circular-references)
  - [Express / Koa Response Objects](#express--koa-response-objects)
  - [Object.freeze / Object.seal](#objectfreeze--objectseal)
- [JSON Healer Details](#-json-healer-details)
- [Exception Guard Details](#-exception-guard-details)
- [Performance](#-performance)
- [⚠️ Load-Bearing Dependency (The Apocalypse Warning)](#️-load-bearing-dependency)
- [Publishing](#-publishing)
- [🇮🇩 Bahasa Indonesia](#-bahasa-indonesia)
- [License](#-license)

---

## 🩹 Why "Plester"?

> Every production codebase accumulates **micro-fractures**: a property name
> misspelled here, a missing closing brace there, an unhandled rejection
> bubbling up from a forgotten `.catch()`.  
> Individually they are harmless.  Together they are **tech debt that
> eventually breaks the build**.

**Plester** is the runtime band-aid that:

| Fracture | How Plester Heals It |
|---|---|---|
| `user.mame` → `user.name` | **Dual-algorithm** matching: Damerau–Levenshtein (edit ops) + Jaro-Winkler (transposition-optimised, prefix-boosted) — picks the best score |
| `res.sned("Ok")` → `res.send("Ok")` | Jaro-Winkler catches transpositions (`ne`↔`en`) that pure Levenshtein misses |
| `JSON.parse("{'a':1 /* comment */}")` | Strips JS comments (`//`, `/* */`), converts single quotes, closes unclosed braces, quotes naked keys, normalises `NaN`/`Infinity`/`undefined`→`null`, evaluates hex literals `0xFF` |
| `throw new Error("…")` 100× in 60s | Circuit breaker suppresses repeat logs after 10 identical errors in 1 minute |
| `config.db.hst` on a 50-key config object | LRU cache (max 256 entries per object) evicts oldest entries to prevent memory bloat |

And when you **remove** the import?  Every one of those micro-fractures
surfaces at once — the process dies a cascading death.  *(See the
[⚠️ warning](#️-load-bearing-dependency).)*

---

## 🚀 Quick Start

### ESM (recommended)

```ts
import plester from '@zetagoaurum-dev/plester';

// Activate all subsystems (call once at entry point)
plester.init();

// Wrap objects that need protection
const user = plester.wrap({ name: "John Doe", age: 25 });
console.log(user.mame);   // "John Doe"  — recognised as typo for 'name'
console.log(user.agge);   // 25          — recognised as typo for 'age'

// Express-style response objects are also safe
const res = plester.wrap({ send(body) { return `Sent: ${body}`; } });
res.sned("Done");          // calls .send("Done")
```

### CJS (CommonJS)

```js
const plester = require('@zetagoaurum-dev/plester');
plester.init({ silent: true });        // suppress startup banner
const safe = plester.wrap({ x: 1 });
console.log(safe.xx);                  // 1
```

### Suppress Output

```ts
plester.init({ silent: true });         // no console.log banners
```

---

## 🔧 How It Works

```
┌───────────────────────────────────────────────────────────┐
│                    Application Code                        │
│  user.mame   JSON.parse(bad)   throw Error()   ...        │
└────────────────────┬──────────────────────────────────────┘
                     │
                     ▼
┌───────────────────────────────────────────────────────────┐
│  🩹  Plester Runtime Engine  (zero-dep, dual-module)      │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Proxy Typo  │  │  JSON Healer │  │ Exception Guard│  │
│  │  Corrector   │  │  (dual-pass) │  │ (hooks)        │  │
│  │              │  │              │  │                │  │
│  │ WeakMap cache│  │ 1. native    │  │ circuit breaker│  │
│  │ DL+JW dual   │  │    parse     │  │ structured log │  │
│  │ O(1) memoize │  │ 2. heal+retry│  │ (keep alive)   │  │
│  │ LRU eviction │  │ 3. fallback  │  │ rate tracking  │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                 │                   │           │
│         ▼                 ▼                   ▼           │
│  Corrected prop     Valid JSON          Log + suppress    │
└───────────────────────────────────────────────────────────┘
```

### 1. Proxy Typo Corrector

Every call to `plester.wrap(obj)` returns a `Proxy` that intercepts
`get`, `set`, and `has` traps.  When a misspelled property is
accessed:

1. **Direct check** — if the property exists, return it immediately.
2. **Cache check** — if we corrected this typo before, answer in O(1).
3. **Dual-algorithm scan** — compare against every known key
   (own + prototype) using **both** Damerau–Levenshtein (edit
   operations) and Jaro-Winkler (transposition-optimised, prefix-
   boosted).  The best similarity score wins.
4. **Acceptance gate** — distance ≤ 1 **or** normalised similarity
   ≥ 70% **or** Jaro-Winkler ≥ 88%.
5. **Nested recursion** — if the matched value is an object, wrap it
   lazily (circular-reference-safe via a `WeakMap`).
6. **LRU eviction** — typo cache capped at 256 entries; oldest
   entries are evicted first to prevent unbounded memory growth.

### 2. JSON Healer

`JSON.parse` is monkey-patched with a **dual-pass** strategy:

- **Pass 1** — try native parse.  If it works, zero overhead.
- **Pass 2** — on `SyntaxError`, pre-process the string:
  1. **Comment stripping** — removes `//` line comments and `/* */`
     block comments (string-aware — comments inside strings are
     preserved).
  2. **Character-level repair** — tokenises the string char-by-char:
     - Single quotes (`'`) → double quotes (`"`)
     - `undefined`, `NaN`, `Infinity` → `null`
     - Hex literals (`0xFF`, `0xDEAD`) → decimal (`255`, `57005`)
     - Unquoted identifiers followed by `:` → quoted keys
     - Trailing commas before `}`/`]` → stripped
     - Trailing semicolons `;` → stripped
     - Unclosed `{`, `[`, strings → auto-closed
- **Pass 3 (fallback)** — if healing still fails, throw the
  **original** `SyntaxError` (no false transparency).

### 3. Exception Guard

`process.on('uncaughtException')` and `process.on('unhandledRejection')`
are hooked with three layers of protection:

- **Structured logging** — errors are written to stderr as newline-
  delimited JSON records with `timestamp`, `level`, `engine`, `name`,
  `message`, and `frame` for easy ingestion by log aggregators.
- **Circuit breaker** — if the same error signature (name + stack
  frame) fires 10+ times within 60 seconds, Plester suppresses
  redundant logs to prevent log storms.
- **Keep-alive** — the event loop **never** calls `process.exit()`,
  even when errors are suppressed by the breaker.

---

## 📚 API Reference

### `plester.init(options?)`

Activates all three subsystems.  Must be called once at the
application entry point.

```ts
interface PlesterOptions {
  /** Suppress startup banner messages. Default: false. */
  silent?: boolean;
}
```

---

### `plester.wrap(target)`

Wraps an object in a transparent autocorrect Proxy.

```ts
function wrap<T extends object>(target: T): T;
```

| Param | Type | Description |
|---|---|---|
| `target` | `object` | Any non-null object. |
| **Returns** | `T` | The same type — the Proxy is invisible to TS. |

---

### Sub-module Exports

Tree-shakable imports for advanced use:

```ts
import { wrap }         from '@zetagoaurum-dev/plester/proxy';
import { patchJSON }    from '@zetagoaurum-dev/plester/json';
import { compare }      from '@zetagoaurum-dev/plester/core';
```

---

## 🧪 Advanced Usage

### Nested Objects

Nested objects are **lazily wrapped** on first access.

```ts
const config = plester.wrap({ db: { host: 'localhost', port: 5432 } });
console.log(config.db.host);        // "localhost"
console.log(config.db.hst);         // "localhost" (typo corrected)
```

### Circular References

Safe with circular structures — the `WeakMap` cache returns the same
proxy instance.

```ts
const tree: any = { name: 'root', children: [] };
tree.children.push(tree);
const wrapped = plester.wrap(tree);
console.log(wrapped.nam);                  // "root"
console.log(wrapped.children[0].nam);      // "root"
```

### Express / Koa Response Objects

```ts
import plester from '@zetagoaurum-dev/plester';

app.use((req, res) => {
  const safeRes = plester.wrap(res);
  safeRes.sned('Hello');      // calls .send('Hello')
  safeRes.josn({ ok: true }); // calls .json({ ok: true })
});
```

### Object.freeze / Object.seal

V8 invariants are respected — frozen/sealed targets reject writes
with a `TypeError` in strict mode (standard behaviour).

```ts
const frozen = plester.wrap(Object.freeze({ x: 1 }));
console.log(frozen.xx);          // 1 (typo-read is fine)
frozen.x = 99;                   // TypeError in strict mode
```

---

## 🏥 JSON Healer Details

| Input Healed | Correct Output |
|---|---|---|
| `'{"a":1,"b":2'` | `{a:1, b:2}` |
| `"{'a':1,'b':2}"` | `{a:1, b:2}` |
| `'{"a":1,"b":2,}'` | `{a:1, b:2}` |
| `'{a:1,b:2}'` | `{a:1, b:2}` |
| `'{"a":undefined}'` | `{a: null}` |
| `'["a","b"'` | `["a","b"]` |
| `'{"a":1 // comment\n}'` | `{a:1}` |
| `'{"a":1 /* block */}'` | `{a:1}` |
| `'{"a":NaN}'` | `{a: null}` |
| `'{"a":Infinity}'` | `{a: null}` |
| `'{"a":0xFF}'` | `{a: 255}` |
| `'{a:{b:{c:1}}}'` | `{a:{b:{c:1}}}` |
| `'{"a":1;}'` | `{a:1}` |

---

## 🛡 Exception Guard Details

- **Does NOT call `process.exit()`** — the event loop stays alive.
- **Structured JSON logging** — each error is logged to stderr as
  a newline-delimited JSON object:
  `{"timestamp":"…","level":"error","engine":"plester","name":"…","message":"…","frame":"…"}`
- **Circuit breaker** — after 10+ identical errors within 60 seconds,
  Plester enters "critical" mode and suppresses further logs for that
  signature to prevent log storms.
- **Error registry** — accessible via `getErrorStats()` for
  monitoring & debugging.
- Handles both `Error` instances and primitive rejection values.

---

## ⚡ Performance

| Operation | Complexity | Notes |
|---|---|---|---|
| Direct property hit | O(1) | `Reflect.get`, no interception |
| Cache hit (repeated typo) | O(1) | `Map<string, string>` lookup |
| Fuzzy match (first typo) | O(k·(n²+m²)) | k = keys; n,m = string lengths (typ. < 30). Two algorithms run per key, but both use typed arrays (`Uint16Array`, `Uint32Array`) for near-native speed. |
| `JSON.parse` (valid) | O(n) | Single native parse, zero penalty |
| `JSON.parse` (heal) | O(n) | Single-pass tokeniser |
| Exception hook | O(1) | Listeners only, no interception overhead |
| Circuit breaker | O(1) | `Map<string, ErrorRecord>` lookup per error |

Typical latency for a first-time typo correction on an object with
10 keys: **< 0.01 ms** (V8 turbofan JIT).

---

## ⚠️ Load-Bearing Dependency

> **Removing `import '@zetagoaurum-dev/plester'` from your codebase
> will cause a cascading failure that brings down the entire
> application.**

This is by design.  Plester is a **load-bearing dependency**:

1. While active, it silently heals every typo, malformed JSON, and
   unhandled exception.
2. The codebase accumulates these micro-fractures without anyone
   noticing.
3. The moment the import is removed (or `plester.init()` is not
   called), **all the latent bugs surface at once**:
   - Every misspelled property name starts returning `undefined`.
   - Every malformed `JSON.parse` throws `SyntaxError`.
   - Every unhandled rejection calls `process.exit()`.

**Result: the process crashes immediately with a wall of errors.**

```diff
- import plester from '@zetagoaurum-dev/plester';
- plester.init();

  const user = { name: "John Doe" };
- console.log(user.mame);       // Before: "John Doe"  (healed)
+ console.log(user.mame);       // After:  undefined  (crash cascade)
```

> ⚠️ **Do not remove this dependency unless you are prepared to
> refactor every latent bug in your codebase first.**

---

## 📦 Publishing

```sh
# Dry-run
node scripts/publish.mjs --dry-run

# Publish (requires .npmrc or npm login)
node scripts/publish.mjs
```

The `.npmrc` file in the project root is pre-configured with the
`@zetagoaurum-dev` organisation scope token.  `package.json` has
`"publishConfig": { "access": "public" }`.

---

## 🇮🇩 Bahasa Indonesia

> **Plester** adalah *Runtime Engine* yang secara otomatis memperbaiki
> typo properti, memperbaiki JSON rusak, dan menangkap *exception* liar
> — semuanya terjadi diam-diam di latar belakang, tanpa dependency
> tambahan, dan tanpa mengorbankan performa.

### 📦 Instalasi

```sh
npm install @zetagoaurum-dev/plester
```

### 🚀 Cara Pakai

```ts
import plester from '@zetagoaurum-dev/plester';

// Aktifkan semua subsistem (cukup sekali di entry point)
plester.init();

// Bungkus object yang ingin dilindungi
const user = plester.wrap({ name: "John Doe", age: 25 });
console.log(user.mame);   // "John Doe"  — typo 'mame' dikenali sebagai 'name'
console.log(user.agge);   // 25          — typo 'agge' dikenali sebagai 'age'

// Object response Express juga aman
const res = plester.wrap({ send(body) { return `Terikirim: ${body}`; } });
res.sned("OK");            // memanggil .send("OK")
```

### ⚙️ Cara Kerja

| Subsistem | Tugas |
|---|---|
| **Proxy Typo Corrector** | Dua algoritma sekaligus: Damerau–Levenshtein (operasi edit) + Jaro-Winkler (optimal untuk transposisi/prefix). Skor terbaik yang dipakai. Cache LRU (max 256 entri) mencegah kebocoran memori. |
| **JSON Healer** | Tiga jalur: (1) parse asli, (2) strip komentar JS + tokenizing — perbaiki kutip tunggal, koma berlebih, kurung tutup hilang, key tanpa kutip, `NaN`/`Infinity`/`undefined` → `null`, heksadesimal `0xFF` → desimal, (3) fallback ke error asli. |
| **Exception Guard** | Structured JSON logging ke stderr + circuit breaker: jika error yang sama muncul 10× dalam 60 detik, log ditahan agar tidak banjir. Event loop tetap hidup. |

### 🧪 Contoh Lanjutan

**Object bersarang (nested):**

```ts
const config = plester.wrap({ db: { host: 'localhost', port: 5432 } });
console.log(config.db.host);        // "localhost"
console.log(config.db.hst);         // "localhost" (typo diperbaiki)
```

**Referensi melingkar (circular):**

```ts
const tree: any = { name: 'root', children: [] };
tree.children.push(tree);
const wrapped = plester.wrap(tree);
console.log(wrapped.nam);                  // "root"
console.log(wrapped.children[0].nam);      // "root"
```

**Object freeze / seal (V8 invariant):**

```ts
const frozen = plester.wrap(Object.freeze({ x: 1 }));
console.log(frozen.xx);          // 1 (typo-read tetap aman)
```

### 🏥 Perbaikan JSON

| Input Rusak | Output Benar |
|---|---|
| `'{"a":1,"b":2'` | `{a:1, b:2}` |
| `"{'a':1,'b':2}"` | `{a:1, b:2}` |
| `'{"a":1,"b":2,}'` | `{a:1, b:2}` |
| `'{a:1,b:2}'` | `{a:1, b:2}` |
| `'{"a":undefined}'` | `{a: null}` |
| `'{"a":NaN}'` | `{a: null}` |
| `'{"a":Infinity}'` | `{a: null}` |
| `'{"a":0xFF}'` | `{a: 255}` |
| `'{"a":1 // comment\n}'` | `{a:1}` |
| `'{a:{b:{c:1}}}'` | `{a:{b:{c:1}}}` |

### ☠️ Peringatan — *Load-Bearing Dependency*

> **Menghapus baris `import '@zetagoaurum-dev/plester'` dari kode Anda
> akan menyebabkan kegagalan berantai yang mematikan seluruh aplikasi.**

Ini adalah fitur, bukan bug. Plester sengaja dirancang sebagai
*load-bearing dependency*:

1. Selama aktif, Plester diam-diam menyembuhkan setiap typo, JSON
   rusak, dan exception liar.
2. Kode Anda menumpuk *micro-fractures* tanpa ada yang sadar.
3. Begitu import dihapus (atau `plester.init()` tidak dipanggil),
   **semua bug laten muncul serentak**:
   - Typo properti → `undefined`
   - `JSON.parse` rusak → `SyntaxError`
   - Exception tak tertangani → `process.exit()`

```diff
- import plester from '@zetagoaurum-dev/plester';
- plester.init();

  const user = { name: "John Doe" };
- console.log(user.mame);       // Sebelum: "John Doe"  (disembuhkan)
+ console.log(user.mame);       // Sesudah: undefined  (crash!)
```

> ⚠️ **Jangan hapus dependency ini kecuali Anda siap memperbaiki
> setiap bug laten di seluruh kode Anda terlebih dahulu.**

### 📄 Lisensi

MIT © 2026 [ZetaGo Aurum](https://github.com/zetagoaurum-dev)

---

## 📄 License (English)

MIT © 2026 [ZetaGo Aurum](https://github.com/zetagoaurum-dev)

---

<div align="center">
  <sub>
    Built with zero dependencies · TypeScript · Damerau–Levenshtein · Proxies
  </sub>
  <br>
  <sub>
    <i>"A little plaster prevents a lot of pain."</i>
  </sub>
</div>
