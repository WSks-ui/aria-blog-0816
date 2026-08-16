---
title: Astro 源码学习笔记 Day 3：第一次修改源码
summary: 理解 monorepo 工作流，第一次在 Astro 源码里加代码并验证生效，掌握改源码-编译-验证的完整循环
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

## 学习目标

从"读源码"到"改源码"，了解monorepo的工作流程，亲手在 Astro 核心代码里加一行日志并验证生效

## monorepo 工作流

### 关键认知

改源码到生效的完整流程：

```
改源码(packages/astro/src/)
    ↓
构建包(pnpm -C packages/astro build)
    ↓
生成JS(packages/astro/dist/)
    ↓
examples通过软链接使用编译后的JS
```

**验证软链接**：

```bash
ls -la examples/minimal/node_modules/astro
# 输出：astro -> /d/Open/astro/astro/packages/astro
```

**核心要点**：
- `examples/minimal/node_modules/astro` 是软链接，指向 `packages/astro`
- 但实际执行的是编译后的 `dist/` 目录里的 JS 文件
- 所以**改完源码必须重新编译才能生效**

## 实战：加第一行日志

### 选择位置

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

**为什么选这里**：
- `build()` 方法是构建流程的核心入口
- 位置在所有日志输出之前，容易观察
- 紧挨着官方日志 `output: "static"`，方便对比

### 编译与验证

**步骤 1**：编译 astro 核心包

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

**步骤 2**：在示例项目里构建

```bash
pnpm -C examples/minimal build
```

**预期输出**：

```
[types] Generated 72ms
[build] 你好呀,这是我添加的第一行代码    ← 成功！
[build] output: "static"
[build] mode: "static"
```

### 常见问题

**Q: 改了源码但没有输出？**

A: 检查两个步骤：
1. 有没有重新编译 `packages/astro`（`pnpm -C packages/astro build`）
2. 查看编译产物的时间戳，确认比源码文件新：
   ```bash
   stat packages/astro/dist/core/build/index.js
   stat packages/astro/src/core/build/index.ts
   ```

**Q: 语法错误怎么办？**

A: `pnpm build` 会直接报错并指出行号，修复后重新编译即可。TypeScript 的类型检查会帮你提前发现很多问题。

## 核心收获

### 技能清单

- ✅ 理解 monorepo 的软链接机制
- ✅ 掌握"改源码 → 编译 → 验证"的工作循环
- ✅ 第一次成功修改开源项目源码
- ✅ 学会用 `this.logger.info()` 打印带前缀的日志

### 关键概念

1. **源码 ≠ 运行时代码**：TypeScript 源码（`src/`）需要编译成 JavaScript（`dist/`）才能执行
2. **Astro 的日志规范**：用 `this.logger.info('build', message)` 而不是 `console.log`，第一个参数是日志类别（会显示为 `[build]`）
3. **monorepo 的便利性**：改完核心包立刻就能在 examples 里验证，不需要 `npm link` 或发布到 registry

## 下一步

第四课将深入渲染循环，在 `generatePages()` 函数里加第二行日志，观察 Astro 如何逐页渲染每个路由。
