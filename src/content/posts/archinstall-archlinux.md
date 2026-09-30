---
title: 使用archinstall安装ArchLinux
summary: 在 VMware 里用 archinstall 装 ArchLinux，每个选项怎么选，以及踩到的四个坑
publishedAt: '2026-06-03'
updatedAt: null
tags:
  - Linux
  - 系统安装
kind: tutorial
featured: false
draft: false
github: null
cover: null
readingWeather: null
---

## 前言

Arch 的传统装法要照着 Wiki 手敲几十条命令，分区、挂载、装引导，哪一步错了都得回头查。后来官方出了个 `archinstall` 脚本，用菜单选一选就能装，我这次就是用它在 VMware 里装的，顺便把踩的坑记下来

环境：主机 Win11（AMD R9 AI 365H，32GB），虚拟机给了 4GB 内存、30GB 硬盘、2核4线程，内核 7.x

## 准备工作

### 下载ISO并制作启动盘

从 [Arch Linux 官网](https://archlinux.org/download/) 下最新的 ISO

装实体机的话用 Rufus、balenaEtcher 或 Ventoy 写进U盘；虚拟机直接挂 ISO 就行

### 启动到Live环境

从 U盘/ISO 启动，选 "Arch Linux install medium"，进去就是 root 的 shell

### 连接网络

archinstall 装的时候要在线下包，网不通后面全白搭，先把网弄好

**有线**：一般会自动拿到 IP，`ping baidu.com` 试一下

**无线**，用 iwctl：

```bash
iwctl
device list                     # 查看无线网卡名称，如 wlan0
station wlan0 scan
station wlan0 get-networks
station wlan0 connect "SSID"    # 输入密码
exit
```

## 运行 archinstall

网通了之后直接输入：

```bash
archinstall
```

会进到一个配置菜单，方向键和 Tab 切换，回车确认。我是这么选的：

| 选项 | 我的选择 | 说明 |
|------|----------|------|
| 语言 | English | 安装器界面语言 |
| 键盘布局 | us | 保持默认 |
| 镜像地区 | China | 不选的话下载慢得离谱 |
| 系统语言 | en_US.UTF-8 | 先别设中文，没装字体时终端会乱码 |
| 磁盘分区 | 最佳配置（Best-effort） | 自动分区（会擦除整个磁盘） |
| 加密 | 否 | 新手可不加密 |
| Swap | 4G（或等于内存大小） | 内存 ≤ 8G 时建议设 Swap |
| 主机名 | 任意 | 例如 archlinux |
| Root 密码 | 设置强密码 | 留空会禁用 root 账户 |
| 普通用户 | 创建用户名和密码 | 平时用这个，别一直用 root |
| 配置文件 | 桌面环境（如KDE Plasma） | 选好会自动安装图形界面 |
| 音频 | pipewire | |
| 额外软件包 | vim firefox 等 | 可选 |

都选好了点 Install

## 踩到的坑

### 坑一：VMware 虚拟机网络子网冲突导致无法联网

**现象**：虚拟机无法获取 IP 地址，或 ping 任何外网都失败

**原因**：VMware 的虚拟网络编辑器里，VMnet0 和 VMnet8 用了同一个子网 `192.168.181.0`，路由乱了

**解决**：

1. 打开 VMware "编辑" → "虚拟网络编辑器"
2. 选中 VMnet8（NAT模式），修改"子网IP"为不冲突的值，例如 `192.168.88.0`
3. 点击"应用"或"确定"（需要管理员权限）
4. 在虚拟机中重启网络服务：`systemctl restart systemd-networkd` 或直接重启虚拟机
5. 重新获取 IP：`dhcpcd` 或 `systemctl restart dhcpcd`
6. 验证：`ip addr` 应能看到类似 `192.168.88.129` 的地址，`ping 114.114.114.114` 正常

### 坑二：archinstall 卡在 "Waiting for time sync" 或 "Waiting for keyring sync"

**现象**：运行 archinstall 后，进度长时间（>3分钟）停留在同步时间或密钥环阶段

**原因**：网络慢，或者连 GPG 密钥服务器太慢

**解决**：按 Ctrl+C 终止，使用跳过参数重新运行：

```bash
archinstall --skip-ntp --skip-wkd
```

- `--skip-ntp`：跳过等待时间同步
- `--skip-wkd`：跳过 Web Key Directory 同步（最常见的卡点）

如果仍然卡住，可以加上 `--no-mirror-select` 并手动设置镜像源：

```bash
echo "Server = https://mirrors.ustc.edu.cn/archlinux/\$repo/os/\$arch" > /etc/pacman.d/mirrorlist
archinstall --skip-ntp --skip-wkd --no-mirror-select
```

有时候等几分钟它自己就过去了，超过 10 分钟还不动就别等了，直接 Ctrl+C 加参数重来

### 坑三：pacman 无法安装 archinstall

**现象**：`error: target not found: archinstall`

**原因**：pacman 的数据库还没同步，Live 环境第一次用要先手动同步一下

**解决**：

```bash
pacman -Sy      # 同步数据库
pacman -S archinstall
```

### 坑四：安装完成后重启没有图形登录界面

**现象**：重启后依然是命令行 `login:`

**原因**：安装时"配置文件"那步没选桌面，或者选了但显示管理器没启用

**解决**：先在命令行登录，手动装上显示管理器并启用，这里用 SDDM：

```bash
sudo pacman -S sddm
sudo systemctl enable sddm
sudo systemctl start sddm   # 立即启动
```

桌面环境也没装的话：

```bash
sudo pacman -S plasma      # KDE
sudo pacman -S gnome       # GNOME
```

## 装完之后

- **更新系统**：`sudo pacman -Syu`
- **安装常用软件**：`sudo pacman -S vim firefox git base-devel`
- **启用时间同步**：`sudo systemctl enable --now systemd-timesyncd`
- **配置中文（如果需要）**：
  - 编辑 `/etc/locale.gen`，取消 `zh_CN.UTF-8` 注释，运行 `sudo locale-gen`
  - 安装中文字体：`sudo pacman -S wqy-microhei`
- **配置 AUR 助手（可选）**：安装 yay 或 paru 以便从 AUR 安装软件

## 最后

archinstall 本身装得很快，时间基本都花在上面这几个坑上。绕过去的话，二十分钟左右就能进桌面
