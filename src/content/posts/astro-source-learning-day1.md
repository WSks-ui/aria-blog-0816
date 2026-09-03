---
title: Astro源码学习 Day1:从最小项目开始
summary: 从examples/minimal入手,理解.astro文件、frontmatter和文件系统路由
publishedAt: '2026-08-13'
updatedAt: null
tags:
  - Astro
  - 源码学习
kind: note
featured: false
draft: false
github: null
cover: /images/astro-learning/astro-logo.png
readingWeather: null
---

## 核心概念

**岛屿架构**
- 默认输出纯 HTML，零 JavaScript
- 只在需要交互的地方按需注入 JS

**三个执行上下文**（读源码的基础）

| 位置 | 何时运行 | Node API |
|------|---------|---------|
| `core/` | build/dev 命令 | 能用 |
| `runtime/server/` | 页面渲染 | 禁用 |
| `runtime/client/` | 浏览器 | 禁用 |

**仓库结构**

```
packages/astro/src/
├── core/            构建编排
├── runtime/         渲染层
├── content/         内容集合
├── vite-plugin-*/   核心实现
└── types/           类型定义
```

## .astro 文件

两部分：frontmatter（服务器端 JS）+ HTML 模板

```astro
---
const title = '我的页面'
---
<html>
	<head><title>{title}</title></head>
	<body><h1>{title}</h1></body>
</html>
```

- `---` 之间的代码在服务器端跑
- `{}` 插值把 JS 表达式的值输出到 HTML
- 构建后变成纯 HTML，frontmatter 代码消失

## 文件系统路由

`src/pages/` 目录结构直接映射 URL

```
src/pages/index.astro      →  /
src/pages/about.astro      →  /about
src/pages/blog/post.astro  →  /blog/post
```

构建后

```
dist/index.html
dist/about/index.html
dist/blog/post/index.html
```

## 构建流程

```bash
pnpm -C examples/minimal build
```

关键日志

```
[types]   类型生成
[build]   output: "static"
[vite]    Vite打包
generating static routes
  ├─ /about/index.html
  ├─ /index.html
```

产物：`dist/` 里只有 HTML，没有 JS 文件

## 日志对应源码

- `[types]` → `content/types-generator.ts`
- `[build]` → `core/build/`
- `generating static routes` → 路由系统

下节课顺着这些线索看 build 流程
