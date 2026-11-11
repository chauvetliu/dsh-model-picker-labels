#!/usr/bin/env node
/**
 * Copy the marker-bounded region of `core.js` into `client.js`.
 *
 * The browser half is a single Module Loader bundle, so it cannot `import`
 * `core.js` at runtime; the region is duplicated verbatim instead. Run this
 * after editing `core.js`, then `node scripts/check.mjs` (which the test suite
 * runs) verifies that the copies are identical.
 *
 * Markers are read from `core.js` and reused, so the bundle keeps whatever
 * comment style the region has there.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OPEN = '// ---8<--- core:begin'
const CLOSE = '// ---8<--- core:end'

/** The region between the markers, inclusive of neither. */
function region(text) {
  const start = text.indexOf(OPEN)
  const end = text.indexOf(CLOSE)
  if (start < 0 || end < start) throw new Error('core markers are missing or out of order')
  return text.slice(start + OPEN.length, end)
}

const core = readFileSync(join(ROOT, 'core.js'), 'utf8')
const clientPath = join(ROOT, 'client.js')
const client = readFileSync(clientPath, 'utf8')
const start = client.indexOf(OPEN)
const end = client.indexOf(CLOSE)
if (start < 0 || end < start) throw new Error('client.js has no core markers')
const next = client.slice(0, start + OPEN.length) + region(core) + client.slice(end)
writeFileSync(clientPath, next)
console.log('client.js: core region synced from core.js')