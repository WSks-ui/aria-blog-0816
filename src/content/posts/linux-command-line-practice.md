---
title: Linux命令行实践：从man到管道
summary: 记录man手册、文件操作、长文本查看和管道组合的学习过程，把常用Linux命令放进可以复现的练习里
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

前两篇笔记解决了“为什么学习Linux”和“命令行处在什么位置”这两个问题，这一篇开始记录更具体的操作：如何查命令、如何处理文件，以及如何把多个命令串起来

## 先学会查：`man`

Linux命令很多，靠记忆不现实。`man`是最直接的联机手册入口：

```bash
man man
man 1 printf
man 2 fork
man 3 printf
```

`man`后面的数字表示手册章节。常见的几类包括：

| 章节 | 内容 |
| --- | --- |
| 1 | 普通用户命令 |
| 2 | 系统调用 |
| 3 | C语言库函数 |
| 5 | 文件格式和配置文件 |
| 8 | 系统管理命令 |

例如，想看Shell中的`printf`命令，可以查`man 1 printf`；想看C语言接口，可以查`man 3 printf`。如果系统提示没有手册，按发行版安装对应的`man`或`man-pages`包即可

## 文件的复制、移动和查看

### `cp`：复制

```bash
cp source.txt backup.txt
cp -r project project-backup
```

`-r`用于递归复制目录。覆盖已有文件前，可以使用`-i`让命令先询问确认

### `mv`：移动或重命名

```bash
mv draft.md notes.md
mv notes.md archive/
```

同一个命令既能改名，也能把文件移动到另一个目录。理解这一点后，整理文件时不需要额外记一条“重命名命令”

### `cat`：快速输出文件

```bash
cat -n notes.md
```

`cat`适合查看短文件或把多个文件连接起来。面对很长的日志时，直接全部输出会让终端很难操作，这时应该换成分页和筛选工具

## 阅读长文本

`less`可以前后翻页，也能在文件内部搜索，适合查看日志：

```bash
less server.log
```

进入后可以使用`/error`向下搜索`error`，使用`?error`向上搜索；按`n`跳到下一个匹配项，按`q`退出

`head`和`tail`用来查看文件开头或结尾的若干行：

```bash
head -n 20 server.log
tail -n 20 server.log
```

组合起来，就可以从一个大文件中取出指定范围。例如，下面的命令会先取前520行，再取其中最后5行：

```bash
head -n 520 long.txt | tail -n 5
```

## 管道：让命令协作

竖线`|`会把前一个命令的标准输出交给后一个命令作为输入。它的价值在于可以把简单工具组合成一条清晰的数据处理流程：

```bash
cat app.log | grep "ERROR"
ls -la | less
printf '%s\n' *.log | head -n 10
```

实际排查问题时，常见的思路是“先产生数据，再逐步缩小范围”。比如先用`ps`列出进程，再用`grep`筛选目标服务：

```bash
ps aux | grep nginx
```

需要注意，管道默认传递的是标准输出，错误输出不会自动进入后一个命令。如果确实需要把错误输出也交给管道，可以使用Shell的重定向语法显式合并

## 一个需要牢记的安全习惯

`rm`删除文件通常不会进入桌面系统那样的回收站，尤其是`rm -r`和`rm -f`，误操作后很难恢复。执行删除前，先确认三件事：

```bash
pwd
ls -la
rm -i target.txt
```

如果经常需要整理文件，可以先用`mv`把文件移动到自己创建的临时目录，确认无误后再统一清理。把“可恢复”作为默认习惯，比给`rm`设置一个复杂别名更容易理解和维护

## 小结

`man`负责让我们知道命令应该怎么用，`cp`、`mv`、`cat`、`less`、`head`和`tail`负责处理文件，管道则把这些小工具连接起来。掌握查手册、单独验证、组合使用的节奏，命令行才会从背诵题变成真正的工作工具

## 来源

本文为个人学习笔记，根据[2301_80171004的《探索Linux命令行：从基础指令到高级管道操作的介绍与实践》](https://blog.csdn.net/2301_80171004/article/details/139706097)提炼并重新组织，保留原文链接供进一步阅读
