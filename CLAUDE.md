# CLAUDE.md — LinkCode VSCode Extension 项目规范

> 每次 claude 会话启动时自动读取。这是本项目的最高指导文件。

---

## 项目概述

LinkCode 是一款 AI 编程助手 VSCode 插件，核心功能：
- **Ghost Text**：AI Inline Completion，光标处实时补全
- **Chat Panel**：侧边栏 AI 对话，支持流式输出、代码引用、Inline Edit
- **CodeLens**：函数/类上方的 AI 操作入口（解释/重构/测试）

技术栈：TypeScript 5.x + esbuild + Vue 3 (WebView) + Vite

---

## 代码风格铁律（不可妥协）

### 核心原则

```
模块化：每个文件只做一件事，职责边界清晰
组件化：UI 拆到不能再拆，每个组件可独立测试
零冗余：没有重复逻辑，没有死代码，没有注释掉的代码块
可读性：命名即注释，结构即文档
可扩展：今天加功能不动昨天的代码（开闭原则）
```

### 文件大小硬限制

| 文件类型 | 最大行数 | 超过必须拆分 |
|---------|---------|------------|
| Vue 组件 | 150 行 | 逻辑抽到 `hooks/useXxx.ts` |
| TS 类/函数文件 | 200 行 | 按功能拆子模块 |
| 单个函数/方法 | 40 行 | 提取私有方法 |

### 命名规范

```typescript
// 文件名
InlineCompletionProvider.ts   // 类文件：PascalCase
useStreamingChat.ts           // composable：use 前缀
api-types.ts                  // 工具/类型：kebab-case

// 变量/函数
const MAX_CONTEXT_LINES = 100          // 常量：UPPER_SNAKE_CASE
const fetchCompletion = async () => {} // 函数：动词开头
const isStreaming = ref(false)         // boolean：is/has/can 前缀
const completionCache = new Map()      // 名词：具体描述

// 禁止
const d = new Date()        // ❌ 单字母变量
const data2 = await api()   // ❌ 数字后缀
const temp = getValue()     // ❌ temp/tmp/misc
```

### 零冗余规则

```typescript
// ❌ 禁止
import { something } from './module'  // 未使用的 import
const unusedVar = 'hello'             // 未使用的变量
// console.log('debug info')          // 注释掉的代码
if (type === 'a') { doA() }           // 可以用 Map 替代的 if-else 链
function fn(x: any) {}               // any 类型

// ✅ 要求
// 所有 import 必须被使用
// 所有声明的变量必须被使用
// 用数据驱动替代重复的条件分支
// 用 unknown + 类型守卫替代 any
```

### 模块化规范

```
src/
├── completion/           # 模块：每个目录一个独立功能域
│   ├── index.ts          # 统一导出（外部只从 index.ts 导入）
│   ├── Provider.ts       # 核心类
│   ├── cache.ts          # 子功能
│   └── context.ts        # 子功能
├── chat/
│   ├── index.ts
│   ├── Provider.ts
│   ├── stream.ts
│   └── MessageHandler.ts
└── shared/               # 跨模块共享（谨慎添加）
    ├── types.ts
    └── constants.ts
```

**跨模块依赖原则：**
- 模块只通过 `index.ts` 对外暴露
- 禁止跨模块直接引用内部文件（`import from '../chat/stream.ts'` ❌）
- 共享代码放 `shared/`，不放在某个具体模块里

---

## VSCode Extension 专项规范

### 激活事件精确化
```json
// ❌ 禁止（拖慢 VSCode 启动）
"activationEvents": ["*"]

// ✅ 要求（按需激活）
"activationEvents": []  // VSCode 1.74+ 自动激活
```

### WebView CSP 强制要求
```typescript
// ✅ 每个 WebView 必须有 nonce + 严格 CSP
content="default-src 'none';
  script-src 'nonce-${nonce}';
  style-src ${webview.cspSource} 'nonce-${nonce}';
  connect-src https://api.linkcode.ai;"

// ❌ 禁止
enableScripts: true  // 没有 CSP 限制
```

### IPC 类型安全
```typescript
// ✅ 所有 postMessage 必须有类型定义
type ExtensionToWebview =
  | { type: 'stream_start' }
  | { type: 'stream_chunk'; content: string }
  | { type: 'stream_end' }
  | { type: 'error'; message: string }

// ❌ 禁止
webview.postMessage({ type: 'whatever', data: anything })
```

### Inline Completion 性能规范
- 防抖：≥ 150ms（减少 API 请求）
- 缓存：LRU + TTL 30s（相同前缀不重复请求）
- 取消：每次新请求前 abort 旧请求（AbortController）
- P90 响应时间目标：< 800ms

### 资源管理
```typescript
// ✅ 所有订阅/监听必须在 context.subscriptions 中注册
context.subscriptions.push(
  vscode.languages.registerInlineCompletionItemProvider(...)
)

// ✅ 有自定义资源的类必须实现 dispose()
export class MyProvider implements vscode.Disposable {
  dispose() {
    this.abortController?.abort()
    this.timer && clearTimeout(this.timer)
  }
}
```

---

## Vue 3 WebView 规范

### 组件规范

```vue
<!-- ✅ 标准组件模板 -->
<script setup lang="ts">
// 1. 类型导入
import type { Message } from '../types'
// 2. 组合式函数（逻辑在外面）
import { useChatInput } from './hooks/useChatInput'
// 3. Props / Emits（类型优先）
const props = defineProps<{ messages: Message[] }>()
const emit = defineEmits<{ send: [content: string] }>()
// 4. 使用组合式函数
const { input, handleSend } = useChatInput(emit)
</script>

<template>
  <!-- 5. 模板只做渲染，不写业务逻辑 -->
</template>
```

**组件拆分规则：**
- `ChatPanel.vue` — 布局容器，不写业务逻辑
- `MessageList.vue` — 消息列表渲染
- `MessageBubble.vue` — 单条消息（含 Markdown/代码块）
- `ChatInput.vue` — 输入框 + 发送
- `CodeBlock.vue` — 代码块 + Copy/Apply 按钮
- `StreamingCursor.vue` — 流式输出光标动画

**hooks 规范（逻辑全在这里）：**
```
webview/src/hooks/
├── useVSCode.ts        # acquireVsCodeApi() 封装 + 消息收发
├── useChat.ts          # 消息状态 + 发送逻辑
├── useStreaming.ts      # 流式输出状态管理
├── useCodeContext.ts   # 代码引用上下文
└── useTheme.ts         # VSCode 主题变量同步
```

---

## Git 提交规范

```bash
# Conventional Commits（必须遵守）
feat(completion): add LRU cache for inline completions
fix(chat): resolve race condition in streaming response
refactor(webview): extract MessageBubble from ChatPanel
perf(completion): reduce debounce from 300ms to 150ms
test(completion): add unit tests for cache eviction
chore(build): update esbuild to 0.25

# 禁止
fix: bug fix
update code
wip
```

---

## 质量门禁（提交前必须全部通过）

```bash
# 在 linkcode-vscode/ 目录下运行
node esbuild.js          # ✅ 构建成功
npx tsc --noEmit         # ✅ 零类型错误
npx eslint src/          # ✅ 零 lint 警告
cd webview && pnpm build # ✅ WebView 构建成功

# 检查冗余
npx ts-unused-exports tsconfig.json   # 零未使用导出
grep -r "console\.log" src/           # 零 console.log
grep -r "any" src/ --include="*.ts"   # 零 any 类型（注释不算）
```

---

## 参考资料（每次任务前加载）

```bash
# VSCode Extension 深度参考（必读）
read ~/.hermes/skills/agents/frontend-agent/references/vscode-extension.md

# AI 开发工具工作流
read ~/.hermes/skills/agents/frontend-agent/references/ai-dev-tools-workflow.md

# Vue 3 最佳实践（WebView 部分）
read ~/.hermes/skills/agents/frontend-agent/references/vue-nuxt-patterns.md

# TypeScript 高级模式
read ~/.hermes/skills/agents/frontend-agent/references/typescript-patterns.md
```

---

## 项目路径

- **本地**: `~/.openclaw/agents/frontend-agent/workspace/linkcode-vscode/`
- **GitHub**: https://github.com/YEMAOYANG/linkcode-vscode
- **分支策略**: `main`（稳定）← `feat/*`（功能）← `fix/*`（修复）
