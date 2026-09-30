---
title: Linux命令行实践：从man到管道
summary: man手册怎么查，cp、mv、cat、less、head、tail怎么用，再用管道把它们串起来
publishedAt: '2026-08-19'
updatedAt: null
tags:
  - Linux
  - 学习笔记
  - 命令行
  - 服务器
kind: note
featured: false
draft: false
github: null
cover: null
readingWeather: null
---

前两篇都在讲概念，这篇开始动手：查手册、处理文件、用管道把命令连起来

## 先学会查：`man`

命令太多了，背不下来，不会就查`man`：

```bash
man man
man 1 printf
man 2 fork
man 3 printf
```

中间的数字是手册的章节，常用的几个：

| 章节 | 内容 |
| --- | --- |
| 1 | 普通用户命令 |
| 2 | 系统调用 |
| 3 | C语言库函数 |
| 5 | 文件格式和配置文件 |
| 8 | 系统管理命令 |

`printf`就是个例子：Shell里有个`printf`命令，C标准库里也有个`printf`函数，`man 1 printf`查前者，`man 3 printf`查后者。如果提示没有手册，装一下`man`或`man-pages`包

## 复制、移动、查看文件

### `cp`：复制

```bash
cp source.txt backup.txt
cp -r project project-backup
```

复制目录要加`-r`。怕覆盖掉已有文件就加`-i`，覆盖前会先问一句

### `mv`：移动或重命名

```bash
mv draft.md notes.md
mv notes.md archive/
```

Linux没有单独的重命名命令，改名就是用`mv`把文件"移动"到同一个目录下的新名字

### `cat`：直接输出文件

```bash
cat -n notes.md
```

`-n`会带上行号。短文件用`cat`看很方便，长日志直接`cat`会一下刷满屏幕，换下面的工具

## 看长文件

`less`可以翻页，也能搜索：

```bash
less server.log
```

进去之后`/error`往下搜，`?error`往上搜，`n`跳到下一个，`q`退出

`head`和`tail`分别看开头和结尾几行：

```bash
head -n 20 server.log
tail -n 20 server.log
```

两个一起用可以截中间某一段。比如要第516到520行，先取前520行，再取最后5行：

```bash
head -n 520 long.txt | tail -n 5
```

## 管道

竖线`|`把前一个命令的输出交给后一个命令当输入：

```bash
cat app.log | grep "ERROR"
ls -la | less
printf '%s\n' *.log | head -n 10
```

最常用的一个是查进程：先`ps`列出所有进程，再`grep`筛出想找的那个

```bash
ps aux | grep nginx
```

有个坑：管道只传标准输出，报错信息（标准错误）不会跟着过去。想一起传的话要用`2>&1`之类的重定向先合并

## 删文件要小心

`rm`删掉的文件不进回收站，`rm -r`、`rm -f`手一滑基本就找不回来了。删之前先确认位置和目标：

```bash
pwd
ls -la
rm -i target.txt
```

要是经常整理文件，可以先`mv`到一个自己建的临时目录，过几天确认没问题再清掉，比给`rm`套一堆别名简单

## 来源

本文为个人学习笔记，根据[2301_80171004的《探索Linux命令行：从基础指令到高级管道操作的介绍与实践》](https://blog.csdn.net/2301_80171004/article/details/139706097)提炼并重新组织，保留原文链接供进一步阅读
