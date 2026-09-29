# 页面切换性能检查（2026-09-20）

## 已确认的问题与调整

- 文章导航仅识别 `data-article-transition-link`，阅读面板退出、栏目链接、浏览器后退会使用整篇 `main` 的命名快照。现在按导航的来源及目标路径识别文章进出，统一使用视口大小的 root 快照。
- 当前 Astro 路由实现在 `viewTransition.updateCallbackDone` 后执行脚本并触发 `astro:page-load`，没有等待 `finished`。此前会在快照准备或播放期间恢复元素命名并切换到入场收尾态。新增 `afterPageTransition`，观察 Astro 在转场完成后移除的 `data-astro-transition`，并在下一次导航开始时取消上一页任务。
- `ReadingSession` 在 page-load 同步读取整篇正文几何，与 SceneGuide 的进度计算重复。现在统一消费目录广播；目录首轮测量、文章侧轨测量与随笔进度初始化等待实际转场结束。尚未测量时不把初始零值写回已有阅读记录。
- 代码块、表格原先在页面挂载后重新包装，引发正文高度变化。换页时改为在离线目标文档中组装，保留首访渐进增强和复制按钮。
- 全站 hover 字重插值会逐帧重新塑形文字。移除该全局规则，保留各组件原有的颜色、细线、位移反馈和字体。
- HUD 打字效果由反复替换文本改为完整文本上的阶梯裁剪，固定布局尺寸；等待转场结束再启动，换页时取消仍在运行的动画。
- 文章辅助脚本首次执行和 page-load 不再重复初始化；默认非沉浸态不重复写入根属性，减少整页样式失效及背景同步。

## 验证方法与结果

使用 `pnpm build` 产物，通过本地静态 HTTP 服务，在 Playwright 驱动的 Edge 中记录 RAF 帧间隔、Long Tasks、Long Animation Frames 和 Astro/View Transition 生命周期。性能数据为本机单轮采样，不是线上统计或所有设备的性能承诺。

性能路径：`/posts/` → `/posts/linux-command-time-search-compression/` → 返回栏目；重复进入后分别通过阅读面板及浏览器后退退出。1440 × 900、4 倍 CPU 降速。

| 操作 | 修改前最大帧间隔 | 修改后最大帧间隔 |
| --- | ---: | ---: |
| 重复进入长文 | 1252 ms | 576 ms |
| 阅读面板退出 | 877 ms | 634 ms |
| 浏览器后退 | 685 ms | 426 ms |

首次冷进入以及页头返回的跨轮测量波动较大，未确认改善，不以热访问结果替代冷访问结论。当前普通速度测试首次进入最大帧间隔约 267 ms，重复进入约 100–109 ms，退出约 92–117 ms。

完整回归已覆盖：

- 桌面雨天、桌面夜间、390 × 844 移动端晴天。
- 移动端 `prefers-reduced-motion: reduce`。
- 禁用 `document.startViewTransition` 后的 Astro fallback。
- 文章进入、顶部返回、浏览器前进及后退、主题保持。
- 阅读至 45% 后持久化、历史恢复与继续阅读入口。
- 页面尚未完成入场就立即退出，原有 45% 续读记录保持不变；随笔独立进度路径正常。
- 代码块包装和复制、视口横向溢出检查、背景 WebGL 非黑像素检查、页面脚本错误检查。
- `pnpm check`：0 errors / 0 warnings，保留两个原有 hints。
- `pnpm build`：77 个页面成功生成。

本地原始记录和截图位于忽略目录 `.visual-check/navigation/`；`baseline.json`、`diagnosed.json` 为修改前，`after-second.json` 为最终代码的降速结果，`final-normal.json` 为普通速度，`regression.json` 为回归结果。

本机复测脚本也保留在该目录：在项目根目录执行 `node .visual-check/navigation/profile.mjs` 或 `node .visual-check/navigation/check.mjs`。脚本引用本机预装的 Playwright 和 Edge，不增加项目依赖；跨机器复用时需调整其导入路径。

## 剩余开销

首次进入长文仍有可测量的字体塑形、布局和视图快照成本。此次保留既有字体及标题/封面共享转场，没有通过移除文章内容或替换全站字体来降低指标。低性能设备仍可能感到停顿，不能将本轮修复描述为完全消除卡顿。

排查期间的字体替换、去除排版特性及 content-visibility 对照仅用于归因，没有写入产品代码。大面积内容跳过会影响长文高度、进度与历史滚动定位，需要独立验证后再考虑。

## 2026-09-21 补充：工具标题飞行与快照筛选

- 修复到达页筛选遗漏 `.tool-dossier__hero` 和 `.tutorial-tool` 的回归：工具讲义标题、返程工具卡片重新参与共享元素飞行。
- 工具讲义路由也按 `/toolkit/` 识别，浏览器前进、后退沿用视口级根快照。
- 返程匹配使用导航事件的 `from.pathname`。历史导航时地址栏已是目标路径，使用 `window.location.pathname` 会找不到原来的文章行或工具卡片。
- 出发列表先按目标链接筛选命名元素，未指向目标的标题跳过几何测量并留在根快照中，不再单独生成无配对的动画组；详情页头仍保留原有视口守卫。此次降低的是测量及快照数量，未给出新的耗时改善百分比。
- 新增本机回归脚本 `.visual-check/navigation/tools.mjs`：检查桌面和移动端进入、后退、前进、相邻工具、返回指南。通过原生 View Transition 的 `ready` 检查两端名称和浏览器实际生成的位移关键帧，而不只检查静态 DOM。移动端历史恢复后卡片离屏的前进场景允许按视口守卫退化。
- 最终构建仍为 77 页，类型检查 0 errors / 0 warnings、两个原有 hints。首次冷进入长文的字体与布局成本仍有后续优化空间。
