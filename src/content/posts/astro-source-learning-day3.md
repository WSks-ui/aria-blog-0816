---
title: Astro 源码学习笔记 Day 3：第一次修改源码
summary: 在 Astro 的构建入口加一行日志，重新编译，再到 minimal 示例里确认它生效。
publishedAt: '2026-08-14'
updatedAt: null
tags:
  - Astro
  - 源码学习
  - 开源项目
kind: note
featured: false
draft: false
github: null
cover: /images/astro-learning/astro-logo.png
readingWeather: null
---

今天在 Astro 的构建入口加了一行日志，确认自己修改的源码能跑起来。

## 示例项目用的是哪份代码

这次修改涉及两个目录：核心包在 `packages/astro`，用来观察结果的示例在 `examples/minimal`。它们之间的关系是：

```
改源码(packages/astro/src/)
    ↓
构建包(pnpm -C packages/astro build)
    ↓
生成JS(packages/astro/dist/)
    ↓
examples通过软链接使用编译后的JS
```

先看示例里的 Astro 指向哪里：

```bash
ls -la examples/minimal/node_modules/astro
# 输出：astro -> /d/Open/astro/astro/packages/astro
```

`examples/minimal/node_modules/astro` 是指向 `packages/astro` 的软链接，不过实际执行的是 `dist/` 里的 JS，而不是 `src/` 里的 TypeScript。因此，这次改完源码后还要重新编译核心包。

## 在构建入口加一行日志

在 `packages/astro/src/core/build/index.ts` 第 187 行之前，`build()` 方法开头：

```typescript
private async build({ viteConfig }: { viteConfig: vite.InlineConfig }) {
	await runHookBuildStart({ settings: this.settings, logger: this.logger });
	this.validateConfig();

	// 加在这里 ↓
	this.logger.info('build', `你好呀,这是我添加的第一行代码`);

	this.logger.info('build', `output: ${colors.blue('"' + this.settings.config.output + '"')}`);
	// ...
}
```

选这里是因为它紧挨着原有的 `output: "static"` 日志，构建时容易找到。`this.logger.info()` 的第一个参数是日志类别，这里会显示为 `[build]`。

## 编译后到示例里看结果

先编译 Astro 核心包：

```bash
pnpm -C packages/astro build
```

输出末尾会显示：
```
Result (11 files):
- 0 errors     ← 编译成功
- 0 warnings
- 0 hints
```

然后在示例项目里构建：

```bash
pnpm -C examples/minimal build
```

要找的是中间这行：

```
[types] Generated 72ms
[build] 你好呀,这是我添加的第一行代码    ← 成功！
[build] output: "static"
[build] mode: "static"
```

如果没有出现这行日志，先确认核心包重新编译过，再比较源码和产物的时间戳，看看是不是仍在运行旧文件：

```bash
stat packages/astro/dist/core/build/index.js
stat packages/astro/src/core/build/index.ts
```

下一次准备顺着 `generatePages()` 看逐页渲染的过程，再加一行日志观察路由的输出顺序。
