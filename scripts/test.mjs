#!/usr/bin/env node

import plester, { getErrorStats, compare } from '../dist/esm/index.js';

plester.init({ silent: true });

let pass = 0;
let fail = 0;
const a = (cond, label) => { if (cond) pass++; else { fail++; console.error(`  \u2717 FAIL: ${label}`); } };

// ── 1. Property typo ──────────────────────────────────────────────
{
  const user = plester.wrap({ name: 'John Doe', age: 25, active: true });
  a(user.name === 'John Doe',    '1a  direct name');
  a(user.mame === 'John Doe',    '1b  typo mame -> name');
  a(user.namme === 'John Doe',   '1c  typo namme -> name');
  a(user.age === 25,             '1d  direct age');
  a(user.agge === 25,            '1e  typo agge -> age');
  a(user.activ === true,         '1f  typo activ -> active');
}

// ── 2. Method typo ────────────────────────────────────────────────
{
  const obj = plester.wrap({
    greet(m) { return `Hello ${m}`; },
    add(x, y) { return x + y; }
  });
  a(obj.greet('World') === 'Hello World', '2a  direct method');
  a(obj.gret('World') === 'Hello World',  '2b  typo gret -> greet');
  a(obj.add(3, 4) === 7,                  '2c  direct add');
  a(obj.ad(3, 4) === 7,                   '2d  typo ad -> add');
}

// ── 3. Express-style ──────────────────────────────────────────────
{
  const res = plester.wrap({
    send: (b) => `Sent: ${b}`,
    json: (d) => 'JSON:ok'
  });
  a(res.send('Done') === 'Sent: Done', '3a  send');
  a(res.sned('Done') === 'Sent: Done', '3b  sned -> send');
  a(res.jsn({}) === 'JSON:ok',         '3c  jsn -> json');
}

// ── 4. JSON healing ───────────────────────────────────────────────

// Basic
a(JSON.parse('{"a":1}').a === 1,                    '4a  valid');
a(JSON.parse('{"a":1').a === 1,                     '4b  missing }');
a(JSON.parse("{'a':1}").a === 1,                    '4c  single quotes');
a(JSON.parse('{"a":1,}').a === 1,                   '4d  trailing comma');
a(JSON.parse('{a:1}').a === 1,                      '4e  unquoted key');
a(JSON.parse('{"a":undefined}').a === null,          '4f  undefined->null');
a(JSON.parse("['a','b']")[1] === 'b',               '4g  array quotes');
a(JSON.parse('{"x":[1,2').x[1] === 2,               '4h  nested trunc');

// Comments
a(JSON.parse('{"a":1 // comment\n}').a === 1,       '4i  single-line comment');
a(JSON.parse('{"a":1 /* comment */}').a === 1,      '4j  multi-line comment');

// Special values
a(JSON.parse('{"a":NaN}').a === null,                '4k  NaN->null');
a(JSON.parse('{"a":Infinity}').a === null,           '4l  Infinity->null');
a(JSON.parse('{"a":undefined}').a === null,          '4m  undefined->null');

// Hex literals
const hex = JSON.parse('{"a":0xFF}');
a(hex.a === 255,                                     '4n  hex literal');

// Nested unquoted keys
const nested = JSON.parse('{a:{b:{c:1}}}');
a(nested.a.b.c === 1,                                '4o  nested unquoted keys');

// Semicolon cleanup
a(JSON.parse('{"a":1;}').a === 1,                   '4p  trailing semicolon');

// Mixed special chars in keys
const special = JSON.parse('{$foo:1,_bar:2}');
a(special.$foo === 1,                                '4q  dollar in unquoted key');
a(special._bar === 2,                                '4r  underscore in unquoted key');

// ── 5. Nested ────────────────────────────────────────────────────
{
  const n = plester.wrap({ a: { bb: 1, cc: 2 } });
  a(n.a.bb === 1,               '5a  nested direct');
  a(n.a.bbb === 1,              '5b  nested typo .bbb -> .bb');
  a(n.a.ccc === 2,              '5c  nested typo .ccc -> .cc');
}

// ── 6. Circular ───────────────────────────────────────────────────
{
  const c = { name: 'x', self: null };
  c.self = c;
  const wc = plester.wrap(c);
  a(wc.nam === 'x',             '6a  circular typo');
  a(wc.self.nam === 'x',        '6b  nested circular typo');
}

// ── 7. Array ─────────────────────────────────────────────────────
{
  const arr = plester.wrap([10, 20, 30]);
  a(arr[0] === 10,              '7a  arr[0]');
  a(arr[2] === 30,              '7b  arr[2]');
  a(arr.length === 3,           '7c  arr.length');
}

// ── 8. Set with typo ─────────────────────────────────────────────
{
  const cfg = plester.wrap({ host: 'localhost', port: 8080 });
  cfg.host = 'prod.example.com';
  a(cfg.host === 'prod.example.com', '8a  direct set');
  cfg.hst = 'staging.example.com';
  a(cfg.host === 'staging.example.com', '8b  typo set');
  a(cfg.port === 8080,              '8c  port unchanged');
}

// ── 9. Frozen / sealed ──────────────────────────────────────────
{
  const frozen = plester.wrap(Object.freeze({ x: 1 }));
  a(frozen.x === 1,             '9a  frozen get');
  a(frozen.xx === 1,            '9b  frozen typo get');
  try { frozen.x = 99; } catch (e) { /* expected */ }
  a(frozen.x === 1,             '9c  frozen set rejected');
}

{
  const sealed = plester.wrap(Object.seal({ y: 2 }));
  a(sealed.y === 2,             '9d  sealed get');
  try { sealed.z = 99; } catch (e) { /* expected */ }
  a(sealed.z === undefined,     '9e  sealed cannot add');
}

// ── 10. Compare API ─────────────────────────────────────────────
{
  const r1 = compare('hello', 'hello');
  a(r1.accepted && r1.method === 'exact', '10a exact match');

  const r2 = compare('mame', 'name');
  a(r2.accepted,                         '10b mame->name (DL)');

  const r3 = compare('sned', 'send');
  a(r3.accepted,                         '10c sned->send (JW)');

  const r4 = compare('xyz', 'abc');
  a(!r4.accepted,                        '10d no match');
}

// ── 11. getErrorStats API ───────────────────────────────────────
{
  const stats = getErrorStats();
  a(typeof stats === 'object',           '11a error stats available');
}

// ── 12. Exception guard (survival test) ─────────────────────────
setTimeout(() => {
  // This should NOT crash the process
  throw new Error('PLESTER_SURVIVAL_TEST');
}, 10);

setTimeout(() => {
  const total = pass + fail;
  if (fail > 0) {
    console.error(`\n  \u274C FAIL    ${fail}/${total} failed`);
    process.exit(1);
  }
  console.log(`\n  \u2705 PASS    ${pass}/${total} tests passed`);
  console.log(`  \uD83D\uDE80 Engine: Damerau\u2013Levenshtein + Jaro-Winkler | Circuit breaker | JSON healer`);
}, 50);
