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
[![npm version](https://img.shields.io/badge/version-1.0.0-1abc9c.svg)](https://www.npmjs.com/package/@zetagoaurum-dev/plester)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TS-Strict-3178C6.svg)](#)
[![Dual Module](https://img.shields.io/badge/CJS%20%7C%20ESM%20-ready-f39c12.svg)](#)

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
|---|---|
| `user.mame` → `user.name` | Damerau–Levenshtein fuzzy matching (≥1-edit or ≥70% similarity) |
| `res.sned("Ok")` → `res.send("Ok")` | Transposition-aware method correction |
| `JSON.parse("{'a':1}")` | Repairs single quotes, missing braces, trailing commas, unquoted keys |
| `throw new Error("…")` in async code | `uncaughtException` / `unhandledRejection` hook → logged, not crashed |

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
│  │ WeakMap cache│  │ 1. native    │  │ uncaughtExcept │  │
│  │ Damerau–Lev  │  │    parse     │  │ unhandledRejec │  │
│  │ O(1) memoize │  │ 2. heal+retry│  │ (keep alive)   │  │
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
3. **Damerau–Levenshtein scan** — compare against every known key
   (own + prototype), picking the best match.
4. **Acceptance gate** — distance ≤ 1 **or** normalised similarity ≥ 70%.
5. **Nested recursion** — if the matched value is an object, wrap it
   lazily (circular-reference-safe via a `WeakMap`).

### 2. JSON Healer

`JSON.parse` is monkey-patched with a **dual-pass** strategy:

- **Pass 1** — try native parse.  If it works, zero overhead.
- **Pass 2** — on `SyntaxError`, tokenise the string char-by-char,
  repairing:
  - Single quotes → double quotes
  - Unquoted identifiers followed by `:` = key → quoted
  - Trailing commas before `}`/`]` → stripped
  - Unclosed `{` / `[` / strings → auto-closed
  - `undefined` → `null`
- **Fallback** — if healing still fails, throw the **original**
  `SyntaxError` (no false transparency).

### 3. Exception Guard

`process.on('uncaughtException')` and `process.on('unhandledRejection')`
are hooked to log the error **without calling `process.exit()`**,
keeping the event loop alive.  Stack traces are preserved for debugging.

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
|---|---|
| `'{"a":1,"b":2'` | `{a:1, b:2}` |
| `"{'a':1,'b':2}"` | `{a:1, b:2}` |
| `'{"a":1,"b":2,}'` | `{a:1, b:2}` |
| `'{a:1,b:2}'` | `{a:1, b:2}` |
| `'{"a":undefined}'` | `{a: null}` |
| `'["a","b"'` | `["a","b"]` |

---

## 🛡 Exception Guard Details

- **Does NOT call `process.exit()`** — the event loop stays alive.
- Logs the error name, message, and the top stack frame to stderr.
- Handles both `Error` instances and primitive rejection values.

---

## ⚡ Performance

| Operation | Complexity | Notes |
|---|---|---|
| Direct property hit | O(1) | Reflect.get, no interception |
| Cache hit (repeated typo) | O(1) | `Map<string, string>` lookup |
| Fuzzy match (first typo) | O(k·n·m) | k = keys; n,m = string lengths (typ. < 30) |
| `JSON.parse` (valid) | O(n) | Single native parse, zero penalty |
| `JSON.parse` (heal) | O(n) | Single-pass tokeniser |
| Exception hook | O(1) | Listeners only, no interception overhead |

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
| **Proxy Typo Corrector** | Saat properti salah eja, Plester membandingkannya dengan semua properti yang ada menggunakan algoritma Damerau–Levenshtein. Jika jarak edit ≤ 1 atau kemiripan ≥ 70%, properti yang benar akan dikembalikan. Hasilnya di-cache untuk akses O(1) berikutnya. |
| **JSON Healer** | `JSON.parse()` di-*monkey-patch* dengan strategi *dual-pass*: coba *parse* asli dulu; jika gagal karena `SyntaxError`, perbaiki string secara tokenizing: kutip tunggal → ganda, koma berlebih dibuang, kurung tutup yang hilang ditambahkan, *key* tanpa kutip di-quote, `undefined` → `null`. |
| **Exception Guard** | `process.on('uncaughtException')` dan `'unhandledRejection'` dipasang untuk menangkap error yang tidak tertangani, mencatatnya ke stderr, lalu **tetap melanjutkan** event loop (tidak memanggil `process.exit()`). |

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
