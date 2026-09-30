---
title: Makefile入门：依赖关系、伪目标与增量构建
summary: Makefile的依赖关系和依赖方法、伪目标，以及make靠什么判断要不要重新编译
publishedAt: '2026-09-10'
updatedAt: null
tags:
  - Linux
  - 学习笔记
  - 构建工具
  - 编译
kind: note
featured: false
draft: false
github: null
cover: null
readingWeather: null
---

这篇学Makefile

## 手写gcc的麻烦

单个C文件的编译很简单：

```bash
gcc hello.c -o hello
```

但手敲有个坑：`-o`后面跟的是输出文件，要是顺序写反了，gcc不会拦你，而是直接把源文件当成输出覆盖掉：

```bash
gcc -o hello.c hello
```

执行完，`hello.c`里的源码就没了

文件一多，编译顺序、链接参数、哪些文件要重编，靠脑子记迟早出错。Makefile就是把这些写进一个文件，以后只敲一个`make`

## 依赖关系与依赖方法

Makefile里的规则只有两类内容：依赖关系和依赖方法

```makefile
mycode: mycode.c
	gcc -o mycode mycode.c
```

![Makefile的第一行是依赖关系，第二行是依赖方法](/assets/images/posts/Makefile/rule-structure.webp)

第一行是依赖关系，表示`mycode`由`mycode.c`生成；第二行是依赖方法，也就是生成时执行的命令

命令那一行前面必须是Tab，写成空格会报`missing separator`，编辑器自动把Tab转空格的话要注意

之后在目录下执行`make`，它会自动找到`Makefile`或`makefile`并完成编译：

```bash
make
gcc -o mycode mycode.c
```

## `make`默认执行第一个目标

`make`不带参数时，只执行文件里的第一个目标

所以顺序写错会出事：

```makefile
.PHONY:clean
clean:
	rm -f mycode

mycode:mycode.c
	gcc -o mycode mycode.c
```

这时直接执行`make`，跑的是删除而不是编译：

```bash
make
rm -f mycode
```

![clean写在前面时，直接运行make执行的是删除](/assets/images/posts/Makefile/first-target.webp)

这时要编译只能写明`make mycode`。一般把最终产物放最前面，`clean`这种放最后

## 把编译过程拆开

上面是一步完成编译。gcc从`.c`到可执行文件实际经过四步，Makefile可以把四步都写成规则：

```makefile
hello: hello.o
	gcc hello.o -o hello

hello.o: hello.s
	gcc -c hello.s -o hello.o

hello.s: hello.i
	gcc -S hello.i -o hello.s

hello.i: hello.c
	gcc -E hello.c -o hello.i
```

![gcc从hello.c到hello的四步](/assets/images/posts/Makefile/gcc-stages.webp)

这样写好之后，`make`会从最终目标往回找，缺哪个中间文件就先生成哪个：`hello`依赖`hello.o`，`hello.o`依赖`hello.s`，一直找到`hello.c`，再按顺序执行每条命令

## `clean`与伪目标

清理编译产物一般单独写一个目标：

```makefile
.PHONY:clean
clean:
	rm -f mycode
```

`clean`没有依赖文件，规则里只有一行命令。`.PHONY:clean`把它声明为伪目标：伪目标不对应真实文件，声明之后，即使目录下正好有个叫`clean`的文件，`make clean`也会照常执行

`.PHONY`后面写的是目标名，不是依赖文件，很容易写混

普通目标则不同，依赖没变过时`make`会直接跳过：

```bash
make
make: 'mycode' is up to date.
```

## `make`怎么判断要不要重新编译

依据是文件的修改时间。用`stat`能看到一个文件的三个时间：

```bash
stat mycode
```

| 字段 | 含义 |
| --- | --- |
| `Access` | 最近一次被读取的时间 |
| `Modify` | 最近一次内容被修改的时间 |
| `Change` | 最近一次元数据（权限、属主等）被修改的时间 |

`make`比较的是`Modify`：目标文件的`Modify`比依赖文件新，说明产物是最新的，不需要重建

![make按修改时间决定编译还是跳过](/assets/images/posts/Makefile/mtime-decision.webp)

为什么不用另外两个：`Access`现在默认按`relatime`策略更新，只有它比mtime或ctime旧、或者距上次更新超过24小时才会刷新（每读一次就写一次盘太费了），所以不准；`Change`记的是权限、属主这类元数据的变化，跟源码改没改不是一回事

想强制重新编译，可以手动刷新源文件的时间：

```bash
touch mycode.c
make
```

`touch`把文件时间改成现在，`make`一看源文件比目标新，就会重新编译

## 变量与自动变量

规则一多，编译器、选项、目标名到处都是重复的，可以用变量：

```makefile
CC = gcc
CFLAGS = -Wall -O2
TARGET = mycode

$(TARGET): $(TARGET).c
	$(CC) $(CFLAGS) -o $@ $<

.PHONY: clean
clean:
	rm -f $(TARGET) *.o
```

![make把变量展开后执行的命令](/assets/images/posts/Makefile/variable-expansion.webp)

变量用`$(名字)`引用，要换编译器或者改选项，只改开头一处就行

`$@`、`$<`这类是自动变量，执行规则时由`make`自动填值：

| 写法 | 含义 |
| --- | --- |
| `$@` | 当前规则的目标名 |
| `$<` | 第一个依赖文件 |
| `$^` | 全部依赖文件 |

所以`$(CC) $(CFLAGS) -o $@ $<`展开就是`gcc -Wall -O2 -o mycode mycode.c`，换个目标名规则也不用改

## 来源

本文为个人学习笔记，根据[lvy的《【Linux必备工具】自动化构建工具makefile的使用详解》](https://lvynote.blog.csdn.net/article/details/139856443)提炼并重新组织，补充了变量与自动变量部分，保留原文链接供进一步阅读
