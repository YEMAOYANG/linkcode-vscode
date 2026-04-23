# LinkCode — 令牌配置引导设计文档

> 版本：v2.0
> 日期：2026-04-23
> 更新：基于 v1.0 审核，修复算法缺陷、统一存储方案、补充中途缺 Token 场景

---

## 一、核心问题

Smoothlink 的令牌系统有一个关键特性：

> **一个令牌只能调用其所属分组内的模型，不同分组需要不同令牌。**

| 分组名 | 可用模型 | 典型用途 |
|--------|---------|---------|
| `Claude_aws` | Claude Sonnet/Opus/Haiku 全系列 + Cursor 系列 | 最强编程推理 |
| `deepseek_tencent` | DeepSeek R1、V3、V3.1、V3.2 | 高性价比推理 |
| `gemini_Google` | Gemini 2.5 Pro/Flash 全系列 | 超长上下文 |
| `gpt_Azure` | GPT-5 全系列（9个） | OpenAI 模型 |
| `scnet` | Qwen3、DeepSeek R1 开源版、QwQ-32B | 开源高性能 |
| `aliyun` | Qwen、GLM、Kimi、MiniMax | 阿里云通道 |
| `MiniMax` | MiniMax M2 全系列 | MiniMax 专属 |
| `hunyuan_tencent` | 混元 2.0 全系列 | 腾讯混元 |
| `other_tencent` | GLM、Kimi、MiniMax | 腾讯其他通道 |
| `scnet-low` | MiniMax M2、M2.5 | 低价通道 |
| `Echo` | Claude Opus 4.6 + Gemini 3.1 Pro | 特殊通道 |
| `stepfun_openrouter` | step-3.5-flash（免费） | 免费体验 |

**用户三种典型场景：**
- **新用户**：只有一个令牌（通常是 Claude 或 DeepSeek），先跑起来
- **进阶用户**：有 2-3 个令牌，希望随时切换厂商
- **企业用户**：有全部分组令牌，需要智能路由

---

## 二、设计原则

1. **最小阻力启动**：一个令牌就能用，不强迫配置所有分组
2. **渐进式配置**：先跑起来，设置里慢慢加其他令牌
3. **清晰的分组可视化**：用户始终知道令牌对应哪些模型
4. **全链路覆盖**：Onboarding、中途缺 Token、设置管理三个场景都要处理

---

## 三、Onboarding 引导流程（4 步）

### 总览

```
Step 1: 欢迎页
  └── 功能亮点展示 + 「开始配置」按钮

Step 2: 令牌配置（核心，三种状态）
  ├── 状态 A：输入阶段（粘贴 + 验证）
  ├── 状态 B：验证成功（展示分组 + 引导继续）
  └── 状态 C：追加更多令牌（可选循环）

Step 3: 选择默认模型
  └── 只展示已配置分组的可用模型

Step 4: 完成
  └── 汇总已解锁模型数 + 进入主界面
```

---

### Step 2 状态 A：输入阶段

```
┌─────────────────────────────────────────────┐
│  🔑 配置你的 Smoothlink 令牌                 │
│                                              │
│  LinkCode 通过 Smoothlink 接入 61+ 个模型    │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ 粘贴你的令牌 sk-...                  │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  还没有令牌？                                │
│  [前往 Smoothlink 免费注册 →]               │
│                                              │
│                      [验证令牌]              │
└─────────────────────────────────────────────┘
```

**验证逻辑：**

```
调用 GET /v1/models（带该令牌）
  ├── 成功 → 解析模型列表 → 推断分组 → 进入状态 B
  ├── 401  → 提示「令牌无效，请检查后重试」
  └── 网络错误 → 提示「网络连接失败，请检查网络」
```

---

### Step 2 状态 B：验证成功

```
┌─────────────────────────────────────────────┐
│  ✅ 令牌验证成功！                           │
│                                              │
│  已识别分组：Claude_aws                      │
│  已解锁 12 个模型：                          │
│  ┌────────────────────────────────────┐     │
│  │ 🟣 Claude Sonnet 4.6   推理最强    │     │
│  │ 🟣 Claude Opus 4.6     最高质量    │     │
│  │ 🟣 Claude Haiku 4.5    最快最省    │     │
│  │ 🟣 ...更多 9 个模型               │     │
│  └────────────────────────────────────┘     │
│                                              │
│  ── 推荐继续配置（解锁更多模型）──           │
│                                              │
│  [+ 添加 DeepSeek 令牌]                      │
│  DeepSeek R1/V3，高性价比推理                │
│                                              │
│  [+ 添加 Gemini 令牌]                        │
│  Gemini 2.5 Pro，200k 超长上下文             │
│                                              │
│  [跳过，稍后设置]          [继续 →]          │
└─────────────────────────────────────────────┘
```

**推荐分组排序逻辑：**
- 排除已配置的分组
- 按「用户常用度」固定排序：deepseek_tencent → gemini_Google → gpt_Azure → scnet
- 最多展示 2 个推荐入口，避免干扰

---

### Step 2 状态 C：追加更多令牌（可选）

点击「+ 添加 DeepSeek 令牌」后展开追加区域：

```
┌─────────────────────────────────────────────┐
│  + 添加 DeepSeek 令牌（可选）                │
│                                              │
│  可解锁：DeepSeek R1、V3、V3.1、V3.2        │
│  参考定价：¥0.001/1K token（约 OpenAI 的 1/10）│
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ 粘贴 deepseek_tencent 分组令牌...    │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [验证并添加]                    [取消]      │
└─────────────────────────────────────────────┘
```

- 验证成功后刷新状态 B，已解锁模型总数累加
- 最多支持添加 4 个分组（超过则引导去设置页面管理）
- 每个分组只能添加一次（已添加的按钮变为 ✅ 状态）

---

### Step 2 状态机

```
用户进入 Step 2
      │
      ▼
  粘贴令牌 → 点击验证
      │
   ┌──┴──┐
失败      成功
  │         │
错误提示    识别分组 + 展示可用模型（状态 B）
+ 重试          │
             ┌──┴──────────┐
           跳过           继续添加（状态 C）
             │               │
             ▼           验证新令牌
          Step 3              │
                         成功 → 刷新状态 B（循环，≤4次）
                         失败 → 错误提示 + 重试
```

---

### Step 3：选择默认模型

- **只展示已配置分组的模型**（不展示无 Token 的分组）
- 每个模型显示：名称 + 分组来源徽章 + 速度/质量标签
- 未配置分组的模型**不在此页出现**（避免选了用不了）

---

### Step 4：完成

```
┌─────────────────────────────────────────────┐
│  🎉 配置完成！                               │
│                                              │
│  已解锁 {n} 个模型，来自 {x} 个分组          │
│                                              │
│  ✅ Claude_aws   12 个模型                   │
│  ✅ deepseek_tencent  4 个模型               │
│                                              │
│  默认模型：Claude Sonnet 4.6                 │
│                                              │
│  💡 随时在设置中添加更多分组令牌             │
│                                              │
│                    [开始使用 →]              │
└─────────────────────────────────────────────┘
```

---

## 四、中途缺 Token 的处理（⚠️ 高频场景）

> 这是比 Onboarding 更高频的场景：用户已上手后切换到未配置分组的模型。

### 4.1 模型选择器（预防）

```
已配置分组的模型：正常显示，可点击选择
未配置分组的模型：显示 🔒 + 灰色 + hover 提示「需要配置 {group} 令牌」
                  点击 → 直接跳到 Settings 令牌管理页，对应分组行高亮闪烁
```

### 4.2 发送时缺 Token（兜底）

如果用户绕过选择器（如通过命令直接设置了模型）触发 API 调用而缺 Token：

```
┌──────────────────────────────────────────────────────┐
│ ⚠️  模型 claude-sonnet-4-6 需要 Claude_aws 分组令牌   │
│     [去配置]                    [换个模型]            │
└──────────────────────────────────────────────────────┘
```

- `[去配置]` → 打开 Settings 并跳到令牌管理 Tab，对应分组高亮
- `[换个模型]` → 打开模型选择器，自动过滤只显示有 Token 的模型

### 4.3 Token 失效 / 被吊销（401）

已有 Token 但 API 返回 401：

```
│ ⚠️  Claude_aws 令牌已失效，请重新配置                │
│     [更新令牌]                                        │
```

- `[更新令牌]` → 打开 Settings 令牌管理，对应分组行进入编辑模式

---

## 五、没有令牌的用户

### 场景一：完全新用户（Onboarding Step 2）

```
┌─────────────────────────────────────────────┐
│  🚀 3 步开始使用 LinkCode                   │
│                                              │
│  1. 前往 Smoothlink 注册（免费）             │
│  2. 在控制台选择分组并创建令牌               │
│  3. 粘贴到下方输入框                         │
│                                              │
│  [打开 Smoothlink 注册页 →]                  │
│                                              │
│  ─────────── 已有令牌 ───────────           │
│                                              │
│  [___________________________]               │
│  [验证并继续]                                │
└─────────────────────────────────────────────┘
```

- 「打开注册页」→ `vscode.env.openExternal('https://smoothlink.ai/register')`
- 用户注册完回来，粘贴令牌继续

### 场景二：体验令牌（谨慎使用）

若提供官方体验令牌，**必须有防滥用机制**：
- 设备指纹限流（基于 VS Code 机器 ID）
- 每设备每天不超过 20 次调用
- 只允许使用低成本模型（如 `stepfun/step-3.5-flash:free`）
- 体验令牌单独存放，不走正式 Token 路由

```
│  或者先用官方体验令牌感受一下（每天 20 次）  │
│  [使用体验令牌] ← 一键填入                   │
```

---

## 六、Settings 令牌管理页

### 布局设计

```
┌─────────────────────────────────────────────┐
│  🔑 令牌管理                                 │
│                                              │
│  [前往 Smoothlink 控制台创建令牌 →]          │
│                                              │
│  ── 已配置 ──────────────────────────────── │
│                                              │
│  ┌────────────────────────────────────┐     │
│  │ ✅ Claude_aws                      │     │
│  │    Claude Sonnet/Opus/Haiku 等     │     │
│  │    sk-iY...KT1U         [更换][删除]│     │
│  └────────────────────────────────────┘     │
│                                              │
│  ── 未配置 ──────────────────────────────── │
│                                              │
│  ┌────────────────────────────────────┐     │
│  │ ○  deepseek_tencent    未配置       │     │
│  │    DeepSeek R1、V3 系列            │     │
│  │                           [+ 添加] │     │
│  ├────────────────────────────────────┤     │
│  │ ○  gemini_Google       未配置       │     │
│  │    Gemini 2.5 Pro/Flash            │     │
│  │                           [+ 添加] │     │
│  ├────────────────────────────────────┤     │
│  │  ...其他 9 个分组（折叠，展开查看） │     │
│  └────────────────────────────────────┘     │
│                                              │
│  配置更多分组令牌即可解锁对应模型             │
└─────────────────────────────────────────────┘
```

**交互细节：**
- 点击 `[更换]` → 该行展开输入框，输入新 Token 后「验证并保存」
- 点击 `[+ 添加]` → 该行展开输入框，格式同 Onboarding 子步骤 C
- 未配置分组默认折叠展示前 4 个（Claude_aws 已配则从 deepseek_tencent 开始）
- Token 显示：始终 masked（`sk-****...****`），不提供明文查看

---

## 七、前端实现要点

### 7.1 令牌分组自动识别算法（v2 — 交集计数）

> ⚠️ v1.0 的单模型特征判断已废弃，原因：模型列表随时更新，且 `/v1/models` 返回集合可能跨分组（如 Echo 分组同时含 Claude 和 Gemini 模型）。

```typescript
// src/shared/constants.ts
// GROUP_TO_MODELS: 每个分组的已知模型列表（从 Smoothlink 文档同步）
export const GROUP_TO_MODELS: Record<string, string[]> = {
  Claude_aws: [
    'claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001',
    'claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101', 'claude-sonnet-4-20250514',
    'cursor-haik-4-5', 'cursor-opu-4-5', 'cursor-opu-4-6',
    'cursor-sonne-4', 'cursor-sonne-4-5', 'cursor-sonne-4-6',
  ],
  deepseek_tencent: ['deepseek-r1', 'deepseek-v3', 'deepseek-v3.1', 'deepseek-v3.2'],
  gemini_Google: [
    'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-image',
    'gemini-2.5-flash-lite', 'gemini-3-flash-preview', 'gemini-3-pro-preview',
    'gemini-3.1-flash-lite-preview', 'gemini-3.1-pro-preview',
    'gemini-embedding-001', 'gemini-flash-lite-latest',
  ],
  gpt_Azure: [
    'gpt-5', 'gpt-5-codex', 'gpt-5.1', 'gpt-5.1-codex',
    'gpt-5.2', 'gpt-5.2-codex', 'gpt-5.3-codex', 'gpt-5.4', 'gpt-5.4-pro',
  ],
  MiniMax: ['M2-her', 'MiniMax-M2.1', 'MiniMax-M2.1-highspeed', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.7', 'MiniMax-M2.7-highspeed'],
  aliyun: ['deepseek-v3.2', 'glm-5', 'kimi-k2.5', 'MiniMax-M2.7', 'qwen3.5-plus', 'qwen3.6-plus'],
  hunyuan_tencent: ['hunyuan-2.0-instruct', 'hunyuan-2.0-thinking'],
  other_tencent: ['glm-5', 'kimi-k2.5', 'minimax-m2.5'],
  scnet: [
    'DeepSeek-R1-0528', 'DeepSeek-R1-Distill-Llama-70B', 'DeepSeek-R1-Distill-Qwen-32B',
    'DeepSeek-R1-Distill-Qwen-7B', 'DeepSeek-V3.2', 'Qwen3-235B-A22B',
    'Qwen3-235B-A22B-Thinking-2507', 'Qwen3-30B-A3B', 'Qwen3-30B-A3B-Instruct-2507', 'QwQ-32B',
  ],
  'scnet-low': ['MiniMax-M2', 'MiniMax-M2.5'],
  Echo: ['claude-opus-4-6', 'gemini-3.1-pro-preview'],
  stepfun_openrouter: ['stepfun/step-3.5-flash:free'],
}

// 交集计数推断分组（v2）
export function inferTokenGroup(returnedModels: string[]): string {
  const modelSet = new Set(returnedModels)
  let bestGroup = 'unknown'
  let bestCount = 0

  for (const [group, models] of Object.entries(GROUP_TO_MODELS)) {
    const matchCount = models.filter(m => modelSet.has(m)).length
    if (matchCount > bestCount) {
      bestCount = matchCount
      bestGroup = group
    }
  }

  // 至少需要 1 个模型匹配才认为识别成功
  return bestCount > 0 ? bestGroup : 'unknown'
}
```

### 7.2 令牌存储方案（独立 key — 最终规范）

> ⚠️ 不使用 JSON 合并存储，原因：JSON 解析失败会导致所有 Token 同时丢失；独立 key 方案原子性更强。

```typescript
// VSCode SecretStorage — 每个分组独立存储
// key 格式：linkcode.token.{group}
// 例：
//   linkcode.token.Claude_aws     → "sk-xxx..."
//   linkcode.token.deepseek_tencent → "sk-yyy..."

// VSCode 普通配置（非敏感）
// linkcode.defaultModel    → "claude-sonnet-4-6"
// linkcode.configuredGroups → ["Claude_aws", "deepseek_tencent"]  // 不含 token，仅标记哪些已配置

// SecretStorage 工具方法（src/utils/secretStorage.ts）
async getGroupToken(group: string): Promise<string | undefined>
async setGroupToken(group: string, token: string): Promise<void>
async deleteGroupToken(group: string): Promise<void>
async getConfiguredGroups(): Promise<string[]>  // 返回已配置的分组名列表
```

### 7.3 ApiClient Token 路由逻辑

```typescript
// src/api/client.ts
async getHeaders(model: string): Promise<Record<string, string>> {
  const group = MODEL_TO_GROUP[model]

  // 1. 优先用对应分组的 Token
  if (group) {
    const groupToken = await this.secretStore.getGroupToken(group)
    if (groupToken) {
      return {
        'Authorization': `Bearer ${groupToken}`,
        'Content-Type': 'application/json',
      }
    }
  }

  // 2. Fallback 到通用 API Key（向后兼容）
  const apiKey = await this.secretStore.getApiKey()
  if (apiKey) {
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  // 3. 完全没有 Token → 抛出带分组信息的错误，触发 tokenMissing 通知
  throw new AuthError(
    `分组 ${group ?? 'unknown'} 的令牌未配置，请在设置中添加`,
    group
  )
}
```

### 7.4 Extension → Webview 消息类型

```typescript
// src/shared/types.ts 补充
type ExtToWebMsg =
  // ...已有类型...
  | { type: 'tokenMissing'; group: string; model: string }   // 缺 Token
  | { type: 'tokenInvalid'; group: string }                  // Token 已失效（401）
  | { type: 'groupTokenValidated'; group: string; models: string[]; success: boolean; message?: string }
  | { type: 'groupTokenStatus'; configured: string[] }       // 已配置的分组列表

type WebToExtMsg =
  // ...已有类型...
  | { type: 'setGroupToken'; group: string; token: string }
  | { type: 'deleteGroupToken'; group: string }
  | { type: 'validateGroupToken'; group: string; token: string }
  | { type: 'getGroupTokenStatus' }
```

---

## 八、实施路线图

### 阶段一：MVP（当前）✅ 已完成

- [x] 多 Token 独立 key 存储（SecretStorage）
- [x] MODEL_TO_GROUP 映射表
- [x] ApiClient 多 Token 路由 + fallback
- [x] Settings Token 管理 Tab（12 个分组展示）
- [x] tokenMissing Banner（发送时缺 Token）
- [x] Onboarding Step 2 改版（快速开始 + 分组配置）

### 阶段二：体验优化（下一步）

- [ ] **模型选择器 Token 锁定**：无 Token 的模型显示 🔒，点击直接跳到 Settings 对应分组
- [ ] **inferTokenGroup 升级到 v2**（交集计数算法）
- [ ] **GROUP_TO_MODELS 常量**补充到 constants.ts
- [ ] Onboarding Step 2 状态 B 的「推荐继续配置」分组
- [ ] Token 失效（401）专用提示和快速修复入口
- [ ] Settings 令牌管理页「已配置 / 未配置」分区展示

### 阶段三：智能路由（V1.1）

- [ ] 「智能路由」模式：根据任务类型自动选最合适的模型
- [ ] Token 余额低时自动切换备用分组
- [ ] 新分组/模型上线时自动通知用户

### 阶段四：一键授权（V2）

- [ ] 与 Smoothlink 协商 OAuth callback 接口
- [ ] 实现「用 Smoothlink 账号授权」→ 自动获取所有分组令牌
- [ ] 令牌过期自动刷新

---

## 九、边界情况处理

| 情况 | 处理方式 |
|------|---------|
| 同一模型出现在多个分组（如 deepseek-v3.2 在 deepseek_tencent 和 aliyun 都有） | 优先用 deepseek_tencent（主分组），aliyun 作备用 |
| inferTokenGroup 返回 unknown | 存为通用 key `linkcode.apiKey`，不做分组路由 |
| 所有分组 Token 全部失效 | 显示全局错误页 + 「重新配置」引导 |
| 用户输错分组令牌（如把 deepseek token 配到 Claude_aws） | 验证时 /v1/models 返回的模型列表不含 Claude，识别到分组不匹配，提示「该令牌属于 {actualGroup} 分组，是否更新归属？」 |
| 网络完全断开 | 验证超时（10s）→ 提示「网络连接失败，请稍后重试」，允许跳过验证手动保存 |

---

*文档基于 Smoothlink API v1，令牌分组信息截至 2026-04-23，如平台新增分组需同步更新 GROUP_TO_MODELS*
