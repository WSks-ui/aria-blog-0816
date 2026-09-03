# aria7-blog 全面审查报告

审查日期：2026-09-02 · 构建复核：2026-09-03 · 审查范围：结构导航 / 性能 / 前端交互 / 响应式 / 内容 / 安全与部署
审查方式：源码逐文件审查（src 全部布局、页面、交互组件、样式、内容）+ 构建验证 + dist 产物分析

---

## 总体结论

这是一份工程质量明显高于平均水平的 Astro 静态站：信息架构清晰（栏目/标签/归档/关系图/RSS/搜索齐全且单一出处）、无障碍基础扎实（跳转链接、aria-current、radiogroup 方向键、reduced-motion 全覆盖）、性能意识到位（字体子集化、speculation rules 预取、LCP 封面预载、音频按需加载、全站 JS 仅约 64KB）、内容层有严格的 zod schema 与草稿过滤。构建本身零编译错误。

需要优先处理的问题集中在：**一处真实的移动端布局溢出、CSS 新特性无降级、缓存头遗漏、以及若干触摸目标/对比度不达标的 a11y 细节**。

> 构建复核：2026-09-03 已在本机完整执行 `pnpm build`，成功生成 71 页，且 `dist/index.html` 已恢复。此前资产搬移受到会话级文件保护拦截的情况已不再出现；部署前仍应以当前提交重新生成的构建产物为准。

---

## 高优先级问题

### H1. 关于页网格在 901–1010px 视口溢出并被静默裁切
- 位置：`src/pages/about.astro:258`、`:280`
- 现状：`.about-grid` 为 `minmax(360px,…) minmax(520px,…)` + 72px 间距，内容最小需求约 952px；断点却设在 900px。901–约 1010px 的视口（如竖屏 iPad、半屏桌面窗口）会横向溢出，而 `global.css` 的 `overflow-x: clip` 把溢出内容**静默裁掉**，用户看不到右栏边缘且无任何提示。
- 建议：断点下放到 `min-width` 计算值内（如 `@media (max-width: 1080px)` 即收单列），或将列改为 `minmax(min(360px, 100%), …)` 使列可压缩；同页 `:281` 的 760px 断点保留。

### H2. `color-mix()` 全站无降级，旧浏览器边框/背景大面积失效
- 位置：`tokens.css:69`（`--border-hairline` 等基础令牌）及全站 60+ 处（构建产物中实测 69 处）
- 现状：`color-mix()` 需要 Safari ≥16.2 / Chrome ≥111。不支持的浏览器会**整条丢弃声明**——基础边框、纸面背景、悬停态会成片消失。中国用户常见的旧安卓 WebView（微信内置浏览器老版本）命中风险真实存在。
- 建议：为关键令牌提供静态回退值，例如：
  ```css
  --border-hairline: 1px solid #9fbcc2; /* 回退 */
  --border-hairline: 1px solid color-mix(in srgb, var(--color-line), transparent 24%);
  ```
  对装饰性用法可接受不处理，但基础令牌（边框、纸面、文字色）必须有回退。`.site-header` 的 `background: color-mix(...)` 同理。

### H3. 部署缓存头遗漏 `/_astro/*`（重复访问性能损失）
- 位置：`public/_headers`
- 现状：`_headers` 只覆盖 `/fonts/*`、`/assets/*`、`/images/*`。Astro 的内容哈希产物全部在 `/_astro/*`（JS/CSS/优化后图片），目前没有任何 Cache-Control 规则，只能靠浏览器启发式缓存。
- 建议：追加：
  ```
  /_astro/*
    Cache-Control: public, max-age=31536000, immutable
  ```
  `/_astro/*` 文件名含内容哈希，长缓存是安全的。这是全站重复访问收益最大的一项改动。

## 中优先级问题

### M1. 多处触摸目标小于 44×44px
- `.weather-mode-control__button` 高 42px（430px 以下缩到 40px）；`HomeKindIndex` 标签链接 min-height 30px；`.scene-guide__expand` 28px、章节切换 26×28px；`.prose-code__copy` 约 22px；搜索筛选钮 40px。
- 建议：触摸主交互统一 ≥44px；纯装饰性小按钮可用 `padding` 扩大热区而不改视觉尺寸（`min-height` + 负 margin 或 `::before` 扩热区）。

### M2. 9px muted 小字对比度不达标
- `--ink-muted` 在 rain 模式约 4.4:1、clear 模式约 4.0:1，用于 9–10px 的 HUD 眉题文字（home.css、article-tabs、post-meta 等），低于 WCAG AA 对小字号 4.5:1 的要求。
- 建议：为「仅装饰的 HUD 代号」保留现状可接受，但承担信息的小字（日期、阅读时长、标签）建议加深 `--ink-muted` 或增大字号到 11px+。

### M3. 灯箱原图体积过大
- `src/assets/images/collection/`：`garden-full.webp` 2.27MB、`rain-umbrella-full.webp` 1.3MB、`butterflies-full` 576KB。虽按需加载，单张 2MB+ 在移动网络下体验差。
- 建议：重新导出为最长边 ≤1920、quality 75–80 的 webp，目标单张 ≤500KB；或用 `<Image>`/`getImage` 生成多档 srcset。

### M4. 文章页存在无效 preload
- 位置：`BaseLayout.astro:73-75` + `ArticleLayout.astro:37`
- 无自定义封面的文章，`image` 回退为 `default-day/night.webp`，head 会 preload 这张图——但首屏实际渲染的是 `ContentCoverScene`（纯 CSS 场景），preload 的 25–37KB 完全浪费；同理，预载的 Noto Serif SC 分片（56.8KB）在 HarmonyOS Sans 优先的字体栈下几乎不会被使用。
- 建议：preload 仅在 `post.data.cover` 真实存在时注入；Noto 分片预载改为预载 HarmonyOS 常用字分片，或直接移除第三个 preload。

### M5. `markdown.processor` 是无效配置
- 位置：`astro.config.mjs:22`
- 已核对 Astro 7 配置 schema：**不存在 `markdown.processor` 选项**，该键被静默忽略（GFM 本就默认开启）。当前属于死代码，且会让人误以为 GFM 由它提供。
- 建议：删除 `processor` 与 `unified` 导入；如需显式声明，用 `markdown: { gfm: true }`。

### M6. 共享 CSS 包 273KB（gzip 约 78KB），@font-face 声明是主因
- `dist/_astro/BaseLayout.*.css`：201 条 @font-face、36 条 keyframes。其中 106 个 Noto Serif SC 分片的 @font-face 在字体栈中排在 HarmonyOS 之后，几乎不命中，属于声明层面的死重（unicode-range 保证运行时不下载，但声明本身占 CSS 体积）。
- 建议：若确认 Noto 仅作极端生僻字兜底，可将其 @font-face 拆到独立的 `noto-fallback.css`，仅在需要的页面注入；或精简分片数量。

### M7. 交互组件的全局监听依赖「常驻页头」这一隐含前提
- `WeatherModeControl`（document 的 `astro:after-swap`、window 的 `storage`）与 `AmbientToggle`（Audio 实例、rAF、pauseTimer）均无 before-swap 清理。当前它们只被渲染在 `transition:persist` 的 SiteHeader 内、且有 `*Ready` 守卫，因此**实际无泄漏**；但一旦未来在非持久上下文复用，会出现旧闭包换页后继续生效（天气被改回旧值、双重雨声）。
- 建议：为两个组件补上 `astro:before-swap` 清理（AbortController），或至少在组件注释中固化「仅用于持久化页头」的约束。
- 同类小问题：`Lightbox` 关闭后焦点未归还触发元素（键盘用户丢失位置）；`SceneGuide` cleanup 未 `cancelAnimationFrame`；giscus 无加载超时兜底。

### M8. 断点体系混用 px 与 rem
- 核心样式用 48rem/64rem，组件用 1240/1100/1000/900/760/430px。760px 与 48rem(768px) 之间存在 8px 的行为分裂区（JS 里也有 `matchMedia('(max-width: 760px)')` 写死）。
- 建议：统一为一套断点令牌（CSS 变量无法用于媒体查询，可用 Sass 式常量注释约定或在 tokens.css 头部集中注释声明），JS 侧改为读取同一数值。

---

## 低优先级问题

| # | 位置 | 问题 | 建议 |
|---|------|------|------|
| L1 | `404.astro` | h1 固定 64px、容器 min-height 680px，无移动端断点 | 加 clamp 字级与 min-height 媒体查询 |
| L2 | `reset.css` | 全站隐藏滚动条；`html{min-width:20rem}` 使 <320px 设备强制横滚 | 至少保留桌面滚动位置提示；min-width 评估必要性 |
| L3 | `BaseLayout.astro` head | 缺 `og:image:width/height`、`twitter:title/description`（目前仅 `twitter:card`，实际会回退 og，影响轻微） | 补全 meta |
| L4 | `BaseLayout.astro` | `Astro.generator` 暴露精确版本号 | 可删，信息泄露风险极低 |
| L5 | `astro-source-learning-day1/day2.md` | 半角标点与全站全角风格不一；day2:82 引号成对错误（`回答”HTML在哪里生成”`）；day2:51 列表混入 `<br>` | 统一标点规范 |
| L6 | 内容规范 | 封面路径两种风格并存（`/images/hero-bg.webp` 与 `/assets/images/posts/…`），均有效 | 统一归档到一种约定 |
| L7 | 全站文章 | `featured` 全为 false，首页精选位恒回退为最新文章 | 确认是否有意；若想人工策展，给目标文标 `featured: true` |
| L8 | `SearchDialog` | 渲染防抖定时器在关闭/换页时未 clear | clearTimeout，影响极小 |
| L9 | `dist/_astro/*.css` 中 69 处 color-mix | 同 H2，构建后验证入口 | 修复后可用 `grep -c color-mix dist/_astro/*.css` 复查 |

---

## 确认无问题的方面（抽查结论）

- **结构与导航**：`SECTION_NAV_ITEMS` 单一出处，页头/文章侧轨共用；`aria-current` 在换页后由脚本重同步；栏目切换带方向感的转场设计完整；无移动端汉堡菜单但导航改横向滚动，是成立的替代模式。
- **内容健康度**：30 篇 md 全部通过 schema 校验；图片引用（含中文路径）全部真实存在、大小写一致；无死链、无草稿误发布、标题层级无跳级。
- **安全**：`_headers` 已配置 nosniff / X-Frame-Options DENY / Referrer-Policy / Permissions-Policy（`/*` 为 Cloudflare 合法全路径语法）；localStorage 读写全部 try/catch；无第三方脚本默认注入（giscus 未配置时渲染安静占位）；`rel="noreferrer"` 外链处理正确。静态站无 CSP 可接受，如后续接入评论可再评估。
- **性能工程**：JS 总计约 64KB（10 个分包）；字体子集 unicode-range 按需加载；雨声 mp3 `preload=none`；speculation rules 中等预取；WebGL 背景有完整 DOM 回退；reduced-motion 覆盖全面。
- **SEO**：canonical、og 基础标签、RSS（含 atom 自引用）、robots.txt、sitemap 集成齐全；404 正确 noindex。

## 建议的行动顺序

1. 本地终端重跑 `pnpm build`（恢复 dist）→ 追加上 H3 的 `/_astro/*` 缓存规则后部署
2. H1（about 网格溢出）——10 分钟可修
3. H2（color-mix 回退）——集中处理 tokens.css 基础令牌即可覆盖 80% 风险面
4. M1/M2（触摸目标与对比度）——一次 a11y 专项
5. M3/M4/M6（图片与 preload、CSS 瘦身）——性能专项
