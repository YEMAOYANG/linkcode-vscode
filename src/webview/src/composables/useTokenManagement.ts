import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useVSCode } from './useVSCode'

interface TokenGroupDef {
  id: string
  label: string
  models: string[]
}

const TOKEN_GROUPS: TokenGroupDef[] = [
  { id: 'Claude_aws', label: 'Claude (AWS)', models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101', 'claude-sonnet-4-20250514', 'cursor-haik-4-5', 'cursor-opu-4-5', 'cursor-opu-4-6', 'cursor-sonne-4', 'cursor-sonne-4-5', 'cursor-sonne-4-6'] },
  { id: 'deepseek_tencent', label: 'DeepSeek (腾讯)', models: ['deepseek-r1', 'deepseek-v3', 'deepseek-v3.1', 'deepseek-v3.2'] },
  { id: 'gemini_Google', label: 'Gemini (Google)', models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-image', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-3.1-flash-lite-preview', 'gemini-3.1-pro-preview', 'gemini-embedding-001', 'gemini-flash-lite-latest'] },
  { id: 'gpt_Azure', label: 'GPT (Azure)', models: ['gpt-5', 'gpt-5-codex', 'gpt-5.1', 'gpt-5.1-codex', 'gpt-5.2', 'gpt-5.2-codex', 'gpt-5.3-codex', 'gpt-5.4', 'gpt-5.4-pro'] },
  { id: 'MiniMax', label: 'MiniMax', models: ['M2-her', 'MiniMax-M2.1', 'MiniMax-M2.1-highspeed', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.7', 'MiniMax-M2.7-highspeed'] },
  { id: 'aliyun', label: '阿里云', models: ['deepseek-v3.2', 'glm-5', 'kimi-k2.5', 'MiniMax-M2.7', 'qwen3.5-plus', 'qwen3.6-plus'] },
  { id: 'scnet', label: 'SCNet', models: ['DeepSeek-R1-0528', 'DeepSeek-R1-Distill-Llama-70B', 'DeepSeek-R1-Distill-Qwen-32B', 'DeepSeek-R1-Distill-Qwen-7B', 'DeepSeek-V3.2', 'Qwen3-235B-A22B', 'Qwen3-235B-A22B-Thinking-2507', 'Qwen3-30B-A3B', 'Qwen3-30B-A3B-Instruct-2507', 'QwQ-32B'] },
  { id: 'scnet-low', label: 'SCNet Low', models: ['MiniMax-M2', 'MiniMax-M2.5'] },
  { id: 'hunyuan_tencent', label: '混元 (腾讯)', models: ['hunyuan-2.0-instruct', 'hunyuan-2.0-thinking'] },
  { id: 'other_tencent', label: '腾讯其他', models: ['glm-5', 'kimi-k2.5', 'minimax-m2.5'] },
  { id: 'Echo', label: 'Echo', models: ['claude-opus-4-6', 'gemini-3.1-pro-preview'] },
  { id: 'stepfun_openrouter', label: 'StepFun (OpenRouter)', models: ['stepfun/step-3.5-flash:free'] },
]

/** Priority order for unconfigured groups display */
const PRIORITY_GROUPS = ['deepseek_tencent', 'gemini_Google', 'gpt_Azure', 'scnet']

export function useTokenManagement(highlightGroupProp?: () => string | undefined) {
  const { postMessage, onMessage } = useVSCode()

  const groupTokens = ref<Record<string, string>>({})
  const groupTokenStatus = ref<Record<string, boolean>>({})
  const groupEditing = ref<Record<string, boolean>>({})
  const groupValidating = ref<Record<string, boolean>>({})
  const groupValidationResult = ref<Record<string, { success: boolean; message: string }>>({})
  const highlightedGroup = ref<string | undefined>(undefined)
  const showAllUnconfigured = ref(false)
  const confirmDeleteGroup = ref<string | undefined>(undefined)

  // Quick start state
  const quickStartToken = ref('')
  const quickStartDetecting = ref(false)
  const quickStartResult = ref<{ group: string; models: string[] } | null>(null)

  const configuredGroups = computed(() =>
    TOKEN_GROUPS.filter(g => groupTokenStatus.value[g.id])
  )

  const unconfiguredGroups = computed(() => {
    const unconfigured = TOKEN_GROUPS.filter(g => !groupTokenStatus.value[g.id])
    // Sort: priority groups first
    return unconfigured.sort((a, b) => {
      const aIdx = PRIORITY_GROUPS.indexOf(a.id)
      const bIdx = PRIORITY_GROUPS.indexOf(b.id)
      const aPriority = aIdx >= 0 ? aIdx : 100
      const bPriority = bIdx >= 0 ? bIdx : 100
      return aPriority - bPriority
    })
  })

  const visibleUnconfiguredGroups = computed(() =>
    showAllUnconfigured.value ? unconfiguredGroups.value : unconfiguredGroups.value.slice(0, 4)
  )

  const hasMoreUnconfigured = computed(() =>
    unconfiguredGroups.value.length > 4 && !showAllUnconfigured.value
  )

  let cleanup: (() => void) | undefined

  function setupListeners(): void {
    postMessage({ type: 'getGroupTokenStatus' })
    cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data as {
        type: string
        tokens?: Record<string, boolean>
        group?: string
        success?: boolean
        message?: string
        models?: string[]
      }
      if (msg.type === 'groupTokenStatus' && msg.tokens) {
        groupTokenStatus.value = msg.tokens
      }
      if (msg.type === 'groupTokenValidated' && msg.group) {
        handleValidationResponse(msg)
      }
    })
  }

  function handleValidationResponse(msg: {
    group?: string
    success?: boolean
    message?: string
    models?: string[]
  }): void {
    if (!msg.group) return
    groupValidating.value[msg.group] = false

    if (msg.success) {
      groupValidationResult.value[msg.group] = { success: true, message: '✓ Token 有效' }
      groupTokenStatus.value[msg.group] = true
      groupEditing.value[msg.group] = false

      // Quick start detection
      if (quickStartDetecting.value && msg.models) {
        const detectedGroup = inferGroupFromModels(msg.models)
        if (detectedGroup) {
          quickStartResult.value = { group: detectedGroup, models: msg.models }
        }
        quickStartDetecting.value = false
      }
    } else {
      groupValidationResult.value[msg.group] = {
        success: false,
        message: `✗ 验证失败: ${msg.message || '请检查 Token'}`,
      }
    }
  }

  function inferGroupFromModels(modelIds: string[]): string | undefined {
    const counts: Record<string, number> = {}
    for (const id of modelIds) {
      for (const group of TOKEN_GROUPS) {
        if (group.models.includes(id)) {
          counts[group.id] = (counts[group.id] ?? 0) + 1
        }
      }
    }
    let maxGroup: string | undefined
    let maxCount = 0
    for (const [group, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; maxGroup = group }
    }
    return maxGroup
  }

  function startEditing(groupId: string): void {
    groupEditing.value[groupId] = true
    groupValidationResult.value[groupId] = undefined as never
  }

  function cancelEditing(groupId: string): void {
    groupEditing.value[groupId] = false
    groupTokens.value[groupId] = ''
    groupValidationResult.value[groupId] = undefined as never
  }

  function saveGroupToken(groupId: string): void {
    const token = groupTokens.value[groupId]?.trim()
    if (!token) return
    postMessage({ type: 'setGroupToken', group: groupId, token })
    groupValidating.value[groupId] = true
    postMessage({ type: 'validateGroupToken', group: groupId, token })
  }

  function deleteGroupToken(groupId: string): void {
    postMessage({ type: 'deleteGroupToken', group: groupId })
    groupTokenStatus.value[groupId] = false
    groupEditing.value[groupId] = false
    groupTokens.value[groupId] = ''
    confirmDeleteGroup.value = undefined
  }

  function maskToken(): string {
    return 'sk-****...****'
  }

  function handleQuickStart(): void {
    const token = quickStartToken.value.trim()
    if (!token) return
    quickStartDetecting.value = true
    quickStartResult.value = null
    postMessage({ type: 'validateGroupToken', group: '_detect', token })
    postMessage({ type: 'setApiKey', key: token })
  }

  function applyQuickStartToGroup(): void {
    if (!quickStartResult.value) return
    const group = quickStartResult.value.group
    const token = quickStartToken.value.trim()
    if (!token) return
    postMessage({ type: 'setGroupToken', group, token })
    groupTokenStatus.value[group] = true
    quickStartToken.value = ''
    quickStartResult.value = null
  }

  function openSmoothlink(): void {
    postMessage({ type: 'openExternal', url: 'https://smoothlink.ai' })
  }

  function applyHighlight(group: string | undefined): void {
    if (!group) return
    highlightedGroup.value = group
    setTimeout(() => { highlightedGroup.value = undefined }, 2000)
  }

  onMounted(() => {
    setupListeners()
    if (highlightGroupProp) {
      applyHighlight(highlightGroupProp())
    }
  })

  onUnmounted(() => {
    cleanup?.()
  })

  return {
    TOKEN_GROUPS,
    groupTokens,
    groupTokenStatus,
    groupEditing,
    groupValidating,
    groupValidationResult,
    highlightedGroup,
    showAllUnconfigured,
    confirmDeleteGroup,
    configuredGroups,
    unconfiguredGroups,
    visibleUnconfiguredGroups,
    hasMoreUnconfigured,
    quickStartToken,
    quickStartDetecting,
    quickStartResult,
    startEditing,
    cancelEditing,
    saveGroupToken,
    deleteGroupToken,
    maskToken,
    handleQuickStart,
    applyQuickStartToGroup,
    openSmoothlink,
    applyHighlight,
  }
}
