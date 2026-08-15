# Aria-7

Aria-7 是一个以静态内容为核心的中文个人博客，记录长文、学习札记、项目、影像、代码与教程。视觉系统从雨天纸面、制图线和天气信息界面中提炼，但不直接使用参考视频截图或角色素材。

项目基于 Astro 7、TypeScript、Content Collections 和原生 CSS。文章在构建时生成静态页面，默认不向浏览器发送框架运行时代码；搜索、主题、归档日历和 Giscus 评论按需使用少量客户端脚本。

完整的视觉依据与落地边界见 [docs/visual-spec.md](./docs/visual-spec.md)。

## 功能

- Markdown / MDX 内容集合，frontmatter 由 schema 校验。
- 六种内容类型：`essay`、`note`、`project`、`photo`、`code`、`tutorial`。
- 文章、分类、标签、时间归档和共享标签关系图。
- 静态 JSON 搜索索引、RSS 和 Sitemap。
- 晴朗、雨天、夜间三种显示模式及减少动态适配。
- 可选 Giscus 评论；未配置时显示静态占位，不加载第三方脚本。
- 静态输出，可部署到 Cloudflare Pages 或 Cloudflare Workers Static Assets。

## 环境要求

- Node.js `>= 22.12.0`
- npm 10 或更高版本

## 本地开发

```powershell
npm install
npm run dev
```

开发服务器默认运行在 [http://localhost:4321](http://localhost:4321)。需要让 Astro 在后台运行时：

```powershell
npm run dev -- --background
npm run astro -- dev status
npm run astro -- dev logs
npm run astro -- dev stop
```

提交前至少执行：

```powershell
npm run check
npm run build
```

常用命令：

| 命令 | 用途 |
|---|---|
| `npm run dev` | 启动开发服务器 |
| `npm run check` | 检查 Astro、TypeScript 与内容类型 |
| `npm run build` | 构建到 `dist/` |
| `npm run preview` | 本地预览生产构建 |
| `npm run astro -- <command>` | 调用 Astro CLI |

## 项目结构

```text
aria7-blog/
├── docs/                  # 视觉规范与项目文档
├── public/assets/         # 不经构建处理的图片、纹理和品牌资源
├── src/components/        # 内容、交互、站点外壳与装饰组件
├── src/content/posts/     # Markdown / MDX 文章
├── src/data/site.ts       # 站点信息、内容类型与导航数据
├── src/layouts/           # 基础布局与文章布局
├── src/lib/content.ts     # 排序、筛选、标签和相关文章查询
├── src/pages/             # 文件路由与静态数据端点
├── src/styles/            # 设计令牌、主题、排版和动效
└── src/content.config.ts  # posts 集合 schema
```

## 功能路由

| 路由 | 内容 |
|---|---|
| `/` | 首页、精选文章、最近文章与内容索引 |
| `/posts/` | 全部已发布文章 |
| `/posts/[...id]/` | 文章详情；路径来自内容文件 id |
| `/types/[kind]/` | 按六种内容类型筛选 |
| `/tags/` | 标签索引 |
| `/tags/[tag]/` | 单个标签下的文章 |
| `/archive/` | 桌面月历与移动端时间列表 |
| `/connections/` | 由共享标签生成的文章关系图 |
| `/about/` | 站点与作者介绍 |
| `/rss.xml` | RSS 2.0 订阅源 |
| `/search-index.json` | 客户端搜索使用的静态索引 |
| `/404.html` | 静态 404 页面 |

`draft: true` 的文章不会进入公开页面、RSS、搜索索引、归档或关系图。

## Markdown / MDX 写作

### 新建文章

在 `src/content/posts/` 新建 `.md` 或 `.mdx` 文件。文件名会成为文章 URL 的一部分，例如：

```text
src/content/posts/2026-08-15-first-note.md
→ /posts/2026-08-15-first-note/
```

frontmatter 必须符合 `src/content.config.ts`：

```yaml
---
title: "第一篇札记"
summary: "用于文章列表、SEO 与 RSS 的简短摘要。"
publishedAt: 2026-08-15
updatedAt: 2026-08-16
tags: ["Astro", "写作"]
kind: "note"
featured: false
draft: false
github: null
cover: "/assets/covers/first-note.webp"
readingWeather:
  condition: "小雨"
  temperature: 25
  location: "窗边"
---
```

字段约定：

| 字段 | 约束 |
|---|---|
| `title` | 必填，1–80 字符 |
| `summary` | 必填，1–220 字符 |
| `publishedAt` | 必填，可解析的日期 |
| `updatedAt` | 必填；没有更新日期时写 `null` |
| `tags` | 必填，1–8 个标签，每项不超过 24 字符 |
| `kind` | 必须是六种内容类型之一 |
| `featured` | 是否允许首页优先选为精选文章 |
| `draft` | 是否为草稿；草稿默认不公开 |
| `github` | 完整仓库 URL，或 `null` |
| `cover` | `public/` 下的站内路径、外部 URL，或 `null` |
| `readingWeather` | 阅读氛围数据；温度可写 `null`，地点与天气必填 |

正文使用标准 Markdown，并支持 GFM 表格、任务列表和围栏代码块。代码块可在语言名后附加标题说明：

````markdown
```ts title="src/example.ts"
export const message = 'hello';
```
````

### 使用 MDX

需要嵌入内容组件时，将扩展名改为 `.mdx`。文章路由已经向 MDX 注册 `RainFootnote` 和 `WeatherFront`，可以直接使用：

```mdx
<RainFootnote index={1} title="实现边界">
  这里放补充说明，正文仍然保持连续。
</RainFootnote>
```

不要在普通文章中加入依赖浏览器全局变量的顶层代码。需要交互时优先封装为 Astro 组件，并明确键盘操作、无脚本回退和 `prefers-reduced-motion` 行为。

### 图片与封面

- 放在 `public/assets/` 的资源使用 `/assets/...` 绝对站内路径。
- `cover: null` 时页面使用默认题图，不需要创建空白占位文件。
- 正文图片应提供准确 `alt`；纯装饰资源使用空 `alt` 或 `aria-hidden="true"`。
- 不要把视觉分析所用的 55 张视频截图复制进仓库或用于公开页面；只转译其布局、色彩与节奏方法。

## Giscus 评论

评论组件位于 `src/components/interactive/CommentPanel.astro`，仅在四个必填参数齐全时加载 [Giscus](https://giscus.app/zh-CN)。准备步骤：

1. 将 GitHub 仓库设为公开，并在仓库 Settings 中启用 Discussions。
2. 安装 [Giscus GitHub App](https://github.com/apps/giscus)，授权它访问该仓库。
3. 在 [giscus.app/zh-CN](https://giscus.app/zh-CN) 选择仓库、Discussion 分类和页面映射方式。
4. 将生成配置中的仓库、仓库 ID、分类和分类 ID 写入本地环境文件。

```powershell
Copy-Item .env.example .env
```

```dotenv
PUBLIC_GISCUS_REPO=owner/repository
PUBLIC_GISCUS_REPO_ID=R_kgDOxxxxxxxx
PUBLIC_GISCUS_CATEGORY=Announcements
PUBLIC_GISCUS_CATEGORY_ID=DIC_kwDOxxxxxxxx
```

组件还支持以下可选变量：

```dotenv
PUBLIC_GISCUS_MAPPING=pathname
PUBLIC_GISCUS_STRICT=0
PUBLIC_GISCUS_REACTIONS_ENABLED=1
PUBLIC_GISCUS_EMIT_METADATA=0
PUBLIC_GISCUS_INPUT_POSITION=top
PUBLIC_GISCUS_THEME=preferred_color_scheme
PUBLIC_GISCUS_LANG=zh-CN
PUBLIC_GISCUS_LOADING=lazy
```

所有 `PUBLIC_` 变量都会进入客户端构建产物，只能存放公开配置，不能放 GitHub Token 或其他密钥。修改环境变量后需重新构建。

## Cloudflare 部署

### 发布前配置

1. 将 `astro.config.mjs` 中的 `site` 改为最终的 `pages.dev`、`workers.dev` 或自定义域名；它会影响 canonical、RSS 和 Sitemap。
2. 同步检查 `src/data/site.ts` 中的站点名、描述、作者和后备 URL。
3. 替换 `src/pages/about.astro`、页眉和页脚中的 GitHub、邮箱等占位信息。
4. 配置生产环境 Giscus 变量。
5. 运行 `npm run check` 与 `npm run build`，再用 `npm run preview` 检查 `dist/`。

### 方案一：Cloudflare Pages Git 部署

在 Cloudflare Dashboard 中创建 Pages 项目并连接 GitHub 仓库，使用以下构建设置：

| 设置 | 值 |
|---|---|
| Framework preset | `Astro` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node.js version | `22.12.0` 或更高 |

在项目的 Settings → Environment variables 中添加 Giscus 变量。预览环境和生产环境分别配置；变量变化后重新部署。若使用自定义域名，在域名生效后再次更新 `astro.config.mjs` 的 `site`。

### 方案二：Wrangler 静态资源部署

仓库中的 `wrangler.jsonc` 已将 `dist/` 配置为静态资源目录，并为未知路径返回构建后的 404 页面：

```powershell
npx wrangler login
npm run build
npx wrangler deploy
```

首次执行 `npx wrangler` 时会按需下载 CLI。该流程使用本地构建时读取到的 `.env`；不要把 `.env` 提交到 Git。若部署目标地址与当前 `site` 不同，应更新地址并重新构建后再发布。

Cloudflare Pages CLI 是另一套独立流程，可使用 `npx wrangler pages deploy dist --project-name aria-7-blog`，但不会读取仓库中 Workers Static Assets 的 `assets` 配置。一个生产站点选择一种部署方式即可。

### 发布后检查

- 首页、文章、标签和分类页面无 404。
- `/rss.xml` 中的站点与文章链接使用正式域名。
- `/sitemap-index.xml` 能访问且不包含草稿。
- `/search-index.json` 只包含已发布文章。
- Giscus 能创建或读取对应 Discussion。
- 360、768、1280 和 1440 px 宽度下没有文字遮挡或横向溢出。
- 键盘焦点、夜间主题与减少动态模式可正常使用。

## 视觉规范

[docs/visual-spec.md](./docs/visual-spec.md) 保留了 55 帧参考素材的逐段分析、近似色板、排版、动效推断、信息层级和博客转译规则。该文档只记录分析结论，不包含原始截图；实现细节以 `src/styles/` 和当前组件源码为准。
