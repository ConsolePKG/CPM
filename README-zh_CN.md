# PS4RPS

## ConsolePKG 资源库与安装 job

当前源码支持浏览器/Node 共享资源库内核、IndexedDB/SQLite 异步索引、只读分享和 NAS Docker 服务。
新安装流程使用主机权威的 `/api/v1/jobs`，需要 CPI 2.07 源码对应的 payload；旧外部静态服务器需升级或改为 WebDAV。
原生完成信号及新的 PS5 job 行为仍须真机验证。部署前请阅读[部署、迁移、分享与恢复说明](docs/library-jobs.md)。

[![GitHub release (latest by date including pre-releases](https://img.shields.io/github/v/release/njzydark/PS4RPS?include_prereleases)](https://github.com/njzydark/PS4RPS/releases/latest)
[![Build/release](https://github.com/njzydark/PS4RPS/actions/workflows/build.yaml/badge.svg)](https://github.com/njzydark/PS4RPS/actions/workflows/build.yaml)
[![GitHub](https://img.shields.io/github/license/njzydark/PS4RPS)](https://github.com/njzydark/PS4RPS/blob/master/LICENSE)

为 PS4 远程安装 PKG

![PS4RPS.png](assets/PS4RPS.png)

简体中文 | [English](./README.md)

## 特性

- 支持 MacOS, Windows 和 Linux
- 支持暗黑模式
- 支持显示 pkg 文件的 icon 和 paramSfo 数据
- 支持直接使用 web 版本访问你 NAS 中的 pkg 文件发送安装任务
- 支持暂停和恢复安装任务
- 支持利用远程的 WebDAV 服务器进行安装
- 支持从本地文件夹创建静态文件服务器
- 支持多个 PS4 Host 和文件服务器配置

## 动机

此类工具其实挺多的，我试用了一款觉得 UI 比较粗糙且不能安装我 NAS 上的 PKG 文件，所以我就准备自己开发一款，也正好为这个社区贡献一份自己的力量，多一种选择也不算坏事。

## 使用

在发送安装任务之前，你必须在 PS4 安装 Remote Pkg Installer 并打开运行

这里推荐使用[我修改的版本](https://github.com/njzydark/ps4_remote_pkg_installer-OOSDK/releases)，此版本修复了文件路径存在空格或者中文字符导致的安装失败问题，并添加了启动时的 ip 和 port 提示，注意此版本的默认端口为 12801

### Web

如果你只需要访问你 NAS 中的 pkg 文件，你可以直接使用网页版，前提你要确保 NAS 的 webdav 支持 cors，并在 ps4 上安装[我修改的版本](https://github.com/njzydark/ps4_remote_pkg_installer-OOSDK/releases), 如果你 nas 上的 webdav 不支持 cors, 你可以安装此版本的[webdav server](https://github.com/hacdias/webdav)

### Desktop

1. 从此页面下载需要的安装程序 [release page](https://github.com/njzydark/PS4RPS/releases)
2. 打开下载好的安装程序
3. 添加 PS4 Host 配置，这里需要填写完整的 url，例如: http://192.168.0.11:12800 端口一般为 12800 或 12801
4. 添加文件服务器配置，这里有两种方式
   - WebDAV: 使用远程的服务器地址，这里需要填写完整的 url 如果有用户密码也需要填写上
   - StaticFileServer: 通过本地文件夹创建静态文件服务器
5. 在文件列表里点击需要的安装的 pkg 名称即可向 PS4 发送安装任务，如果发送成功会有相应提示

## 开发

```bash
pnpm install
pnpm run desktop:dev
pnpm run desktop:start
```

## 打包

```bash
pnpm install
pnpm run desktop:build
pnpm run desktop:dist
```

## 常见问题

1. 传输速度如何?

   WebDAV 取决于你 WebDAV 服务器的速度，StaticFileServer 我这里测试基本可以跑满我本地的局域网带宽

2. 为什么支持 WebDAV?

   因为可以很方便的安装 NAS 上的 PKG 文件

3. 为什么 arm 版本的 mac 安装程序打开失败?

   因为没有签名，你需要在终端执行一下此命令:

   ```bash
   sudo xattr -r -d com.apple.quarantine /Applications/PS4RPS.app
   ```

## Thanks

- [psdevwiki](https://www.psdevwiki.com/ps4/Package_Files)
- [dexter85/ps4-pkg-info](https://github.com/dexter85/ps4-pkg-info)
- [flatz/ps4_remote_pkg_installer](https://github.com/flatz/ps4_remote_pkg_installer)
- [Backporter/ps4_remote_pkg_installer-OOSDK](https://github.com/Backporter/ps4_remote_pkg_installer-OOSDK)
- [OpenOrbis/OpenOrbis-PS4-Toolchain](https://github.com/OpenOrbis/OpenOrbis-PS4-Toolchain)

## 后续计划

- [ ] 自动发现 PS4 主机地址
- [x] 修复 PS4 Remote Pkg Install 的 cors bug [cors bug](https://github.com/flatz/ps4_remote_pkg_installer/issues/10) 并发布纯 Web 版本
- [x] 支持在文件列表显示更多的 pkg 文件信息，例如 icon 和 titleID
