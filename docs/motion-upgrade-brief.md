# 滚动动效融合任务书

> 面向执行者（Claude Code）的实施简报。目标：在 aria7-blog 现有「雨天档案」动效体系上，融合七组新前端动效，且不破坏 `docs/visual-spec.md` 建立的设计语言、性能边界与无障碍红线。
>
> 使用方法：在 Claude Code 中执行 `@docs/motion-upgrade-brief.md 按本任务书分阶段实施`。

## 0. 开始之前：必读文件

按顺序读完再动手，禁止跳过：

1. `AGENTS.md` —— pnpm 工作流、`astro dev --background` 后台模式
2. `docs/visual-spec.md` —— 重点读 §5 动效与节奏、§7.4 组件规范、§7.6 响应式与可访问性边界、§7.7 应做与不应做
3. `src/styles/tokens.css` —— 时长五档（fast 140 / base 260 / slow 520 / arrival 560 / scene 720ms）与 `--ease-rain` / `--ease-drift`
4. `src/styles/motion.css` —— 两级 reduced-motion 策略的注释与实现
5. `src/pages/index.astro` —— `initHomeReveal` 全页显现协调器与 `astro:page-load` / `astro:before-swap` 生命周期模式
6. `src/components/visual/HeroScene.astro` —— 现有四拍舞台与 `hero-liquid` SVG 液态滤镜（流体扭曲的升级起点）
7. `src/components/content/ImageCollection.astro` 与 `src/data/image-collection.ts` —— 3D 轮播的改造对象与数据源

## 1. 现状一句话

首页已有：HeroScene 四拍自动循环舞台（Canvas 雨线 + SVG 制图）、`initHomeReveal` 入场协调器、WeatherTransition / RouteTransition 全屏过场、`hero-liquid` 静态噪声液态滤镜。**新动效是叠加层，不是重构**——所有既有节拍系统保持原样。

## 2. 七组动效：落点与规格

分三个阶段交付，**每阶段完成后停下来汇报**，不要一口气全做完。

### P1 —— 低风险基础（纯 CSS/JS）

#### ① 逐字错峰入场

- **落点**：`HomeHero` 站点标题、`PageHeader` 页面 H1。仅限展示级标题，禁止用于正文、摘要、按钮、导航。
- **规格**：JS 拆分为逐字 `<span>`（CJK 按字、拉丁按词分组内按字、标点跟随前字），原始文本保留在 `aria-label`，拆分 span 全部 `aria-hidden="true"`。错峰 `transition-delay: calc(var(--char-index) * 24ms)`，总时长落在 `--duration-slow` 档内。
- **集成**：复用现有 `data-home-reveal` / `is-in-view` 机制触发，不新建第二套入场系统。注意逐字 span 不得破坏 CJK 断行——按词分组包裹 `white-space: nowrap`，组内可断。
- **降级**：reduced-motion 直接呈现终态（走 motion.css 第 1 级兜底）。
- **设计语义**：visual-spec §3 歌词排版与 §5.2「主信息通过固定位置保持可读」——文字显现是建立节拍，不是持续演出。

#### ② 局部滚动吸附

- **落点**：仅为 P3 的 3D 轮播容器与场景叙事带容器服务，**严禁** `html` / `body` 级全局吸附（长文阅读是本站核心，全局吸附会毁掉它）。
- **规格**：容器级 `scroll-snap-type: y proximity`（不用 mandatory，避免陷死）；吸附点不超过 4 个。
- **降级**：reduced-motion 下 `scroll-snap-type: none`。

### P2 —— 滚动驱动核心

#### ③ 滚动叠层转场

- **落点**：首页 `HomeFeatured` → `HomeRecent` → `HomeKindIndex` → `HomeCoda` 区块衔接。`HomeHero` 不参与（它有自己的四拍舞台）。
- **规格**：`position: sticky; top: 0` 依次叠放，后层覆盖时前层 `scale(0.96)` + 叠一层 `opacity` 黑罩收暗（避免 `filter`，太贵）。叠层深度不超过 3 层。
- **集成**：与 `initHomeReveal` 协调器合并管理，共享同一套 IO / scroll 观察，禁止各区块自挂 `scroll` listener。

#### ④ 滚动驱动全屏扩展转场

- **落点**：`HomeFeatured` 精选文章封面、文章页 `ContentCoverScene`。
- **规格**：封面随滚动从网格内尺寸扩展到满 bleed——优先 CSS `animation-timeline: view()`，`@supports not (animation-timeline: view())` 时降级为 IO + rAF 驱动 `transform: scale` + `clip-path: inset()`。transform/clip-path only，不触发布局。
- **设计语义**：visual-spec §1.2 图06→09「影像窗纵向拉伸、框架从面板变成环境」——这是该 MV 的原生语法，放心用。
- **边界**：扩展的是**图**，标题与元数据保持静止可读（§5.2 静态锚点原则）。

#### ⑤ 滚动驱动场景切换

- **落点**：新建一个首页中段叙事带组件（建议 `src/components/home/HomeSceneStrip.astro`），3–4 个场景，**不要**改造现有五个区块。
- **规格**：容器 `height: 300vh`+ 内层 sticky，滚动进度映射场景透明度/位移切换；每场景带 `SCENE/01` 式编号 HUD（§1.2 图37–40 的语言，与 `ContentCoverScene` 的场景编号母题同源）。单场景事件时长对应 `--duration-scene` 档。
- **节奏红线**：visual-spec §5.2「每次高密度后都安排换气」「章节切换常靠清空」——场景之间必须有一个低密过渡帧，禁止全程高密度。
- **降级**：reduced-motion 下退化为静态纵向排列的场景卡片。

### P3 —— 重度组件（独立隔离）

#### ⑥ 滚动驱动 3D 环形轮播

- **落点**：改造 `ImageCollection`（现有 12 张 collection 图，天然环形数据源）。
- **规格**：CSS 3D——12 张图 `rotateY(calc(var(--i) * 30deg)) translateZ(var(--ring-radius))` 排环；容器 sticky + 滚动进度驱动整环 `rotateY`。同时支持指针拖拽作为辅助输入。保留现有点击进入 `Lightbox` 的能力。
- **性能**：transform-only 动画；图片用现有 thumb 规格，不加载 full 图进环。
- **降级**：reduced-motion / 无 3D 支持时退化为横向平滑滚动列表（配合 ② 的局部吸附）。
- **设计语义**：对应 §1.1「同一主体多尺度复现」与图18–20 归档柱阵的空间化——环形轮播是「归档」的立体化，不是炫技。

#### ⑦ 交互式流体扭曲

- **落点 A（必做）**：升级 `HeroScene` 现有 `hero-liquid` 滤镜——鼠标位置/速度驱动 `feDisplacementMap` 的 `scale`（8–24 区间）与噪声中心，rAF + lerp 惯性衰减，只作用于夜间展示字组（`hero-scene__night-word`）这一既有装饰层。
- **落点 B（选做）**：`ContentCoverScene` 封面 hover 水波纹——若做，手写 WebGL2 单 pass 片元着色器（curl noise 位移），独立 ES module，约 200 行内，**不引 Three.js**。
- **红线**：扭曲层永远 `aria-hidden="true"` + `pointer-events: none`；正文、导航、表单、代码块永不进入折射层（visual-spec §2.3、§7.6 的硬性规定）。
- **降级**：reduced-motion 渲染静态帧（沿用现有策略）；`document.visibilitychange` 与离屏时暂停 rAF。

## 3. 全局红线（违反任何一条即返工）

1. **时长/缓动**：一律使用 tokens.css 五档与 `--ease-rain` / `--ease-drift`；新的编排内错拍允许字面值，但必须成组注释（沿用 motion.css 头部注释的规矩）。
2. **reduced-motion**：遵守 motion.css 两级策略——有语义终态的动画靠第 1 级 1ms 兜底，纯演出层第 2 级 `display: none`。新组件先想清楚自己属于哪一级。
3. **生命周期**：所有组件 script 遵循 `dispose` 函数 + `astro:page-load` 初始化 + `astro:before-swap` 清理的模式（View Transitions 下防双重初始化与泄漏）。
4. **性能**：Canvas DPR ≤ 2；粒子数量按画布面积调节；页面隐藏 / 组件离屏时暂停逐帧绘制；滚动监听统一走协调器或 `animation-timeline`，禁止裸挂多个 `scroll` listener。
5. **正文保护区**：680–760px 阅读列内禁止任何扭曲、视差、持续位移；装饰密度峰值只准出现在首屏、专题带、转场（§7.7）。
6. **可访问性**：装饰层 `aria-hidden` + `pointer-events: none`；键盘焦点框不被任何装饰层遮挡；拆分文字必须保留屏幕阅读器可读的原文。
7. **依赖**：默认**零新增运行时依赖**（vanilla JS + CSS scroll-driven animations + IO + rAF）。若评估后认为必须引入 gsap 等库，先停下来汇报体积成本与收益，经确认后再 `pnpm add`。
8. **工作流**：pnpm，不用 npm/yarn；dev server 用 `astro dev --background`。

## 4. 每阶段验收清单

- [ ] `pnpm check` 与 `pnpm build` 通过
- [ ] 360 / 768 / 1280 / 1440px 四档宽度目检：无文字被装饰遮挡、无布局抖动（§最终落地优先级第 4 条）
- [ ] 系统开启「减少动态效果」后：全部页面静态完整可读，无 `opacity: 0` 卡死元素
- [ ] DevTools Performance：滚动期间无长任务 > 50ms；页面切后台后 rAF 停止
- [ ] 键盘 Tab 走查：焦点顺序正确，焦点框始终可见
- [ ] 装饰层全开 / 全关两种状态下，信息层级不变（§7.6：关闭动效后版式必须仍然完整）

## 5. 阶段交付顺序

```
P1（① 逐字入场 + ② 局部吸附）        → 汇报 → 确认
P2（③ 叠层 + ④ 全屏扩展 + ⑤ 场景带）  → 汇报 → 确认
P3（⑥ 3D 轮播 + ⑦ 流体扭曲）          → 汇报 → 整体验收
```

每阶段汇报内容：改动文件清单、动效落点截图/录屏说明、验收清单逐项结果、遇到的问题与取舍。
