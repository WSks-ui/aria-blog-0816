---
title: "RVC 开源变声器上手：软件下载、音色模型与 OBS 实时变声"
summary: "结合 Windows 11 下的 RVC 整合包与实际配置，介绍软件下载、音色模型导入、无索引推理，以及通过 VB-CABLE 接入 OBS 的步骤和参数调整"
publishedAt: "2026-09-09"
updatedAt: null
tags:
  - "AI"
  - "本地推理"
  - "开源工具"
kind: tutorial
featured: false
draft: false
github: https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI
cover: null
readingWeather: null
---

## 前言

我之前配置虚拟主播项目时，使用了 **RVC + 虚拟声卡（VB-CABLE）+ OBS** 这套方案。

> 顺带预告一下：我正在开发一套不依赖摄像头的自主驱动 Live2D 程序，模型控制思路参考了对 Neuro-sama 工作方式的推测。

配置过程很有趣，实际效果也不错，因此我把完整流程整理成这篇文章，方便有相同需求的人参考。

本文按实际使用顺序整理：先下载软件和模型，完成本地耳机试听，再通过虚拟声卡接入 OBS 或语音软件。

## 我的运行环境

我使用的是机械革命无界系列笔记本，配备 32 GB 内存，核显为 AMD Radeon 880M。

此前通过 OCuLink 外接 RTX 5060 8 GB 运行 RVC，因此保留了对应的 NVIDIA RTX 50 系列整合包。

| 项目 | 本地环境 |
| --- | --- |
| 操作系统 | Windows 11 25H2 |
| 整合包目录 | `RVC20260723Nvidia50x0/RVC20260718Nvidia50x0` |
| Python | 包内`runtime`，版本`3.12.10` |
| PyTorch | `2.7.1+cu128` |
| CUDA运行时版本 | `12.8` |
| 保存的音色模型 | `bjx8.pth` |
| 索引设置 | 路径为空，Index Rate为`0` |
| 音高算法 | `rmvpe` |

使用这份 NVIDIA 包前，确认系统已识别对应的 NVIDIA 显卡；只使用核显时，应另选 AMD / Intel 对应包。

## RVC的工作机制

[RVC（Retrieval-based Voice Conversion）](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI)是一套开源音色转换工具，提供音频文件转换和实时变声界面

![RVC官方GitHub项目卡片，仓库名称为RVC-Project/Retrieval-based-Voice-Conversion-WebUI](/assets/images/posts/rvc-realtime-voice-changer/rvc-github-project.png)

上图是官方项目的仓库卡片

下载软件时进入这个仓库的Releases，音色模型会在后文单独下载

实时模式会读取麦克风音频，提取语音特征，再通过音色模型生成转换后的声音

说话节奏、发音和麦克风输入质量都会影响结果

本文主要配置两条链路：

1. **本地试听**：麦克风输入RVC，转换结果输出到耳机
2. **录音与语音通信**：通过虚拟声卡，把转换结果作为其他软件的麦克风输入

## 一、下载整合包与环境检查

### 官方整合包

在[RVC官方Releases](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI/releases)中找到**Complete package / 完整包**

本文使用的版本对应[2.3.260718发布页](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI/releases/tag/2.3.260718)，下载时按显卡选择：

| 硬件平台 | 整合包下载 |
| --- | --- |
| NVIDIA RTX 50系 | [RVC20260718Nvidia50x0.7z](https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/RVC20260718Nvidia50x0.7z) |
| NVIDIA RTX 50系以前的显卡 | [RVC20260718Nvidia.7z](https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/RVC20260718Nvidia.7z) |
| AMD / Intel显卡 | [RVC20260718AMD_Intel.7z](https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/RVC20260718AMD_Intel.7z) |

也可以在[官方Hugging Face文件列表](https://huggingface.co/lj1995/VoiceConversionWebUI/tree/main)中查找文件

下载较慢时，查看发布说明中的备用入口

GitHub页面底部的`Source code (zip)`是源码包，需要另外配置运行环境

直接使用软件应下载上表中的完整包

### 解压与启动

将压缩包完整解压到英文路径

本文这版GUI会检查模型路径中的中文字符，模型文件名也建议使用英文

我的实际程序根目录是：

```text
D:\LiveStreamingImage\RVC20260723Nvidia50x0\RVC20260718Nvidia50x0\
```

外层目录名称和内层名称不同，启动时以包含`runtime`和启动脚本的内层目录为准：

```text
RVC20260718Nvidia50x0/
├── go-realtime_gui.bat   # 实时变声界面
├── go-webui.bat          # 网页端音频转换与训练
├── realtime_gui.py
├── runtime/             # 内置 Python 环境
├── assets/              # 基础资源与音色模型
└── configs/
    └── config.json      # 保存的实时 GUI 参数
```

双击`go-realtime_gui.bat`

首次启动和加载模型需要等待，控制台窗口保持开启，运行异常时查看底部报错

![整合包内层目录，选中用于实时变声的go-realtime_gui.bat，下方为go-webui.bat](/assets/images/posts/rvc-realtime-voice-changer/realtime-launcher.png)

图中选中的是实时变声启动脚本；下方的`go-webui.bat`用于网页端音频转换和训练

启动脚本使用的是包内`runtime\python.exe`，无需先向系统Python安装依赖

### CUDA环境检查

NVIDIA用户可以在整合包根目录打开PowerShell，执行：

```powershell
.\runtime\python.exe -I -c "import torch; print('torch:', torch.__version__); print('cuda:', torch.version.cuda); print('available:', torch.cuda.is_available())"
```

`torch`和`cuda`显示安装版本，`available`表示这份环境当前能否访问CUDA

AMD / Intel路线跳过这项CUDA检查

## 二、模型下载与文件准备

我使用的原版整合包包含HuBERT、RMVPE等基础资源，音色模型只附带`kikiV1`，可以先用它测试变声，其他音色需要自行下载

| 文件类型 | 常见文件 | 作用 |
| --- | --- | --- |
| 基础资源 | HuBERT相关文件、`rmvpe.pt` | 提取语音特征与音高 |
| 推理模型 | `*.pth` | 音色转换权重 |
| 检索索引 | `*.index` | 检索配套特征，参与音色转换 |
| 训练检查点 | `G_*.pth`、`D_*.pth` | 保存训练状态，使用实时GUI时应寻找导出的推理模型 |

### 从哪里下载音色

可以从[Hugging Face的RVC模型搜索页](https://huggingface.co/models?search=RVC)开始，搜索`RVC + 音色名称`或`RVC + 中文`

创作者的作品介绍、GitHub页面也常会提供模型下载地址

![Hugging Face Models页面搜索RVC，右侧展示多个社区模型仓库](/assets/images/posts/rvc-realtime-voice-changer/huggingface-rvc-search.png)

图中是在**Models**列表中搜索`RVC`的结果

点击仓库名称进入模型页面，再找**Files and versions**下载文件；搜索结果中也有模型合集和基础资源，需要阅读仓库说明后选择

在 Hugging Face 上：

1. 阅读模型说明，确认适配RVC，并查看版本、训练语言与试听
2. 打开**Files and versions**，找到推理用`.pth`和配套`.index`
3. 使用文件旁的下载按钮，或进入文件详情页下载
4. 如果下载的是`.zip`或`.7z`，先解压，再选择其中的模型文件

下载时最好保留原始发布页，后续查找索引、版本说明和更新会方便一些

只从可信来源获取整合包和音色模型，不要运行模型仓库中附带的不明可执行文件或脚本。使用他人音色前也应确认授权范围，不要将变声结果用于冒充、欺骗或其他侵犯权益的场景。

### 我的模型目录

本地`assets/weights`中，`kikiV1.pth`是原版附带的模型，`bjx8.pth`、`azuki.pth`、`beijixing.pth`等其他模型都是我后来自行下载的，当前配置保存的是`bjx8.pth`

部分模型带有同名索引，例如：

```text
assets/
├── weights/
│   ├── bjx8.pth
│   ├── guanguanV1.pth
│   ├── keruanV1.pth
│   └── kikiV1.pth
└── indices/
    ├── guanguanV1.index
    ├── keruanV1.index
    └── kikiV1.index
```

上面的目录展示的是添加自下载模型后的本地文件，原版只有`kikiV1`音色模型及其配套索引，下载其他音色时按自己的文件名选择即可

实时GUI中点击**选择.pth文件**和**选择.index文件**，分别指定路径

索引选择窗口默认打开`logs`，可以手动切换到`assets/indices`

### 无索引推理

我的`bjx8.pth`配置没有选择索引，**Index Rate为`0`**

因为我的本地`realtime_gui.py`加过索引可选补丁，路径为空时会自动关闭检索，因此能够只加载`.pth`

如果使用的GUI仍要求填写索引，需要获取模型配套的`.index`，或使用支持无索引的版本

索引应与模型配套，不要混用其他音色的文件

有配套索引时，可以从较低的Index Rate开始，逐步增加并比较输出效果

### 基础资源缺失

如果控制台提示缺少HuBERT或RMVPE，先检查是否完整解压

这版使用的路径为：

```text
assets/
├── hubert_base/
│   ├── config.json
│   ├── preprocessor_config.json
│   └── pytorch_model.bin
└── rmvpe/
    └── rmvpe.pt
```

缺失文件可从[官方基础模型仓库](https://huggingface.co/lj1995/VoiceConversionWebUI/tree/main)补充

旧版本可能采用`hubert_base.pt`单文件结构，按所用版本的README和报错路径处理

## 三、本地实时变声与参数

接入OBS前，先测试：

```text
物理麦克风 → RVC 实时变声 → 耳机
```

### 初次测试设置

![RVC实时变声界面，包含模型加载、音频设备、常规设置和性能设置](/assets/images/posts/rvc-realtime-voice-changer/realtime-gui.png)

首次使用可以按下面的设置开始。截图展示的是我当前保存的参数，表格则是一组更适合初次排查的起始值：

| 参数 | 初始设置 |
| --- | --- |
| 模型 | 选择自己的推理`.pth` |
| 索引 | 配套`.index`；支持无索引时留空并将Index Rate设为`0` |
| 设备类型 | 先试`MME`，输入输出保持同一类型 |
| 输入设备 | 物理麦克风 |
| 输出设备 | 耳机对应的播放设备 |
| 采样率 | 使用模型采样率 |
| 音高算法 | `rmvpe` |
| 音调 | `0`，试听后调整 |
| 采样长度 | `0.25`秒 |
| 淡入淡出长度 | `0.05`秒 |
| 额外推理时长 | `2.5`秒 |
| 响应阈值 | `-60` |
| 工作模式 | 输出变声 |

点击**开始音频转换**，等待模型加载后说一段完整句子

需要比较原始输入时切换“输入监听”，完成后切回“输出变声”

### 参数调整

**采样长度**影响分块处理与延迟

先从`0.25`秒开始，稳定后逐步尝试`0.15`或`0.10`秒

如果出现断续或爆音，先回调采样长度，再检查设备和计算负载

端到端延迟还包含声卡缓冲及后续软件处理时间

**音调**以半音为单位，`+12`为升高一个八度，以自己的输入声线和目标模型为准，逐步调整

**响应阈值**控制低音量片段的截断

数值从`-60`提高到`-40`会截掉更多轻声片段

发音开头丢字时，应把阈值往更低的方向调，并检查麦克风输入电平与降噪

本地代码在`-60`时跳过这段阈值截断，已经设为`-60`后，应优先排查其他环节

调整时每次只改一项，用同一句话录音比较

## 四、安装VB-CABLE虚拟音频通道

本地试听正常后，通过虚拟声卡把变声输出传递给其他软件

1. 前往[VB-Audio官网](https://vb-audio.com/Cable/)下载Windows版VB-CABLE
2. 解压后按包内说明，以管理员身份运行对应的安装程序
3. 安装完成后重启电脑

系统音频列表中会出现：

- 播放设备：`CABLE Input (VB-Audio Virtual Cable)`
- 录制设备：`CABLE Output (VB-Audio Virtual Cable)`

路由关系如下：

```text
物理麦克风
    |
    v
RVC 实时变声
    |
    v
CABLE Input       ← RVC 的输出设备
    |
    v
CABLE Output      ← OBS / 语音软件的输入设备
```

在RVC中将输出设备从Senary Audio播放设备或耳机改为`CABLE Input`

如果列表中没有新设备，点击“重载设备列表”，必要时重启GUI

更改后，音频进入虚拟声卡，耳机不再直接接收这一路声音

需要在OBS中设置监听

## 五、接入OBS与语音软件

### OBS音频输入

1. 在OBS“来源”面板添加**音频输入采集**，命名为“RVC变声”
2. 设备选择`CABLE Output (VB-Audio Virtual Cable)`
3. 对麦克风说话，观察这一路的电平变化
4. 检查全局“麦克风/辅助音频”和其他麦克风来源，关闭重复采集的物理麦克风

### OBS实时监听

需要同时录制和试听时：

1. 在OBS音频设置的高级选项中，将“监听设备”设为物理耳机
2. 打开混音器的“高级音频属性”
3. 将“RVC变声”的音频监听设为**监听并输出**

不需要自己试听时，使用“监听关闭”，录制输出仍然保留

“仅监听（输出静音）”会关闭这一路的录制输出

如果启用了“桌面音频”，检查它是否再次采集耳机的监听声

出现重复声音时，关闭重复来源，或将桌面采集与监听设备分开

监听设备不要设为`CABLE Input`，以免音频重新进入同一虚拟通道

### 通信与会议软件

在支持选择麦克风的软件中，将输入指定为`CABLE Output`

如果软件跟随系统默认输入，在Windows中调整默认录制设备及默认通信设备，再重启软件测试

具体入口依软件版本而定

使用期间保持RVC转换运行

结束后若要恢复原声通话，记得将目标软件的麦克风切回物理设备

## 六、常见问题排查

### 查看控制台耗时

![RVC控制台连续输出推理耗时和SOLA偏移，图中耗时约为0.39至0.52秒](/assets/images/posts/rvc-realtime-voice-changer/inference-console.png)

这张日志图中，“推理耗时”约为**`0.39至0.52`秒**

本地代码会在音频回调中计时，因此这里包含该次回调内的音频处理过程；“SOLA偏移”是片段拼接时的对齐偏移

判断能否持续实时处理，需要把耗时与**同一次运行的采样长度**比较

如果运行时采样长度为`0.10`秒，而处理一块音频需要约`0.4`秒，就无法持续跟上输入，需检查计算设备并调整参数

### 排查对照表

| 异常现象 | 优先排查项 |
| --- | --- |
| 启动脚本报错 | 检查完整解压、路径和控制台末尾信息 |
| CUDA不可用 | 检查显卡是否连接并被系统识别，再检查驱动及包内环境 |
| CUDA架构不兼容 | 检查整合包是否适配显卡型号 |
| 显存不足 | 关闭其他占用显存的程序，适当缩短额外推理时长后重新测试 |
| 索引加载失败 | 检查模型与索引是否配套；支持无索引时关闭检索后单独测试 |
| 未找到虚拟声卡 | 确认驱动安装和重启完成，重载设备列表 |
| 试听有声音，下游无声 | 核对RVC输出为`CABLE Input`，下游输入为`CABLE Output` |
| 原声与变声重叠 | 检查物理麦克风是否被额外采集 |
| 重复监听或回声 | 检查桌面音频是否采集监听输出，避免监听回环 |
| 声音断续、爆音 | 调高采样长度，检查计算负载、设备采样率与驱动 |
| 轻声或开头丢字 | 检查阈值、输入电平及降噪 |
| 发音失真 | 检查变调幅度，检查模型训练语言、输入质量和索引匹配 |

## 七、VST插件路线

本地还保存了`RVCRealtime-Win64VST/RVCRealtime-Win64-20260802`插件包，包含VST2、VST3和Studio One使用说明

下载入口在[官方发布页](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI/releases/tag/2.3.260718)，也可直接下载[VST插件包](https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/RVCRealtime-Win64VST.zip)

插件需要已有的RVC整合包与Python环境

已有Studio One工作流程时可以采用这条路线；日常语音和OBS变声直接使用GUI，配置环节更少

因为我没有实际使用过 Studio One，所以这里不展开未经验证的配置步骤。
