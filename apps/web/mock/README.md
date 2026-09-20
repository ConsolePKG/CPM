# Mock 与真实测试

## 真实模式（默认）

仓库根目录运行 `pnpm run web:dev`，打开 http://localhost:5173/ 。不会注入示例资源或模拟接口。在设置中添加资源服务器（WebDAV 或已有静态服务器）与真实 PS4 地址。需要本地文件夹托管、Electron 原生功能时运行 `pnpm run desktop:dev`。

## Mock 模式（显式启动）

仓库根目录运行 `pnpm run web:mock`，构建应用并启动独立测试服务器：

- http://localhost:4180/ ：带 MOCK 标识的应用，首次自动初始化示例配置。
- 4181 / 4182：两台模拟 PS4，可测试切换主机、安装、进度、暂停、继续与取消。
- http://localhost:4180/__fixture ：重新写入示例主机和资源配置。

已经构建时可直接运行 `pnpm --filter web mock`。修改应用后重新构建并刷新；模拟 API 状态在服务器重启后清空。封面保存在 `covers`，无需依赖 design 目录。

两个端口的 localStorage 相互隔离，mock 不读写真实模式的配置。mock 页面仅允许连接自身与两个模拟 API；真实主机测试请使用 5173。生产构建不导入 mock 文件或注入初始化逻辑。

模拟进度仅用于交互测试，不会下载或安装 PKG，不能代替实机验证。
