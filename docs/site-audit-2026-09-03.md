# aria7-blog 全面审查报告（2026-09-03 复审）

审查日期：2026-09-03 · 审查范围：结构导航 / 性能 / 前端交互 / 响应式 / 内容 / 安全与部署
审查方式：源码逐文件审查（配置、布局、组件、样式、页面路由）+ `astro check` 类型检查 + dist 产物分析 + 全量链接/图片校验脚本 + Playwright 运行时冒烟测试（14 页面 × 3 视口 × 桌面/移动 + 6 组核心交互）

---

## 总体结论

本轮为 2026-09-02 首轮审查后的复审。**上一轮全部高优先级问题（H1–H3）与大部分中低优先级问题（M4/M5/M7、L3/L4/L8/L9）已确认修复**，修复质量高：about 网格改用 `minmax(min(360px,100%),…)` + 1080px 断点；`/_astro/*` 已加年度 immutable 缓存；preload 仅在真实封面时注入；交互组件（WeatherModeControl / AmbientToggle / SearchDialog / CommentPanel / Lightbox）全部补齐 AbortController 换页清理；`--color-ink-muted` 加深至 #53686d（对纸面约 5.0:1，满足 AA）。

运行时冒烟测试全绿：14 个页面在桌面 1440px 与移动 390px 视口下 **零控制台错误、零 JS 异常、零横向溢出**；搜索、天气切换、ClientRouter 换页、代码复制、图片画廊（缩略图/翻页/继续加载/srcset 按需选择）全部正常。`astro check` 0 错误。全站内部链接与图片引用 0 死链。

当前无高优先级问题。剩余问题集中在**极端条件下的潜伏缺陷**（3x DPR 大图、组件复用场景、极窄视口）与**构建体积优化空间**。

---

## 中优先级问题

### M1. 图片画廊 srcset 含原始 3200w 档，3x DPR 移动端可能拉取 2.3MB
- 位置：`src/components/content/ImageCollection.astro:17-22`（`fullImageWidths`）
- 现状：`widths` 数组在 `item.width >= 1920` 时追加了 `item.width`（3200），srcset 因此包含原始未压缩档（garden-full 2.27MB、rain-umbrella-full 1.3MB）。舞台 `sizes` 为 820px，1x/2x DPR 正确选择 820w/1640w 附近档位（实测选中 820w 变体）；但 3x DPR（多数现代手机）有效需求 2460px，浏览器会选择 3200w 档，单图 2.3MB。
- 建议：展示 srcset 封顶 1920w（移除 `widths.push(item.width)` 分支）；`originalSrc` 已单独保留给下载按钮，原文件仍随构建分发，不影响"下载原图"功能。

### M2. TooltipLayer 触屏 focusin 仍会弹出并滞留
- 位置：`src/components/interactive/TooltipLayer.astro:71-74`
- 现状：`handlePointerOver` 明确过滤 `pointerType === 'touch'`（触屏交给 aria-label），但 `handleFocusIn` 无此过滤。Android Chrome 点按聚焦控件后 tooltip 照常弹出且无 pointerleave 可消除，与既定策略矛盾。
- 建议：focusin 路径增加触屏判定（如最近一次 pointer 事件为 touch 则跳过），或对 touch 设备禁用 focus 触发分支。

### M3. MemoryVault 计数显示全局污染（多实例潜伏）
- 位置：`src/components/interactive/MemoryVault.astro:244-251`
- 现状：`syncCountDisplays` 更新全文档所有 `[data-memory-count]`。当前全站只用一个摘录 storageKey，不暴露；一旦未来出现不同 `storageKey` 的实例（如按文章分册），任一实例的写入会把其他实例计数改写为自己的值。
- 建议：计数节点按 `root` 作用域查询（`root.querySelectorAll`），或给计数节点登记 storageKey 并过滤匹配。

### M4. ArrivalRipples 依赖 transition:persist 的单次初始化链存在断裂风险
- 位置：`src/components/visual/ArrivalRipples.astro:73-113`
- 现状：组件仅在首次加载时初始化，靠 `transition:persist` 保持元素与 `ripplesReady` 标记存活。若未来某次导航的目标页未渲染该组件（persist 元素被 ClientRouter 移除），之后再回到含组件的页面时新元素永远不会初始化，涟漪效果永久失效。当前所有页面经 BaseLayout 均渲染该组件，属潜伏问题。
- 建议：与其它组件一致，在 `astro:page-load` 中重扫并按 `*Ready` 守卫补初始化；或至少在组件注释中固化「必须全站渲染」约束。

---

## 低优先级问题

### L1. 320px 极窄视口页头横向溢出约 15px，被静默裁切
- 位置：`src/components/shell/SiteHeader.astro`（≤430px 工具区规则）+ `src/styles/global.css:12`（`overflow-x: clip`）
- 现状：实测 320px 视口下 `.site-header` 内容（品牌 116px + 工具区 218px + 边距 28px）需求约 362px，scrollWidth=335；溢出部分被 `overflow-x: clip` 裁掉，天气控件右缘不可见且无提示。390px 及以上视口无问题。受影响设备为 320–335px 宽的旧机型（iPhone 5/SE1 时代），影响面小。
- 建议：≤360px 时隐藏雨声开关（`[data-ambient-toggle]` 的按钮容器）或将天气控件 `flex-basis` 降至 40px；二者任选其一即可收回 15px。

### L2. 共享 CSS 273KB（gzip 前），201 条 @font-face 声明是主因
- 位置：`src/styles/fonts.css`（106 条，含 103 个 Noto Serif SC 分片）+ `src/styles/harmonyos-sans.css`（95 条）
- 现状：BaseLayout 共享 CSS 273KB，其中 Noto Serif SC 在 HarmonyOS Sans 优先的字体栈下几乎不命中，但 103 条声明仍随首屏 CSS 下发（unicode-range 保证不下载字体文件，仅声明本身占体积）。上轮 M6 未处理。
- 建议：将 Noto Serif SC 的 @font-face 拆到独立 `noto-fallback.css` 并仅在极少数需要兜底的场景注入；或接受现状（gzip 后增量有限），但应作为已知债务记录。

### L3. 断点体系 rem 与 px 混用，760/768 存在 8px 行为分裂区
- 位置：`src/styles/tokens.css:143`（48rem）vs 各组件（1240/1100/1000/900/760/430px）；JS 侧 `RainField.astro:737` 写死 `matchMedia('(max-width: 760px)')`
- 现状：上轮 M8 未处理。48rem（768px）与 760px 之间的 8px 区间内，令牌字号已缩小而组件布局未切换，某些元素会有轻微比例失调（非溢出）。
- 建议：统一为一套常量约定（tokens.css 头部集中注释声明 + JS 从单一模块读取），或将令牌断点改为 47.5rem 对齐 760px。

### L4. 标签大小写不敏感合并存在 404 链接风险（潜伏）
- 位置：`src/lib/content.ts:180-195`（`collectTagCounts`）+ `ArticleRow.astro:41` / `HomeKindIndex.astro:54`
- 现状：标签按小写归一合并，但仅保留首见 label 生成路径；若两篇文章分别使用 "Astro" 与 "ASTRO"，只有前者路径被生成，后者的原始 label 链接 404。当前标签集全为中文，不受影响。
- 建议：链接生成处也走 `collectTagCounts` 的归一映射，而不是原样 `encodeURIComponent(post.data.tags)`。

### L5. HomeRecent 窄视口判定仅初始化一次，旋转后失效
- 位置：`src/components/home/HomeRecent.astro:222`
- 现状：`compactViewport` 在初始化时判定一次；移动端旋转到桌面宽度（或反向）后不会重建/拆除复制组，行为失配直至下次导航。
- 建议：改用 `matchMedia(...).addEventListener('change')` 响应式重判。

### L6. 归档日历"今天"使用本地时区，非 UTC 边界日误标
- 位置：`src/components/content/ArchiveCalendar.astro:331-333`
- 现状：日历格按 UTC 生成，`is-today` 用本地 `getFullYear/getMonth/getDate`；UTC+8 时区在 08:00 前会把"今天"标在前一格。
- 建议：统一用 UTC 或 `Date` 全程本地化二选一。

### L7. ArticleGraph 边 key 与移动端提示细节
- 位置：`src/components/content/ArticleGraph.astro:83/111/231-234`
- 现状：边 key 用 `--` 拼接 post.id，id 含 `--` 时 `indexOf('--')` 解析错位（当前 id 均不含）；悬停提示在 canvas 已隐藏的移动端（≤48rem）仍然渲染。
- 建议：key 改用不可见分隔符（如 `\u0000`）；提示文案按媒体查询隐藏。

### L8. 空状态与分页的细节缺口
- `tags/index.astro`：无标签时缺空状态文案，只剩空网格框线（低）。
- `types/[kind].astro:79`：essay 无文章渲染 `null`，其他类型有 `.empty` 提示，行为不一致（低）。
- `posts/index.astro`：全部文章单页输出无分页，当前 17 篇可接受，文章量过百后需分页或虚拟化（低，记为债务）。

### L9. 其他已知小项
- `404.astro`：h1 固定 64px、min-height 680px 无移动断点；实测 390px 下自动换行可读，仅观感偏大（上轮 L1 遗留）。
- `reset.css`：全站隐藏视口滚动条为风格选择，但内容横向溢出时用户无任何视觉提示（配合 L1 的 clip 静默裁切，排查困难）；`html{min-width:20rem}` 对 ≥320px 设备已无副作用。
- 首页 `featured` 全为 false，精选位恒回退最新文章——若有意可忽略（上轮 L7 遗留）。
- `about.astro` QQ 群链接含公开 authKey，会过期（注释已自知，属权衡）。
- `tool-guides/toolbox.md`（CSDIY 上游同步内容）含 6 个 `http://` 明文链接（含 libgen/zlib onio­n 地址），上游内容不可控，如介意可在同步脚本中过滤或加提示。

---

## 确认无问题的方面（本轮实测结论）

- **结构与导航**：`SECTION_NAV_ITEMS` 单一出处；栏目/标签/归档/关系图/RSS/搜索入口齐全；`aria-current` 换页后由脚本重同步；`transition:persist` 页头 + 指示线滑移正常（实测）。
- **性能工程**：JS 总计约 65KB（10 个分包）；字体 unicode-range 按需分片；首屏仅预载 2 个拉丁子集；speculationrules 中等预取；`/_astro/*` 一年 immutable 缓存 + `/fonts/*` 月缓存 + `/assets/* /images/*` 周缓存（`_headers` 已验证）；雨声 mp3 `preload=none` 按需 2.9MB；WebGL 背景单 pass 着色器 + DOM 完整回退 + reduced-motion 冻结。
- **前端交互（实测）**：搜索（`/` 快捷键、防抖、筛选、显示更多、未读排序）✓；天气三档切换 + localStorage + 跨页恢复 ✓；ClientRouter 换页 + 页头持久化 + 后退 ✓；代码复制按钮"已复制"反馈 ✓；画廊 11 缩略图/翻页/继续加载/srcset 按需 ✓；14 页面零控制台错误。
- **内容健康度**：30 篇 md 全部通过 zod schema；全站图片/链接/cover 引用 0 死链（脚本全量校验）；dist 内部链接 0 失效；草稿过滤正常。
- **安全**：`_headers` 配置 nosniff / X-Frame-Options DENY / Referrer-Policy / Permissions-Policy；localStorage 读写全部 try/catch；无 innerHTML 直插用户数据（搜索高亮走 textContent + mark 节点）；外链 `rel="noreferrer"`；giscus 未配置时不注入第三方脚本；404 正确 noindex。
- **SEO**：canonical（含尾斜杠与 trailingSlash 一致）、og/twitter 完整、RSS 自引用 + lastBuildDate、robots.txt 指向 sitemap、sitemap 集成正常。
- **类型检查**：`astro check` 0 错误 0 警告（仅 execCommand 弃用提示，属已知兜底）。

---

## 按优先级排序的处理清单

| 序 | 项 | 位置 | 工作量 | 预期收益 |
|----|----|------|--------|----------|
| 1 | M1 画廊 srcset 封顶 1920w | ImageCollection.astro:17-22 | 5 分钟 | 3x DPR 移动端单图 2.3MB → ≤1.5MB |
| 2 | M2 TooltipLayer 触屏 focusin 过滤 | TooltipLayer.astro:71-74 | 15 分钟 | 消除 Android 触屏 tooltip 滞留 |
| 3 | L1 320px 页头溢出（隐藏雨声或缩窄控件） | SiteHeader.astro ≤360px 规则 | 10 分钟 | 极窄设备工具区完整可见 |
| 4 | M3 MemoryVault 计数按 root 作用域 | MemoryVault.astro:244-251 | 15 分钟 | 消除多实例数据污染隐患 |
| 5 | M4 ArrivalRipples 补 page-load 初始化 | ArrivalRipples.astro:73-113 | 20 分钟 | 消除 persist 断裂后永久失效 |
| 6 | L4 标签链接走归一映射 | ArticleRow / HomeKindIndex | 30 分钟 | 消除大小写标签 404 风险 |
| 7 | L5 HomeRecent 响应式重判 | HomeRecent.astro:222 | 20 分钟 | 旋转后行为正确 |
| 8 | L6 归档日历时区统一 | ArchiveCalendar.astro:331 | 15 分钟 | "今天"标记全天正确 |
| 9 | L3 断点常量统一 | tokens.css + RainField JS | 1–2 小时 | 消除 8px 分裂区，长期可维护性 |
| 10 | L2 Noto @font-face 拆分 | fonts.css | 半天 | 共享 CSS 273KB → 约 170KB |
| 11 | L7/L8/L9 小项批量清理 | 各处 | 半天 | 空状态一致化、边 key、404 断点等 |

> 1–5 为低成本高确定性修复，建议一次提交完成；6–8 为潜伏缺陷，随功能迭代顺手处理；9–11 为结构性优化，可排入专项。

---

*构建复核说明：本次审查基于 2026-09-03 17:04 构建的 dist 产物；`astro check` 与 Playwright 冒烟测试均在本机通过。部署前请以最新提交重新构建。*
