---
title: Linux命令行进阶：时间、查找与压缩
summary: date、重定向、find、grep、zip、tar这几组命令的用法和踩过的坑
publishedAt: '2026-08-26'
updatedAt: null
tags:
  - Linux
  - 学习笔记
  - 命令行
  - 文件管理
  - 服务器
kind: note
featured: false
draft: false
github: null
cover: null
readingWeather: null
---

这次学的是时间、输入输出、找文件和压缩这几组命令，单个都不难，但后面查日志、打包备份基本都靠它们

## 先说一下命令选项

命令后面`-`开头的是选项，比如`ls -l`的`-l`是"详细列表"。短选项可以合在一起写，`ls -la`就等于`ls -l -a`

有的选项后面要跟参数，比如`unzip project.zip -d ./restored`里，`-d`后面跟的是解压到哪

`>`、`>>`、`<`、`|`这些不是选项，是Shell的符号，下面会讲。不认识的选项还是老办法，`man 命令名`

## `date`：时间

```bash
date
date '+%Y-%m-%d %H:%M:%S'
date '+%Y-%m-%d'
```

常用的格式：

| 标记 | 含义 |
| --- | --- |
| `%Y` | 四位年份 |
| `%m` | 月份 |
| `%d` | 日 |
| `%H` | 小时（00到23） |
| `%M` | 分钟 |
| `%S` | 秒 |
| `%F` | 等同于`%Y-%m-%d` |

时间戳和日期互相转换：

```bash
date '+%s'
date -d '@1599642565' '+%Y-%m-%d %H:%M:%S'
```

`-d`把给定的字符串当时间来解析，`@`开头表示后面是时间戳

`date -s`可以改系统时间，要root权限。服务器上别乱改，日志、定时任务、证书校验都依赖系统时间

顺便一个看日历的`cal`：

```bash
cal
cal 8 2026
```

## 重定向

命令默认从键盘读输入、往屏幕上输出，重定向可以把方向换掉：

```bash
echo '第一次写入' > note.txt
echo '继续追加' >> note.txt
cat < note.txt
```

`>`是覆盖写，`>>`是追加，`<`是把文件当输入。`>`和`>>`就差一个字符，写错了原文件就没了

比如把目录列表存下来慢慢看：

```bash
ls -la > directory.txt
less < directory.txt
```

## `find`：找文件

`find`从指定目录开始往下找，按条件筛选。最常用的是按名字和类型：

```bash
find . -type f -name '*.log'
find /var/log -type f -name '*.log'
find . -type d -name 'cache'
```

还能按修改时间和大小：

```bash
find . -type f -mtime -7
find . -type f -size +100M
```

| 选项 | 作用 |
| --- | --- |
| `-type f` | 只找普通文件 |
| `-type d` | 只找目录 |
| `-name` | 按名字匹配，可以用通配符 |
| `-mtime -7` | 最近7天内改过的 |
| `-size +100M` | 大于100MB的 |
| `-exec` | 对找到的每个结果执行一条命令 |

`-exec`可以直接对结果做操作，比如在所有`.log`里搜`error`：

```bash
find . -type f -name '*.log' -exec grep -n 'error' {} +
```

`{}`会被换成找到的文件路径。结尾用`+`是把多个文件攒在一起交给一次`grep`，用`\;`的话每个文件都要单独启动一次`grep`

## `grep`：搜内容

```bash
grep -n 'error' app.log
grep -i 'warning' app.log
grep -v 'debug' app.log
grep -Rni --include='*.log' 'timeout' ./logs
```

| 选项 | 作用 |
| --- | --- |
| `-n` | 显示行号 |
| `-i` | 忽略大小写 |
| `-v` | 反过来，只显示不包含关键词的行 |
| `-R` | 递归搜整个目录 |
| `--include='*.log'` | 递归时只搜匹配的文件 |

和管道一起用，比如在进程列表里找nginx：

```bash
ps aux | grep nginx
```

`ps aux`这里的选项没有`-`，是BSD风格的写法：`a`显示所有用户的进程，`u`显示用户和资源占用，`x`把没有终端的进程也算上

## `zip`和`unzip`

```bash
zip notes.zip notes.md
zip -r project.zip project/
unzip project.zip
unzip project.zip -d ./restored
```

压目录要加`-r`，不然只会压一个空目录进去。解压时`-d`指定目标目录，不指定就解到当前目录，同名文件会被问要不要覆盖

## `tar`：打包

Linux上见得更多的是`.tar.gz`。`tar`本身只负责打包，压缩交给gzip或bzip2

| 选项 | 作用 |
| --- | --- |
| `-c` | 创建归档 |
| `-x` | 解开归档 |
| `-t` | 查看归档里有什么 |
| `-z` | 用gzip压缩/解压 |
| `-j` | 用bzip2压缩/解压 |
| `-v` | 显示处理过程 |
| `-f` | 指定归档文件名 |
| `-C` | 先切换到指定目录再操作 |

最常用的三条，分别是打包、查看、解包：

```bash
tar -czvf project.tar.gz project/
tar -tzvf project.tar.gz
tar -xzvf project.tar.gz -C ./restored
```

拆开看就是`c`/`t`/`x`三选一，加上`z`（gzip）、`v`（显示过程）、`f`（后面跟文件名）。`f`后面要紧跟文件名，所以一般放在最后

只想取出其中一个文件，把路径写在后面：

```bash
tar -xzvf project.tar.gz project/config.yaml
```

## 其他零碎的

终端里算数用`bc`，`scale`是保留几位小数：

```bash
echo 'scale=2; 10 / 3' | bc
```

看内核版本：

```bash
uname -r
uname -a
```

`-r`只显示内核版本，`-a`把主机名、架构什么的全打出来

几个快捷键：

- `Tab`补全命令和路径
- `Ctrl-C`终止当前程序
- `Ctrl-D`输入结束，在空命令行上按会退出Shell
- `Ctrl-R`搜历史命令

关机和重启：

```bash
shutdown -h now
shutdown -r now
shutdown -t 60
```

分别是立即关机、立即重启、延迟60秒。远程服务器上敲之前看清楚自己连的是哪台机器

## 命令清单

课上列了一份常用命令，先记在这，用到再细看：

- **安装和登录**：`login`、`shutdown`、`halt`、`reboot`、`install`、`mount`、`umount`、`chsh`、`exit`、`last`
- **文件处理**：`file`、`mkdir`、`grep`、`dd`、`find`、`mv`、`ls`、`diff`、`cat`、`ln`
- **系统管理**：`df`、`top`、`free`、`quota`、`at`、`lp`、`adduser`、`groupadd`、`kill`、`crontab`
- **网络操作**：`ifconfig`、`ip`、`ping`、`netstat`、`telnet`、`ftp`、`route`、`rlogin`、`rcp`、`finger`、`mail`、`nslookup`
- **系统安全**：`passwd`、`su`、`umask`、`chgrp`、`chmod`、`chown`、`chattr`、`sudo`、`ps`、`who`
- **其他**：`tar`、`unzip`、`gunzip`、`unarj`、`mtools`、`man`、`uuencode`、`uudecode`

## 练习

把上面几个命令串起来：建日志、往里写内容、找出带error的行、打包再查看包里的内容

```bash
mkdir -p demo/logs
printf 'info start\nerror timeout\n' > demo/logs/app.log
printf 'warning retry\n' >> demo/logs/app.log
find demo -type f -name '*.log' -exec grep -n 'error' {} +
tar -czvf demo-logs.tar.gz demo/logs
tar -tzvf demo-logs.tar.gz
```

`mkdir -p`会顺带把不存在的上级目录建好，目录已经存在也不会报错

## 来源

本文为个人学习笔记，根据[lvy-的《Linux命令行：从时间管理到文件查找压缩的指令详解》](https://lvynote.blog.csdn.net/article/details/139739336)提炼并重新组织，保留原文链接供进一步阅读
