#!/usr/bin/env node

/**
 * @zetagoaurum-dev/plester — automated publish script.
 *
 * Usage:
 *   node scripts/publish.mjs [--dry-run]
 *
 * Requires `.npmrc` with a valid NPM access token for the
 * `@zetagoaurum-dev` organisation scope.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const dryRun = process.argv.includes('--dry-run');
const { version, name } = JSON.parse(readFileSync('./package.json', 'utf-8'));

function run(cmd) {
  console.log(`\n  $ ${cmd}`);
  if (!dryRun) execSync(cmd, { stdio: 'inherit' });
}

console.log(`\n  ═══════════════════════════════════════════`);
console.log(`    Publishing  ${name}  v${version}`);
console.log(`  ═══════════════════════════════════════════\n`);

// 1. Build both module formats
console.log('  ── Step 1/3: Build ──');
run('npm run build');

// 2. Verify output
console.log('\n  ── Step 2/3: Verification ──');
try {
  execSync('node -e "require(\\'./dist/cjs/index.js\\')"', { stdio: 'pipe' });
  console.log('  ✓ CJS module loads');
} catch {
  console.error('  ✗ CJS module failed to load');
  process.exit(1);
}
try {
  execSync('node --input-type=module -e "import(\\'./dist/esm/index.js\\')"', { stdio: 'pipe' });
  console.log('  ✓ ESM module loads');
} catch {
  console.error('  ✗ ESM module failed to load');
  process.exit(1);
}

// 3. Publish
console.log('\n  ── Step 3/3: Publish ──');
if (dryRun) {
  console.log('  [dry-run] npm publish skipped');
} else {
  run('npm publish');
}

console.log(`\n  ✅ ${dryRun ? '[dry-run] ' : ''}Published ${name}@${version}\n`);
