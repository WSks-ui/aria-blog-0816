---
title: Linux权限管理：用户、文件与目录
summary: Shell、用户身份、rwx、chmod、chown、chgrp、umask和粘滞位
publishedAt: '2026-08-27'
updatedAt: null
tags:
  - Linux
  - 学习笔记
  - 文件管理
  - 服务器
  - 系统管理
kind: note
featured: false
draft: false
github: null
cover: null
readingWeather: null
---

这次学权限。之前以为权限就是"文件能不能打开"，学完发现目录能不能进、脚本能不能跑、服务能不能读配置、共享目录里能不能删别人的文件，全归它管

## Shell在用户和内核中间

严格来说Linux指的是内核（Kernel），用户没法直接操作内核，要通过它外面的"壳"，也就是Shell

```text
用户输入命令
    |
Shell解析命令
    |
Kernel执行系统调用
    |
文件、进程、网络和硬件
```

Shell负责解析命令、启动程序、显示结果，权限检查是内核在处理请求时做的。所以同一条命令，换个用户执行结果可能就不一样

## 用户身份

Linux里分root和普通用户。root几乎什么都能干，普通用户只能在被允许的范围内操作

看提示符就能大概分辨：普通用户是`$`，root是`#`

确认当前身份：

```bash
whoami
id
```

`whoami`只输出用户名，`id`还会列出用户ID、主组和附加组。排查权限问题时，组经常是关键

切换用户：

```bash
su - user
sudo -u user command
```

`su - user`是切换成`user`，并像重新登录一样加载这个用户的环境；`sudo -u user command`只是用`user`的身份跑一条命令

`su -`里这个`-`是`su`自己的参数，不是所有命令都这么用，拿不准就`man`一下

## 用`ls -l`看权限

```text
-rw-r----- 1 user dev 128 Aug 27 20:00 note.txt
```

第一个字符是文件类型：

| 第一位 | 类型 |
| --- | --- |
| `-` | 普通文件 |
| `d` | 目录 |
| `l` | 软链接 |
| `c` | 字符设备 |
| `b` | 块设备 |
| `p` | 管道 |
| `s` | 套接字 |

后面九位三个一组，依次是所有者（u）、所属组（g）、其他用户（o）。上面的`rw-r-----`拆开就是：所有者能读写，组里的人只能读，其他人什么都不能干

## `rwx`在文件和目录上不一样

| 权限 | 对文件 | 对目录 |
| --- | --- | --- |
| `r` | 读内容 | 列出目录里有哪些名字 |
| `w` | 改内容 | 配合`x`在目录里新建、删除、重命名 |
| `x` | 执行 | 进入目录，访问里面的文件 |

目录的`x`最容易被忽略。没有`x`的话，就算知道文件名也进不去、读不了

## 数字写法

`r`=4，`w`=2，`x`=1，每组加起来就是一位数字：

| 数值 | 权限 |
| --- | --- |
| 7 | `rwx` |
| 6 | `rw-` |
| 5 | `r-x` |
| 4 | `r--` |
| 0 | `---` |

所以`755`是所有者`rwx`、其他两组`r-x`；`640`是所有者读写、组只读、其他人没权限

## `chmod`：改权限

```bash
chmod u+x deploy.sh
chmod go-w config.env
chmod a=r readme.txt
chmod 640 config.env
```

符号写法由三部分组成：谁（`u`/`g`/`o`/`a`，a是全部）、怎么改（`+`加、`-`减、`=`直接设成）、改什么（`r`/`w`/`x`）。`chmod u+x deploy.sh`就是给所有者加上执行权限

要一次把三组都写清楚时，用数字写法更直接

递归改整个目录用`-R`：

```bash
chmod -R u=rwX,go=rX site/
```

注意这里是大写`X`：只给目录和本来就能执行的文件加`x`，普通文本文件不会被顺手改成可执行。批量改之前最好先在测试目录里试一遍

## `chown`和`chgrp`：改所有者和组

```bash
sudo chown user:dev note.txt
sudo chgrp dev note.txt
sudo chown -R user:dev project/
```

`user:dev`是同时把所有者设成`user`、组设成`dev`。改所有者一般要`sudo`，改之前先`ls -l`看一下现在归谁

## `umask`：新文件的默认权限

新建文件的权限上限是`666`，目录是`777`。文件默认不给`x`，不然随便建个文本都能执行

`umask`是在这个上限上要去掉的位：

```bash
umask
umask 022
```

| 掩码 | 新文件 | 新目录 |
| --- | --- | --- |
| `022` | `644` | `755` |
| `002` | `664` | `775` |

`022`就是把组和其他人的写权限去掉

## 粘滞位

有时候文件本身权限没问题，就是打不开，多半是上级某个目录缺`x`

还有一个问题是共享目录：大家都有`w`，就意味着谁都能删别人的文件。粘滞位就是解决这个的，设了之后，目录里的文件只有文件所有者、目录所有者和root能删或改名

```bash
mkdir -p permission-lab/share
chmod 1777 permission-lab/share
ls -ld permission-lab/share
```

`1777`开头的`1`就是粘滞位。`ls -ld`里的`-d`是显示目录本身，而不是列出目录里的内容。设好之后权限最后一位会显示成`t`

`/tmp`就是这样：谁都能在里面建临时文件，但删不了别人的

## 练习

在自己的目录下做，别碰系统目录：

```bash
mkdir -p permission-lab
touch permission-lab/private.txt
chmod 640 permission-lab/private.txt
mkdir permission-lab/upload
chmod 1777 permission-lab/upload
ls -ld permission-lab permission-lab/upload
ls -l permission-lab/private.txt
```

建一个只有自己能读写的文件，再建一个带粘滞位的共享目录，看看`ls`输出里的权限、所有者、组，还有末尾那个`t`

以后碰到权限问题，大概按这个顺序查：我是谁、文件归谁、在哪个组、权限位是什么、上级目录有没有`x`

## 来源

本文为个人学习笔记，根据[lvy-的《深入解析Linux权限管理：从基本原理到应用》](https://lvynote.blog.csdn.net/article/details/139767569)提炼并重新组织，保留原文链接供进一步阅读
