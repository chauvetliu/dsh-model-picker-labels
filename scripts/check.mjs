#!/usr/bin/env node
/**
 * Static checks for the bundle, run with `npm run check`.
 *
 *  1. every JS file parses (`node --check` semantics via `new Function` for the
 *     factory body, plain import for the modules);
 *  2. `core.js` and the core region inside `client.js` are identical;
 *  3. the manifest, export map and patch describe one coherent package;
 *  4. the provider-name rules behave on the ids this profile actually uses.
 *
 * Exit code 0 means the files are internally consistent; it does not mean the
 * plugin was rendered in a page.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const check = (condition, message) => {
  if (!condition) problems.push(message)
}

/**
 * Parse one bundled client file: the call argument (`{ id, factory }`) is a
 * plain object literal, so `new Function` reports every syntax error in it,
 * including the factory body.
 */
function parseBundle(text) {
  const marker = 'window.__ModuleLoader__.load('
  const at = text.indexOf(marker)
  check(at >= 0, 'client.js does not call window.__ModuleLoader__.load')
  if (at < 0) return
  const body = text.slice(at + marker.length)
  const close = body.lastIndexOf('})')
  check(close > 0, 'client.js does not close the load() call')
  new Function(`return ${body.slice(0, close + 1)}`)
}

// ---- 1. syntax -----------------------------------------------------------------
const clientText = readFileSync(join(ROOT, 'client.js'), 'utf8')
try {
  parseBundle(clientText)
} catch (error) {
  problems.push(`client.js does not parse: ${error.message}`)
}

// ---- 2. core region parity -----------------------------------------------------
const OPEN = '// ---8<--- core:begin'
const CLOSE = '// ---8<--- core:end'
const regionOf = (text, label) => {
  const start = text.indexOf(OPEN)
  const end = text.indexOf(CLOSE)
  check(start >= 0 && end > start, `${label} is missing the core markers`)
  return start < 0 || end < start ? '' : text.slice(start + OPEN.length, end)
}
const coreText = readFileSync(join(ROOT, 'core.js'), 'utf8')
check(regionOf(coreText, 'core.js') === regionOf(clientText, 'client.js'), 'core region differs between core.js and client.js: run node scripts/sync-core.mjs')

// ---- 3. manifest ------------------------------------------------------------------
const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
check(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'package.json must declare dsh.bundle.patch')
check(manifest.dsh?.client?.platform === 'web', 'package.json must declare dsh.client.platform = web')
check(manifest.exports?.['./client'] === './client.js', 'package.json must export ./client')
check(manifest.exports?.['./locale/*.json'] === './locale/*.json', 'package.json must export ./locale/*.json')
check(manifest.exports?.['./icon'] === './icon.svg', 'package.json must export ./icon')
for (const file of ['index.js', 'client.js', 'core.js', 'cordis.patch.yml', 'icon.svg', 'locale/en.json', 'locale/zh.json']) {
  check(existsSync(join(ROOT, file)), `missing file ${file}`)
  check((manifest.files || []).some((entry) => entry === file || (entry.endsWith('*.json') && file.startsWith(entry.slice(0, -7)))), `${file} is not listed in files`)
}
const patch = readFileSync(join(ROOT, 'cordis.patch.yml'), 'utf8')
check(patch.includes(`name: ${manifest.name}`), 'cordis.patch.yml must insert a row named after the package')

// ---- 4. label rules -----------------------------------------------------------------
const region = regionOf(coreText, 'core.js')
const api = new Function(`${region}\nreturn { providerParts, providerLabel, glyphOf, hueOf, labelModel, effortName, relabelEfforts }`)()
const expectations = [
  // [id, name, expected label] — the routes of this profile's picker.
  ['qwen-token-plan-cn', 'qwen-token-plan-cn', 'Qwen · Token Plan CN'],
  ['our-free-model', 'our-free-model', 'Our Free Model'],
  ['deepseek-official', 'DeepSeek', 'DeepSeek · 官方'],
  ['openai', 'OpenAI', 'OpenAI'],
  ['custom-gw', '国内中转 (智谱 GLM)', '国内中转 · (智谱 GLM)'],
]
for (const [id, name, expected] of expectations) {
  const actual = api.providerLabel({ id, name })
  check(actual === expected, `providerLabel(${id}, ${name}) is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
}
const model = api.labelModel({ provider: { id: 'qwen-token-plan-cn', name: 'qwen-token-plan-cn' }, model: { id: 'glm-5.3', name: 'GLM-5.3' } })
check(model.glyph.length > 0 && model.glyph.length <= 3, 'a provider monogram must be one to three characters')
check(model.hue >= 1 && model.hue <= 6, 'a provider ring hue must be within 1..6')
check(model.title === 'GLM-5.3 · Qwen · Token Plan CN', `label title is ${JSON.stringify(model.title)}`)

// ---- 5. effort names ---------------------------------------------------------------
const effortExpectations = [
  // [id, name, expected in Chinese] — the names adapters actually print.
  ['off', 'Off', '关闭(Off)'],
  ['none', 'none', '关闭(none)'],
  ['low', 'Low', '低(Low)'],
  ['minimal', 'minimal', '轻度(minimal)'],
  ['medium', 'medium', '中(medium)'],
  ['high', 'High', '高(High)'],
  ['xhigh', 'xhigh', '极高(xhigh)'],
  ['max', 'max', '最高(max)'],
  // A name the provider already wrote bilingually is normalised, not nested.
  ['max', '最大(Max)', '最高(Max)'],
]
for (const [id, name, expected] of effortExpectations) {
  const actual = api.effortName({ id, name }, true)
  check(actual === expected, `effortName(${id}, ${name}) is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
}
check(api.effortName({ id: 'low', name: '较低' }, true) === undefined, 'a Chinese level name written by the provider must be left alone')
check(api.effortName({ id: 'low', name: 'Low' }, false) === 'Low', 'a non-Chinese page must keep the adapter word')
check(api.effortName({ id: 'custom', name: 'Whatever' }, true) === undefined, 'an unknown level must keep its own name')
const levels = ['off', 'low', 'high', 'max'].map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }))
const catalog = { groups: [{ id: 'p', models: [{ id: 'm', reasoning: { efforts: levels } }] }] }
check(api.relabelEfforts(catalog, true) === 4, 'every offered level must be rewritten on a Chinese page')
check(levels[1].name === '低(Low)', `a rewritten level is ${JSON.stringify(levels[1].name)}`)
check(api.relabelEfforts(catalog, true) === 0, 'rewriting must be idempotent')
check(api.relabelEfforts(catalog, false) === 4 && levels[1].name === 'Low', 'a language switch back must strip the Chinese half')
const enumLevels = ['none', 'minimal', 'medium', 'high', 'xhigh', 'max'].map((id) => ({ id, name: id }))
const enumCatalog = { groups: [{ id: 'p', models: [{ id: 'm', reasoning: { efforts: enumLevels } }] }] }
api.relabelEfforts(enumCatalog, true)
check(
  enumLevels.map((level) => level.name).join(' / ') === '关闭(none) / 轻度(minimal) / 中(medium) / 高(high) / 极高(xhigh) / 最高(max)',
  `raw enum names read ${JSON.stringify(enumLevels.map((level) => level.name).join(' / '))}`,
)

// ---- report --------------------------------------------------------------------------
if (problems.length > 0) {
  for (const problem of problems) console.error(`✗ ${problem}`)
  process.exit(1)
}
console.log('✓ syntax, core parity, manifest and label rules are consistent')