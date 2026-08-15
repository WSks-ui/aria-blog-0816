---
title: "用两层 CSS 做克制的纸面颗粒"
summary: "不用大图背景，通过重复渐变与混合模式构造低成本纸纹，并兼顾减少动态与高对比模式。"
publishedAt: 2026-07-09
updatedAt: 2026-07-11
tags: ["CSS", "纹理", "性能"]
kind: "code"
featured: false
draft: false
github: null
cover: null
readingWeather:
  condition: "多云"
  temperature: 31
  location: "室内"
---

纸面质感最容易出现的问题，是纹理先于内容被看见。这里使用两个透明度很低的重复渐变：一层提供细小明暗差，另一层打破规则周期。

```css
.paper-surface::before {
  position: fixed;
  inset: 0;
  pointer-events: none;
  content: "";
  opacity: 0.16;
  background:
    repeating-linear-gradient(7deg, rgb(40 48 47 / 4%) 0 1px, transparent 1px 5px),
    repeating-linear-gradient(93deg, rgb(255 255 255 / 7%) 0 1px, transparent 1px 7px);
  mix-blend-mode: multiply;
}
```

## 三个边界条件

1. 纹理层必须忽略指针事件，不能遮挡正文链接。
2. 固定定位元素要评估移动端合成开销；低端设备上可以改为随页面滚动。
3. 强制颜色模式下应直接移除混合效果，确保系统配色不被污染。

```css
@media (forced-colors: active) {
  .paper-surface::before { display: none; }
}
```

在普通显示器上，如果读者第一眼能准确描述颗粒形状，通常说明透明度已经过高。
