# PS4RPS

[![GitHub release (latest by date including pre-releases](https://img.shields.io/github/v/release/njzydark/PS4RPS?include_prereleases)](https://github.com/njzydark/PS4RPS/releases/latest)
[![Build/release](https://github.com/njzydark/PS4RPS/actions/workflows/build.yaml/badge.svg)](https://github.com/njzydark/PS4RPS/actions/workflows/build.yaml)
![GitHubPages deployments](https://img.shields.io/github/deployments/njzydark/ps4rps/production?label=github-pages&logo=github-pages)
[![GitHub](https://img.shields.io/github/license/njzydark/PS4RPS)](https://github.com/njzydark/PS4RPS/blob/master/LICENSE)

Yet another remote pkg sender for PS4

![PS4RPS.png](assets/PS4RPS.png)

English | [简体中文](./README-zh_CN.md)

## Features

- Support MacOS, Windows and Linux
- Dark Mode
- Support show pkg file icon0 and paramSfo data
- Support use web version to send install task from your NAS
- Pause and resume install task
- Use remote WebDAV server to send install task
- Create Static file server from local folder
- Multiple PS4 host and file server host config

## Motivation

There are actually quite a lot of such tools, I tried one and felt that the UI was rough and could not install the PKG file on my NAS, so I am going to develop one myself and contribute to this community, one more choice is not a bad thing.

## Usage

Before send install task, you need install Remote Pkg Installer on your PS4.

I recommend using [my modified Remote Pkg Installer](https://github.com/njzydark/ps4_remote_pkg_installer-OOSDK/releases) on your ps4. This version fixes the problem that the
path with spaces or Chinese characters cannot be installed, and adds ip and port tips at startup (default port is 12801)

### Web

The Web version is mainly used to install files in WebDAV Server (NAS), and you must instal [this version of RPI](https://github.com/njzydark/ps4_remote_pkg_installer-OOSDK/releases) on your PS4 and confirm your nas webdav server support cors, you can use [this webdav server](https://github.com/hacdias/webdav) on your nas

### Desktop

1. Download this app from [release page](https://github.com/njzydark/PS4RPS/releases)
2. Open the app
3. Add PS4 host (Your PS4 ip and port, The port is usually 12800 or 12801), for example: http://192.168.0.11:12800
4. Add File server host
   - StaticFileServer: use local folder to create static file server
   - WebDAV: use remote WebDAV server url
5. Click pkg name from file list to send install task

## Dev

```bash
pnpm install
pnpm run desktop:dev
pnpm run desktop:start
```

### UI testing modes

- Real APIs (default): `pnpm run web:dev` → http://localhost:5173/
- Mock data: `pnpm run web:mock` → http://localhost:4180/

Mock mode uses isolated browser storage, bundled sample covers and two local simulated consoles. It is never included in the production app. See [testing mode instructions](apps/web/mock/README.md).

## Build

```bash
pnpm install
pnpm run desktop:build
pnpm run desktop:dist
```

## FAQ

1. How fast is the transfer?

   WebDAV depends on the speed of your WebDAV server, StaticFileServer I tested here can basically run full my local LAN bandwidth

2. Why support WebDAV?

   Because it is easy to install the pkg file on NAS using webdav

3. Why mac arm64 app open failed?

   Because the app is not signed, you need to execute this command in the terminal:

   ```bash
   sudo xattr -r -d com.apple.quarantine /Applications/PS4RPS.app
   ```

## Thanks

- [psdevwiki](https://www.psdevwiki.com/ps4/Package_Files)
- [dexter85/ps4-pkg-info](https://github.com/dexter85/ps4-pkg-info)
- [flatz/ps4_remote_pkg_installer](https://github.com/flatz/ps4_remote_pkg_installer)
- [Backporter/ps4_remote_pkg_installer-OOSDK](https://github.com/Backporter/ps4_remote_pkg_installer-OOSDK)
- [OpenOrbis/OpenOrbis-PS4-Toolchain](https://github.com/OpenOrbis/OpenOrbis-PS4-Toolchain)

## TODO

- [ ] Auto find PS4 host
- [x] Fix the [cors bug](https://github.com/flatz/ps4_remote_pkg_installer/issues/10) and release the web version
- [x] Show more pkg file info, such as icon and titleID

---

[![Powered by DartNode](https://dartnode.com/branding/DN-Open-Source-sm.png)](https://dartnode.com 'Powered by DartNode - Free VPS for Open Source')
