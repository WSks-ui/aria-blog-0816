---
title: 给博客添加自定义鼠标效果
summary: 照着 shiyin.cafe 做的三层鼠标效果：SVG 光标、延迟跟随的灰圆、点击涟漪，以及后来为什么又改回了原生光标
publishedAt: '2026-06-01'
updatedAt: null
tags:
  - 前端交互
  - 视觉效果
kind: code
featured: false
draft: false
github: null
cover: null
readingWeather: null
---

在 shiyin.cafe 看到一个很舒服的鼠标效果，照着给博客做了一个。下面写的是当时的实现，现在站点已经换成了原生光标，原因放在最后

## 效果拆解

一共三层叠在一起：

| 层级 | 实现方式 | 作用 |
|------|----------|------|
| 1 | `cursor: url(data:image/svg+xml...)` 替换系统光标 | 白色小圆点代替默认箭头，零延迟 |
| 2 | `<div id="g-pointer">` 跟随鼠标移动 | 灰色半透明圆，0.1s 过渡延迟产生粘滞感 |
| 3 | `.click-effect` 动画元素 | 鼠标松开时扩散涟漪，动画结束后移除 |

好看主要靠第二层：白点始终在鼠标的真实位置，灰圆因为 `transition: transform 0.1s ease` 会慢半拍，鼠标一甩两层就错开了

## 用 transform 还是 left/top

让灰圆跟着鼠标走有两种写法，性能差很多：

| 方案 | 触发流程 | 性能 |
|------|----------|------|
| `left` / `top` | Layout → Paint → Composite | 差，高频mousemove下卡顿 |
| `transform: translate()` | Composite 仅合成层 | 好，GPU 加速 |

再加一个 `will-change: transform`，让浏览器提前把它放到单独的合成层

## 实现

### CSS

```css
/* SVG 光标：亮色用黑点，暗色用白点 */
html.custom-cursor-active,
html.custom-cursor-active * {
  cursor: url("data:image/svg+xml,...fill='black'...") 4 4, auto !important;
}
html.dark.custom-cursor-active,
html.dark.custom-cursor-active * {
  cursor: url("data:image/svg+xml,...fill='white'...") 4 4, auto !important;
}

/* 跟随灰圆：transform 定位 + 过渡延迟 */
#g-pointer {
  position: fixed;
  top: 0;
  left: 0;
  width: 20px;
  height: 20px;
  background: rgba(128, 128, 128, 0.3);
  border-radius: 50%;
  pointer-events: none;
  z-index: 9999999;
  transition: transform 0.1s ease;
  will-change: transform;
}

/* 点击涟漪 */
.click-effect {
  position: fixed;
  background: rgba(128, 128, 128, 0.3);
  border-radius: 50%;
  transform: scale(0);
  animation: clickAnimation 0.6s ease-out;
  pointer-events: none;
  z-index: 9999999;
}

@keyframes clickAnimation {
  0% { transform: scale(0); opacity: 0.8; }
  100% { transform: scale(4); opacity: 0; }
}

/* 移动端降级 */
@media (max-width: 1023px) {
  html.custom-cursor-active,
  html.custom-cursor-active * { cursor: auto !important; }
  #g-pointer { display: none; }
}
```

### JavaScript

```js
var MIN_WIDTH = 1024;
var gPointer = null;
var isEnabled = false;
var isPressing = false;

function buildTransform(x, y) {
  var t = "translate(" + (x - 8.5) + "px, " + (y - 8.5) + "px)";
  if (isPressing) t += " scale(0.15)";
  return t;
}

function onMouseMove(e) {
  gPointer.style.transform = buildTransform(e.clientX, e.clientY);
}

function onMouseDown(e) {
  if (!isEnabled) return;
  isPressing = true;
  gPointer.style.transform = buildTransform(e.clientX, e.clientY);
}

function onMouseUp(e) {
  if (!isEnabled) return;
  isPressing = false;
  gPointer.style.transform = buildTransform(e.clientX, e.clientY);
  // 创建涟漪
  var el = document.createElement("div");
  el.className = "click-effect";
  el.style.left = (e.clientX - 17) + "px";
  el.style.top = (e.clientY - 17) + "px";
  el.style.width = "34px";
  el.style.height = "34px";
  document.body.appendChild(el);
  el.addEventListener("animationend", function () { el.remove(); });
}
```

当时还顺手屏蔽了右键菜单和文字选中，因为这两个操作会让系统光标冒出来，跟自定义光标叠在一起很怪：

```js
function onContextMenu(e) { e.preventDefault(); }
function onSelectStart(e) { e.preventDefault(); }
```

现在的站点已经把这两个限制去掉了

### 踩过的坑

- **按下缩放时圆心跑偏**：别用单独的 CSS `scale` 属性，它是相对元素原本的位置（`top:0; left:0`）缩放的，而不是当前屏幕上的位置。要把 scale 跟 translate 写进同一个 `transform` 里，先平移再缩放，圆心就不会动
- **涟漪定位**：`left/top` 设成 `e.clientX - 半径`，中心才会对准鼠标；动画结束后在 `animationend` 里把节点删掉，不然页面上会越堆越多
- **切页面后失效**：PJAX 或 SPA 换页之后要重新绑定，监听 `astro:page-load` 或 swup 的 `content:replace`，先 `deactivate()` 再 `activate()`
- **移动端**：宽度小于 1024px 时整个关掉，换回系统光标，事件也全部解绑
- **评论区里变回系统光标**：Giscus 是跨域 iframe，父页面的 CSS 管不到里面，这是浏览器的安全限制，没办法。能做的只有鼠标移进 iframe 时把自己的光标藏起来，免得出现两个光标

## 可调整参数

| 参数 | 位置 | 说明 |
|------|------|------|
| `- 8.5` | JS偏移量 | 灰圆相对鼠标的偏移像素，修改它微调对齐 |
| `scale(0.15)` | JS buildTransform | 按下时灰圆缩放倍率 |
| `0.1s` | CSS transition | 灰圆跟随延迟，越大越粘滞 |
| `34px` / `scale(4)` | JS/CSS keyframe | 涟漪初始尺寸和扩散倍率 |
| `1023px` | CSS media query | 效果生效的屏幕宽度阈值 |

## 为什么后来改回了原生光标

用 DOM 元素跟随鼠标，不管怎么优化都会比系统光标慢至少一帧，因为系统光标是硬件直接画的，DOM 要等下一帧渲染。所以现在站点只用原生的 `cursor: url(...)` 换成 SVG，不再放跟随元素。现在的代码在：

- `public/assets/cursors/` — 默认箭头与可点击十字的 SVG 光标资源
- `src/styles/interactive.css` — 原生 `cursor: url(...)` 的三态规则
- `src/components/interactive/InteractionSurface.astro` — 根据设备能力与可访问性偏好切换状态

`BaseLayout.astro` 里已经全局引入了，别的布局要用的话：

```astro
import { InteractionSurface } from "@/components/interactive";

<InteractionSurface />
```

以后要加拖尾、粒子这类效果，也是在原生光标上面另外叠一层，光标本身还是交给系统画
