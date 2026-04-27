import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useVSCode } from './useVSCode'

/**
 * Cursor-style chat mode. Mirrors `ChatMode` in `src/shared/types.ts`.
 * Webview keeps its own copy to stay decoupled from the extension build.
 */
export type ChatMode = 'ask' | 'agent' | 'plan'

export interface SessionStats {
  totalTokens: number
  promptTokens: number
  completionTokens: number
  messageCount: number
  estimatedCost: number // claude-sonnet ¥0.015/1K tokens
}

export interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  cost?: string
  savings?: string
  tokenCount?: number
  mode?: ChatMode
}

export interface ModelInfo {
  id: string
  label: string
  provider: string
  tag?: string
}

export interface PricingItemWeb {
  model_name: string
  model_ratio: number
  enable_groups: string[]
  tags?: string
  description?: string
  quota_type?: number
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function useChat() {
  const messages = ref<ChatMsg[]>([])
  const isLoading = ref(false)
  const currentModel = ref('claude-sonnet-4-6')
  const currentMode = ref<ChatMode>('ask')
  const models = ref<ModelInfo[]>([])
  const modelsLoading = ref(true)
  const sessionStats = ref<SessionStats>({
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    messageCount: 0,
    estimatedCost: 0,
  })
  const pricingData = ref<PricingItemWeb[]>([])
  const pricingGroupRatio = ref<Record<string, number>>({})
  const { onMessage, postMessage } = useVSCode()

  let cleanup: (() => void) | undefined
  let historyLoaded = false

  onMounted(() => {
    // Request chat history from extension host on startup
    postMessage({ type: 'getHistory' })
    // Signal ready — extension will send model info
    postMessage({ type: 'ready' })

    cleanup = onMessage((event: MessageEvent) => {
      const msg = event.data as {
        type: string
        content?: string
        message?: string
        action?: string
        payload?: string
        code?: string
        language?: string
        messages?: ChatMsg[]
        models?: ModelInfo[] | PricingItemWeb[]
        modelId?: string
        cost?: string
        savings?: string
        groupRatio?: Record<string, number>
        usage?: {
          prompt_tokens?: number
          completion_tokens?: number
          total_tokens?: number
        }
      }

      switch (msg.type) {
        case 'loadHistory':
          // Restore history from extension globalState
          if (msg.messages && Array.isArray(msg.messages)) {
            messages.value = msg.messages.map((m) => ({
              ...m,
              mode: m.mode ?? 'ask',
            }))
            historyLoaded = true
          }
          break

        case 'modelInfo':
          if (msg.modelId) {
            currentModel.value = msg.modelId
          }
          break

        case 'modelList':
          if (msg.models && Array.isArray(msg.models)) {
            models.value = msg.models as ModelInfo[]
            modelsLoading.value = false
          }
          break

        case 'modelListMerge': {
          // Phase 2: merge newly-validated group models into existing list, dedup by id
          if (msg.models && Array.isArray(msg.models)) {
            const existingIds = new Set(models.value.map((m) => m.id))
            const incoming = msg.models as ModelInfo[]
            const toAdd = incoming.filter((m) => !existingIds.has(m.id))
            if (toAdd.length > 0) {
              models.value = [...models.value, ...toAdd]
            }
            modelsLoading.value = false
          }
          break
        }

        case 'pricingData':
          if (msg.models && Array.isArray(msg.models)) {
            pricingData.value = msg.models as PricingItemWeb[]
          }
          if (msg.groupRatio) {
            pricingGroupRatio.value = msg.groupRatio
          }
          break

        case 'chatCleared':
          messages.value = []
          break

        case 'stream_start':
          // Extension is about to stream — create an empty assistant bubble
          // Snapshot the currently-active mode so ChatMessage can render
          // mode-specific affordances (e.g. PlanActions) when it finishes.
          isLoading.value = true
          messages.value.push({
            id: generateId(),
            role: 'assistant',
            content: '',
            mode: currentMode.value,
          })
          break

        case 'stream_chunk': {
          // Append token to the last assistant message
          const lastMsg = messages.value[messages.value.length - 1]
          if (!lastMsg || lastMsg.role !== 'assistant') {
            messages.value.push({
              id: generateId(),
              role: 'assistant',
              content: '',
              mode: currentMode.value,
            })
          }
          const current = messages.value[messages.value.length - 1]
          current.content += msg.content ?? ''
          break
        }

        case 'stream_end':
          isLoading.value = false
          // Accumulate usage stats
          if (msg.usage) {
            const u = msg.usage
            sessionStats.value.promptTokens += u.prompt_tokens ?? 0
            sessionStats.value.completionTokens += u.completion_tokens ?? 0
            sessionStats.value.totalTokens += u.total_tokens ?? 0
            sessionStats.value.messageCount += 1
            // Estimate cost at ¥0.015/1K tokens (claude-sonnet rate)
            sessionStats.value.estimatedCost = sessionStats.value.totalTokens * 0.015 / 1000
          }
          // Attach cost info if provided
          if (msg.cost) {
            const last = messages.value[messages.value.length - 1]
            if (last && last.role === 'assistant') {
              last.cost = msg.cost
              if (msg.savings) last.savings = msg.savings
            }
          }
          break

        case 'stream_error':
          isLoading.value = false
          // Parse error type for ErrorState component
          if (msg.message) {
            const last = messages.value[messages.value.length - 1]
            if (last && last.role === 'assistant') {
              last.content += `\n\n⚠️ Error: ${msg.message}`
            }
          }
          // Emit error info for App.vue error state detection
          // App.vue listens for show_error via extension host
          break

        case 'user_action':
          // Triggered by CodeLens / command (explain, refactor, etc.)
          // Extension host triggers the API call; stream_start will set isLoading
          messages.value.push({
            id: generateId(),
            role: 'user',
            content: `[${msg.action}]\n${msg.payload ?? ''}`,
          })
          break
      }
    })
  })

  onUnmounted(() => {
    cleanup?.()
  })

  // Persist messages to extension host whenever they change
  watch(
    messages,
    (newMessages) => {
      if (historyLoaded || newMessages.length > 0) {
        postMessage({ type: 'saveMessages', messages: newMessages })
      }
    },
    { deep: true }
  )

  function sendMessage(text: string, mode?: ChatMode) {
    const effectiveMode: ChatMode = mode ?? currentMode.value
    messages.value.push({
      id: generateId(),
      role: 'user',
      content: text,
      mode: effectiveMode,
    })
    isLoading.value = true
  }

  function clearMessages() {
    messages.value = []
  }

  function changeModel(modelId: string) {
    currentModel.value = modelId
  }

  function setMode(mode: ChatMode) {
    currentMode.value = mode
  }

  return {
    messages,
    isLoading,
    currentModel,
    currentMode,
    models,
    modelsLoading,
    sessionStats,
    pricingData,
    pricingGroupRatio,
    sendMessage,
    clearMessages,
    changeModel,
    setMode,
  }
}
