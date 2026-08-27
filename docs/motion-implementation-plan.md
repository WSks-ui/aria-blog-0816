# 滚动动效融合实施设计书

> 版本：v1.0  
> 日期：2026-08-25  
> 基于：`docs/motion-upgrade-brief.md` 任务书  
> 面向：开发执行与技术审查

## 目录

- [1. 项目概览](#1-项目概览)
- [2. P1 阶段：低风险基础层](#2-p1-阶段低风险基础层)
- [3. P2 阶段：滚动驱动核心](#3-p2-阶段滚动驱动核心)
- [4. P3 阶段：重度交互组件](#4-p3-阶段重度交互组件)
- [5. 性能与可访问性保障](#5-性能与可访问性保障)
- [6. 测试与验收标准](#6-测试与验收标准)

---

## 1. 项目概览

### 1.1 目标

在 aria7-blog 现有「雨天档案」动效体系上，**叠加**（而非重构）七组新前端动效，保持 `docs/visual-spec.md` 建立的设计语言、性能边界与无障碍红线。

### 1.2 核心约束

| 约束类型 | 具体要求 |
|---------|---------|
| **时长体系** | 五档：fast 140ms / base 260ms / slow 520ms / arrival 560ms / scene 720ms |
| **缓动曲线** | `--ease-rain: cubic-bezier(0.22, 0.75, 0.28, 1)` / `--ease-drift` |
| **降级策略** | 两级 reduced-motion：1级=1ms兜底，2级=display:none |
| **生命周期** | `astro:page-load` 初始化 + `astro:before-swap` 清理 + dispose 函数 |
| **依赖原则** | 零新增运行时依赖（vanilla JS + CSS + IO + rAF） |
| **正文保护** | 680–760px 阅读列禁止扭曲/视差/持续位移 |

### 1.3 交付节奏

```
P1（2项）→ 汇报停止 → 用户确认 → P2（3项）→ 汇报停止 → 用户确认 → P3（2项）→ 最终验收
```

---

## 2. P1 阶段：低风险基础层

### 2.1 ① 逐字错峰入场

#### 2.1.1 功能定位

**落点**：`HomeHero` 站点标题（"Aria-7"）、`PageHeader` 所有页面 H1 标题  
**设计语义**：建立节拍，非持续演出（visual-spec §3 歌词排版 + §5.2 固定位置保持可读）  
**禁用范围**：正文、摘要、按钮、导航（任何非展示级标题）

#### 2.1.2 技术架构

```
┌─────────────────────────────────────────────────────────┐
│ 文本输入（"Aria-7"）                                      │
└──────────────┬──────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────┐
│ splitTextForStagger(text, config)                       │
│ ├─ 拆分逻辑：CJK按字 / 拉丁按词分组内按字 / 标点跟前字     │
│ ├─ XSS防护：escapeHtml() 处理所有文本                    │
│ └─ 输出HTML：<span class="stagger-char" style="...">    │
└──────────────┬──────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────┐
│ Astro组件注入（set:html + aria-label原文）               │
└──────────────┬──────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────┐
│ CSS动画定义（stagger-entrance.css）                      │
│ ├─ 初态：opacity:0 + translateY(0.4em)                  │
│ ├─ 延迟：transition-delay: var(--char-delay)            │
│ └─ 触发：.is-in-view 类添加 → 执行transition            │
└──────────────┬──────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────┐
│ Intersection Observer触发（复用data-home-reveal机制）    │
└─────────────────────────────────────────────────────────┘
```

#### 2.1.3 实现细节

**文件清单：**

| 文件 | 状态 | 职责 |
|------|------|------|
| `src/lib/motion-utils.ts` | 新建 | 拆字函数 + HTML 转义 |
| `src/styles/stagger-entrance.css` | 新建 | 逐字动画样式 |
| `src/layouts/BaseLayout.astro` | 修改 | 全局引入样式（第 10 行） |
| `src/components/home/HomeHero.astro` | 修改 | 站点标题接入 + 清理旧动画 |
| `src/components/content/PageHeader.astro` | 修改 | 页面 H1 接入 |

**拆字函数签名：**

```typescript
export interface StaggerConfig {
  charDelay?: number;    // 单字错峰间隔，默认 24ms
  maxDuration?: number;  // 总时长上限，默认 520ms（--duration-slow）
}

export function splitTextForStagger(text: string, config?: StaggerConfig): string;
```

**拆分规则：**

- CJK 字符（`0x4e00`–`0x9fff`）逐字独立包裹，允许在字间断行
- 拉丁文本先按空格分词，词内逐字包裹，词容器加 `white-space: nowrap` 防止词中断行
- 标点紧跟前一字符，不单独成组
- 每个 `<span>` 注入 `style="--char-index: N; --char-delay: Nms"`

**核心 CSS：**

```css
.stagger-char {
  display: inline-block;
  opacity: 0;
  transform: translateY(0.4em);
  transition:
    opacity var(--duration-slow) var(--ease-rain),
    transform var(--duration-slow) var(--ease-rain);
  transition-delay: var(--char-delay, 0ms);
}

.is-in-view .stagger-char {
  opacity: 1;
  transform: translateY(0);
}
```

**组件接入方式：**

```astro
---
import { splitTextForStagger } from '@/lib/motion-utils';
const titleStaggered = splitTextForStagger(title, { charDelay: 24, maxDuration: 520 });
---
<h1 set:html={titleStaggered} data-home-reveal></h1>
```

`aria-label` 由 `splitTextForStagger` 在最外层容器上输出原文，内部所有拆分 span 标记 `aria-hidden="true"`，屏幕阅读器读到的仍是完整标题。

#### 2.1.4 冲突清理

`HomeHero.astro` 原有 `home-title-enter` keyframes 动画与新的 transition 机制争夺 `opacity` / `transform`，已移除：

- 第 61 行 H1 规则删除 `opacity: 0; animation: home-title-enter 480ms var(--ease-rain) 160ms forwards;`
- 删除 `@keyframes home-title-enter` 与 `@keyframes home-title-enter-mobile` 定义

#### 2.1.5 降级路径

reduced-motion 下走 motion.css **第 1 级**兜底（1ms 时长），字符立即呈现终态。因为标题是语义信息层，不能 `display: none`。

#### 2.1.6 验收状态

| 项目 | 结果 |
|------|------|
| `pnpm check` | ✅ 0 errors / 0 warnings / 0 hints |
| `pnpm build` | ✅ 35+ 静态路由全部生成 |
| 四档宽度目检 | ⏳ 待人工验证（dev server 已启动于 4321） |
| reduced-motion | ⏳ 待人工验证 |

---

### 2.2 ② 局部滚动吸附

#### 2.2.1 实施时机决策

任务书将此项列在 P1，但规格明确其**唯一服务对象**是 P3 的两个容器：3D 环形轮播、场景叙事带。这两个容器在 P1 阶段尚不存在。

**决策：推迟到 P3 与目标容器同批交付。**

理由：

1. 规格严格限定应用范围，现有滚动容器（如 `.recent-stage__visual`）不在落点内，提前改动会无谓改变既有交互
2. `scroll-snap-align` 与 `scroll-snap-stop` 的参数需要根据实际容器高度与吸附点分布调优，脱离容器无法确定
3. P1 剩余工作量归零，可立即进入 P2，节奏更紧凑

#### 2.2.2 规格预留

P3 实施时按以下规格落地：

```css
.snap-container {
  scroll-snap-type: y proximity;  /* 严禁 mandatory，避免滚动陷死 */
  overscroll-behavior-y: contain;
}

.snap-container > .snap-point {
  scroll-snap-align: start;
  scroll-snap-stop: normal;
}

@media (prefers-reduced-motion: reduce) {
  .snap-container { scroll-snap-type: none; }
}
```

**硬性边界：**

- 吸附点数量 ≤ 4
- 严禁 `html` / `body` 级全局吸附（长文阅读是本站核心）
- 仅容器级作用域

---

## 3. P2 阶段：滚动驱动核心

### 3.1 ③ 滚动叠层转场

#### 3.1.1 落点

首页区块衔接：`HomeFeatured` → `HomeRecent` → `HomeKindIndex` → `HomeCoda`。  
`HomeHero` **不参与**（它有自己的四拍舞台，叠层会打断节奏）。

#### 3.1.2 技术方案

```
滚动方向 ↓

┌──────────────────┐  ← HomeFeatured (sticky, top:0)
│  z-index: 1      │     被覆盖时 scale(0.96) + 黑罩 opacity 渐显
├──────────────────┤
│  HomeRecent      │  ← z-index: 2，向上滑入覆盖前层
│  z-index: 2      │
├──────────────────┤
│  HomeKindIndex   │  ← z-index: 3
└──────────────────┘
      最大叠层深度 3 层
```

**关键实现：**

- 前层收暗用**叠加一层纯色 `::after` 黑罩改 opacity**，不用 `filter: brightness()`（filter 触发重绘，成本高）
- `scale(0.96)` 走 transform，不触发布局
- 叠层深度硬上限 3 层，超出则前层直接 `visibility: hidden` 退出合成

#### 3.1.3 协调器集成

**红线：禁止各区块自挂 `scroll` listener。**

统一并入 `src/pages/index.astro` 的 `initHomeReveal` 协调器：

```
initHomeReveal (已存在)
├─ 现有职责：入场显现（data-home-reveal → is-in-view）
└─ 新增职责：叠层进度计算
   ├─ 单个 IO 观察所有叠层区块
   ├─ 单个 rAF 循环统一读取 boundingClientRect
   └─ 批量写入 CSS 变量 --layer-progress（0→1）
```

读写分离：一帧内先集中读取所有 rect（避免布局抖动），再集中写入样式。

#### 3.1.4 降级

reduced-motion 下 `position: static` + 取消 scale/黑罩，区块恢复常规纵向流。

### 3.2 ④ 滚动驱动全屏扩展转场

#### 3.2.1 落点

- `HomeFeatured` 精选文章封面
- 文章页 `ContentCoverScene`

#### 3.2.2 双轨实现（渐进增强）

**首选：CSS scroll-driven animations**

```css
@supports (animation-timeline: view()) {
  .cover-expand {
    animation: cover-bleed linear both;
    animation-timeline: view();
    animation-range: entry 20% cover 60%;
  }
}

@keyframes cover-bleed {
  from { transform: scale(1);    clip-path: inset(0 round 12px); }
  to   { transform: scale(1.08); clip-path: inset(0 round 0px); }
}
```

零 JS 成本，在合成器线程运行，滚动期间不占主线程。

**降级：IO + rAF**

```
@supports not (animation-timeline: view())
  → IO 检测进入视口
  → rAF 循环读取滚动进度
  → 写入 --expand-progress 变量
  → CSS 用 calc() 消费该变量驱动 transform + clip-path
```

#### 3.2.3 性能边界

- **仅** `transform` + `clip-path`，绝不动 `width` / `height` / `top` / `left`
- 扩展元素加 `will-change: transform` 但**仅在 IO 命中期间**，离屏立即移除（避免长期占用合成层内存）

#### 3.2.4 设计语义约束

visual-spec §1.2 图06→09「影像窗纵向拉伸、框架从面板变成环境」——这是源 MV 的原生语法。

**边界（§5.2 静态锚点原则）：扩展的只有图，标题与元数据保持静止可读。** 文字不参与任何缩放或位移。

---

### 3.3 ⑤ 滚动驱动场景切换

#### 3.3.1 落点

**新建** `src/components/home/HomeSceneStrip.astro`，插入首页中段。  
**不改造**现有五个区块。

#### 3.3.2 结构设计

```astro
<section class="scene-strip" style="height: 300vh">   <!-- 滚动轨道 -->
  <div class="scene-strip__stage">                    <!-- sticky 舞台 -->
    <div class="scene-strip__hud">SCENE / 01</div>    <!-- 编号 HUD -->
    <div class="scene" data-scene="0">...</div>
    <div class="scene" data-scene="1">...</div>
    <div class="scene" data-scene="2">...</div>
  </div>
</section>
```

滚动进度 0→1 映射到场景索引，每场景切换事件对应 `--duration-scene`（720ms）档。

#### 3.3.3 节奏红线

visual-spec §5.2「每次高密度后都安排换气」「章节切换常靠清空」。

**场景之间必须插入低密过渡帧**：

```
场景1(高密) → 过渡帧(清空/低密) → 场景2(高密) → 过渡帧 → 场景3(高密)
```

进度映射建议：每个场景占 30% 进度，中间 5% 为过渡窗口，该窗口内两侧场景都降到低不透明度。

#### 3.3.4 HUD 编号母题

`SCENE/01` 式编号，与 `ContentCoverScene` 的场景编号同源（visual-spec §1.2 图37–40）。等宽字体、小字号、低对比。

#### 3.3.5 降级

reduced-motion 下：容器 `height: auto`，sticky 取消，场景退化为**静态纵向排列的卡片**，HUD 编号保留作为章节标识。

---

## 4. P3 阶段：重度交互组件

### 4.1 ⑥ 滚动驱动 3D 环形轮播

#### 4.1.1 落点

改造 `src/components/content/ImageCollection.astro`，数据源 `src/data/image-collection.ts`（现有 12 张图，天然环形）。

#### 4.1.2 3D 几何

```
12 张图均匀分布于圆环：单张角距 = 360° / 12 = 30°

.ring-item {
  transform:
    rotateY(calc(var(--i) * 30deg))
    translateZ(var(--ring-radius));
}

.ring {
  transform-style: preserve-3d;
  transform: rotateY(var(--ring-rotation));   /* 滚动驱动 */
}
```

`--ring-radius` 按视口宽度用 `clamp()` 调节，保证窄屏不溢出。

#### 4.1.3 双输入模型

| 输入 | 行为 |
|------|------|
| 滚动 | 容器 sticky 期间，滚动进度驱动 `--ring-rotation` |
| 指针拖拽 | 辅助输入，pointerdown/move/up 累加旋转量，释放后惯性衰减 |

两者写同一个变量，拖拽期间暂停滚动驱动避免冲突。

**保留现有点击进入 `Lightbox` 的能力**——3D 变换不能吃掉点击事件。

#### 4.1.4 性能

- transform-only 动画
- **图片只用现有 thumb 规格，不加载 full 图进环**
- 背面图片 `backface-visibility: hidden`
- 离屏时暂停 rAF

#### 4.1.5 降级

- reduced-motion 或无 3D 支持（`@supports not (transform-style: preserve-3d)`）→ 退化为**横向平滑滚动列表**，配合 ② 的局部吸附提供停靠感
- 这是 ② 的第一个真实落点

#### 4.1.6 设计语义

对应 §1.1「同一主体多尺度复现」与图18–20 归档柱阵的空间化。环形轮播是「归档」概念的立体化表达，不是炫技。

---

### 4.2 ⑦ 交互式流体扭曲

#### 4.2.1 落点 A（必做）：HeroScene 液态滤镜升级

升级现有 `hero-liquid` SVG 滤镜，从静态噪声变为鼠标驱动：

```
鼠标位置/速度
  → rAF + lerp 惯性衰减
  → 驱动 feDisplacementMap 的 scale（8–24 区间）
  → 驱动 feTurbulence 噪声中心偏移
  → 仅作用于 .hero-scene__night-word（既有装饰层）
```

**参数边界：** `scale` 严格限制在 8–24，超出会把字形撕碎到不可辨识。

#### 4.2.2 落点 B（选做）：ContentCoverScene 水波纹

若实施：

- 手写 WebGL2 单 pass 片元着色器（curl noise 位移）
- 独立 ES module，控制在 200 行内
- **不引 Three.js**（体积成本不可接受）
- 无 WebGL2 支持时静默降级为静态封面

#### 4.2.3 红线

1. 扭曲层永远 `aria-hidden="true"` + `pointer-events: none`
2. **正文、导航、表单、代码块永不进入折射层**（visual-spec §2.3、§7.6 硬性规定）
3. reduced-motion 渲染静态帧
4. `document.visibilitychange` 与离屏时暂停 rAF

---

## 5. 性能与可访问性保障

### 5.1 性能预算

| 指标 | 上限 |
|------|------|
| 滚动期间长任务 | < 50ms |
| Canvas DPR | ≤ 2 |
| 叠层深度 | ≤ 3 |
| 吸附点 | ≤ 4 |
| 新增运行时依赖 | 0 |

### 5.2 滚动监听统一原则

```
✅ 允许：CSS animation-timeline（合成器线程，零主线程成本）
✅ 允许：单一协调器内的 IO + rAF
❌ 禁止：多个组件各自裸挂 scroll listener
```

### 5.3 生命周期模式

所有含 script 的组件遵循：

```javascript
function init() { /* ... */ }
function dispose() { /* 解绑事件、取消 rAF、断开 IO */ }

document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', dispose);
```

防 View Transitions 下的双重初始化与内存泄漏。

### 5.4 reduced-motion 两级策略

| 级别 | 适用对象 | 处理 |
|------|---------|------|
| 第 1 级 | 有语义终态的动画（标题入场、封面扩展） | 时长压到 1ms，直达终态 |
| 第 2 级 | 纯演出层（流体扭曲、粒子） | `display: none` 整层移除 |

新组件实施前必须先判定自己属于哪一级。

### 5.5 可访问性清单

- 装饰层 `aria-hidden="true"` + `pointer-events: none`
- 键盘焦点框不被任何装饰层遮挡（检查 z-index 层序）
- 拆分文字保留屏幕阅读器可读原文（`aria-label`）
- 关闭动效后版式仍然完整（§7.6）

---

## 6. 测试与验收标准

### 6.1 每阶段必过清单

- [ ] `pnpm check` 通过（0 error）
- [ ] `pnpm build` 通过
- [ ] 360 / 768 / 1280 / 1440px 四档宽度目检：无文字被装饰遮挡、无布局抖动
- [ ] 系统开启「减少动态效果」后：全部页面静态完整可读，无 `opacity: 0` 卡死元素
- [ ] DevTools Performance：滚动期间无长任务 > 50ms；页面切后台后 rAF 停止
- [ ] 键盘 Tab 走查：焦点顺序正确，焦点框始终可见
- [ ] 装饰层全开 / 全关两种状态下信息层级不变

### 6.2 汇报内容格式

每阶段汇报包含：

1. 改动文件清单
2. 动效落点说明
3. 验收清单逐项结果
4. 遇到的问题与取舍决策

### 6.3 返工触发条件

违反第 3 节全局红线任何一条即返工，包括：时长/缓动未走 tokens、reduced-motion 未分级、生命周期缺 dispose、裸挂 scroll listener、正文保护区被侵入、擅自新增依赖。

---

## 附录：当前进度

| 阶段 | 项目 | 状态 |
|------|------|------|
| P1 | ① 逐字错峰入场 | ✅ 代码完成，构建通过，待人工目检 |
| P1 | ② 局部滚动吸附 | ⏸️ 决策推迟至 P3（无目标容器） |
| P2 | ③ 滚动叠层转场 | ⬜ 待启动 |
| P2 | ④ 全屏扩展转场 | ⬜ 待启动 |
| P2 | ⑤ 场景切换 | ⬜ 待启动 |
| P3 | ⑥ 3D 环形轮播 | ⬜ 待启动 |
| P3 | ⑦ 流体扭曲 | ⬜ 待启动 |
