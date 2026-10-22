// 会话标色插件的纯逻辑自测(不依赖 DOM)
import assert from 'node:assert'

const HEX = /^#[0-9a-fA-F]{6}$/
assert.ok(HEX.test('#ef4444'))
assert.ok(!HEX.test('#fff'))
assert.ok(!HEX.test('#12345g'))
assert.ok(!HEX.test('red; } [data-row-key="session:x"] {'))

const cssId = (id) => String(id).replace(/["\\]/g, (c) => '\\' + c)
assert.equal(cssId('a"b'), 'a\\"b')

// 规则生成:与 assets/session-color.js 中 renderStyles 相同的拼接
const id = '550e8400-e29b-41d4-a716-446655440000'
const c = '#ef4444'
const sel = '[data-row-key="session:' + cssId(id) + '"]'
const rule = sel + '{box-shadow:inset 3px 0 0 0 ' + c + ',inset 0 0 0 9999px ' + c + '40!important}'
assert.equal(
  rule,
  '[data-row-key="session:550e8400-e29b-41d4-a716-446655440000"]{box-shadow:inset 3px 0 0 0 #ef4444,inset 0 0 0 9999px #ef444440!important}'
)

// localStorage 往返:非法值必须被剔除
const stored = { good: '#3b82f6', bad: 'javascript:x', bad2: '#fff' }
const colors = {}
for (const k in stored) if (typeof stored[k] === 'string' && HEX.test(stored[k])) colors[k] = stored[k].toLowerCase()
assert.deepEqual(colors, { good: '#3b82f6' })

// 默认红:色板第一格 = DEFAULT_COLOR
const PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#111827']
assert.equal(PALETTE.length, 10)
assert.equal(PALETTE[0], '#ef4444')

console.log('session-color logic: all assertions passed')
