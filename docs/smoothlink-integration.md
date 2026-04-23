# LinkCode × Smoothlink API 对接文档

> 版本：v1.0  
> 日期：2026-04-23  
> 文档来源：https://smoothlink.ai/docs

---

## 一、Smoothlink 平台概述

Smoothlink（三千尺/Starpeak Technology）是一个 **AI 模型聚合平台**，统一代理多家厂商的大模型，提供 **完全兼容 OpenAI 的 API 接口**。

- 接入一次，调用 61+ 模型（Claude / GPT / Gemini / DeepSeek / Qwen / MiniMax 等）
- 认证方式：Bearer Token
- 接口格式：100% 兼容 OpenAI Chat Completions API
- 支持流式输出（SSE）

---

## 二、认证方式

所有请求的 Header 中添加：

```http
Authorization: Bearer <YOUR_API_TOKEN>
Content-Type: application/json
```

Token 在 [Smoothlink Console](https://smoothlink.ai/login) 中获取。

---

## 三、核心 API 端点

### 3.1 对话（Chat Completions）⭐️ 最重要

```
POST https://smoothlink.ai/v1/chat/completions
```

这是 LinkCode Chat Panel 和 Inline Completion 都要用的核心接口。

#### 请求体

```typescript
interface SmoothLinkChatRequest {
  model: string                    // 必填 — 模型 ID，见第五节
  messages: ChatMessage[]          // 必填 — 对话历史
  stream?: boolean                 // 可选 — true 启用 SSE 流式
  stream_options?: {
    include_usage?: boolean        // 流式结束时是否附带 token 用量
  }
  temperature?: number             // 可选 — 采样温度，推荐 0.2（代码场景）
  top_p?: number                   // 可选 — 核采样
  max_tokens?: number              // 可选 — 最大生成 token 数
  max_completion_tokens?: number   // 可选 — 同 max_tokens（新字段）
  stop?: string | string[]         // 可选 — 停止序列
  presence_penalty?: number        // 可选
  frequency_penalty?: number       // 可选
  seed?: number                    // 可选 — 固定随机种子
  user?: string                    // 可选 — 用户标识，用于用量追踪
  reasoning_effort?: 'low' | 'medium' | 'high'  // 可选 — 推理强度（推理模型专用）
  tools?: ToolDefinition[]         // 可选 — Function Calling
  tool_choice?: string             // 可选
  response_format?: {
    type: 'text' | 'json_object' | 'json_schema'
    json_schema?: object
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  tool_calls?: ToolCall[]          // assistant 角色时携带
  tool_call_id?: string            // tool 角色时携带
  reasoning_content?: string       // 推理模型的思考链内容
}
```

#### 非流式响应（`stream: false` 或不传）

```typescript
interface ChatCompletionResponse {
  id: string
  object: 'chat.completion'
  created: number                  // Unix timestamp
  model: string                    // 实际使用的模型
  choices: Array<{
    index: number
    message: {
      role: 'assistant'
      content: string
      tool_calls?: ToolCall[]
      reasoning_content?: string   // 推理模型思考链
    }
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter'
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    prompt_tokens_details?: {
      cached_tokens: number
      text_tokens: number
    }
    completion_tokens_details?: {
      reasoning_tokens: number
    }
  }
  system_fingerprint?: string
}
```

#### 流式响应（`stream: true`，SSE 格式）

每个 SSE 数据包格式：

```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"claude-sonnet-4-6","choices":[{"index":0,"delta":{"role":"assistant","content":"你好"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"claude-sonnet-4-6","choices":[{"index":0,"delta":{"content":"，"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"claude-sonnet-4-6","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

**关键字段路径：**
- 增量文本：`choices[0].delta.content`（可能为 `null` 或 `undefined`，需判断）
- 结束标志：`choices[0].finish_reason === 'stop'` 或收到 `[DONE]`
- 如果 `stream_options.include_usage: true`，最后一个 chunk 会携带 `usage` 字段

### 3.2 获取模型列表

```
GET https://smoothlink.ai/v1/models
Authorization: Bearer <token>
```

响应：

```typescript
interface ModelsResponse {
  object: 'list'
  data: Array<{
    id: string           // 模型 ID，直接用于 model 参数
    object: 'model'
    created: number
    owned_by: string
  }>
}
```

### 3.3 错误码

| HTTP 状态码 | 含义 | 处理建议 |
|------------|------|---------|
| `400` | 请求参数错误（如 model 不存在、messages 为空） | 检查请求体，提示用户 |
| `401` | Token 无效或未传 | 弹出 API Key 配置提示 |
| `429` | 请求频率超限 | 指数退避重试，提示用户 |
| `500` | 平台内部错误 | 提示稍后重试 |

---

## 四、现有代码需要改动的地方

### 4.1 改动汇总

| 文件 | 改动内容 | 优先级 |
|------|---------|--------|
| `src/api/client.ts` | 端点路径、请求体格式 | 🔴 必须 |
| `src/api/stream.ts` | SSE 解析逻辑，适配 OpenAI 格式 | 🔴 必须 |
| `src/api/types.ts` | 补充 Smoothlink 返回类型 | 🔴 必须 |
| `src/shared/constants.ts` | 更新默认 API 地址和默认模型 | 🔴 必须 |
| `package.json` | 插件配置项加 `model` 选择 | 🟠 重要 |
| `src/providers/ChatViewProvider.ts` | CSP 加 `connect-src smoothlink.ai` | 🟠 重要 |
| `src/webview/src/` | Chat 面板加模型选择 UI | 🟡 建议 |

### 4.2 `src/api/client.ts` — 改动详解

**改动 1：Chat 端点路径**

```typescript
// ❌ 旧代码
const res = await fetch(`${endpoint}/v1/chat`, { ... })

// ✅ 改为
const res = await fetch(`${endpoint}/v1/chat/completions`, { ... })
```

**改动 2：请求体加 model 字段**

```typescript
// ❌ 旧代码
body: JSON.stringify({ messages, stream: true })

// ✅ 改为
const model = this.getModel()   // 从 vscode config 读取
body: JSON.stringify({
  model,
  messages,
  stream: true,
  stream_options: { include_usage: false },
  temperature: 0.2,
  max_tokens: 2048,
})
```

**改动 3：Inline Completion 端点**

当前的 `POST /v1/complete` 在 Smoothlink 不存在。两种方案：

**方案 A（推荐）**：用 Chat Completions 模拟补全，构造 system prompt 引导模型只输出代码：

```typescript
const messages: ChatMessage[] = [
  {
    role: 'system',
    content: '你是一个代码补全助手。根据用户提供的代码前缀和后缀，只输出补全的代码片段，不要解释，不要 markdown 代码块。',
  },
  {
    role: 'user',
    content: `语言: ${payload.language}\n文件: ${payload.filepath ?? 'unknown'}\n\n代码前缀:\n${payload.prefix}\n\n代码后缀:\n${payload.suffix ?? ''}\n\n请补全前缀和后缀之间的代码：`,
  },
]
```

**方案 B**：等 Smoothlink 支持 FIM (Fill-In-the-Middle) 端点后再迁移。

**改动 4：新增 `getModel()` 私有方法**

```typescript
private getModel(): string {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
  return config.get<string>('model') ?? DEFAULT_MODEL
}
```

### 4.3 `src/api/stream.ts` — 改动详解

**这是最关键的改动**，旧代码解析的是自定义格式，Smoothlink 返回 OpenAI 标准格式：

```typescript
// ❌ 旧代码 — 解析自定义格式
const parsed = JSON.parse(data) as { content?: string; error?: string }
if (parsed.content) {
  yield { type: 'token', content: parsed.content }
}

// ✅ 新代码 — 解析 OpenAI Chat Completion Chunk 格式
interface StreamChunk {
  id: string
  object: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string | null
      reasoning_content?: string | null
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

const parsed = JSON.parse(data) as StreamChunk
const delta = parsed.choices?.[0]?.delta
if (delta?.content) {
  yield { type: 'token', content: delta.content }
}
const finishReason = parsed.choices?.[0]?.finish_reason
if (finishReason === 'stop' || finishReason === 'length') {
  yield { type: 'done' }
  return
}
```

### 4.4 `src/shared/constants.ts` — 改动

```typescript
// ✅ 新增/修改常量
export const DEFAULT_API_ENDPOINT = 'https://smoothlink.ai'
export const DEFAULT_MODEL = 'claude-sonnet-4-6'   // 推荐默认模型

// 推荐的可选模型列表（供 UI 展示用）
export const RECOMMENDED_MODELS = [
  { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6',  provider: 'Anthropic' },
  { id: 'claude-opus-4-6',           label: 'Claude Opus 4.6',    provider: 'Anthropic' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',   provider: 'Anthropic' },
  { id: 'deepseek-r1',               label: 'DeepSeek R1',        provider: 'DeepSeek'  },
  { id: 'deepseek-v3',               label: 'DeepSeek V3',        provider: 'DeepSeek'  },
  { id: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro',     provider: 'Google'    },
  { id: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash',   provider: 'Google'    },
  { id: 'gpt-5',                     label: 'GPT-5',              provider: 'OpenAI'    },
] as const
```

### 4.5 `package.json` — 新增配置项

```json
"configuration": {
  "properties": {
    "linkcode.apiEndpoint": {
      "type": "string",
      "default": "https://smoothlink.ai",
      "description": "Smoothlink API 地址"
    },
    "linkcode.model": {
      "type": "string",
      "default": "claude-sonnet-4-6",
      "enum": [
        "claude-sonnet-4-6",
        "claude-opus-4-6",
        "claude-haiku-4-5-20251001",
        "deepseek-r1",
        "deepseek-v3",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gpt-5"
      ],
      "enumDescriptions": [
        "Claude Sonnet 4.6 (推荐，平衡速度与质量)",
        "Claude Opus 4.6 (最强推理，适合复杂问题)",
        "Claude Haiku 4.5 (最快，适合 Inline 补全)",
        "DeepSeek R1 (强推理，性价比高)",
        "DeepSeek V3 (通用，性价比高)",
        "Gemini 2.5 Pro (长上下文，200k tokens)",
        "Gemini 2.5 Flash (快速，适合补全)",
        "GPT-5"
      ],
      "description": "LinkCode 使用的 AI 模型"
    },
    "linkcode.completionModel": {
      "type": "string",
      "default": "claude-haiku-4-5-20251001",
      "description": "Inline 代码补全专用模型（建议选速度快的小模型）"
    }
  }
}
```

### 4.6 CSP 更新（`ChatViewProvider.ts`）

```typescript
// ✅ connect-src 需要加上 Smoothlink 域名
content="default-src 'none';
  script-src 'nonce-${nonce}';
  style-src ${webview.cspSource} 'unsafe-inline';
  img-src ${webview.cspSource} https:;
  connect-src https://smoothlink.ai;"
```

---

## 五、令牌分组机制（⚠️ 核心概念）

### 5.1 什么是令牌分组

Smoothlink 的模型按**令牌分组（Token Group）**管理。**每个分组需要单独创建 API 令牌**，不同分组的令牌不通用。也就是说：

> **一个 API Key 只能调用其所属分组内的模型。**

如果你想用 Claude 和 DeepSeek 两个厂商的模型，就需要创建两个令牌（分别属于 `Claude_aws` 和 `deepseek_tencent` 分组），在代码中根据模型自动选择对应的令牌。

### 5.2 完整分组与模型映射

| 分组名 | 模型 | 适合场景 |
|--------|------|---------|
| **Claude_aws** | `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-sonnet-4-5-20250929`, `claude-opus-4-5-20251101`, `claude-haiku-4-5-20251001`, `claude-sonnet-4-20250514`, `cursor-haik-4-5`, `cursor-opu-4-5`, `cursor-opu-4-6`, `cursor-sonne-4`, `cursor-sonne-4-5`, `cursor-sonne-4-6` | Chat 主力 + 补全 |
| **gpt_Azure** | `gpt-5`, `gpt-5-codex`, `gpt-5.1`, `gpt-5.1-codex`, `gpt-5.2`, `gpt-5.2-codex`, `gpt-5.3-codex`, `gpt-5.4`, `gpt-5.4-pro` | GPT 系列 |
| **gemini_Google** | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-image`, `gemini-2.5-flash-lite`, `gemini-3-flash-preview`, `gemini-3-pro-preview`, `gemini-3.1-flash-lite-preview`, `gemini-3.1-pro-preview`, `gemini-embedding-001`, `gemini-flash-lite-latest` | 长上下文 + Embedding |
| **deepseek_tencent** | `deepseek-r1`, `deepseek-v3`, `deepseek-v3.1`, `deepseek-v3.2` | 高性价比推理 |
| **MiniMax** | `M2-her`, `MiniMax-M2.1`, `MiniMax-M2.1-highspeed`, `MiniMax-M2.5-highspeed`, `MiniMax-M2.7`, `MiniMax-M2.7-highspeed` | MiniMax 系列 |
| **aliyun** | `deepseek-v3.2`, `glm-5`, `kimi-k2.5`, `MiniMax-M2.7`, `qwen3.5-plus`, `qwen3.6-plus` | 阿里云通道 |
| **hunyuan_tencent** | `hunyuan-2.0-instruct`, `hunyuan-2.0-thinking` | 腾讯混元 |
| **other_tencent** | `glm-5`, `kimi-k2.5`, `minimax-m2.5` | 腾讯其他通道 |
| **scnet** | `DeepSeek-R1-0528`, `DeepSeek-R1-Distill-Llama-70B`, `DeepSeek-R1-Distill-Qwen-32B`, `DeepSeek-R1-Distill-Qwen-7B`, `DeepSeek-V3.2`, `Qwen3-235B-A22B`, `Qwen3-235B-A22B-Thinking-2507`, `Qwen3-30B-A3B`, `Qwen3-30B-A3B-Instruct-2507`, `QwQ-32B` | 开源模型通道 |
| **scnet-low** | `MiniMax-M2`, `MiniMax-M2.5` | 低价通道 |
| **Echo** | `claude-opus-4-6`, `gemini-3.1-pro-preview` | 特殊通道 |
| **stepfun_openrouter** | `stepfun/step-3.5-flash:free` | 免费通道 |

### 5.3 对 LinkCode 的影响（⚠️ 架构决策）

这是最关键的架构决策点。**不能只存一个 API Key，需要多 Key 路由。**

#### 方案 A：多 Token 自动路由（推荐 ✅）

用户在设置中配置多个分组的 Token，插件根据选中的模型自动选 Token：

```
用户配置:
  Claude Token: sk-claude-xxx     (Claude_aws 分组)
  DeepSeek Token: sk-ds-xxx       (deepseek_tencent 分组)
  Gemini Token: sk-gem-xxx        (gemini_Google 分组)

用户选模型 → 插件查映射表 → 自动用对应 Token 发请求
```

**代码设计：**

```typescript
// src/shared/constants.ts — 模型到分组的映射
export const MODEL_TO_GROUP: Record<string, string> = {
  // Claude_aws
  'claude-sonnet-4-6': 'Claude_aws',
  'claude-opus-4-6': 'Claude_aws',
  'claude-haiku-4-5-20251001': 'Claude_aws',
  'claude-sonnet-4-5-20250929': 'Claude_aws',
  'claude-opus-4-5-20251101': 'Claude_aws',
  'claude-sonnet-4-20250514': 'Claude_aws',
  // gpt_Azure
  'gpt-5': 'gpt_Azure',
  'gpt-5.1': 'gpt_Azure',
  'gpt-5.2': 'gpt_Azure',
  'gpt-5.4': 'gpt_Azure',
  // gemini_Google
  'gemini-2.5-pro': 'gemini_Google',
  'gemini-2.5-flash': 'gemini_Google',
  // deepseek_tencent
  'deepseek-r1': 'deepseek_tencent',
  'deepseek-v3': 'deepseek_tencent',
  'deepseek-v3.1': 'deepseek_tencent',
  'deepseek-v3.2': 'deepseek_tencent',
  // ... 其他模型
}

// src/shared/types.ts — 多 Token 配置
export interface TokenConfig {
  group: string       // 分组名
  token: string       // API Token
  models: string[]    // 该 Token 可用的模型
}
```

**package.json 配置项：**

```json
"linkcode.apiTokens": {
  "type": "object",
  "default": {},
  "description": "各分组的 API Token（key=分组名, value=token）",
  "properties": {
    "Claude_aws": { "type": "string" },
    "gpt_Azure": { "type": "string" },
    "gemini_Google": { "type": "string" },
    "deepseek_tencent": { "type": "string" }
  }
}
```

**ApiClient 改造：**

```typescript
// src/api/client.ts
private async getHeaders(): Promise<Record<string, string>> {
  const model = this.getModel()
  const group = MODEL_TO_GROUP[model]
  if (!group) throw new AuthError(`未知模型: ${model}`)
  
  // 从配置读取该分组的 token
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
  const tokens = config.get<Record<string, string>>('apiTokens') ?? {}
  const token = tokens[group]
  
  // 如果分组 token 没配置，fallback 到通用 API Key
  const apiKey = token || await this.getApiKey()
  if (!apiKey) {
    throw new AuthError(`分组 ${group} 的 API Token 未配置`)
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}
```

#### 方案 B：单 Token + 限制可选模型（简单但受限）

只配一个 Token，插件只展示该 Token 对应分组的模型：

```
用户只配: sk-claude-xxx (Claude_aws 分组)
→ 模型选择器只展示 Claude 系列
→ 切到 DeepSeek 不可用，提示配置对应 Token
```

优点：实现简单。缺点：用户体验差，切模型要改 Token。

#### 方案 C：动态拉取可用模型（最优雅）

用 `GET /v1/models` 端点 + 当前 Token 自动获取可用模型列表：

```typescript
// 每次用户打开模型选择器时拉取
const res = await fetch(`${endpoint}/v1/models`, {
  headers: { 'Authorization': `Bearer ${currentToken}` }
})
const { data } = await res.json()
// data 只返回该 Token 有权限的模型
```

优点：不需要维护映射表，实时准确。可与方案 A 组合使用。

### 5.4 推荐实施策略

**第一阶段（MVP）**：方案 B — 单 Token 快速跑通，验证核心流程。

**第二阶段（正式版）**：方案 A + C 组合：
1. 支持配置多个分组 Token
2. 每个 Token 调 `/v1/models` 动态获取可用模型
3. 合并后展示给用户选择
4. 选模型时自动路由到对应 Token

---

## 六、可用模型列表（截至 2026-04-23）

共 61 个模型，以下是 LinkCode 推荐使用的：

### Claude 系列（Anthropic） — 分组：Claude_aws
| 模型 ID | 说明 | 适用场景 |
|---------|------|---------|
| `claude-sonnet-4-6` | 最新旗舰，速度与质量平衡 | Chat Panel 默认推荐 |
| `claude-opus-4-6` | 最强推理能力 | 复杂代码分析 |
| `claude-sonnet-4-5-20250929` | 上一代旗舰 | 备选 |
| `claude-haiku-4-5-20251001` | 最快，成本最低 | Inline Completion 推荐 |

### DeepSeek 系列 — 分组：deepseek_tencent
| 模型 ID | 说明 | 适用场景 |
|---------|------|---------|
| `deepseek-r1` | 强推理，思维链 | 算法/逻辑题 |
| `deepseek-v3` | 通用，性价比最高 | 日常编码 |
| `deepseek-v3.1` | V3 升级版 | 日常编码 |
| `deepseek-v3.2` | V3 最新版 | 日常编码 |

### Gemini 系列（Google） — 分组：gemini_Google
| 模型 ID | 说明 | 适用场景 |
|---------|------|---------|
| `gemini-2.5-pro` | 超长上下文（200k） | 大文件分析 |
| `gemini-2.5-flash` | 快速推理 | 补全/快速问答 |

### OpenAI 系列 — 分组：gpt_Azure
| 模型 ID | 说明 |
|---------|------|
| `gpt-5` | GPT-5 最新版 |
| `gpt-5.1` | GPT-5.1 |
| `gpt-5.2` | GPT-5.2 |

---

## 六、完整对接代码示例

### 6.1 Chat 流式请求（最终目标形态）

```typescript
// src/api/client.ts — streamChat 方法最终实现
async *streamChat(
  messages: ChatMessage[],
  signal?: AbortSignal
): AsyncGenerator<ChatStreamChunk> {
  const headers = await this.getHeaders()
  const endpoint = this.getEndpoint()
  const model = this.getModel()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  if (signal) {
    if (signal.aborted) { controller.abort() }
    else { signal.addEventListener('abort', () => controller.abort(), { once: true }) }
  }

  try {
    const res = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.2,
        max_tokens: 4096,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new ApiError(`API error ${res.status}: ${body}`, res.status)
    }

    yield* parseSSEStream(res, controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}
```

### 6.2 SSE 解析（最终目标形态）

```typescript
// src/api/stream.ts — 解析 OpenAI 格式 SSE
interface OpenAIStreamChunk {
  choices: Array<{
    delta: { content?: string | null; reasoning_content?: string | null }
    finish_reason: string | null
  }>
}

export async function* parseSSEStream(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<ChatStreamChunk> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) break

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue

        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6)

          if (data === '[DONE]') {
            yield { type: 'done' }
            return
          }

          try {
            const chunk = JSON.parse(data) as OpenAIStreamChunk
            const delta = chunk.choices?.[0]?.delta
            const finishReason = chunk.choices?.[0]?.finish_reason

            if (delta?.content) {
              yield { type: 'token', content: delta.content }
            }
            if (finishReason === 'stop' || finishReason === 'length') {
              yield { type: 'done' }
              return
            }
          } catch {
            // 非 JSON 行跳过
          }
        }
      }
    }

    yield { type: 'done' }
  } finally {
    reader.releaseLock()
  }
}
```

### 6.3 Inline Completion（用 Chat API 模拟）

```typescript
// src/api/client.ts — complete 方法最终实现
async complete(
  payload: CompletionRequest,
  signal?: AbortSignal
): Promise<string | null> {
  const headers = await this.getHeaders()
  const endpoint = this.getEndpoint()
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
  const model = config.get<string>('completionModel') ?? 'claude-haiku-4-5-20251001'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  if (signal) {
    if (signal.aborted) { controller.abort() }
    else { signal.addEventListener('abort', () => controller.abort(), { once: true }) }
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: '你是专业代码补全助手。根据代码上下文，只输出补全内容，不加任何解释或 Markdown 格式。',
    },
    {
      role: 'user',
      content: [
        `语言: ${payload.language}`,
        payload.filepath ? `文件: ${payload.filepath}` : '',
        `\n<prefix>${payload.prefix}</prefix>`,
        payload.suffix ? `<suffix>${payload.suffix}</suffix>` : '',
        '\n直接输出补全代码：',
      ].filter(Boolean).join('\n'),
    },
  ]

  try {
    const res = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: 0.1,     // 低温，代码补全需要确定性
        max_tokens: 256,      // 补全不需要太长
        stop: ['\n\n\n'],     // 防止输出太多
      }),
    })

    if (!res.ok) return null

    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices?.[0]?.message?.content?.trim() ?? null
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return null
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
```

---

## 七、注意事项 & 踩坑记录

### 7.1 model 字段必填
Smoothlink 的 `model` 是必填字段，不传会返回 `400`。旧代码没有传这个字段，是最高优先级 bug。

### 7.2 SSE 格式完全不同
旧代码解析 `{ content, error }` 自定义格式，Smoothlink 是 OpenAI 标准的 `choices[0].delta.content`，不改就完全解析不了，聊天没有任何输出。

### 7.3 reasoning_content 字段
推理模型（DeepSeek R1、Claude Opus）的响应会携带 `reasoning_content` 字段（思维链），可以选择在 UI 中展示或忽略。

### 7.4 模型能力差异
| 能力 | 支持的模型 |
|------|----------|
| Function Calling / Tools | GPT 系列、Claude 系列、部分 Gemini |
| 推理链（reasoning） | DeepSeek R1、Claude Opus |
| 超长上下文（>100k） | Gemini 2.5 Pro (200k)、Claude (1m) |
| 视觉（Vision） | GPT-5、Claude、Gemini |

### 7.5 CSP 限制
WebView 的 `connect-src` 必须包含 `https://smoothlink.ai`，否则浏览器会拦截请求（但实际上请求是从 extension host 发出的，不是 WebView，所以 Chat 的 API 调用走的是 `ChatViewProvider.ts`，不受 WebView CSP 限制）。

### 7.6 Inline Completion 的性能建议
用 Chat API 模拟补全会比专用 FIM 端点慢，建议：
- `completionModel` 默认用 `claude-haiku-4-5-20251001`（最快）
- `max_tokens` 控制在 128-256
- 防抖时间从 300ms 提高到 500ms（减少无效请求）
- LRU 缓存命中率要重点关注

---

## 八、对接实施顺序

```
Step 1: 改 src/api/stream.ts — SSE 解析适配 OpenAI 格式
   └── 这是 Chat 能工作的最关键一步

Step 2: 改 src/api/client.ts
   ├── streamChat: 端点改为 /v1/chat/completions，加 model 字段
   └── complete: 改为用 Chat API 模拟补全

Step 3: 改 src/shared/constants.ts
   └── 更新 DEFAULT_API_ENDPOINT、DEFAULT_MODEL

Step 4: 改 package.json 插件配置
   └── 加 model 和 completionModel 配置项

Step 5: 更新 ChatViewProvider.ts
   └── 读取 model 配置，传给 apiClient

Step 6:（可选）Webview 加模型切换 UI
   └── 下拉选择模型，实时切换
```

---

## 九、测试验证 curl

拿到 Token 后，可用以下 curl 快速验证对接是否成功：

```bash
# 非流式测试
curl https://smoothlink.ai/v1/chat/completions \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "messages": [{"role": "user", "content": "用 TypeScript 写一个 hello world 函数"}],
    "max_tokens": 200
  }'

# 流式测试
curl https://smoothlink.ai/v1/chat/completions \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-haiku-4-5-20251001",
    "messages": [{"role": "user", "content": "hello"}],
    "stream": true
  }'
```

---

*更多 API 文档见：https://smoothlink.ai/docs*
