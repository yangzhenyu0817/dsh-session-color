/*!
 * dsh-session-color v0.1 —— DSH Web 侧栏会话右键标色。
 *
 * 用法:
 *   · 在侧栏会话行上点**右键** → 弹出调色板菜单,点任意色块立即标色;
 *   · 默认红色(菜单第一格,也用于"一键标红");
 *   · 色板含 红/橙/黄/绿/青/蓝/紫/粉/灰/黑 十色 + **自定义…**(系统取色器);
 *   · "清除颜色" 取消该会话的标记;
 *   · 颜色记忆在 localStorage(dsh-session-colors-v1),刷新、重启不丢;
 *   · 菜单外点击 / Esc / 滚动 关闭菜单;宿主原生右键菜单在会话行上被替换,
 *     其他区域(消息、输入框等)完全不受影响。
 *
 * 结构定位(刻意避开 CSS module 哈希类名,跨小版本更稳):
 *   会话行 = [data-row-key^="session:"](dsh-client-ui-workspace 的 SessionNodeItem 所写)
 * 标色实现 = 一条 <style> 里按属性选择器生成规则(inset box-shadow 半透明底色 + 左侧 3px 实色条),
 *   不动 React 的内联样式,行重渲染、换数据都不会丢;匹配失败时静默退化,绝不影响宿主。
 * 整体 try/catch 兜底。
 */
(function () {
	'use strict';
	try {
		if (window.__dshSessionColorInstalled) return;
		window.__dshSessionColorInstalled = true;

		var ROW_SELECTOR = '[data-row-key^="session:"]';
		var STORAGE_KEY = 'dsh-session-colors-v1';
		var STYLE_ID = 'dsh-session-color-style';
		var MENU_ID = 'dsh-session-color-menu';
		var DEFAULT_COLOR = '#ef4444'; // 默认红

		// 色板:第一格即默认红,依次暖色→冷色→中性色
		var PALETTE = [
			{ color: '#ef4444', name: '红' },
			{ color: '#f97316', name: '橙' },
			{ color: '#eab308', name: '黄' },
			{ color: '#22c55e', name: '绿' },
			{ color: '#06b6d4', name: '青' },
			{ color: '#3b82f6', name: '蓝' },
			{ color: '#8b5cf6', name: '紫' },
			{ color: '#ec4899', name: '粉' },
			{ color: '#6b7280', name: '灰' },
			{ color: '#111827', name: '黑' }
		];

		// —— 持久化: { sessionId: "#rrggbb" } ——
		var colors = {};
		try {
			var raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				var parsed = JSON.parse(raw) || {};
				for (var k in parsed) {
					if (typeof parsed[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed[k])) colors[k] = parsed[k].toLowerCase();
				}
			}
		} catch (e) {}
		function persist() {
			try { localStorage.setItem(STORAGE_KEY, JSON.stringify(colors)); } catch (e) {}
		}

		// —— 标色渲染:唯一一条 style,按属性选择器下发规则 ——
		function normalizeHex(color) { return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : null; }
		function cssId(id) { // 属性选择器里的字面量转义
			return String(id).replace(/["\\]/g, function (c) { return '\\' + c; });
		}
		function renderStyles() {
			try {
				var tag = document.getElementById(STYLE_ID);
				if (!tag) {
					tag = document.createElement('style');
					tag.id = STYLE_ID;
					tag.dataset.plugin = 'dsh-session-color';
					(document.head || document.documentElement).appendChild(tag);
				}
				var rules = [];
				for (var id in colors) {
					var c = normalizeHex(colors[id]);
					if (!c) continue;
					var sel = '[data-row-key="session:' + cssId(id) + '"]';
					// 半透明整行底色(压在宿主背景之上,选中/悬停底色仍能透出)+ 左侧 3px 实色条
					rules.push(sel + '{box-shadow:inset 3px 0 0 0 ' + c + ',inset 0 0 0 9999px ' + c + '40!important}');
				}
				tag.textContent = rules.join('\n');
			} catch (e) {}
		}

		// —— 菜单 ——
		var menu = null;
		var menuSessionId = null;

		function closeMenu() {
			if (!menu) return;
			try { menu.remove(); } catch (e) {}
			menu = null;
			menuSessionId = null;
		}

		function applyColor(sessionId, color) {
			var hex = normalizeHex(color);
			if (!hex) return;
			colors[sessionId] = hex;
			persist();
			renderStyles();
		}
		function clearColor(sessionId) {
			if (!(sessionId in colors)) return;
			delete colors[sessionId];
			persist();
			renderStyles();
		}

		function swatchButton(hex, name, current, onPick) {
			var b = document.createElement('button');
			b.type = 'button';
			b.title = name;
			b.setAttribute('aria-label', '标为' + name);
			b.style.cssText = 'width:22px;height:22px;border-radius:6px;cursor:pointer;padding:0;flex:0 0 auto;' +
				'background:' + hex + ';border:2px solid ' + (current === hex ? '#fff' : 'transparent') + ';' +
				'box-shadow:0 0 0 1px rgba(0,0,0,.35);outline-offset:2px';
			if (current === hex) b.style.boxShadow = '0 0 0 2px rgba(255,255,255,.9), 0 0 0 4px ' + hex;
			b.addEventListener('click', function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
				onPick();
			});
			return b;
		}

		function textButton(label, bold, onClick) {
			var b = document.createElement('button');
			b.type = 'button';
			b.textContent = label;
			b.style.cssText = 'display:block;width:100%;text-align:left;font:inherit;font-size:12px;line-height:22px;' +
				'padding:3px 10px;cursor:pointer;color:inherit;background:none;border:0;border-radius:6px' +
				(bold ? ';font-weight:600' : '');
			b.addEventListener('mouseenter', function () { b.style.background = 'rgba(127,127,127,.18)'; });
			b.addEventListener('mouseleave', function () { b.style.background = 'none'; });
			b.addEventListener('click', function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
				onClick();
			});
			return b;
		}

		function openMenu(x, y, sessionId, row) {
			closeMenu();
			menuSessionId = sessionId;

			var el = document.createElement('div');
			el.id = MENU_ID;
			el.setAttribute('role', 'menu');
			el.style.cssText = 'position:fixed;z-index:2147483647;min-width:148px;padding:8px;' +
				'background:rgba(28,28,30,.96);color:#f2f2f7;border:1px solid rgba(255,255,255,.14);' +
				'border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.45);backdrop-filter:blur(8px);' +
				'font:12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif';

			var title = document.createElement('div');
			title.textContent = '标色';
			title.style.cssText = 'font-size:11px;opacity:.65;padding:0 2px 6px;display:flex;justify-content:space-between;align-items:center;gap:8px';
			var hint = document.createElement('span');
			hint.textContent = '默认红';
			hint.style.cssText = 'font-size:10px;opacity:.7';
			title.appendChild(hint);
			el.appendChild(title);

			var current = colors[sessionId] || null;

			// 快捷行:一键标红(默认)/ 清除
			var quick = document.createElement('div');
			quick.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
			var redBtn = textButton('标为红色', true, function () { applyColor(sessionId, DEFAULT_COLOR); closeMenu(); });
			redBtn.style.flex = '1';
			var clearBtn = textButton('清除颜色', false, function () { clearColor(sessionId); closeMenu(); });
			clearBtn.style.flex = '1';
			if (current) clearBtn.style.opacity = '1'; else clearBtn.style.opacity = '.5';
			quick.appendChild(redBtn);
			quick.appendChild(clearBtn);
			el.appendChild(quick);

			// 色板网格
			var grid = document.createElement('div');
			grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:2px 4px 6px';
			PALETTE.forEach(function (p) {
				grid.appendChild(swatchButton(p.color, p.name, current, function () {
					applyColor(sessionId, p.color);
					closeMenu();
				}));
			});
			el.appendChild(grid);

			// 自定义取色器
			var customRow = document.createElement('label');
			customRow.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 4px 0;' +
				'border-top:1px solid rgba(255,255,255,.12);margin-top:2px;font-size:12px;cursor:pointer';
			var input = document.createElement('input');
			input.type = 'color';
			input.value = /^#[0-9a-fA-F]{6}$/.test(current || '') ? current : DEFAULT_COLOR;
			input.style.cssText = 'width:26px;height:20px;padding:0;border:0;background:none;cursor:pointer';
			input.addEventListener('click', function (ev) { ev.stopPropagation(); });
			input.addEventListener('input', function () { applyColor(sessionId, input.value); });
			input.addEventListener('change', function () { applyColor(sessionId, input.value); closeMenu(); });
			var customText = document.createElement('span');
			customText.textContent = '自定义…';
			customRow.appendChild(input);
			customRow.appendChild(customText);
			el.appendChild(customRow);

			// 关闭方式:菜单外的任何指针按下
			el.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
			el.addEventListener('contextmenu', function (ev) { ev.preventDefault(); ev.stopPropagation(); });

			document.body.appendChild(el);

			// 视口内夹取
			var rect = el.getBoundingClientRect();
			var left = Math.min(x, window.innerWidth - rect.width - 8);
			var top = Math.min(y, window.innerHeight - rect.height - 8);
			el.style.left = Math.max(8, left) + 'px';
			el.style.top = Math.max(8, top) + 'px';

			menu = el;
		}

		// —— 事件接管:capture 阶段拦截会话行的右键 ——
		document.addEventListener('contextmenu', function (ev) {
			try {
				var target = ev.target;
				if (!target || typeof target.closest !== 'function') return;
				if (target.closest('#' + MENU_ID)) return;
				var row = target.closest(ROW_SELECTOR);
				if (!row) { closeMenu(); return; } // 非会话行:完全放行宿主/浏览器菜单
				var key = row.getAttribute('data-row-key') || '';
				if (key.indexOf('session:') !== 0) return;
				var sessionId = key.slice('session:'.length);
				if (!sessionId) return;
				ev.preventDefault();
				ev.stopPropagation();
				openMenu(ev.clientX, ev.clientY, sessionId, row);
			} catch (e) {}
		}, true);

		document.addEventListener('pointerdown', function (ev) {
			try {
				if (!menu) return;
				if (ev.target && ev.target.closest && ev.target.closest('#' + MENU_ID)) return;
				closeMenu();
			} catch (e) {}
		}, true);

		document.addEventListener('keydown', function (ev) {
			try { if (ev.key === 'Escape') closeMenu(); } catch (e) {}
		}, true);

		window.addEventListener('blur', closeMenu);
		window.addEventListener('resize', closeMenu);

		// 首屏即恢复已标色的会话
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', renderStyles, { once: true });
		}
		renderStyles();
	} catch (e) {}
})();
