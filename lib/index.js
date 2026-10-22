// dsh-session-color —— 服务端半区(cordis 插件)。
//
// 职责只有两件事(与 dsh-settings-drag 同款防御式架构):
//  ① 尽早向 `webserver/index-inject` 推一行内联 script —— 桌面端(Electron)的注入表在宿主启动时
//     一次性收集、没有任何刷新路径,所以注册必须在 apply() 开头同步完成,不能等任何服务;
//  ② webServer 就绪后注册 `/dsh-session-color/session-color.js` 路由,按 mtime 缓存读取
//     assets/session-color.js —— 改完客户端脚本硬刷新页面即生效,无需重启 DSH。
//
// 注入行是"自己建 <script src> 并吞掉 onerror"的内联行,而不是 script-src 行:
// 桌面壳页面侧解释器对 script-src 是"加载失败即 reject 整个 boot",插件被禁用而注入表还留着
// 该行时会让整个应用起不来;内联行则路由在就正常加载、不在就静默失败(dsh-whale-widget issue #154)。

import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT_ROUTE = '/dsh-session-color/session-color.js'

// 客户端脚本候选路径,按顺序取第一个能读到的:
//  ① 开发覆盖:环境变量 DSH_SESSION_COLOR_SCRIPT 指向任意源码副本(改完硬刷新页面即生效);
//  ② 随包安装的副本(正常路径)。
const SCRIPT_CANDIDATES = [
  process.env.DSH_SESSION_COLOR_SCRIPT,
  path.join(PACKAGE_ROOT, 'assets', 'session-color.js'),
].filter((p) => typeof p === 'string' && p.length > 0)

// 每次请求按 (路径, mtime) 判断是否需要重读。
let scriptCache = null // { path, text, mtimeMs }
function loadScript() {
  for (const p of SCRIPT_CANDIDATES) {
    try {
      const st = statSync(p)
      if (scriptCache && scriptCache.path === p && scriptCache.mtimeMs === st.mtimeMs) return scriptCache.text
      const text = readFileSync(p, 'utf8')
      scriptCache = { path: p, text, mtimeMs: st.mtimeMs }
      return text
    } catch (err) {}
  }
  return scriptCache ? scriptCache.text : ''
}

const INJECT_ROW_TEXT =
	'(function(){try{var d=document.body||document.head||document.documentElement;if(!d)return;' +
	'var s=document.createElement("script");s.src="' + SCRIPT_ROUTE + '";' +
	's.onerror=function(){};d.appendChild(s)}catch(e){}})()'

export default {
	name: 'session-color',
	apply(root) {
		const rowDisposers = []
		root.effect(() => () => {
			for (const d of rowDisposers) {
				try { d() } catch (err) {}
			}
		})

		// ① 结构化注入行:不依赖任何服务,apply() 第一件事就注册。
		rowDisposers.push(root.on('webserver/index-inject', (table) => {
			try {
				if (!Array.isArray(table)) return
				for (const row of table) {
					if (!row) continue
					if (row.kind === 'script-src' && row.src === SCRIPT_ROUTE) return
					if (row.kind === 'script' && typeof row.text === 'string'
						&& row.text.indexOf(SCRIPT_ROUTE) >= 0) return
				}
				table.push({ kind: 'script', placement: 'body', text: INJECT_ROW_TEXT })
			} catch (err) {}
		}))

		// ② 路由:等 webServer 就绪;inject 回调的返回值是清理函数。
		root.inject(['webServer'], (ctx) => {
			const disposers = []
			// 轻量信任栅栏:脚本无秘密、无状态,但跨站请求一律拒;宿主栅栏(connection)可用时委托它。
			const rejected = (req, res) => {
				try {
					const site = String((req.headers && req.headers['sec-fetch-site']) || '').toLowerCase()
					if (site === 'cross-site') {
						res.writeHead(403)
						res.end()
						return true
					}
				} catch (err) {}
				const conn = typeof ctx.get === 'function' ? ctx.get('connection') : undefined
				if (conn && typeof conn.requestRejection === 'function') {
					let code
					try {
						code = conn.requestRejection(req)
					} catch (err) {
						try { res.writeHead(403); res.end() } catch (err2) {}
						return true
					}
					if (code === undefined || code === null || code === false) return false
					try { res.writeHead(typeof code === 'number' ? code : 403); res.end() } catch (err) {}
					return true
				}
				return false
			}
			disposers.push(ctx.webServer.register({
				kind: 'exact',
				path: SCRIPT_ROUTE,
				handler: (req, res) => {
					if (rejected(req, res)) return
					res.writeHead(200, {
						'Content-Type': 'application/javascript; charset=utf-8',
						'Cache-Control': 'no-store',
					})
					res.end(loadScript())
				},
			}))
			return () => {
				for (const d of disposers) {
					try { d() } catch (err) {}
				}
			}
		})
	},
}
