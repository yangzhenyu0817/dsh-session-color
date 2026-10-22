# dsh-session-color

给 DSH Web 侧栏的**会话行加右键标色**:右键任意会话 → 弹出调色板 → 点色即标,**默认红色**,可选十色色板 + 系统取色器自定义色,也可一键清除。

## 效果

- 侧栏会话行**右键** → 弹出标色菜单(宿主原生右键菜单在会话行上被替换;消息区、输入框等其他区域不受影响);
- 快捷行「**标为红色**(默认)/ **清除颜色**」;
- 10 色色板:红 橙 黄 绿 青 蓝 紫 粉 灰 黑,当前色高亮描边;
- 「自定义…」打开系统取色器,任意 hex 色;
- 标色样式 = 整行半透明底色 + 左侧 3px 实色条,不遮挡选中/悬停态;
- 颜色按 `sessionId` 记忆在浏览器 `localStorage`(`dsh-session-colors-v1`),刷新、重启不丢;
- 菜单外点击 / Esc / 窗口失焦 / 缩放 自动关闭。

## 原理

- 服务端半区(`lib/index.js`)与 `dsh-settings-drag` 同款:
  - `apply()` 第一件事向 `webserver/index-inject` 推一行**内联 script 行**(桌面端注入表启动时一次性收集);
    内联行吞掉 onerror,插件禁用/路由缺失时静默失败,绝不影响宿主启动;
  - webServer 就绪后注册 `GET /dsh-session-color/session-color.js`,按 mtime 缓存 ——
    **改完客户端脚本硬刷新页面即生效,无需重启 DSH**。
- 客户端半区(`assets/session-color.js`):纯 DOM 脚本,无依赖,整体 try/catch 兜底。
  - 行定位用稳定属性 `[data-row-key^="session:"]`(`dsh-client-ui-workspace` 的 `SessionNodeItem` 写入),
    刻意避开 CSS module 哈希类名;任何一步匹配失败都静默退化为"不接管",宿主右键菜单照常。
  - 标色不动 React 内联样式,而是维护**一条 `<style>`**,按
    `[data-row-key="session:<id>"]` 生成 `box-shadow` inset 规则 —— 行重渲染、换数据、列表滚动都不会丢色。

## 安装

源码目录执行(或复制本目录到别处后用绝对路径):

```powershell
dsh plugin --profile desktop add dsh-session-color
```

然后把 `"dsh-session-color"` 追加到 `%USERPROFILE%\.dsh\profiles\desktop\package.json`
的 `dsh.profile.bundles` 数组,与 `dsh-settings-drag` 并列,**重启桌面端**即可。

本地开发:把环境变量 `DSH_SESSION_COLOR_SCRIPT` 指向工作区的 `assets/session-color.js`,
路由按 mtime 重读,改完**硬刷新页面**即生效,不用重启。

## 卸载

1. profile `cordis.patch.yml` / `dsh.profile.bundles` 移除相关条目;
2. `dsh plugin --profile desktop remove dsh-session-color`;
3. 重启桌面端。浏览器侧残留的 localStorage 键可手动清(`dsh-session-colors-v1`)。

## 已知边界

- 只作用于**侧栏会话行**;搜索结果行(`SearchResultItem`)没有 `data-row-key`,不接管,右键保持宿主行为。
- 颜色存浏览器 localStorage,不跨设备、不进会话元数据;换浏览器/清站点数据即丢。
- 标色是纯视觉标记,与归档/置顶等会话状态互不影响。
