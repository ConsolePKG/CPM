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

### Bundled CPI and host management

Adding/editing a PS4 host queries `/api/status` for the system version, CPI version,
and service state. Older services fall back to the read-only existence probe.
The web public directory includes `cpi/rpi-payload-ps4.elf` and a version/size/SHA-256
manifest. After rebuilding CPI in the sibling repository, run `pnpm cpi:sync` to
refresh both before releasing CPM. The web build copies these public assets into
the output; desktop packaging includes the same renderer assets.

“重装 CPI” uses GoldHEN's HTTP protocol in both web and Electron: POST `/status`
on the configurable Payload Server port (default 9090), followed by POST `/` with
the raw ELF ArrayBuffer. Reference: [hippie68's browser sender](https://github.com/hippie68/hippie68.github.io/blob/master/900/index.html).
It verifies the bundled hash and loader readiness before requesting CPI shutdown,
waits for API/manifest listeners to disappear, sends once, then checks CPI on port
12801. Failed or uncertain sends are never automatically repeated. This updates both the running payload and `/data/payloads/rpi-payload-ps4.elf`.
When current CPI advertises `payload_update`, CPM uploads to `/api/payload` and
verifies the readback hash before shutdown. For older CPI that supports shutdown
but lacks this capability, CPM first loads the new bundled CPI, then uploads and
verifies the boot file using the new instance. Failure to save/read back the boot
file is reported as incomplete, not success. FTP is not required.

The browser needs access to the console's local HTTP endpoints. HTTPS pages can
be blocked by mixed-content restrictions; use HTTP hosting or Electron. The UI
reports network failures and preserves the distinction between payload transfer
and a verified CPI response. Wait for active installations to finish before
reloading CPI. On an offline result, confirm the old instance has stopped before
sending another payload.

### PKG artwork and trophies

Game details open in a full-screen route with the library kept mounted underneath.
The hero initially uses a blurred cover and fades in PIC1 after decoding; missing
artwork retains the cover backdrop. The primary install button uses the existing selected-host installation flow.
Returning restores the library view; trophy parsing remains tab-triggered.

The Artwork tab displays actual PIC*.PNG entries with PIC1 first, then PIC0,
each followed by its localized variants; other PIC images follow in natural filename order. Images load as they approach the viewport and can
be exported individually. Other image resources remain available through the
package API but are not shown as artwork.
This does not scan textures inside PFS or trophy archives. Trophy definitions/icons
load only when the Trophies tab is selected. Ordinary library scanning still reads only SFO and
ICON0. Complete results are cached by URL, filename, size, ETag and modification
time with a bounded in-memory cache; switching files or closing the drawer aborts
pending reads. Network errors can be retried. Encrypted/unsupported resources
show their status rather than blocking the library or installation.

### PS4 browser preview

Run `pnpm web:build` followed by `pnpm web:preview`. Preview listens on
`0.0.0.0:5173`; open the computer's LAN address from the PS4 browser.
`/browser-check.html` provides basic browser capability diagnostics.
WebDAV servers must permit the `Range` request header in CORS preflight responses,
in addition to authorization and directory-listing headers.

The PS4 profile uses native controller navigation, static route transitions,
opaque surfaces and legacy layout fallbacks. PKG scanning concurrency remains
unchanged. Dependencies are transpiled for older WebKit, with a scoped Base UI
patch for its bounded focus history when `WeakRef` is unavailable.
