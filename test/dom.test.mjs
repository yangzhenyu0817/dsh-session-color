// 用极简 DOM 桩跑一遍 assets/session-color.js:
// 右键会话行 → 出菜单 → 点色块 → 生成 <style> 规则并落 localStorage;
// 自定义色 / 清除颜色 / Esc 关闭也各走一遍。
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const SOURCE = readFileSync(new URL('../assets/session-color.js', import.meta.url), 'utf8')

function matches(node, sel) {
	let m
	if ((m = /^\[([\w-]+)\]$/.exec(sel))) return node.attributes[m[1]] !== undefined
	if ((m = /^\[([\w-]+)\^="([^"]*)"\]$/.exec(sel))) return String(node.attributes[m[1]] ?? '').startsWith(m[2])
	if ((m = /^#([\w-]+)$/.exec(sel))) return node.id === m[1]
	if ((m = /^\.([\w-]+)$/.exec(sel))) return (node.className || '').split(/\s+/).includes(m[1])
	if (/^[a-zA-Z][\w-]*$/.test(sel)) return node.tagName === sel.toUpperCase()
	return false
}

function makeEvent(type, extra) {
	return {
		type,
		defaultPrevented: false,
		preventDefault() { this.defaultPrevented = true },
		stopPropagation() {},
		...extra,
	}
}

class Element {
	constructor(tag) {
		this.tagName = String(tag).toUpperCase()
		this.children = []
		this.listeners = {}
		this.style = { cssText: '', setProperty() {}, removeProperty() {} }
		this.dataset = {}
		this.attributes = {}
		this.parentNode = null
		this.textContent = ''
		this._rect = { left: 0, top: 0, width: 160, height: 220, right: 160, bottom: 220 }
	}
	appendChild(child) { if (child.parentNode) child.parentNode.removeChild(child); child.parentNode = this; this.children.push(child); return child }
	removeChild(child) { this.children = this.children.filter((c) => c !== child); child.parentNode = null }
	remove() { if (this.parentNode) this.parentNode.removeChild(this); if (this.id) byId.delete(this.id) }
	setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'id') this.id = String(v) }
	getAttribute(k) { return this.attributes[k] ?? null }
	addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn) }
	removeEventListener() {}
	getBoundingClientRect() { return this._rect }
	closest(sel) {
		let node = this
		while (node) {
			if (matches(node, sel)) return node
			node = node.parentNode
		}
		return null
	}
	querySelectorAll() { return [] }
	dispatch(type, extra = {}) {
		const event = makeEvent(type, { target: this, ...extra })
		for (const fn of this.listeners[type] || []) fn(event)
		return event
	}
}

const byId = new Map()
const make = (tag) => new Element(tag)
const doc = {
	readyState: 'complete',
	documentElement: make('html'),
	head: make('head'),
	body: make('body'),
	listeners: {},
	createElement: (t) => make(t),
	getElementById: (id) => byId.get(id) ?? null,
	addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn) },
	dispatch(type, extra) {
		const event = makeEvent(type, extra)
		for (const fn of this.listeners[type] || []) fn(event)
		return event
	},
}
const originalAppend = Element.prototype.appendChild
Element.prototype.appendChild = function (child) {
	if (child.id) byId.set(child.id, child)
	return originalAppend.call(this, child)
}

const store = new Map()
const localStorage = {
	getItem: (k) => (store.has(k) ? store.get(k) : null),
	setItem: (k, v) => store.set(k, String(v)),
	removeItem: (k) => store.delete(k),
}

const window = { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {} }
const sandbox = { window, document: doc, localStorage, console, JSON, CSS: { escape: (s) => s }, setTimeout, clearTimeout }
vm.createContext(sandbox)
vm.runInContext(SOURCE, sandbox, { filename: 'session-color.js' })

const ID = '550e8400-e29b-41d4-a716-446655440000'
const row = make('div')
row.setAttribute('data-row-key', 'session:' + ID)
const titleEl = make('span')
row.appendChild(titleEl)

const walkButtons = (node, out = []) => {
	for (const c of node.children) { if (c.tagName === 'BUTTON') out.push(c); walkButtons(c, out) }
	return out
}

// —— 场景 1:右键会话行 → 菜单出现 ——
const ctx = doc.dispatch('contextmenu', { target: titleEl, clientX: 120, clientY: 240 })
assert.equal(ctx.defaultPrevented, true, '会话行右键必须被接管')
const menu = byId.get('dsh-session-color-menu')
assert.ok(menu, '菜单应插入 body')

// —— 场景 2:点「标为红色」→ 规则落盘 ——
const redBtn = walkButtons(menu).find((b) => b.textContent === '标为红色')
assert.ok(redBtn, '应有「标为红色」按钮')
redBtn.dispatch('click')

const styleTag = byId.get('dsh-session-color-style')
assert.ok(styleTag, '应生成标色 style')
assert.ok(styleTag.textContent.includes(`[data-row-key="session:${ID}"]`), '规则必须按 data-row-key 命中该会话')
assert.ok(styleTag.textContent.includes('#ef4444'), '默认必须是红色 #ef4444')
assert.deepEqual(JSON.parse(store.get('dsh-session-colors-v1')), { [ID]: '#ef4444' }, '颜色必须写入 localStorage')
assert.equal(byId.get('dsh-session-color-menu'), undefined, '选完色菜单应关闭')

// —— 场景 3:再次右键 → 选蓝色 ——
doc.dispatch('contextmenu', { target: titleEl, clientX: 130, clientY: 250 })
const menu2 = byId.get('dsh-session-color-menu')
assert.ok(menu2, '第二次右键应重新出菜单')
const blue = walkButtons(menu2).find((b) => b.getAttribute('aria-label') === '标为蓝')
assert.ok(blue, '色板应含蓝色')
blue.dispatch('click')
assert.ok(styleTag.textContent.includes('#3b82f6'), '改色后规则应更新')
assert.equal(JSON.parse(store.get('dsh-session-colors-v1'))[ID], '#3b82f6')

// —— 场景 4:清除颜色 ——
doc.dispatch('contextmenu', { target: titleEl, clientX: 130, clientY: 250 })
const clear = walkButtons(byId.get('dsh-session-color-menu')).find((b) => b.textContent === '清除颜色')
assert.ok(clear, '应有「清除颜色」按钮')
clear.dispatch('click')
assert.deepEqual(JSON.parse(store.get('dsh-session-colors-v1')), {})
assert.equal(styleTag.textContent, '', '清除后不应残留规则')

// —— 场景 5:非会话行右键不接管 ——
const plain = make('div')
const ctx2 = doc.dispatch('contextmenu', { target: plain, clientX: 10, clientY: 10 })
assert.equal(ctx2.defaultPrevented, false, '非会话区右键必须放行给宿主')

// —— 场景 6:Esc 关闭菜单 ——
doc.dispatch('contextmenu', { target: titleEl, clientX: 100, clientY: 100 })
assert.ok(byId.get('dsh-session-color-menu'))
doc.dispatch('keydown', { key: 'Escape' })
assert.equal(byId.get('dsh-session-color-menu'), undefined, 'Esc 应关闭菜单')

// —— 场景 7:损坏的 localStorage 不崩、不被信任 ——
store.set('dsh-session-colors-v1', '{"x":"javascript:alert(1)","y":"#fff"}')
const sandbox2 = { window, document: doc, localStorage, console, JSON, CSS: { escape: (s) => s }, setTimeout, clearTimeout }
vm.createContext(sandbox2)
vm.runInContext(SOURCE, sandbox2, { filename: 'session-color.js' })
assert.ok(!styleTag.textContent.includes('javascript'), '非法颜色不能进入样式')

console.log('session-color DOM 行为测试:全部通过')
