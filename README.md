# Aria-7

> 一个基于 Astro 7 构建的中文静态个人博客，记录长文、学习札记、项目、影像、代码与教程。

Aria-7 使用 Astro Content Collections 管理 Markdown / MDX 内容，以 TypeScript 和原生 CSS 实现页面、主题与交互。首页由 Canvas 2D、SVG 和 CSS 组成动态场景，并提供晴朗、雨天、夜间三种显示模式。

> [!NOTE]
> 这是个人站点的源代码仓库，不是开箱即用的通用主题。Fork 或复用时，请替换站点信息、文章内容、联系入口和媒体资源，并确认所使用素材的授权范围。

## 特性

- Markdown / MDX 内容集合与构建期 frontmatter 校验。
- 六种内容类型：`essay`、`note`、`project`、`photo`、`code`、`tutorial`。
- 文章、分类、标签、时间归档、文章关系图和工具讲义页面。
- 静态搜索索引、RSS、Sitemap 与 `robots.txt`。
- 晴朗、雨天、夜间主题，以及 `prefers-reduced-motion` 适配。
- 本地记忆库、图片灯箱、阅读进度和键盘可访问的交互界面。
- 可选 Giscus 评论；未配置时不加载第三方评论脚本。
- 静态构建产物，可部署至 Cloudflare Pages、Cloudflare Workers Static Assets 或其他静态托管服务。

## 技术栈

| 类别 | 使用方案 |
| --- | --- |
| 框架 | Astro 7 |
| 语言 | TypeScript |
| 内容 | Astro Content Collections、Markdown、MDX |
| 样式与交互 | 原生 CSS、Canvas 2D、局部客户端脚本 |
| 构建与包管理 | Vite、pnpm |
| 部署 | 静态输出、Cloudflare Pages / Workers |

## 快速开始

### 环境要求

- Node.js `>= 22.12.0`
- pnpm `>= 11`

项目使用 pnpm 管理依赖。请不要使用 npm 或 yarn，以免生成与 `pnpm-lock.yaml` 冲突的锁文件。

### 安装与运行

```powershell
git clone https://github.com/WSks-ui/aria-blog-0816.git aria7-blog
cd aria7-blog
pnpm install
pnpm dev -- --background
```

开发服务器默认运行在 `http://localhost:4321`。项目使用 Astro 后台模式启动，命令执行后会立即返回，服务器会继续运行。

`pnpm dev` 对应 `package.json` 中的 `astro dev` 脚本；命令中的第二个 `--` 用于把后续参数传递给 Astro CLI。

查看、跟踪日志或停止后台服务器：

```powershell
pnpm astro dev status
pnpm astro dev logs --follow
pnpm astro dev stop
```

需要指定端口或监听地址时，将参数传递给 `astro dev`：

```powershell
pnpm dev -- --background --port 4322
pnpm dev -- --background --host 127.0.0.1
```

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev -- --background` | 在后台启动本地开发服务器 |
| `pnpm astro dev status` | 查看后台开发服务器状态 |
| `pnpm astro dev logs --follow` | 持续查看后台开发服务器日志 |
| `pnpm astro dev stop` | 停止后台开发服务器 |
| `pnpm check` | 检查 Astro、TypeScript 与内容类型 |
| `pnpm build` | 生成生产构建到 `dist/` |
| `pnpm preview` | 本地预览生产构建 |
| `pnpm sync:csdiy-tools` | 同步 CSDIY 工具讲义内容 |

提交变更前请至少执行：

```powershell
pnpm check
pnpm build
```

## 配置

复制环境变量模板并按需修改：

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

| 变量 | 是否必需 | 用途 |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | 生产部署时必需 | 站点公开地址，用于 canonical、RSS 和 Sitemap。 |
| `PUBLIC_GISCUS_REPO`、`PUBLIC_GISCUS_REPO_ID`、`PUBLIC_GISCUS_CATEGORY`、`PUBLIC_GISCUS_CATEGORY_ID` | 可选 | 四项同时配置后启用 Giscus 评论。 |
| `PUBLIC_GITHUB_URL` | 可选 | 页头与关于页的 GitHub 链接。 |
| `PUBLIC_CONTACT_EMAIL` | 可选 | 关于页的公开联系邮箱。 |
| `PUBLIC_QQ_GROUP_URL` | 可选 | 关于页的 QQ 群链接。 |

启用 Giscus 前，需要在 GitHub 仓库中开启 Discussions，并在 [Giscus 配置页面](https://giscus.app/zh-CN) 选择仓库与 Discussion 分类，再将生成的四项公开配置写入 `.env`。

站点名称、描述、栏目和导航位于 [`src/data/site.ts`](./src/data/site.ts)。部署自己的站点时，还应检查 [`src/pages/about.astro`](./src/pages/about.astro) 和 `public/` 下的品牌及媒体资源。

所有以 `PUBLIC_` 开头的变量都会进入浏览器构建产物，不能存放 Token、密码或其他私密信息。

## 内容管理

### 新建文章

在 [`src/content/posts/`](./src/content/posts/) 新建 `.md` 或 `.mdx` 文件。文件名会成为文章 URL 的一部分：

```text
src/content/posts/2026-08-15-first-note.md
-> /posts/2026-08-15-first-note/
```

文章 frontmatter 由 [`src/content.config.ts`](./src/content.config.ts) 校验：

```yaml
---
title: "第一篇札记"
summary: "用于文章列表、SEO 与 RSS 的简短摘要。"
publishedAt: 2026-08-15
updatedAt: null
tags: ["Astro", "写作"]
kind: "note"
featured: false
draft: false
github: null
cover: "/assets/covers/first-note.webp"
readingWeather: null
---
```

- `kind` 必须为 `essay`、`note`、`project`、`photo`、`code` 或 `tutorial` 之一。
- `updatedAt`、`github`、`cover` 和 `readingWeather` 可使用 `null`。
- `cover` 使用 `public/` 下的站内路径或外部 URL。
- `draft: true` 的文章不会进入公开页面、RSS、搜索索引、归档或关系图。

正文支持 GFM 表格、任务列表和围栏代码块。使用 MDX 时，文章路由已注册 `RainFootnote` 与 `WeatherFront` 组件，可直接在 `.mdx` 文件中引用。

### 图片与资源

- 放入 `public/assets/` 的资源使用 `/assets/...` 站内路径。
- 正文图片应提供准确的 `alt` 文本；纯装饰图片使用空 `alt` 或 `aria-hidden="true"`。
- 复用或新增第三方图片、音频、字体和文档时，请同时提交对应的来源与许可证信息。

### 工具讲义同步

[`src/content/tool-guides/`](./src/content/tool-guides/) 中的工具讲义由脚本从 [PKUFlyingPig/cs-self-learning](https://github.com/PKUFlyingPig/cs-self-learning) 同步生成，不建议手动修改。需要更新时运行：

```powershell
pnpm sync:csdiy-tools
pnpm check
```

同步脚本会访问上游仓库，并更新本地讲义及对应许可证文件。

## 项目结构

```text
aria7-blog/
├── docs/                    # 项目文档
├── LICENSES/                # 第三方字体与同步内容的许可证
├── public/                  # 不经构建处理的静态资源
├── scripts/                 # 内容同步与维护脚本
├── src/
│   ├── components/          # 内容、交互、站点外壳与视觉组件
│   ├── content/posts/       # Markdown / MDX 文章
│   ├── content/tool-guides/ # 同步生成的工具讲义
│   ├── data/                # 站点信息、栏目和静态数据
│   ├── layouts/             # 页面布局
│   ├── pages/               # 文件路由与静态数据端点
│   └── styles/              # 设计令牌、主题、排版和动效
├── astro.config.mjs         # Astro 配置
├── pnpm-workspace.yaml      # pnpm 工作区配置
└── wrangler.jsonc           # Cloudflare Workers 静态资源配置
```

## 部署

部署前请完成以下事项：

1. 在 `.env` 或部署平台环境变量中设置正式的 `PUBLIC_SITE_URL`。
2. 按需配置 Giscus 公开变量。
3. 执行 `pnpm check` 与 `pnpm build`。

### Cloudflare Pages

在 Cloudflare Dashboard 创建 Pages 项目并连接仓库，使用以下构建设置：

| 设置 | 值 |
| --- | --- |
| Framework preset | `Astro` |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node.js version | `22.12.0` 或更高 |

在项目的环境变量中设置与本地 `.env` 相同的公开配置。更新域名后，应先更新 `PUBLIC_SITE_URL` 再重新构建。

### Cloudflare Workers Static Assets

仓库中的 [`wrangler.jsonc`](./wrangler.jsonc) 已将 `dist/` 配置为静态资源目录：

```powershell
pnpm dlx wrangler login
pnpm build
pnpm dlx wrangler deploy
```

其他静态托管服务也可直接使用 `pnpm build` 生成的 `dist/` 目录。

## 参与贡献

欢迎通过 [Issues](https://github.com/WSks-ui/aria-blog-0816/issues) 提交问题、改进建议或功能请求。提交 Pull Request 前，请：

1. 从最新主分支创建清晰命名的分支。
2. 保持改动聚焦，并说明行为或视觉上的变化。
3. 为受影响的功能补充必要测试或验证步骤。
4. 运行 `pnpm check` 与 `pnpm build`。

请勿提交 `.env`、构建产物、依赖目录或未获得授权的第三方资源。

## 许可证

本项目代码以 [MIT License](./LICENSE) 发布。第三方字体与同步的工具讲义遵循各自许可证，详见 [`LICENSES/`](./LICENSES/)。
