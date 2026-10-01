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

“添加资源库”按文件来源选择本地文件夹、WebDAV 或资源库服务。资源库服务可连接已有库，也可由管理员添加来源。连接服务时输入 `/api/v1` 所在服务的基础地址、管理员令牌或私有分享链接，可选择具体 library ID。

浏览器文件夹使用 File/Blob 读取；重新打开页面后需要重新选择文件夹。取消授权不会把旧索引误标为文件已删除。索引/封面保存在 IndexedDB；存储不可用时 UI 明确提示会话模式。Worker 不可用时使用同一个解析器降级执行。

浏览器文件不能自动成为主机可访问的下载地址。需要安装时，请在桌面/NAS 托管文件；WebDAV 使用主机可达的直连 URL；账号密码分别编码进 URL userinfo，由主机下载器进行认证。需要自定义请求头的来源仍须由桌面/NAS 服务转发。HTTPS 页面访问 HTTP 服务仍受浏览器混合内容和网络权限策略限制，CORS 不能绕过这些限制。

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

桌面内置同一个 Node 服务/SQLite，不再独立启动封面小服务器；同端口切换文件夹复用服务，避免中断正在下载的任务。Electron 的 WebDAV 连接也自动接入此服务进行持久化索引与元数据解析。管理员下载 API 优先返回 WebDAV 直连 URL（包含编码后的账号密码），主机直接从 WebDAV 下载，文件字节不经过 Electron。桌面文件夹、自定义认证头和只读分享仍使用限定文件版本的签名转发链接，转发期间需要保持服务运行及局域网地址可达。

发布桌面包需要 Electron 对应 ABI 的 `better-sqlite3`，仅 Node 测试通过不能证明原生打包正确。`desktop:dev` 启动前会验证 Electron 能加载 SQLite，不匹配时自动重建。

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

服务模式下，所有者使用 WebDAV 直连下载；只读分享通过库服务转发 WebDAV Range，保留撤销能力且不暴露来源账号密码，不预先下载完整 PKG。上游不支持 Range 或认证失败时返回明确错误。分享链接使用 URL fragment 传递令牌，由远程客户端转换为 API Bearer 授权，不把令牌作为索引查询参数。

分享令牌只保存 SHA-256 摘要。下发主机的下载凭据独立限定文件 ID、文件版本、分享来源及 24 小时有效期。撤销分享立即拒绝后续请求；已开始的响应不追溯撤回已传输字节。文件版本变化拒绝旧 URL，并在流式读取期间检查变化，避免混合两个版本。管理员令牌变更会使既有签名下载 URL 失效。

服务没有账号系统、公网穿透或 P2P。用户负责网络可达性、HTTPS/反向代理与访问控制；不要把管理员令牌作为分享令牌发送。

## CPI 权威安装 job

新 WebUI 仅使用 CPI v1 job 协议。job ID 复用 CPI 持久请求编号；客户端任务键为主机配置身份加 job ID，PS4 原生 `task_id` 与 PS5 原生 `content_id` 分别保存在 `nativeRef`，不再使用占位 task ID 或按 Content ID 合并安装尝试。

| 接口                            | 行为                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/v1/jobs`             | `idempotencyKey/url/titleId?/contentId?/packageType?/title?/iconUrl?/resourceId?/resource?`；先持久化，返回 `202` 和 job |
| `GET /api/v1/jobs`              | 分页主机历史                                                                                                             |
| `GET /api/v1/jobs/:id`          | 权威状态、原生引用和进度                                                                                                 |
| `POST /api/v1/jobs/:id/actions` | `pause/resume/cancel/retry/delete`；删除历史写回 CPI                                                                     |
| `GET /api/v1/capabilities`      | 已验证控制能力、完成确认能力                                                                                             |

WebUI 在发送前持久化幂等键。响应丢失时保留同一键核对，不创造第二次安装。离线是客户端同步属性，不覆盖主机状态；界面显示最近同步时间。主机安装独立于页面继续执行。CPI 在列表或单任务 GET 时查询本次返回任务的原生状态，包含 unknown；后台不再单独轮询安装进度。明确的新安装或终态显式重试创建新的 job，同游戏排队、提交中或原生接口确认正在安装时拒绝重复提交。PS5 可分别提交相同 Content ID 的已知本体与补丁，两者保留独立 job 和原生状态、控制接口；同类型及身份不明的请求仍受重复提交保护。

发送安装、暂停、恢复、取消、删除记录和重新安装会立即显示处理中通知及按钮加载状态，同一资源或任务的重复点击在请求期间禁用。响应到达后更新同一通知，显示请求结果或失败原因；发送成功不表示安装已完成。处理中状态仅用于交互反馈，不改写主机状态，也不根据本体活动推断补丁的等待原因。

任务恢复仅展示实际安装尝试，不把旧 Content ID 迁移记录当作新任务。前端每秒按主机独立分页同步完整 CPI 列表，本地缓存只用于离线显示和响应丢失核对。CPI 默认排除迁移占位、已被新尝试替代和已删除的记录；删除历史通过 `delete` action 写入主机日志，所有客户端刷新后均不再展示，完整记录、标题、进度及下载地址从 JSON 中移除；同一原子写入仅保留 `{id,key,expiresAt}` 的 24 小时重放保护，最多 2048 条，过期清理。删除后单任务查询返回 404，保护期内旧键发送返回 410。进行中的任务必须先结束才能删除。job 保留确切的资源 ID，旧 job 从原资源库下载路径提取文件 ID，不返回下载凭据。刷新后重新关联资源库和封面，避免按共用 Content ID 把本体匹配成补丁。重新安装从资源库取得当前文件和新的签名 URL，使用任务原来的主机。

job 的 `activity` 与安装结果分别记录。PS5 返回 `none` 时保留历史进度，显示已无活跃安装、结果未确认。用户显式重新安装时，CPI 重新查询原生活动；排队、提交中、刚接受但尚未观察的请求和可证明的原生安装活动仍拒绝重复提交。旧尝试结果未知、原生查询失败或原生 `none` 不会永久挡住用户显式的新安装；不自动重发结果未知的已接受任务。新 job 与旧记录的 `supersededBy` 关系原子保存；旧记录停止跟踪该 Content ID，防止误显示新安装的进度。已完整传输且推广进度 100 的 `playable` 可以确认无安装活动，仍不声称已证明旧尝试成功。

状态包括 `queued/submitting/accepted/transferring/installing/completed/paused/failed/cancelled/unknown`。主机调用原生接口前和记录原生引用后都写日志；存储失败拒绝接受新工作。中断提交或证据不足的恢复结果为 `unknown`，不能自动重装。

PS4 使用已有 BGFT 安装与安全取消规则；取消下载不自动卸载本体、补丁、DLC。PS5 仅使用 AppInstUtil；不引入 PS5 BGFT，也不开放未经验证的暂停、恢复、取消。PS5 的 4096 字节状态 scratch buffer 只是保留的 ABI 缓解措施，不证明所有固件安全。

当前真实两平台均声明 `completionVerified: false`：PS4 传输 100% 仍为 `installing`；PS5 的 `playable` 不能证明当前尝试完成，显示 `unknown`/待核对。只有验证可靠完成信号后才可以开放完成能力。协议 mock 中的 `completed` 仅用于 UI 测试。

### 采样与多资源库回显

- CPI 始终返回 `titleId/contentId/packageType`；旧记录从合法 Content ID 提取 title ID，缺少证据的包类型为 `unknown`，本体与补丁不能按共用 Content ID 合并。
- 原生查询成功返回 `observation: {sessionId,sampleId,sampledAt,ageMs}`，其中 sampleId 为单调时钟毫秒。前端按字节增量/采样间隔计算平滑速度，显示“预计下载剩余”，不估算安装完成时间。同一次采样不重复计算；查询失败、离线、暂停、安装阶段、字节回退及 CPI 重启清空估算。
- 查询失败单独返回 `queryError`，保留最后成功的状态、进度与采样时间，不误标安装失败；主机 API 连接错误与资源库认证/文件版本错误分别提示。
- CPI 保存白名单资源快照 `libraryId/fileVersion/filename/size/kind/version/sourceName/platform`，不返回封面或下载凭据。任务标题、类型、版本与来源不依赖当前资源库；前端异步按原库、文件 ID 和版本补封面，资源库失败不拖住主机同步。
- 收到 job ID 后前端清除缓存的提交 URL。未确认提交先从列表按幂等键核对，再用原键、原请求重放，最长 24 小时；过期显示结果未确认，要求显式核对后重发。重新安装始终取得新签名 URL 并创建新键。
- 删除成功后拒绝应用旧轮询结果，防止记录短暂复活。完整列表才能清除已不在 CPI 的本地记录；新提交不被发送前的旧列表快照覆盖。

### 配置与记录迁移

- 原 WebDAV 配置保留；浏览器作为浏览器来源，Electron 自动接入内置 Node 库服务。桌面文件夹配置首次连接同一服务时补齐令牌和 library ID。
- 旧的外部静态文件服务器不再有兼容 wire adapter，需要升级为资源库服务，或改为 WebDAV 来源。
- CPI 请求日志 v1 迁移先保存 `requests.json.v1.bak`；PS5 已接受 ID 文件先保存 `.bak`。没有足够信息的旧记录为待核对，不伪造完整历史。
- PS5 导入的 Content ID 历史不等于一次现代安装请求；UI 不自动恢复为任务，主机保留迁移备份。显式新安装会重新查询原生活动；已确认无活动的现代旧尝试也可被新 job 替代，但不修改其未知结果为成功。
- 新的 job 日志版本为 3，兼容读取 v1/v2/v3，启动时压缩旧 `deleted:true` 记录；现代记录不自动淘汰，以免幂等键重放导致重复安装。达到 2048 条容量时拒绝新工作，需要显式删除非活跃历史记录释放容量。
- 旧浏览器 PS5 任务保留备份，不作为现代任务回显；旧 CPI 仍可在主机列表检测，但不能伪造 v1 job 能力。
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
