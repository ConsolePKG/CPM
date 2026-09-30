# 资源库与主机安装任务（v1）

## 架构与支持边界

`@consolepkg/library` 是不依赖 UI 的资源库内核。文件夹、用户授权的浏览器文件、WebDAV 统一经过来源适配器、按内容识别的解析器、异步索引与原生身份关联，再由 `LibraryClient` 提供给 WebUI。资源库只负责文件和元数据，不维护安装任务状态机。

- 浏览器本地库、Node/NAS 库和只读分享库可以保存在同一个 WebUI 中，切换连接不会改变资源语义。
- 已实现 PS4 PKG/SFO、封面和按需图片/奖杯提取。浏览器与 Node 使用同一个解析核心；旧解析包的浏览器/Node 导出仍保留。
- PS5 包没有经样本验证的解析器；未知格式返回 `unsupported`，不根据文件名猜标题或平台。Switch/3DS 仅保留解析器注册和规范化平台类型，不实现安装。
- PS4 资源可以安装到 PS5；资源平台不等于安装主机平台。
- 文件 ID 标识实际副本，Content ID 不标识安装尝试。游戏视图按平台原生 title identity 关联本体、补丁、DLC；不会按名字合并，孤立补丁/DLC 和重复副本都保留。

## 使用方式

### 纯浏览器 / 静态 WebUI

```sh
pnpm install
pnpm web:build
pnpm web:preview
```

“添加资源库”包含两个入口：创建自己的资源库，或连接已有服务。创建时可以选择浏览器文件夹、浏览器 WebDAV、桌面文件夹或 Node/NAS 服务上的来源。连接服务时输入 `/api/v1` 所在服务的基础地址、管理员令牌或私有分享链接，可选择具体 library ID。

浏览器文件夹使用 File/Blob 读取；重新打开页面后需要重新选择文件夹。取消授权不会把旧索引误标为文件已删除。索引/封面保存在 IndexedDB；存储不可用时 UI 明确提示会话模式。Worker 不可用时使用同一个解析器降级执行。

浏览器文件不能自动成为主机可访问的下载地址。需要安装时，请在桌面/NAS 托管文件；浏览器 WebDAV 必须提供主机可达且无需客户端私有认证头的下载 URL，否则安装入口明确拒绝。HTTPS 页面访问 HTTP 服务仍受浏览器混合内容和网络权限策略限制，CORS 不能绕过这些限制。

### Node / NAS

```sh
CPM_DATA=/absolute/data \
CPM_LIBRARY_ROOT=/absolute/games \
CPM_EXTERNAL_URL=http://nas-lan-ip:8080 \
pnpm library:start
```

| 环境变量              | 默认值 / 用途                                                    |
| --------------------- | ---------------------------------------------------------------- |
| `PORT`                | `8080`                                                           |
| `CPM_DATA`            | `./data`，SQLite 索引、资源、分享摘要及管理员令牌                |
| `CPM_LIBRARY_ROOT`    | 可选；第一次启动时创建此文件夹来源                               |
| `CPM_EXTERNAL_URL`    | 主机可达的服务基础地址；未设置时不生成下载链接                   |
| `CPM_ADMIN_TOKEN`     | 可选，至少 32 字符；未设置时生成并保存为 `CPM_DATA/admin-token`  |
| `CPM_WEB_ROOT`        | 静态 WebUI 路径；Docker 中为 `/app/web`                          |
| `CPM_ALLOWED_ORIGINS` | 逗号分隔的允许来源；未设置时允许携带正确 Bearer 令牌的跨来源请求 |

首次启动及每 15 分钟扫描，支持手动重扫。默认全局解析并发为 2；枚举的文件立即可见，解析错误只影响单个文件。缓存同时检查文件版本和解析器版本；没有可靠变化标识的远程文件不跨扫描复用。来源离线不会删除索引，成功完整枚举后才将缺失文件标为不可用。

`/data` 和桌面用户数据目录包含来源凭据，应当限制目录访问并做备份。服务器不会把 WebDAV 密码或真实文件路径开放给分享用户。

### Docker

```sh
CPM_EXTERNAL_URL=http://nas-lan-ip:8080 \
CPM_GAMES_DIRECTORY=/absolute/games \
docker compose up --build -d
docker compose exec consolepkg cat /data/admin-token
```

游戏目录只读挂载到 `/games`，`/data` 持久化；WebUI 与 API 使用同一端口。外部地址不能填容器 IP 或 `localhost`。源目录允许多个来源通过管理员 API 添加，不要求所有游戏放在一个目录中。

```sh
docker buildx build --platform linux/amd64,linux/arm64 --target library --push -t YOUR_REGISTRY/consolepkg:library .
docker build --target static -t consolepkg:web .
```

`library` 镜像提供 Node 服务和 WebUI；`static` 镜像只提供 WebUI。仓库工作流提供双架构构建。部署生产依赖闭包时允许未使用的 UI patch，但不会删除或跳过 WebUI 所需的 patch。

桌面内置同一个 Node 服务/SQLite，不再独立启动封面小服务器；同端口切换文件夹复用服务，避免中断正在下载的任务。发布桌面包需要 Electron 对应 ABI 的 `better-sqlite3`，仅 Node 测试通过不能证明原生打包正确。

## 资源库 HTTP 协议

所有 JSON API 使用 `/api/v1` 和 `Authorization: Bearer TOKEN`。管理员可以管理来源；分享令牌只能浏览所选资源库、提取资源和获取下载链接。

| 方法与路径                                                        | 用途                                       |
| ----------------------------------------------------------------- | ------------------------------------------ |
| `GET /capabilities`                                               | 协议、持久化、写入和托管能力               |
| `GET /libraries` / `POST /libraries`                              | 查询 / 创建资源库                          |
| `POST /libraries/:id/sources`                                     | 添加文件夹或 WebDAV 来源                   |
| `POST /libraries/:id/sources/:sourceId`                           | 更新来源配置                               |
| `POST /libraries/:id/sources/:sourceId/remove`                    | 移除来源，不删除实际文件                   |
| `GET /libraries/:id/files`                                        | 文件分页（`cursor/limit/search/sourceId`） |
| `GET /files/:id`                                                  | 文件、版本、解析状态及规范化元数据         |
| `GET /libraries/:id/games` / `GET /libraries/:id/games/:gameId`   | 聚合游戏列表 / 本体、补丁、DLC 关联详情    |
| `POST /libraries/:id/scans` / `GET /scans/:scanId`                | 启动扫描 / 查询扫描状态                    |
| `POST /files/:id/retry`                                           | 重试失败解析                               |
| `GET /libraries/:id/changes?after=REVISION`                       | 增量索引，`reset` 时重新分页读取           |
| `GET /assets/:id`                                                 | 封面字节；持久记录不保存 Blob URL          |
| `GET /files/:id/resources/:kind`                                  | 按需扩展资源，可带 `key`                   |
| `POST /files/:id/download`                                        | 创建指定文件版本的下载地址                 |
| `GET/HEAD /downloads/:id?token=...`                               | 限定文件和版本的流式下载，支持单段 Range   |
| `GET/POST /libraries/:id/shares` / `POST /shares/:shareId/revoke` | 查询 / 创建 / 撤销只读分享                 |

例如添加服务上的 WebDAV 来源：

```sh
curl -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Games","sources":[{"id":"nas-dav","name":"WebDAV","type":"webdav","url":"http://dav:5005","root":"/games","username":"USER","password":"PASSWORD"}]}' \
  http://nas:8080/api/v1/libraries
```

服务模式通过库服务代理经过认证的 WebDAV Range，不预先下载完整 PKG。上游不支持 Range 或认证失败时返回明确错误。分享链接使用 URL fragment 传递令牌，由远程客户端转换为 API Bearer 授权，不把令牌作为索引查询参数。

分享令牌只保存 SHA-256 摘要。下发主机的下载凭据独立限定文件 ID、文件版本、分享来源及 24 小时有效期。撤销分享立即拒绝后续请求；已开始的响应不追溯撤回已传输字节。文件版本变化拒绝旧 URL，并在流式读取期间检查变化，避免混合两个版本。管理员令牌变更会使既有签名下载 URL 失效。

服务没有账号系统、公网穿透或 P2P。用户负责网络可达性、HTTPS/反向代理与访问控制；不要把管理员令牌作为分享令牌发送。

## CPI 权威安装 job

新 WebUI 仅使用 CPI v1 job 协议。job ID 复用 CPI 持久请求编号；客户端任务键为主机配置身份加 job ID，PS4 原生 `task_id` 与 PS5 原生 `content_id` 分别保存在 `nativeRef`，不再使用占位 task ID 或按 Content ID 合并安装尝试。

| 接口                            | 行为                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `POST /api/v1/jobs`             | `idempotencyKey/url/contentId?/title?/iconUrl?`；先持久化，返回 `202` 和 job |
| `GET /api/v1/jobs`              | 分页主机历史                                                                 |
| `GET /api/v1/jobs/:id`          | 权威状态、原生引用和进度                                                     |
| `POST /api/v1/jobs/:id/actions` | `pause/resume/cancel/retry`；重试必须使用新幂等键                            |
| `GET /api/v1/capabilities`      | 已验证控制能力、完成确认能力                                                 |

WebUI 在发送前持久化幂等键。响应丢失时保留同一键核对，不创造第二次安装。离线是客户端同步属性，不覆盖主机状态；界面显示最近同步时间。主机后台每 3 秒跟踪任务，不依赖页面存活。明确的新安装或终态显式重试创建新的 job，无法分辨的同内容活跃安装拒绝并发。

状态包括 `queued/submitting/accepted/transferring/installing/completed/paused/failed/cancelled/unknown`。主机调用原生接口前和记录原生引用后都写日志；存储失败拒绝接受新工作。中断提交或证据不足的恢复结果为 `unknown`，不能自动重装。

PS4 使用已有 BGFT 安装与安全取消规则；取消下载不自动卸载本体、补丁、DLC。PS5 仅使用 AppInstUtil；不引入 PS5 BGFT，也不开放未经验证的暂停、恢复、取消。PS5 的 4096 字节状态 scratch buffer 只是保留的 ABI 缓解措施，不证明所有固件安全。

当前真实两平台均声明 `completionVerified: false`：PS4 传输 100% 仍为 `installing`；PS5 的 `playable` 不能证明当前尝试完成，显示 `unknown`/待核对。只有验证可靠完成信号后才可以开放完成能力。协议 mock 中的 `completed` 仅用于 UI 测试。

### 配置与记录迁移

- 原 WebDAV 配置原样作为浏览器来源；桌面文件夹配置首次连接同一 Node 库服务时补齐令牌和 library ID。
- 旧的外部静态文件服务器不再有兼容 wire adapter，需要升级为资源库服务，或改为 WebDAV 来源。
- CPI 请求日志 v1 迁移先保存 `requests.json.v1.bak`；PS5 已接受 ID 文件先保存 `.bak`。没有足够信息的旧记录为待核对，不伪造完整历史。
- 新的 job 日志版本为 2；现代记录不自动淘汰，以免幂等键重放导致重复安装。达到 2048 条容量时拒绝新工作，需要后续明确的归档管理，而不是静默删除身份。
- 旧浏览器 PS5 任务保留备份并显示未知；旧 CPI 仍可在主机列表检测，但不能伪造 v1 job 能力。
- 同步新 payload 必须先真实重编译。不要把已有 ELF 的 manifest 版本改成新协议版本。构建、同步成功仍不等于真机回归完成。

## 测试与发布门槛

```sh
pnpm test
pnpm tsc
pnpm web:build
pnpm --filter desktop build
pnpm web:mock
cd ../CPI && ./tests/run.sh
```

Mock WebUI 在 `http://localhost:4180`，资源库/PS4 协议在 4181，PS5 配置在 4182。固定场景使用可控时钟、故障与丢响应注入；仅演示服务使用速度波动。真实客户端消费真实 HTTP 协议，生产代码没有 mock 分支。

发布必须区分：核心/协议自动化通过、容器与桌面 native ABI 构建通过、以及 PS4/PS5 真机行为验证。新 CPI 的 PS4 安装/安全取消、PS5 进度/重启/ABI 边界仍需要真机回归；缺少 PS5 PKG 样本时不得将其解析能力标为已验证。
