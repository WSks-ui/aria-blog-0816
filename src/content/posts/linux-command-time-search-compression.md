---
title: Linux命令行进阶：时间、查找与压缩
summary: 记录`date`、重定向、`find`、`grep`、`zip`、`unzip`和`tar`等命令的学习过程
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

这次学习Linux命令行，重点放在时间管理、输入输出、文件查找和压缩归档这些高频场景上，单条命令看起来都很短，组合起来就能完成日志排查、文件整理和备份等工作

## 命令选项

命令后面以`-`开头的内容通常是选项，用来改变命令的行为，例如`ls -l`中的`-l`表示使用详细列表格式

短选项可以合写，`ls -la`等同于`ls -l -a`，其中`-l`表示显示详细信息，`-a`表示连隐藏文件一起显示，选项后面如果需要参数，参数通常紧跟在选项后面或单独写出，例如`unzip project.zip -d ./restored`中的`-d`用于指定解压目录

像`>`、`>>`、`<`和`|`属于Shell的数据流符号，和命令选项的作用不同，遇到不熟悉的选项，可以先运行`man 命令名`查看手册，之前介绍过man命令

## 用`date`查看和处理时间

`date`可以显示当前时间，也可以按照指定格式输出

```bash
date
date '+%Y-%m-%d %H:%M:%S'
date '+%Y-%m-%d'
```

常见格式标记如下：

| 标记 | 含义 |
| --- | --- |
| `%H` | 小时，范围是00到23 |
| `%M` | 分钟 |
| `%S` | 秒 |
| `%d` | 一个月中的第几天 |
| `%m` | 月份 |
| `%Y` | 四位年份 |
| `%F` | 等同于`%Y-%m-%d` |

时间戳也可以在日期和秒数之间转换：

```bash
date '+%s'
date -d '@1599642565' '+%Y-%m-%d %H:%M:%S'
```

这里的两个选项分别负责转换和设置时间：

| 选项 | 作用 |
| --- | --- |
| `-d` | 按给定日期或时间字符串进行转换 |
| `-s` | 设置系统时间，通常需要root权限 |

`date -s`能够设置系统时间，但通常需要root权限，服务器上的时间调整还会影响日志、定时任务和证书校验，实际操作前要先确认环境和权限

`cal`用于查看日历，临时确认日期或安排任务时很方便：

```bash
cal
cal 8 2026
```

## 重定向让输入输出换个方向

命令默认从标准输入读取数据，并把结果写到标准输出，Shell的重定向符号可以改变数据流向

```bash
echo '第一次写入' > note.txt
echo '继续追加' >> note.txt
cat < note.txt
```

`>`会覆盖目标文件的原有内容，`>>`会在文件末尾追加内容，`<`会把文件交给命令作为输入，需要保留原内容时，应优先使用`>>`，执行覆盖操作前也要确认目标路径

例如，把目录列表保存下来，再交给`less`分页查看：

```bash
ls -la > directory.txt
less < directory.txt
```

`ls -l`会以详细列表显示文件权限、所有者、大小和修改时间，`-a`会把隐藏文件一起列出，所以`ls -la`适合在排查目录内容时使用

## 用`find`按条件查找文件

`find`从指定路径开始遍历目录，并根据条件筛选文件，最常用的条件是文件名和类型

```bash
find . -type f -name '*.log'
find /var/log -type f -name '*.log'
find . -type d -name 'cache'
```

还可以结合修改时间和文件大小缩小范围：

```bash
find . -type f -mtime -7
find . -type f -size +100M
```

`find`中常见的筛选选项如下：

| 选项 | 作用 |
| --- | --- |
| `-type f` | 只匹配普通文件 |
| `-type d` | 只匹配目录 |
| `-name` | 按名称匹配，支持通配符 |
| `-mtime -7` | 匹配最近7天内被修改过的内容 |
| `-size +100M` | 匹配大于100MB的文件 |
| `-exec` | 对找到的每个结果执行后面的命令 |

如果要直接处理查找到的文件，可以使用`-exec`：

```bash
find . -type f -name '*.log' -exec grep -n 'error' {} +
```

`-exec`后面的`{}`会被替换成找到的文件路径，末尾的`+`表示尽量把多个路径合并后交给一次命令处理，减少重复启动`grep`的次数

这条命令把查找和搜索连成了一步，适合快速定位一批日志中的关键词

## 用`grep`搜索文本

`grep`负责在文件内容中查找字符串，常用选项可以让输出更适合排查问题

```bash
grep -n 'error' app.log
grep -i 'warning' app.log
grep -v 'debug' app.log
grep -Rni --include='*.log' 'timeout' ./logs
```

| 选项 | 作用 |
| --- | --- |
| `-n` | 同时显示匹配行的行号 |
| `-i` | 忽略大小写 |
| `-v` | 反向筛选，不显示包含关键词的行 |
| `-R` | 递归搜索目录 |
| `--include='*.log'` | 递归搜索时只处理匹配该模式的文件 |

管道可以把多个命令串起来，例如先列出进程，再筛选目标服务：

```bash
ps aux | grep nginx
```

这里的`ps aux`使用了不带短横线的BSD风格选项：`a`表示显示其他用户的进程，`u`显示用户和资源占用信息，`x`包含没有关联终端的进程

实际排查时，可以先产生完整结果，再逐步缩小范围，每一步都能单独运行和验证，出了问题也更容易定位

## `zip`和`unzip`处理zip文件

`zip`适合快速创建zip压缩包，`unzip`负责解压

```bash
zip notes.zip notes.md
zip -r project.zip project/
unzip project.zip
unzip project.zip -d ./restored
```

| 选项 | 作用 |
| --- | --- |
| `-r` | 递归处理目录及其子目录 |
| `-d` | 指定解压目标目录 |

压缩目录时需要使用`-r`，解压时使用`-d`可以把文件放到指定位置，解压前最好确认目标目录，避免同名文件被覆盖

## `tar`负责打包和归档

Linux环境中更常见的是`tar`系列命令，它可以把目录打包，也可以结合gzip或bzip2进行压缩

| 选项 | 作用 |
| --- | --- |
| `-c` | 创建归档 |
| `-x` | 解开归档 |
| `-t` | 查看归档内容 |
| `-z` | 使用gzip压缩或解压 |
| `-j` | 使用bzip2压缩或解压 |
| `-v` | 显示处理过程 |
| `-f` | 指定归档文件名 |
| `-C` | 切换到指定目录后操作 |

常用操作可以这样写：

```bash
tar -czvf project.tar.gz project/
tar -tzvf project.tar.gz
tar -xzvf project.tar.gz -C ./restored
```

上面的选项可以合并书写，读法如下：

| 写法 | 拆解 | 作用 |
| --- | --- | --- |
| `-czvf` | `-c`、`-z`、`-v`、`-f` | 创建一个gzip压缩的归档，并显示过程与文件名 |
| `-tzvf` | `-t`、`-z`、`-v`、`-f` | 查看gzip归档中的文件列表 |
| `-xzvf` | `-x`、`-z`、`-v`、`-f` | 解开gzip归档并显示过程 |
| `-C ./restored` | `-C`加目标目录 | 在指定目录中执行后续解压操作 |

只想取出归档中的某个文件时，可以把路径写在命令末尾：

```bash
tar -xzvf project.tar.gz project/config.yaml
```

打包前需要确认路径层级，尤其是从根目录或系统目录创建归档时，避免把不需要的内容一起打进去

## 继续熟悉几个常用命令

`bc`可以在终端中进行计算：

```bash
echo 'scale=2; 10 / 3' | bc
```

`uname -r`用于查看当前内核版本，`uname -a`会输出更完整的系统信息：

```bash
uname -r
uname -a
```

| 选项 | 作用 |
| --- | --- |
| `-r` | 只显示内核版本 |
| `-a` | 显示内核、主机名、系统版本和硬件架构等完整信息 |

几个值得记住的快捷键：

- `Tab`补全命令和路径
- `Ctrl-C`终止当前运行的程序
- `Ctrl-D`表示输入结束，也常用于退出Shell
- `Ctrl-R`搜索历史命令

`shutdown`用于关机或重启，常见形式如下，远程服务器执行前要再次确认主机和时间，避免中断正在运行的服务

```bash
shutdown -h now
shutdown -r now
shutdown -t 60
```

`shutdown -h now`会在停止系统服务后立即关机，`shutdown -r now`会重启系统，`shutdown -t 60`表示延迟60秒执行操作

## 常用命令扩展

这组命令覆盖登录、文件处理、系统管理、网络操作和权限控制等场景，使用前可以先通过`man`确认当前系统支持的选项

### 安装和登录命令

`login`、`shutdown`、`halt`、`reboot`、`install`、`mount`、`umount`、`chsh`、`exit`、`last`

### 文件处理命令

`file`、`mkdir`、`grep`、`dd`、`find`、`mv`、`ls`、`diff`、`cat`、`ln`

### 系统管理相关命令

`df`、`top`、`free`、`quota`、`at`、`lp`、`adduser`、`groupadd`、`kill`、`crontab`

### 网络操作命令

`ifconfig`、`ip`、`ping`、`netstat`、`telnet`、`ftp`、`route`、`rlogin`、`rcp`、`finger`、`mail`、`nslookup`

### 系统安全相关命令

`passwd`、`su`、`umask`、`chgrp`、`chmod`、`chown`、`chattr`、`sudo`、`ps`、`who`

### 其他命令

`tar`、`unzip`、`gunzip`、`unarj`、`mtools`、`man`、`unendcode`、`uudecode`

## 试着练习

下面是一个完整的例子，尝试完成：

这里的`mkdir -p`中，`-p`会在上级目录不存在时一并创建目录，目标目录已经存在时也不会因为重复创建而报错

```bash
mkdir -p demo/logs
printf 'info start\nerror timeout\n' > demo/logs/app.log
printf 'warning retry\n' >> demo/logs/app.log
find demo -type f -name '*.log' -exec grep -n 'error' {} +
tar -czvf demo-logs.tar.gz demo/logs
tar -tzvf demo-logs.tar.gz
```

## 小结

`date`和`cal`处理时间，重定向控制数据流向，`find`和`grep`负责定位文件与内容，`zip`、`unzip`和`tar`完成压缩与归档，`bc`、`uname`和快捷键则是用于日常使用场景

命令行真正有用的地方，在于这些小工具可以被脚本和管道连接起来，把路径、权限、输入输出和覆盖风险都确认清楚，再执行命令，效率和可控性会一起提高

## 来源

本文为个人学习笔记，根据[lvy-的《Linux命令行：从时间管理到文件查找压缩的指令详解》](https://lvynote.blog.csdn.net/article/details/139739336)提炼并重新组织，保留原文链接供进一步阅读
