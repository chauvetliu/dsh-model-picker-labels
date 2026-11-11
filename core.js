/**
 * dsh-model-picker-groups — pure helpers for the browser half.
 *
 * `scripts/sync-core.mjs` copies everything below the marker into `client.js`
 * (the shipped bundle must register from one file, so it cannot import this
 * module at runtime), and `scripts/check.mjs` fails when the two drift apart.
 * Written against the bare `require` the Module Loader hands a plugin, so the
 * same code runs in the packaged bundle, a test harness and the preview page.
 *
 * @module dsh-model-picker-groups/core
 */

// ---8<--- core:begin

/** Spelled-out names for provider ids seen in the wild, `[brand, ...qualifier]`. */
const PROVIDER_ALIASES = {
  'deepseek-account': ['DeepSeek', '账号'],
  'deepseek-official': ['DeepSeek', '官方'],
  'deepseek-api-key': ['DeepSeek', 'API Key'],
  'deepseek-account-platform': ['DeepSeek', '账号'],
  qwen: ['Qwen'],
  dashscope: ['通义千问', 'DashScope'],
  aliyun: ['阿里云', 'DashScope'],
  google: ['Google'],
  gemini: ['Google', 'Gemini'],
  grok: ['xAI', 'Grok'],
  'z-ai': ['Z.ai', 'GLM'],
  'our-free-model': ['Our Free Model'],
}

/** Brand casing for id segments that are acronyms or brand words. */
const WORD_CASE = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  anthropic: 'Anthropic',
  google: 'Google',
  gemini: 'Gemini',
  mistral: 'Mistral',
  groq: 'Groq',
  moonshot: 'Moonshot',
  kimi: 'Kimi',
  zhipu: '智谱',
  bigmodel: '智谱',
  minimax: 'MiniMax',
  xiaomi: 'Xiaomi',
  mimo: 'MiMo',
  qwen: 'Qwen',
  glm: 'GLM',
  gpt: 'GPT',
  llm: 'LLM',
  ai: 'AI',
  api: 'API',
}

/** Single-segment ids whose brand casing is not obvious from the word alone. */
const KEY_BRANDS = {
  kimi: 'Kimi',
  moonshot: 'Moonshot',
  minimax: 'MiniMax',
  'z-ai': 'Z.ai',
  xai: 'xAI',
  groq: 'Groq',
  mimo: 'MiMo',
}

/** Short id words that are spelled out: `cn`, `glm`, `v4` stay upper-case. */
const ACRONYMS = new Set(['cn', 'us', 'eu', 'glm', 'gpt', 'v4', 'v3', 'v2', 'ai', 'api', 'llm', 'sdk'])

/** Id tails that read as one word or a short tag once the alias named the brand. */
const TAIL_GLUED = { tokenplan: 'TokenPlan', tokenplancn: 'CN' }

/**
 * Turn one id segment into a display word.
 * @param raw - one `-`-separated segment of an id.
 * @returns the display word.
 */
function capWord(raw) {
  if (raw === '') return ''
  if (WORD_CASE[raw.toLowerCase()] !== undefined) return WORD_CASE[raw.toLowerCase()]
  if (ACRONYMS.has(raw.toLowerCase())) return raw.toUpperCase()
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/**
 * A readable name for an id no table knows: `my-cool_gateway` becomes
 * `My Cool Gateway`.
 * @param id - provider id.
 * @returns display text.
 */
function prettyId(id) {
  if (typeof id !== 'string') return ''
  const segments = id.trim().split(/[-_.\s/]+/u).filter((segment) => segment !== '')
  if (segments.length === 0) return ''
  // Camel humps survive: `MiniMax` is a name, `Mini-Max` is an id.
  const first = segments[0]
  const brand = KEY_BRANDS[first.toLowerCase()] || capWord(first)
  return segments.length === 1 ? brand : `${brand} ${segments.slice(1).map(capWord).join(' ')}`
}

/**
 * Lowercase letters and digits only, for comparing a name with an id.
 * @param text - display name or id.
 * @returns the comparable form.
 */
function comparableName(text) {
  return String(text).toLowerCase().replace(/[-_.\s/()]+/gu, '')
}

/**
 * Readable words after the first id segment: `qwen-token-plan-cn` becomes
 * `Token Plan CN`. Segments the brand table already knows keep their spelling
 * without being read again (`our-free-model` → `free Model` → `Free Model`).
 * @param id - provider id.
 * @returns the tail, or '' for a one-word id.
 */
function tailOf(id) {
  const segments = id.split(/[-_.\s/]+/u).filter((segment) => segment !== '')
  if (segments.length < 2) return ''
  const tail = segments.slice(1).map((segment) => (/[A-Z]/u.test(segment) ? segment : capWord(segment)))
  return TAIL_GLUED[tail.join('').toLowerCase()] || tail.join(' ')
}

/**
 * `parts` with `more` appended to the qualifier.
 * @param parts - `{ brand, qualifier }`.
 * @param more - extra qualifier words, may be ''.
 * @returns a new `{ brand, qualifier }`.
 */
function withTail(parts, more) {
  if (more === '' || parts.qualifier === '' || comparableName(parts.qualifier).includes(comparableName(more))) return parts
  return { brand: parts.brand, qualifier: `${parts.qualifier} ${more}` }
}

/**
 * Split a provider into a brand and an optional qualifier.
 *
 * The picker shows `provider.name`, and a custom route without a `displayName`
 * simply reports its id, which is the noise this plugin removes. The id is read
 * when a table knows it or the name only repeats it; otherwise the name the
 * user wrote wins, so a Chinese `displayName` stays as written.
 *
 * @param provider - `{ id, name? }` as the model seat hands it over.
 * @returns `{ brand, qualifier }`; `qualifier` is '' when there is nothing to add.
 */
function providerParts(provider) {
  const id = String((provider && provider.id) || '').trim()
  const key = id.toLowerCase()
  const written = typeof (provider && provider.name) === 'string' ? provider.name.trim() : ''
  const repeats = written === '' || comparableName(written) === comparableName(id)
  const alias = PROVIDER_ALIASES[key]
  if (alias !== undefined) {
    const head = { brand: alias[0], qualifier: alias.slice(1).join(' ') }
    // `DeepSeek` written for `deepseek-official` repeats the brand, not the route.
    if (key.startsWith('deepseek-') && comparableName(written) === 'deepseek') return head
    const tail = tailOf(id)
    // A real name wins whole (`Qwen Token Plan CN`); a casing of the id keeps
    // the alias qualifier and only gains the id tail.
    if (rewritten(written, key)) return splitName(written, id)
    if (tail === '') return head
    // The written name already carries the route (`Qwen Token Plan`): no tail.
    if (head.qualifier !== '' && comparableName(written).includes(comparableName(head.qualifier))) return head
    return withTail(head, tail)
  }
  if (id.startsWith('deepseek-') && WORD_CASE.deepseek !== undefined) {
    // `deepseek-v4-gateway` reads as `DeepSeek · V4 Gateway`; `deepseek-official`
    // is already spelled out by the alias above.
    const tail = tailOf(id)
    return tail === '' ? { brand: 'DeepSeek', qualifier: '' } : { brand: 'DeepSeek', qualifier: tail }
  }
  if (KEY_BRANDS[key] !== undefined || (WORD_CASE[key] !== undefined && !id.includes('-'))) {
    return { brand: KEY_BRANDS[key] || WORD_CASE[key], qualifier: '' }
  }
  return splitName(repeats ? prettyId(id) : written, id)
}

/**
 * Whether the user wrote a real display name rather than a casing or spacing of
 * the id (`Qwen-Token-Plan-CN`, `Qwen Token Plan CN` are rewrites).
 * @param written - provider display name.
 * @param key - lowercase provider id.
 * @returns the name says more than the id does.
 */
function rewritten(written, key) {
  return written !== '' && comparableName(written) !== comparableName(key)
}

/**
 * Split a display name into a brand word and a qualifier.
 *
 * A multi-word name keeps its first word as the brand and the rest as the
 * qualifier (`Acme Gateway`, `智谱 · GLM`). A single word splits at its first
 * digit (`Qwen3` becomes `Qwen` + `3`).
 *
 * @param source - the name to split.
 * @param id - provider id, used only when the name is empty.
 * @returns `{ brand, qualifier }`.
 */
function splitName(source, id) {
  const text = String(source || '').trim()
  if (text === '') return { brand: prettyId(id), qualifier: '' }
  // Words joined by `·` belong together (`智谱 · GLM`), so no brand is invented.
  if (/[·•|]/u.test(text) === false && /\s/u.test(text)) {
    const words = text.split(/\s+/u)
    return { brand: words[0], qualifier: words.slice(1).join(' ') }
  }
  const inner = /^([A-Za-z\u4e00-\u9fff]*[A-Za-z])(\d.*)$/u.exec(text)
  if (inner !== null && inner[1] !== '') return { brand: inner[1], qualifier: inner[2] }
  return { brand: text, qualifier: '' }
}

/**
 * `providerParts` as one string, for titles and tooltips.
 * @param provider - `{ id, name? }`.
 * @returns display text such as `Qwen · Token Plan CN`.
 */
function providerLabel(provider) {
  const parts = providerParts(provider)
  return parts.qualifier === '' ? parts.brand : `${parts.brand} · ${parts.qualifier}`
}

/**
 * The first digit in a string.
 * @param text - text to scan.
 * @returns the digit, or ''.
 */
function firstDigit(text) {
  const found = String(text || '').match(/\d/u)
  return found === null ? '' : found[0]
}

/**
 * Stable ring colour token (1-6) for a provider, derived from its id.
 * @param id - provider id.
 * @returns an integer from 1 to 6.
 */
function hueOf(id) {
  const text = String(id || '')
  let hash = 7
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) % 1_000_003
  return (hash % 6) + 1
}

/**
 * Monogram for a provider ring: acronym brands read whole (`GLM`, `DS`), other
 * Latin brands keep the initials of their camel humps or first vowel (`OpenAI`
 * becomes `OA`, `Qwen` becomes `QW`), and CJK brands show two characters.
 * @param brand - brand word.
 * @param qualifier - qualifier text, may be ''.
 * @param name - the model name, used when there is no brand at all.
 * @returns one to three characters.
 */
function glyphOf(brand, qualifier, name) {
  const letters = (text) => Array.from(String(text || '').toUpperCase()).filter((char) => /[\p{L}\p{N}]/u.test(char))
  const word = letters(brand)
  if (word.length === 0) return letters(name).slice(0, 1).join('') || '?'
  const digit = firstDigit(qualifier)
  const latin = /^[A-Z]+/u.exec(word.join(''))
  if (latin === null) return word.length >= 2 ? word.slice(0, 2).join('') : word[0] + digit
  const run = latin[0]
  if (run.length >= 2 && run.length <= 3 && !/[AEIOU]/u.test(run)) return run
  const initial = run.charAt(0)
  if (run.length === 1) return digit === '' ? initial : initial + digit
  const camel = /[A-Z]/u.exec(run.slice(1))
  if (camel !== null) return initial + camel[0]
  if (digit !== '') return initial + digit
  const vowel = /[AEIOU]/u.exec(run.slice(2, 6))
  return vowel === null ? initial : initial + vowel[0]
}

/**
 * What the trigger shows after the brand, and whether that brand gets a pill.
 *
 *   - a route the alias table knows (`deepseek-official`) shows its qualifier
 *     (`官方`), and a one-word alias such as `DeepSeek` only repeats the brand;
 *   - a route-like id (`qwen-token-plan-cn`) shows the words after its first
 *     segment the alias table has not already claimed (`Token Plan CN`);
 *   - a line the user named (`国内中转`) keeps their words;
 *   - a name with a qualifier (`Acme Gateway`) shows the qualifier;
 *   - a dotted or plain name shows '' — the brand pill or the model name alone
 *     already says enough.
 *
 * The pill appears only for code-like routes (an id with a `-` or `_`), which
 * no display name can fully replace; a provider named in words keeps the
 * shell's plain look.
 *
 * @param id - provider id.
 * @param written - provider display name, may be ''.
 * @returns `{ text, bag }`.
 */
function routeOf(id, written) {
  const key = id.toLowerCase()
  // Codes and dotted names (`qwen-token-plan-cn`, `z.ai`) identify a line no
  // display name can replace, so they keep the brand pill.
  const codeLike = /[-_]/u.test(id)
  if (rewritten(written, key)) {
    // A one-word alias (`DeepSeek` for `deepseek-official`) only repeats the
    // brand: keep the qualifier the id names and spare the pill.
    const head = providerParts({ id, name: '' })
    if (!/\s/u.test(written) && written.toLowerCase() === head.brand.toLowerCase()) {
      return { text: head.qualifier, bag: false }
    }
    return { text: written, bag: codeLike }
  }
  if (codeLike) {
    const parts = providerParts({ id, name: '' })
    const tail = tailOf(id)
    if (tail === '') return { text: parts.qualifier, bag: true }
    return { text: parts.qualifier === '' || comparableName(parts.qualifier).includes(comparableName(tail)) ? parts.qualifier : tail, bag: true }
  }
  return { text: providerParts({ id, name: written }).qualifier, bag: false }
}

/**
 * Chinese names for the reasoning levels adapters publish, keyed by level id:
 * `[中文, English fallback]`.
 *
 * Adapters spell the same ladder differently — `Off` in one catalog, the raw
 * enum `none` in another — so the Chinese word is fixed here while the English
 * half stays whatever the model actually displayed (`关闭（none）`,
 * `关闭（Off）`). The fallback only fills in when a level has no printed name.
 */
const EFFORT_NAMES = {
  off: ['关闭', 'Off'],
  disabled: ['关闭', 'Off'],
  none: ['关闭', 'Off'],
  minimal: ['轻度', 'Minimal'],
  min: ['轻度', 'Minimal'],
  light: ['精简', 'Light'],
  low: ['低', 'Low'],
  medium: ['中', 'Medium'],
  mid: ['中', 'Medium'],
  balanced: ['均衡', 'Balanced'],
  high: ['高', 'High'],
  xhigh: ['极高', 'XHigh'],
  'extra-high': ['极高', 'XHigh'],
  extrahigh: ['极高', 'XHigh'],
  max: ['最高', 'Max'],
  maximum: ['最高', 'Max'],
  deep: ['深思', 'Deep'],
}

/**
 * `EFFORT_NAMES` keyed by a comparison form, so `extra-high`, `Extra High` and
 * `EXTRA_HIGH` all resolve to the same row.
 */
const EFFORT_KEYS = new Map()
for (const [key, value] of Object.entries(EFFORT_NAMES)) {
  EFFORT_KEYS.set(key.toLowerCase().replace(/[^a-z0-9]/gu, ''), value)
}

/**
 * The bilingual wording of one published reasoning level, or undefined when the
 * level is unknown or the provider already names it in Chinese itself.
 *
 * Chinese pages read `低(Low)`: the Chinese word first, whatever English term
 * the model printed after it in brackets. That covers the plain names (`Low`),
 * the raw enum some catalogs print (`none`, `minimal`, `xhigh`), and a name
 * that is already bilingual (`最高(max)`), which is normalised rather than
 * nested. Other languages keep the English term unchanged.
 *
 * Levels a model does not offer are never invented: only the entries already in
 * `model.reasoning.efforts` are rewritten, so a model without an effort menu
 * stays without one.
 *
 * @param level - one `{ id, name }` entry of `model.reasoning.efforts`.
 * @param zh - whether the page speaks Chinese.
 * @returns the display name, or undefined when no rewriting applies.
 */
function effortName(level, zh) {
  const written = String((level && level.name) || '').trim()
  const bracketed = /^(.*?)\s*[（(]\s*([^（()）]*?)\s*[）)]\s*$/u.exec(written)
  const head = bracketed === null ? written : bracketed[1].trim()
  const tail = bracketed === null ? written : bracketed[2].trim()
  const id = String((level && level.id) || '').trim()
  const known = EFFORT_KEYS.get(id.toLowerCase().replace(/[^a-z0-9]/gu, ''))
    || EFFORT_KEYS.get(head.toLowerCase().replace(/[^a-z0-9]/gu, ''))
    || EFFORT_KEYS.get(tail.toLowerCase().replace(/[^a-z0-9]/gu, ''))
  if (known === undefined) return undefined
  // A provider that writes the level in Chinese alone keeps its wording.
  if (bracketed === null && /[\u4e00-\u9fff]/u.test(written)) return undefined
  const english = /[\u4e00-\u9fff]/u.test(tail) || tail === '' ? known[1] : tail
  return zh === true ? `${known[0]}(${english})` : english
}

/**
 * Rewrite the reasoning levels of a loaded model catalog in place, so every
 * surface that prints a level name (trigger, root menu cell, effort pane) shows
 * the bilingual wording without copying the picker's render tree. Only `name`
 * is touched; selection and persistence use `id`, which is never changed.
 *
 * @param catalog - a `modelCatalog` value: `{ groups: [{ models }] }`, or null.
 * @param zh - whether the page speaks Chinese.
 * @returns how many level names were rewritten.
 */
function relabelEfforts(catalog, zh) {
  let changed = 0
  const groups = Array.isArray(catalog && catalog.groups) ? catalog.groups : []
  for (const group of groups) {
    const models = Array.isArray(group && group.models) ? group.models : []
    for (const model of models) {
      const efforts = Array.isArray(model && model.reasoning && model.reasoning.efforts) ? model.reasoning.efforts : []
      for (const level of efforts) {
        const name = effortName(level, zh)
        if (name === undefined || level.name === name) continue
        level.name = name
        changed += 1
      }
    }
  }
  return changed
}

/**
 * Everything one label placement needs, computed once per render.
 * @param owner - owner props: `{ provider, model, placement, selected }`.
 * @returns `{ providerId, modelId, brand, qualifier, route, bag, name, hue, glyph, title }`
 *   where `route` is the trigger's line text and `bag` its pill switch.
 */
function labelModel(owner) {
  const provider = (owner && owner.provider) || {}
  const model = (owner && owner.model) || {}
  const parts = providerParts(provider)
  const id = String(provider.id || '').trim()
  const written = typeof provider.name === 'string' ? provider.name.trim() : ''
  const name = typeof model.name === 'string' && model.name !== '' ? model.name : String(model.id || '')
  const line = routeOf(id, written)
  return {
    providerId: id,
    modelId: String(model.id || ''),
    brand: parts.brand,
    qualifier: parts.qualifier,
    route: line.text,
    bag: line.bag,
    name,
    hue: hueOf(provider.id),
    glyph: glyphOf(parts.brand, parts.qualifier, name),
    title: [name, providerLabel(provider)].filter((part) => part !== '').join(' · '),
  }
}

// ---8<--- core:end
