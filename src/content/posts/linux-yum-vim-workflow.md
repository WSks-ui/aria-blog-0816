---
title: Linux工具学习：YUM软件包管理与Vim编辑器的高效运用
summary: 用YUM查询、安装、卸载软件包，以及Vim的三种模式、移动、编辑、搜索和配置
publishedAt: '2026-08-30'
updatedAt: null
tags:
  - Linux
  - 学习笔记
  - 软件包管理
  - Vim
  - 命令行
kind: note
featured: false
draft: false
github: null
cover: /assets/images/posts/Linux软件包与Vim/cover.webp
readingWeather: null
---

![YUM软件包管理与Vim编辑器的文章封面](/assets/images/posts/Linux软件包与Vim/cover.webp)

## 软件包和包管理器

Linux上装软件有两种路子：自己下源码编译，或者装别人编好的软件包

源码编译可以自己定参数，但要准备编译环境，依赖也得自己一个个装。软件包就省事多了，程序、配置、版本信息都打包好了，YUM负责帮你搜索、下载、校验、安装和卸载，有点像手机上的应用商店

先说明一下：课上用的是CentOS 7那一套。CentOS Linux 7在2024年6月30日已经停止维护了，现在的Fedora、RHEL 8及以后主要用DNF，有些系统还留着`yum`这个命令作为兼容入口。自己动手前先确认一下发行版

## 装一个软件时YUM在干什么

敲下安装命令后，YUM会去查配置好的软件仓库，算出要装哪些依赖，把包下载下来，装进系统并记录下来

![YUM从仓库查询到完成安装的流程](/assets/images/posts/Linux软件包与Vim/yum-workflow.webp)

依赖不用自己找了，以后升级和卸载也有记录可查

## 先确认网络

YUM要连仓库，网络不通会报元数据下载失败、域名解析不了或者连接超时

先`ping`一下：

```bash
ping -c 4 www.baidu.com
```

`-c 4`是发4次就停，不加的话Linux上的`ping`会一直发下去

能`ping`通只说明DNS和网络大致没问题，仓库能不能用还得看`yum repolist`。`ping`不通就去查网卡、IP、默认路由和DNS；能通但下载很慢，可以换个靠谱的镜像源

## 查软件包

```bash
yum list
yum list | grep lrzsz
```

`yum list`输出很长，用管道交给`grep`只留下包含`lrzsz`的行

看详情或者按关键词搜：

```bash
yum info vim
yum search editor
```

列表里的一行长这样：

```text
lrzsz.x86_64    0.12.20-36.el7    base
```

- `lrzsz`：包名，装上以后就有`rz`和`sz`两个传文件的命令
- `x86_64`：64位x86架构（`i686`是32位）
- `0.12.20-36`：软件版本和打包的修订号
- `el7`：给Enterprise Linux 7编的
- `base`：来自哪个仓库

## 安装和卸载

```bash
sudo yum install lrzsz
```

YUM会先列出要装的包和依赖，输入`y`确认

确定没问题的话可以加`-y`，所有确认都自动回答yes：

```bash
sudo yum install -y vim
```

方便是方便，但也就看不到变更列表了，服务器上用之前先想清楚

卸载：

```bash
sudo yum remove lrzsz
```

卸载时YUM会列出连带要删的依赖，看一眼，别把还在用的东西一起删了

## Vim和Vi

Vi是老牌的终端编辑器，Vim在兼容Vi操作的基础上加了语法高亮、多级撤销、配置扩展这些功能

```bash
vim notes.txt
```

刚用Vim最懵的是：同一个键在不同模式下作用完全不一样。先把模式搞清楚，后面就顺了

## 三种模式

![Vim正常模式、插入模式和末行模式的切换关系](/assets/images/posts/Linux软件包与Vim/vim-modes.webp)

| 模式 | 干什么 | 怎么进 |
| --- | --- | --- |
| 正常模式 | 移动光标、删除、复制、粘贴、撤销 | 打开Vim默认就是，或者按`Esc`回来 |
| 插入模式 | 打字 | 正常模式下按`i`、`a`或`o` |
| 末行模式 | 保存、退出、搜索、设置 | 正常模式下按`:`、`/`或`?` |

最短的流程：打开文件，按`i`开始打字，打完按`Esc`，输入`:wq`保存退出

## 进入插入模式

| 按键 | 作用 |
| --- | --- |
| `i` | 在光标前面开始输入 |
| `a` | 在光标后面开始输入 |
| `o` | 在下面新开一行开始输入 |
| `Esc` | 回到正常模式 |

其实会`i`和`Esc`就能用了，`a`和`o`能少按几下方向键和回车

## 移动光标

`h`、`j`、`k`、`l`分别是左、下、上、右

| 按键 | 作用 |
| --- | --- |
| `gg` | 跳到第一行 |
| `G` | 跳到最后一行 |
| `12G` | 跳到第12行 |
| `0` | 跳到行首 |
| `^` | 跳到行首第一个非空白字符 |
| `$` | 跳到行尾 |
| `w` | 下一个单词开头 |
| `e` | 当前或下一个单词结尾 |
| `b` | 上一个单词开头 |

翻页：`Ctrl-F`往下一页，`Ctrl-B`往上一页，`Ctrl-D`往下半页，`Ctrl-U`往上半页

## 删除、复制、粘贴

这些命令前面都可以加数字，表示重复几次：

| 命令 | 作用 |
| --- | --- |
| `x` | 删掉光标所在的字符 |
| `4x` | 从光标开始删4个字符 |
| `dd` | 删掉当前行 |
| `3dd` | 从当前行开始删3行 |
| `yy` | 复制当前行 |
| `5yy` | 从当前行开始复制5行 |
| `p` | 粘贴到光标或当前行后面 |
| `P` | 粘贴到光标或当前行前面 |

`dd`删掉的内容会存进寄存器，挪到别处按`p`就能贴回来，所以`dd`+`p`其实就是剪切

## 替换和撤销

| 命令 | 作用 |
| --- | --- |
| `r`加一个字符 | 把光标处的字符换成这个字符 |
| `~` | 切换大小写 |
| `u` | 撤销 |
| `Ctrl-R` | 重做（撤销的撤销） |

## 搜索

| 命令 | 作用 |
| --- | --- |
| `/error` | 往后搜`error` |
| `?error` | 往前搜`error` |
| `n` | 按同一方向跳到下一个 |
| `N` | 反方向跳到上一个 |

看长日志、长配置时，直接搜比一行行翻快得多

## 保存和退出

正常模式下按`:`：

| 命令 | 作用 |
| --- | --- |
| `:w` | 保存 |
| `:q` | 退出（有没保存的修改时会拒绝） |
| `:wq` | 保存并退出 |
| `:q!` | 不保存，强制退出 |
| `:15` | 跳到第15行 |
| `:set number` | 显示行号 |
| `:set nonumber` | 隐藏行号 |

## 配置自己的Vim

用户配置文件是`~/.vimrc`（比如用户`user`的就是`/home/user/.vimrc`）。可以先加这几行：

```vim
syntax on
set number
set tabstop=4
set shiftwidth=4
set expandtab
set autoindent
```

| 配置 | 作用 |
| --- | --- |
| `syntax on` | 语法高亮 |
| `set number` | 显示行号，可以简写成`set nu` |
| `set tabstop=4` | Tab显示为4格宽 |
| `set shiftwidth=4` | 自动缩进每次4格 |
| `set expandtab` | 按Tab实际存成空格 |
| `set autoindent` | 新行跟着上一行缩进 |

配置最好一行行加，加一行就重新打开Vim看看效果，出问题了也知道是哪行

## 练一遍

```bash
yum info vim
sudo yum install -y vim
vim notes.txt
```

进去之后：

1. 按`i`进入插入模式
2. 随便打几行字
3. 按`Esc`回到正常模式
4. `gg`回到第一行，`yy`复制
5. `G`跳到最后一行，`p`粘贴
6. `/YUM`搜一下
7. `:wq`保存退出

多来几遍手就熟了

## 来源

本文为个人学习笔记，根据[《YUM软件包管理器与Vim编辑器的高效运用》](https://blog.csdn.net/2301_80171004/article/details/139837077)提炼并重新组织，保留原文链接供进一步阅读

YUM与DNF的版本差异可以继续参考[Fedora的DNF文档](https://docs.fedoraproject.org/en-US/quick-docs/dnf/)和[CentOS Linux 7生命周期说明](https://www.redhat.com/en/blog/centos-linux-7-end-life-june-30-2024)
