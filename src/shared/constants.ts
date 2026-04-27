/**
 * Global constants for the LinkCode extension.
 * Centralizes magic numbers and configuration defaults.
 */

/** Debounce delay for inline completion requests (ms) */
export const DEBOUNCE_MS = 300

/** LRU cache time-to-live for completion entries (ms) */
export const CACHE_TTL_MS = 30_000

/** Maximum number of entries in the completion LRU cache */
export const MAX_CACHE_SIZE = 50

/** Default API request timeout (ms) */
export const API_TIMEOUT_MS = 30_000

/** Maximum lines of context before cursor */
export const MAX_CONTEXT_LINES_BEFORE = 100

/** Maximum lines of context after cursor */
export const MAX_CONTEXT_LINES_AFTER = 50

/** SecretStorage key for the API key */
export const SECRET_KEY_API = 'linkcode.apiKey'

/** Extension configuration section name */
export const CONFIG_SECTION = 'linkcode'

/** Default Smoothlink API endpoint */
export const DEFAULT_API_ENDPOINT = 'https://smoothlink.ai'

/** Default chat model */
export const DEFAULT_MODEL = 'claude-sonnet-4-6'

/** Default inline completion model (fast & cheap) */
export const DEFAULT_COMPLETION_MODEL = 'claude-haiku-4-5-20251001'

/**
 * Model → Token Group mapping for Smoothlink multi-token routing.
 * Each group requires a separate API token.
 */
/**
 * Auto-generated from GROUP_TO_MODELS — keep in sync!
 * Models appearing in multiple groups map to the first group listed.
 */
export const MODEL_TO_GROUP: Record<string, string> = {
  // Claude_aws
  'claude-sonnet-4-6': 'Claude_aws',
  'claude-opus-4-6': 'Claude_aws',
  'claude-haiku-4-5-20251001': 'Claude_aws',
  'claude-sonnet-4-5-20250929': 'Claude_aws',
  'claude-opus-4-5-20251101': 'Claude_aws',
  'claude-sonnet-4-20250514': 'Claude_aws',
  'cursor-haik-4-5': 'Claude_aws',
  'cursor-opu-4-5': 'Claude_aws',
  'cursor-opu-4-6': 'Claude_aws',
  'cursor-sonne-4': 'Claude_aws',
  'cursor-sonne-4-5': 'Claude_aws',
  'cursor-sonne-4-6': 'Claude_aws',
  // deepseek_tencent
  'deepseek-r1': 'deepseek_tencent',
  'deepseek-v3': 'deepseek_tencent',
  'deepseek-v3.1': 'deepseek_tencent',
  'deepseek-v3.2': 'deepseek_tencent',
  // gemini_Google
  'gemini-2.5-pro': 'gemini_Google',
  'gemini-2.5-flash': 'gemini_Google',
  'gemini-2.5-flash-image': 'gemini_Google',
  'gemini-2.5-flash-lite': 'gemini_Google',
  'gemini-3-flash-preview': 'gemini_Google',
  'gemini-3-pro-preview': 'gemini_Google',
  'gemini-3.1-flash-lite-preview': 'gemini_Google',
  'gemini-3.1-pro-preview': 'gemini_Google',
  'gemini-embedding-001': 'gemini_Google',
  'gemini-flash-lite-latest': 'gemini_Google',
  // gpt_Azure
  'gpt-5': 'gpt_Azure',
  'gpt-5-codex': 'gpt_Azure',
  'gpt-5.1': 'gpt_Azure',
  'gpt-5.1-codex': 'gpt_Azure',
  'gpt-5.2': 'gpt_Azure',
  'gpt-5.2-codex': 'gpt_Azure',
  'gpt-5.3-codex': 'gpt_Azure',
  'gpt-5.4': 'gpt_Azure',
  'gpt-5.4-pro': 'gpt_Azure',
  // MiniMax
  'M2-her': 'MiniMax',
  'MiniMax-M2.1': 'MiniMax',
  'MiniMax-M2.1-highspeed': 'MiniMax',
  'MiniMax-M2.5-highspeed': 'MiniMax',
  'MiniMax-M2.7': 'MiniMax',
  'MiniMax-M2.7-highspeed': 'MiniMax',
  // aliyun (note: deepseek-v3.2, glm-5, kimi-k2.5, MiniMax-M2.7 already mapped above)
  'qwen3.5-plus': 'aliyun',
  'qwen3.6-plus': 'aliyun',
  // hunyuan_tencent
  'hunyuan-2.0-instruct': 'hunyuan_tencent',
  'hunyuan-2.0-thinking': 'hunyuan_tencent',
  // other_tencent (note: glm-5, kimi-k2.5 already mapped above)
  'glm-5': 'other_tencent',
  'kimi-k2.5': 'other_tencent',
  'minimax-m2.5': 'other_tencent',
  // scnet
  'DeepSeek-R1-0528': 'scnet',
  'DeepSeek-R1-Distill-Llama-70B': 'scnet',
  'DeepSeek-R1-Distill-Qwen-32B': 'scnet',
  'DeepSeek-R1-Distill-Qwen-7B': 'scnet',
  'DeepSeek-V3.2': 'scnet',
  'Qwen3-235B-A22B': 'scnet',
  'Qwen3-235B-A22B-Thinking-2507': 'scnet',
  'Qwen3-30B-A3B': 'scnet',
  'Qwen3-30B-A3B-Instruct-2507': 'scnet',
  'QwQ-32B': 'scnet',
  // scnet-low
  'MiniMax-M2': 'scnet-low',
  'MiniMax-M2.5': 'scnet-low',
  // Echo (note: claude-opus-4-6, gemini-3.1-pro-preview already mapped above)
  // stepfun_openrouter
  'stepfun/step-3.5-flash:free': 'stepfun_openrouter',
}

/**
 * GROUP_TO_MODELS: Complete model list per group (from Smoothlink docs).
 * Used by inferTokenGroup v2 (intersection counting) and UI display.
 */
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

/**
 * Intersection counting algorithm (v2) to infer token group from returned models.
 * Replaces the single-feature v1 approach.
 */
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

  return bestCount > 0 ? bestGroup : 'unknown'
}

/**
 * Token group definitions for UI display and routing.
 * Ordered by usage frequency.
 */
export interface TokenGroupDef {
  id: string
  label: string
  models: string[]
}

export const TOKEN_GROUPS: TokenGroupDef[] = [
  { id: 'Claude_aws', label: 'Claude (AWS)', models: GROUP_TO_MODELS.Claude_aws },
  { id: 'deepseek_tencent', label: 'DeepSeek (腾讯)', models: GROUP_TO_MODELS.deepseek_tencent },
  { id: 'gemini_Google', label: 'Gemini (Google)', models: GROUP_TO_MODELS.gemini_Google },
  { id: 'gpt_Azure', label: 'GPT (Azure)', models: GROUP_TO_MODELS.gpt_Azure },
  { id: 'MiniMax', label: 'MiniMax', models: GROUP_TO_MODELS.MiniMax },
  { id: 'aliyun', label: '阿里云', models: GROUP_TO_MODELS.aliyun },
  { id: 'scnet', label: 'SCNet', models: GROUP_TO_MODELS.scnet },
  { id: 'scnet-low', label: 'SCNet Low', models: GROUP_TO_MODELS['scnet-low'] },
  { id: 'hunyuan_tencent', label: '混元 (腾讯)', models: GROUP_TO_MODELS.hunyuan_tencent },
  { id: 'other_tencent', label: '腾讯其他', models: GROUP_TO_MODELS.other_tencent },
  { id: 'Echo', label: 'Echo', models: GROUP_TO_MODELS.Echo },
  { id: 'stepfun_openrouter', label: 'StepFun (OpenRouter)', models: GROUP_TO_MODELS.stepfun_openrouter },
]

/** Priority order for recommending unconfigured groups */
export const RECOMMENDED_GROUP_ORDER = ['deepseek_tencent', 'gemini_Google', 'gpt_Azure', 'scnet'] as const

/**
 * Fallback "fastest" completion model per group — used for Phase 5D graceful
 * degradation when the configured `linkcode.completionModel` has no token.
 * Ordered by preferred fallback priority.
 */
export const GROUP_FAST_COMPLETION_MODEL: Record<string, string> = {
  Claude_aws: 'claude-haiku-4-5-20251001',
  gemini_Google: 'gemini-2.5-flash-lite',
  deepseek_tencent: 'deepseek-v3',
  gpt_Azure: 'gpt-5.1-codex',
  aliyun: 'qwen3.5-plus',
  'scnet-low': 'MiniMax-M2.5',
  MiniMax: 'MiniMax-M2.1-highspeed',
  hunyuan_tencent: 'hunyuan-2.0-instruct',
  other_tencent: 'glm-5',
  scnet: 'Qwen3-30B-A3B-Instruct-2507',
  Echo: 'claude-opus-4-6',
  stepfun_openrouter: 'stepfun/step-3.5-flash:free',
}

/** Preferred order of degradation fallback. */
export const FAST_COMPLETION_GROUP_PRIORITY = [
  'gemini_Google',
  'deepseek_tencent',
  'gpt_Azure',
  'aliyun',
  'scnet-low',
  'MiniMax',
  'hunyuan_tencent',
  'other_tencent',
  'scnet',
  'stepfun_openrouter',
] as const
