---
title: Linux为什么重要：从企业服务器到个人能力栈
summary: Linux在服务器、嵌入式和个人设备上各用在哪，以及第一次SSH连上服务器编译运行一个C程序
publishedAt: '2026-08-19'
updatedAt: null
tags:
  - Linux
  - 学习笔记
  - 服务器
  - 操作系统
kind: note
featured: false
draft: false
github: null
cover: null
readingWeather: null
---

之前学过一遍Linux，但一篇笔记都没留下，最近重新过一遍，顺手记下来。偏个人博客的写法，不是教程

## Linux用在哪

### 服务器

这是Linux最主要的地盘。Web服务、数据库、DNS、邮件、代理、容器，大部分都跑在Linux上

服务器一般不装桌面，管理员SSH登上去，部署、改配置、看监控、查故障全在终端里完成。所以想碰后端或者运维，绕不开Linux命令行

当然企业里也不是只有Linux，Windows Server之类的也有，只是互联网这一块Linux占大头

### 嵌入式设备

路由器、交换机、车机、各种物联网小盒子，很多里面跑的是裁剪过的Linux。内核能适配的处理器很多，资源少的设备也塞得下

### 个人设备

桌面上Windows和macOS还是主流，Linux桌面用的人不多。但Android用的是Linux内核，智能电视、光猫、路由器也大多是Linux，只是平时看不到它

## 学Linux会连带学到什么

真用起来，会顺带碰到这些东西：

- Shell和命令行
- 进程、文件、内存、设备这些操作系统概念
- 网络和服务部署
- C语言和系统调用
- 写脚本、看日志、查问题
- 查文档、搜资料

运维、后端、数据库、嵌入式、系统编程这些方向，或多或少都要用到上面几样

## 第一次连上Linux

最省事的办法是弄一台云服务器或者虚拟机，用SSH连上去。Windows上用Xshell、Windows Terminal都行，需要的是主机地址、端口、用户名，以及密码或密钥

连上之后写个最小的C程序试试：

```bash
touch test.c
vim test.c
```

写入代码：

```c
#include <stdio.h>

int main(void) {
	printf("Hello, Linux!\n");
	return 0;
}
```

保存退出，编译运行：

```bash
gcc test.c
./a.out
```

没指定输出文件名时gcc默认生成`a.out`，前面的`./`表示运行当前目录下的这个文件

几行命令下来，建文件、用vim编辑、调gcc、运行程序都走了一遍，比光背命令有感觉

## 来源

本文为个人学习笔记，根据[lvy-的《配置教程》Linux在企业端为何如此重要](https://lvynote.blog.csdn.net/article/details/139637106)提炼并重新组织，保留原文链接供进一步阅读
