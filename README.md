# LinkCode — VS Code AI 编程助手

> 内联补全、对话面板、代码审查 — 由 AI 驱动。

## 功能特性

- **Ghost Text（内联补全）** — 边写代码边获得 AI 智能提示
- **对话面板** — 侧边栏 AI 助手，支持多轮对话
- **CodeLens** — 函数/类上方一键「解释」和「重构」
- **流式输出** — 基于 SSE 的实时响应

## 快速开始

### 环境要求

- VS Code >= 1.85.0
- Node.js >= 18
- pnpm

### 安装

```bash
# 克隆仓库
git clone https://github.com/YEMAOYANG/linkcode-vscode.git
cd linkcode-vscode

# 安装依赖
pnpm install

# 构建插件
pnpm run build

# 构建 WebView（开发时需要）
cd src/webview && pnpm install && pnpm run build
```

## 本地调试

### 第一步 — 用 VS Code 打开项目

```bash
code ~/.openclaw/agents/frontend-agent/workspace/linkcode-vscode
```

### 第二步 — 构建

```bash
# 构建插件主体
pnpm build

# 构建 WebView（对话面板 UI）
pnpm build:webview
```

### 第三步 — 按 F5 启动调试

按 **F5**，VS Code 会弹出一个新的 **Extension Development Host** 窗口，LinkCode 插件已自动加载。

### 第四步 — 配置 API Key

在调试窗口中按 `Ctrl+Shift+P`（Mac 用 `⌘+Shift+P`），运行：

```
LinkCode: Set API Key
```

输入你的 Smoothlink API Token，会安全存储到 VS Code 的 SecretStorage 中。

> **提示：** 首次启动时，如果没有检测到 API Key，插件会自动写入默认 Token。

### 第五步 — 开始使用

| 操作 | 方式 |
|------|------|
| 打开对话面板 | `Ctrl+Shift+P` → `LinkCode: Open Chat` |
| 内联代码补全 | 在任意支持的文件中输入代码，自动触发 Ghost Text |
| CodeLens 操作 | 鼠标悬停在函数上，点击「解释」或「重构」|
| 切换 AI 模型 | 点击对话输入栏的模型标签 |

### 热更新（边改边调试）

开两个终端：

```bash
# 终端 1 — 监听插件主体
pnpm watch

# 终端 2 — 监听 WebView
cd src/webview && pnpm dev
```

保存代码后，在调试窗口执行：
```
Ctrl+Shift+P → Developer: Reload Window
```

### 调试技巧

- **插件日志** — `Ctrl+Shift+U` → 在输出面板选择 **LinkCode** 频道
- **WebView DevTools** — 在对话面板内右键 → **检查元素**，可调试 Vue 组件和样式
- **断点调试** — 在 `src/` 文件里打断点，F5 启动后断点会命中

## 插件配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `linkcode.apiEndpoint` | `https://smoothlink.ai` | API 地址 |
| `linkcode.model` | `claude-sonnet-4-6` | 对话使用的模型 |
| `linkcode.completionModel` | `claude-haiku-4-5-20251001` | 内联补全使用的模型 |
| `linkcode.completionDebounceMs` | `300` | 补全防抖延迟（毫秒）|

## 项目结构

```
src/
├── extension.ts              # 插件入口
├── providers/
│   ├── InlineCompletionProvider.ts   # Ghost Text 补全
│   ├── ChatViewProvider.ts           # 对话 WebView
│   └── CodeLensProvider.ts           # CodeLens
├── commands/                 # 命令注册
├── api/                      # HTTP 客户端、SSE 流式、类型定义
├── webview/                  # Vue 3 WebView UI
└── utils/                    # 工具函数
```

## License

MIT
