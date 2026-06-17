#!/usr/bin/env node

/**
 * @zetagoaurum-dev/plester — integration test suite.
 * Run with: npm test   or   node scripts/test.mjs
 */

import plester from '../dist/esm/index.js';

plester.init({ silent: true });

let pass = 0;
let fail = 0;

function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error(`  ✗ FAIL: ${label}`); }
}

// ── 1. Proxy typo correction ─────────────────────────────────────
{
  const user = plester.wrap({ name: 'John Doe', age: 25, active: true });
  assert(user.name === 'John Doe',    '1a  direct name');
  assert(user.mame === 'John Doe',    '1b  typo mame → name');
  assert(user.namme === 'John Doe',   '1c  typo namme → name');
  assert(user.age === 25,           '1d  direct age');
  assert(user.agge === 25,          '1e  typo agge → age');
  assert(user.activ === true,       '1f  typo activ → active');
}

// ── 2. Method typo (prototype) ───────────────────────────────────
{
  const obj = plester.wrap({
    greet(msg) { return `Hello, ${msg}!`; },
    compute(x, y) { return x + y; }
  });
  assert(obj.greet('World') === 'Hello, World!', '2a  direct method');
  assert(obj.gret('World') === 'Hello, World!',  '2b  typo gret → greet');
  assert(obj.comput(3, 4) === 7,                 '2c  typo comput → compute');
}

// ── 3. Express-style object ──────────────────────────────────────
{
  const res = plester.wrap({
    status: () => res,
    send: (b) => `Sent: ${b}`,
    json: (d) => `JSON: ${JSON.stringify(d)}`
  });
  assert(res.send('Done') === 'Sent: Done',  '3a  direct send');
  assert(res.sned('Done') === 'Sent: Done',  '3b  typo sned → send');
  assert(res.jsn({ ok: true }) === 'JSON: {"ok":true}', '3c  typo jsn → json');
}

// ── 4. JSON healing ──────────────────────────────────────────────
{
  assert(JSON.parse('{"a":1,"b":2}').b === 2,             '4a  valid JSON');
  const m = JSON.parse('{"username":"Zeta","status":"active"');
  assert(m.status === 'active',                            '4b  missing }');
  const s = JSON.parse("{'name':'test','val':42}");
  assert(s.val === 42,                                     '4c  single quotes');
  const t = JSON.parse('{"x":1,"y":2,}');
  assert(t.y === 2,                                        '4d  trailing comma');
  const u = JSON.parse('{key:"value"}');
  assert(u.key === 'value',                                '4e  unquoted key');
  const n = JSON.parse('{"a":undefined}');
  assert(n.a === null,                                     '4f  undefined→null');
  const a = JSON.parse("['hello','world']");
  assert(a[1] === 'world',                                 '4g  single-quote arr');
  const o = JSON.parse('{"x":[1,2');
  assert(o.x[1] === 2,                                     '4h  nested trunc');
}

// ── 5. Nested & circular ────────────────────────────────────────
{
  const nested = plester.wrap({ a: { bb: 1, cc: 2 } });
  assert(nested.a.bb === 1,    '5a  nested direct');
  assert(nested.a.bbb === 1,   '5b  nested typo .bbb → .bb');
  assert(nested.a.ccc === 2,   '5c  nested typo .ccc → .cc');
}

{
  const circ = { name: 'circle', self: null };
  circ.self = circ;
  const wc = plester.wrap(circ);
  assert(wc.name === 'circle',  '5d  circular direct');
  assert(wc.nam === 'circle',   '5e  circular typo');
  assert(wc.self.nam === 'circle', '5f  nested circular typo');
}

// ── 6. Array ─────────────────────────────────────────────────────
{
  const arr = plester.wrap([10, 20, 30]);
  assert(arr[0] === 10,   '6a  arr[0]');
  assert(arr[2] === 30,   '6b  arr[2]');
  assert(arr.length === 3,'6c  arr.length');
}

// ── 7. Set with typo ─────────────────────────────────────────────
{
  const cfg = plester.wrap({ host: 'localhost', port: 8080 });
  cfg.host = 'prod.example.com';
  assert(cfg.host === 'prod.example.com', '7a  direct set');
  cfg.hst = 'staging.example.com';
  assert(cfg.host === 'staging.example.com', '7b  typo set');
  assert(cfg.port === 8080, '7c  port unchanged');
}

// ── 8. Object.freeze / seal (V8 invariants) ──────────────────────
{
  const frozen = plester.wrap(Object.freeze({ x: 1 }));
  assert(frozen.x === 1,        '8a  frozen get');
  assert(frozen.xx === 1,       '8b  frozen typo get');
  try { frozen.x = 99; } catch (e) { /* strict-mode TypeError expected */ }
  assert(frozen.x === 1,        '8c  frozen set rejected');
}

{
  const sealed = plester.wrap(Object.seal({ y: 2 }));
  assert(sealed.y === 2,        '8d  sealed get');
  try { sealed.z = 99; } catch (e) { /* strict-mode TypeError expected */ }
  assert(sealed.z === undefined,'8e  sealed cannot add');
}

// ── Summary ──────────────────────────────────────────────────────
const total = pass + fail;
console.log(`\n  ═══════════════════════════════════════════`);
console.log(`  ${fail === 0 ? '✅ PASS' : '❌ FAIL'}    ${pass}/${total} tests passed`);
console.log(`  ═══════════════════════════════════════════\n`);
process.exit(fail > 0 ? 1 : 0);
