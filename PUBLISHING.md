# 发布 / Publishing

本插件对外分发走两条独立通道,顺序建议:**先 npm,再市场条目**。

## 1. npm(安装通道)

包名 `dsh-session-color`(2026-10-22 查过,registry 上未被占用)。

```powershell
cd tools\dsh-session-color
npm login                      # 首次:浏览器授权
npm publish                    # publishConfig.access=public,直接公开
```

发布后任何人可以:

```sh
dsh plugin --profile desktop add dsh-session-color
```

## 2. 插件市场(发现通道)

市场 `dshmarket` 的列表来自精选仓库 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin),
它每天生成 `plugins.json` / `index.json` 并同步到 npm 包 `dsh-plugin-catalog`。上架 = **往那个仓库提一个 PR**,
只加一个文件,不要改 README(README 由脚本生成)。

文件路径:`data/plugins/<owner>__<repo>.yml`,内容:

```yaml
url: https://github.com/<owner>/<repo>     # 必须与仓库地址完全一致
name: <owner>/<repo>                       # 列表里显示的链接文字
category: ui                               # 本插件属于 ui;可选值见 contributing.md
description:
  en: Right-click any session row in the DeepSeek Harness sidebar to color-tag it with a default red, ten palette colors or a custom picker, persisted locally.
  zh: 给 DeepSeek Harness 侧栏会话行加右键标色：默认红色、十色色板与自定义取色，颜色本地持久化。
```

收录硬性要求(CI 自动检查):

- 仓库 `package.json` 声明 `dsh.bundle`(本插件已声明 `dsh.bundle.patch`);
- 仓库有真实可用代码,不是占位/纯 README;
- 仓库**创建满 1 天**;
- 仓库加 `dsh-plugin` topic;
- 保持维护。

所以顺序是:建仓库 → 打 topic → 等满 1 天 → 提 PR。合并后站点与市场通常一天内收录。

## 3. 自己的索引(可选)

如果你不想等精选列表,也可以把 `plugins.json`(format 1 索引)放到自己的静态托管,
在 **插件 → 发现 → 索引源** 里添加该 URL,别人同样能装上——只是不会出现在默认市场里。
