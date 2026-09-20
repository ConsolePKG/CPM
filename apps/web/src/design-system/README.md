# CPM Design System

CPM 使用 Base UI 的无样式交互组件，视觉由本目录统一定义。页面负责业务组合，主机、资源和安装逻辑保留在 store / hooks / service 层。

## 分层

- `tokens.less`：语义颜色、间距、圆角、阴影与动效。日夜模式共用 token 名，业务样式使用 `var(--…)`，不自行判断主题。
- `ThemeProvider.tsx`：浅色、深色、跟随系统；持久化选择并兼容旧主题偏好。挂载到应用根部。
- `Button.tsx` / `Fields.tsx`：按钮、图标按钮、输入框、选择、开关、单选与设置行。
- `Overlays.tsx`：抽屉、确认弹窗和悬浮面板，使用 Base UI 管理焦点、Escape 和弹层。
- `Feedback.tsx` / `Notifications.tsx`：进度、加载、空状态与通知。
- `components.less`：基础组件的尺寸、状态、焦点与响应式样式。

新增通用组件从 `index.ts` 导出。`components/ui` 仅作为旧业务 import 的兼容出口，不维护第二套组件。封面、主机选择、任务卡片、速率图等业务组件分别位于 Home、shell 和 Tasks 目录。

## 交互与主题

图标按钮必须提供可访问名称；表单保留 label 和错误提示；菜单、对话框优先使用 Base UI。颜色要同时考虑浅色、深色及 disabled / hover / focus 状态。系统减少动态效果偏好由全局样式处理。

安装速度来自已传输字节的时间差。每条任务绑定创建时的主机地址，切换当前主机不会改变已有任务的目标。没有 API 数据时不展示推测的磁盘速度或空间。

## 验证

从仓库根目录运行：

```sh
pnpm --filter web test
pnpm run tsc
pnpm --filter web lint
pnpm run desktop:build
```

`pnpm run web:mock` 提供独立的本地 UI 验证环境。构建 web 后访问 `http://127.0.0.1:4180/__fixture`，在该测试源下初始化示例资源和两台模拟主机。此数据不进入生产应用；模拟 API 验证不能替代真实 PS4、Electron 和手柄测试。
