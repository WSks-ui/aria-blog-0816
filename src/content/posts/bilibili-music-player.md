---
title: 给astro的音乐播放器接上B站
summary: 给博客的播放器加上B站音源，顺便做了个自建歌单，中间换过一次方案
publishedAt: '2026-05-31'
updatedAt: null
tags:
  - 博客开发
  - 音乐播放器
  - Bilibili
kind: project
featured: false
draft: false
github: https://github.com/WSks-ui/aria7-blog
cover: /assets/images/posts/B站音乐播放器/cover.webp
readingWeather: null
---

## 说在前头

我的博客当时基于名为 Firefly 的 Astro 主题二次开发。原主题上游链接现已失效，相关历史实现与配置可以参考[旧版 aria7-blog 仓库](https://github.com/WSks-ui/aria7-blog)。它自带一个挺好看的音乐播放器，支持**Meting API在线音乐**和**本地音乐**两种模式，唯独不支持B站

我平时听歌基本在B站，好听的BGM都在视频里，就想能不能直接在博客播放器里放B站视频的音频

于是我开始了漫长的魔改之路...

---

## 整体结构

先放最后做出来的样子：

```
用户输入 BV 号
    ↓
Vercel Serverless (api/bilibili-audio.js)
    ├── 请求 B站官方接口获取音频流
    │   └── 返回 { title, artist, pic, audio_url }
    ↓
MusicManager (后台控制器)
    ├── 管理播放状态、队列、音量
    ├── 维护已保存的视频收藏
    └── 维护自建播放列表
    ↓
MusicPlayer (UI 组件)
    ├── 播放器控件（播放/暂停/上下曲/进度条）
    ├── 播放列表抽屉
    ├── 歌词展示
    └── 音源面板（添加视频、收藏、播放列表）
```

主要是两个Astro组件：**MusicManager**管数据，**MusicPlayer**管界面，两边通过全局对象`window.__fireflyMusic`和自定义事件`fm:*`通信

---

## 第一步：B站音频代理

浏览器直接请求`api.bilibili.com`会被CORS拦下来，所以得有个服务端帮忙转一下，我用的是**Vercel Serverless Function**

`api/bilibili-audio.js` 接收 `?bvid=BV1xxx&meta=1` 参数，向B站接口请求数据：

```javascript
// Step 1: 获取视频基本信息
const infoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;

// Step 2: 获取音频流 URL
const audioUrl = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&qn=0&fnver=0&fnval=4048&fourk=1`;

// Step 3: 返回格式化数据
return { title, artist, pic, audio_url };
```

这里关键是`fnval=4048`，它让B站返回`dash`格式，音频和视频是分开的两条轨，直接拿`audio`那条就行，前端一个`<audio>`标签就能播

Vercel上给这个函数配了512MB内存和30秒超时：

```json
{
  "functions": {
    "api/bilibili-audio.js": {
      "memory": 512,
      "maxDuration": 30
    }
  }
}
```

---

## 第二步：两个组件怎么通信

播放器的状态和逻辑都在MusicManager里，用IIFE包起来挂到`window.__fireflyMusic`上：

```
MusicManager → 事件广播 → MusicPlayer
     ↑                        ↓
     └── 方法调用 ←───────────┘
```

### 事件系统

```javascript
// MusicManager 端
function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

// MusicPlayer 端
function on(name, fn) {
  handlers[name] = fn;
  window.addEventListener(name, fn);
}
```

### 播放器状态

```javascript
var state = {
    playMode: 0,        // 0=列表循环, 1=单曲循环, 2=随机
    volume: 0.7,
    isMuted: false,
    isPlaying: false,
    playlist: [],
    currentIndex: 0,
    lyrics: [],
    currentLrcIndex: -1
};
```

状态只放在Manager里，Player只负责听事件、更新界面，要改状态就调Manager的方法。这样改界面的时候基本不用动播放逻辑

![播放器控制区域：进度条、音量、播放/暂停、列表/歌词抽屉](/assets/images/posts/B站音乐播放器/player-controls.webp)

---

## 第三步：第三方API和官方API轮流试

拿B站音频不止一条路，我让MusicManager按顺序挨个试：

```
setBilibiliSource('video', bvid)
    ↓
Layer 1: 第三方 API（用户配置的多个 API 端点）
    ├── 遍历所有 API
    ├── 替换 :type, :id, :r 占位符
    └── 如果成功 → 使用该数据
    ↓ (全部失败)
Layer 2: B站官方 API（通过代理）
    ├── /api/bilibili-audio?bvid=xxx
    ├── 获取音频直链
    └── 如果成功 → 使用该数据
    ↓ (全部失败)
抛出错误 "All Bilibili APIs failed"
```

第三方API说挂就挂，有官方接口兜底，至少还能放

---

## 第四步：自建播放列表

一开始想的是直接导入B站收藏夹，结果限制一堆：要Cookie、有跨域问题、私密收藏夹根本读不到，做出来很难用

![老版本的B站收藏夹导入方案：选择收藏夹类型后输入fid](/assets/images/posts/B站音乐播放器/old-collection-approach.webp)

后来干脆不接收藏夹了，**在博客里自己建歌单**，把想听的BV号存进去：

### 数据模型

```javascript
// localStorage["music-custom-playlists"]
[
  {
    id: "pl_xxx_yyy",
    name: "日推歌单",
    tracks: [
      { bvid: "BV1Gi576kE2T", title: "使一颗心免于哀伤", artist: "知更鸟", pic: "" },
      { bvid: "BV1xxx", title: "卡农摇滚版", artist: "...", pic: "" }
    ],
    createdAt: 1685000000000,
    updatedAt: 1685000000000
  }
]
```

### 功能

音源面板分三个区域：

**1. 视频输入区** —— 输入BV号点击"应用"直接播放，或点"收藏"保存到本地

**2. 我的收藏** —— 所有收藏过的视频列在这里。每条右侧有两个按钮：
- `[+]` 弹出播放列表选择框，将视频添加到指定歌单
- `[删除]` 从收藏中移除

**3. 自建播放列表** —— 顶部输入框可创建新的歌单。每个歌单条目显示名称和曲目数，hover后出现"全部播放"和"删除"按钮。点击歌单标题可**展开**查看内部曲目，每首曲目同样有`[+]`（添加到播放队列）和`[删除]`（移出歌单）按钮

每个`[+]`按钮会弹出播放列表选择框，点击后曲目会**追加到主播放队列的末尾**，而不是替换当前播放

![已保存的视频收藏列表：每个视频旁有[+]添加到播放列表和删除按钮](/assets/images/posts/B站音乐播放器/saved-videos.webp)

![自建播放列表展开状态：显示曲目名称、BV号，右侧[+]和删除按钮](/assets/images/posts/B站音乐播放器/playlists.webp)

### 多曲目队列

```javascript
async function setBilibiliPlaylist(bvids) {
    // 逐个获取音频 URL
    var tracks = [];
    for (var i = 0; i < bvids.length; i++) {
        var t = await fetchBilibiliVideoTracks(bvids[i]);
        tracks.push(t[0]);
    }
    state.playlist = tracks;     // 替换整个队列
    loadTrack(0, true);          // 自动播放第一首
}

async function addToBilibiliQueue(bvid) {
    var t = await fetchBilibiliVideoTracks(bvid);
    state.playlist.push(t[0]);   // 追加到队列末尾
    emit('fm:queue-updated');    // 通知 UI 刷新
}
```

这样就能从不同歌单里挑几首拼成一个队列，再配上列表循环、单曲循环、随机三种模式，自己用着还挺顺手

---

## 其他细节

### 1. 抽屉展开动画

列表和音源面板的展开收起用的是`grid-template-rows`过渡：

```css
.playlist-drawer, .source-drawer {
    transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

`cubic-bezier`是缓动曲线，让开合不那么生硬

之前我以为这样能走GPU，其实不能：`grid-template-rows`一变就会触发重新布局。抽屉里东西不多所以感觉不到卡，内容多了的话还是得换成`transform`之类的方案

### 2. 清理事件监听

页面切换时播放器组件可能被移除，挂在`window`上的监听不解绑就会泄漏：

```javascript
var observer = new MutationObserver(function (mutations) {
    for (var mutation of mutations) {
        if (mutation.removedNodes.contains(widget)) {
            Object.keys(handlers).forEach(function (name) {
                window.removeEventListener(name, handlers[name]);
            });
            document.removeEventListener('click', popupDocHandler, true);
            observer.disconnect();
        }
    }
});
```

### 3. 本地存储溢出

`localStorage`一般只有5MB左右，收藏多了可能存不下。现在只是try-catch吞掉了错误，以后真遇到了再考虑压缩或者换IndexedDB

---

## 最后

前后折腾了几天，现在能输BV号直接播、收藏视频、建歌单、整单播放或者挑几首追加到队列，也能加载B站视频的歌词

代码在[GitHub](https://github.com/WSks-ui/aria7-blog)上，有问题欢迎指出
