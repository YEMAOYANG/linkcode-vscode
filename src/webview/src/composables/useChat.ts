import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useVSCode } from './useVSCode'

export interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  cost?: string
  savings?: string
  tokenCount?: number
}

export interface ModelInfo {
  id: string
  label: string
  provider: string
  tag?: string
}

/** Fallback model list matching RECOMMENDED_MODELS in constants */
const FALLBACK_MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'Anthropic', tag: '推荐' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', provider: 'Anthropic', tag: '最强推理' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', provider: 'Anthropic', tag: '最快' },
  { id: 'deepseek-r1', label: 'DeepSeek R1', provider: 'DeepSeek', tag: '强推理' },
  { id: 'deepseek-v3', label: 'DeepSeek V3', provider: 'DeepSeek', tag: '性价比' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'Google', tag: '长上下文' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'Google', tag: '快速' },
  { id: 'gpt-5', label: 'GPT-5', provider: 'OpenAI' },
]

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function useChat() {
  const messages = ref<ChatMsg[]>([])
  const isLoading = ref(false)
  const currentModel = ref('claude-sonnet-4-6')
  const models = ref<ModelInfo[]>(FALLBACK_MODELS)
  const modelsLoading = ref(true)
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
        models?: ModelInfo[]
        modelId?: string
        cost?: string
        savings?: string
      }

      switch (msg.type) {
        case 'loadHistory':
          // Restore history from extension globalState
          if (msg.messages && Array.isArray(msg.messages)) {
            messages.value = msg.messages
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
            models.value = msg.models
            modelsLoading.value = false
          }
          break

        case 'chatCleared':
          messages.value = []
          break

        case 'stream_start':
          // Extension is about to stream — create an empty assistant bubble
          isLoading.value = true
          messages.value.push({ id: generateId(), role: 'assistant', content: '' })
          break

        case 'stream_chunk': {
          // Append token to the last assistant message
          const lastMsg = messages.value[messages.value.length - 1]
          if (!lastMsg || lastMsg.role !== 'assistant') {
            messages.value.push({ id: generateId(), role: 'assistant', content: '' })
          }
          const current = messages.value[messages.value.length - 1]
          current.content += msg.content ?? ''
          break
        }

        case 'stream_end':
          isLoading.value = false
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
          // Append error info to the current assistant message
          if (msg.message) {
            const last = messages.value[messages.value.length - 1]
            if (last && last.role === 'assistant') {
              last.content += `\n\n⚠️ Error: ${msg.message}`
            }
          }
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

  function sendMessage(text: string) {
    messages.value.push({ id: generateId(), role: 'user', content: text })
    isLoading.value = true
  }

  function clearMessages() {
    messages.value = []
  }

  function changeModel(modelId: string) {
    currentModel.value = modelId
  }

  return {
    messages,
    isLoading,
    currentModel,
    models,
    modelsLoading,
    sendMessage,
    clearMessages,
    changeModel,
  }
}
