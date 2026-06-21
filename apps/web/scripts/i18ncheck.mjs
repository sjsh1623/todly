import { readFileSync, readdirSync, statSync } from 'node:fs'

function walk(d) {
  let out = []
  for (const e of readdirSync(d)) {
    const p = d + '/' + e
    const s = statSync(p)
    if (s.isDirectory()) out = out.concat(walk(p))
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\./.test(e)) out.push(p)
  }
  return out
}

const files = walk('src')
const koDef = new Set()
const enDef = new Set()
const KEY = /['"]([a-zA-Z]+\.[a-zA-Z0-9.]+)['"]\s*:/g

function addInline(file, set) {
  const s = readFileSync(file, 'utf8')
  for (const m of s.matchAll(KEY)) set.add(m[1])
}
addInline('src/shared/i18n/ko.ts', koDef)
addInline('src/shared/i18n/en.ts', enDef)

for (const f of files.filter((f) => f.includes('i18n/parts/'))) {
  const s = readFileSync(f, 'utf8')
  const idx = s.search(/export const \w+En/)
  const koBlock = idx >= 0 ? s.slice(0, idx) : s
  const enBlock = idx >= 0 ? s.slice(idx) : ''
  for (const m of koBlock.matchAll(KEY)) koDef.add(m[1])
  for (const m of enBlock.matchAll(KEY)) enDef.add(m[1])
}

const used = new Set()
for (const f of files) {
  if (f.includes('i18n/')) continue
  const s = readFileSync(f, 'utf8')
  for (const m of s.matchAll(/\bi18n\.t\(\s*['"]([^'"]+)['"]/g)) used.add(m[1])
  for (const m of s.matchAll(/[^a-zA-Z0-9_.]t\(\s*['"]([^'"]+)['"]/g)) used.add(m[1])
}
const usedReal = [...used].filter((k) => /^[a-zA-Z]+\.[a-zA-Z0-9.]+$/.test(k))
const missing = usedReal.filter((k) => !koDef.has(k))
const koOnly = [...koDef].filter((k) => !enDef.has(k))
const enOnly = [...enDef].filter((k) => !koDef.has(k))

console.log('defined ko:', koDef.size, '| en:', enDef.size, '| used:', usedReal.size)
console.log('\nUSED BUT MISSING in ko (' + missing.length + '):')
console.log(missing.join('\n') || '  (none)')
console.log('\nko-only / missing in en (' + koOnly.length + '):')
console.log(koOnly.join('\n') || '  (none)')
console.log('\nen-only / missing in ko (' + enOnly.length + '):')
console.log(enOnly.join('\n') || '  (none)')
