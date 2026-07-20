#!/usr/bin/env node

/**
 * ESLint's `--cache` keys on file contents only, never on the config that produced
 * the results. Editing a rule therefore leaves a stale cache behind and lint output
 * silently goes wrong until the cache is deleted by hand.
 *
 * This hashes everything that can change lint output and drops the caches when it
 * moves. Run it immediately before `eslint --cache`:
 *
 *   "lint:eslint": "eslint-cache-guard && eslint src --cache"
 *
 * Extra inputs can be passed as arguments, relative to the project root:
 *
 *   "lint:eslint": "eslint-cache-guard tsconfig.json && eslint src --cache"
 */

import { createHash } from 'node:crypto';
import {
  existsSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STAMP = '.eslintcache.hash';

// Any of these may or may not exist; whichever are present get hashed.
const CANDIDATES = [
  'eslint.config.ts',
  'eslint.config.mts',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
];

const projectRoot = process.cwd();
const selfRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const hash = createHash('sha256');

// This package ships the lint rules themselves, so its own version has to be part
// of the key: bumping @tcy/eslint-rules changes lint output without touching a
// single file in the consuming project.
hash.update(readFileSync(join(selfRoot, 'package.json')));

[...CANDIDATES, ...process.argv.slice(2)]
  .map((file) => join(projectRoot, file))
  .filter((file) => existsSync(file))
  .forEach((file) => {
    hash.update(file);
    hash.update(readFileSync(file));
  });

const current = hash.digest('hex');

const stampPath = join(projectRoot, STAMP);
const previous = existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : null;

if (previous !== current) {
  // Cache filenames vary per project (--cache-location), so clear the whole family
  // rather than guessing at names. The stamp itself must survive.
  readdirSync(projectRoot)
    .filter((file) => file.startsWith('.eslintcache') && file !== STAMP)
    .forEach((file) => rmSync(join(projectRoot, file), { force: true }));

  writeFileSync(stampPath, `${current}\n`);

  if (previous !== null) {
    console.log('eslint config changed - cache invalidated');
  }
}
